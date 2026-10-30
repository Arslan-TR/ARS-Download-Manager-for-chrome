import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createEngine, planTick, waterFill, snailRate, TICK_MS, MAX_PAUSE_S } from '../lib/throttle.js';

const MB = 1024 * 1024;
const KB = 1024;
const STEP_MS = 10;

/**
 * Download simulator modelled on what Chrome was measured to do:
 * - bytesReceived is published every `reportMs` (~500 ms) while running, on
 *   a timer that restarts on resume; nothing is published while paused;
 * - after a pause the sender keeps filling socket/pipe buffers up to
 *   `backlog`, which Chrome takes in all at once on resume;
 * - running downloads share `lineRate`.
 * Decisions are applied the way background.js applies them.
 */
function simulate({ downloads, settings, seconds, lineRate = 20 * MB, userPaused = [], reportMs = 500, backlog = 2 * MB }) {
  const engine = createEngine();
  const items = downloads.map((d, i) => ({
    id: d.id ?? i + 1,
    state: 'in_progress',
    paused: userPaused.includes(d.id ?? i + 1),
    bytesReceived: 0,
    actual: 0,
    buffer: 0,
    sinceReport: 0,
    totalBytes: d.totalBytes ?? 10_000 * MB,
    startTime: d.startTime ?? new Date(Date.UTC(2026, 0, 1, 0, 0, i)).toISOString(),
    serverRate: d.serverRate ?? Infinity,
  }));
  const byId = (id) => items.find((d) => d.id === id);
  const log = [];
  const pausedFor = new Map(); // id -> longest stretch paused by us, ms
  const stretch = new Map();
  const start = 1_000_000;
  for (let now = start; now < start + seconds * 1000; now += STEP_MS) {
    if ((now - start) % TICK_MS === 0) {
      const plan = planTick(engine, items, settings, now);
      for (const id of plan.pause) byId(id).paused = true;
      for (const id of plan.resume) {
        byId(id).paused = false;
        byId(id).sinceReport = 0;
      }
      log.push(plan);
    }
    const filling = items.filter((d) => !d.paused || d.buffer < backlog);
    for (const d of items) {
      const share = Math.min(lineRate / Math.max(1, filling.length), d.serverRate) * (STEP_MS / 1000);
      if (d.paused) {
        d.buffer = Math.min(backlog, d.buffer + share);
      } else {
        d.actual += d.buffer + share;
        d.buffer = 0;
        d.sinceReport += STEP_MS;
        if (d.sinceReport >= reportMs) {
          d.bytesReceived = d.actual;
          d.sinceReport = 0;
        }
      }
      const ours = d.paused && engine.ourPaused.has(d.id);
      stretch.set(d.id, ours ? (stretch.get(d.id) ?? 0) + STEP_MS : 0);
      pausedFor.set(d.id, Math.max(pausedFor.get(d.id) ?? 0, stretch.get(d.id)));
    }
  }
  return { items, engine, log, pausedFor };
}

const avg = (item, seconds) => item.actual / seconds;

test('waterFill splits capacity equally when demand is unlimited', () => {
  const a = waterFill(9, [{ id: 1, demand: Infinity }, { id: 2, demand: Infinity }, { id: 3, demand: Infinity }]);
  assert.deepEqual([a.get(1), a.get(2), a.get(3)], [3, 3, 3]);
});

test('waterFill hands unused share to the others', () => {
  const a = waterFill(9, [{ id: 1, demand: 1 }, { id: 2, demand: Infinity }, { id: 3, demand: Infinity }]);
  assert.equal(a.get(1), 1);
  assert.equal(a.get(2), 4);
  assert.equal(a.get(3), 4);
});

test('snailRate has a floor and scales with the limit', () => {
  assert.equal(snailRate(100 * KB), 8 * KB);
  assert.equal(snailRate(10 * MB), 0.02 * 10 * MB);
});

test('disabled limiter never pauses anything', () => {
  const { log } = simulate({
    downloads: [{}],
    settings: { enabled: false, limitBps: 1 * MB, mode: 'share', perFile: {} },
    seconds: 5,
  });
  assert.ok(log.every((p) => p.pause.length === 0));
});

test('single download is held near the global limit', () => {
  const seconds = 30;
  const { items } = simulate({
    downloads: [{}],
    settings: { enabled: true, limitBps: 2 * MB, mode: 'share', perFile: {} },
    seconds,
  });
  const rate = avg(items[0], seconds);
  assert.ok(rate > 1.7 * MB && rate < 2.3 * MB, `rate ${rate / MB} MB/s`);
});

test('a download slower than the limit is never paused', () => {
  const { log } = simulate({
    downloads: [{ serverRate: 1 * MB }],
    settings: { enabled: true, limitBps: 5 * MB, mode: 'share', perFile: {} },
    seconds: 10,
  });
  assert.ok(log.every((p) => p.pause.length === 0));
});

test('share mode splits the limit roughly equally', () => {
  const seconds = 30;
  const { items } = simulate({
    downloads: [{}, {}],
    settings: { enabled: true, limitBps: 4 * MB, mode: 'share', perFile: {} },
    seconds,
  });
  const [a, b] = items.map((d) => avg(d, seconds));
  assert.ok(a + b < 4.6 * MB && a + b > 3.4 * MB, `total ${(a + b) / MB}`);
  assert.ok(Math.abs(a - b) < 0.5 * MB, `a=${a / MB} b=${b / MB}`);
});

test('share mode gives a slow download\'s unused share to the fast one', () => {
  const seconds = 30;
  const { items } = simulate({
    downloads: [{ serverRate: 0.5 * MB }, {}],
    settings: { enabled: true, limitBps: 4 * MB, mode: 'share', perFile: {} },
    seconds,
  });
  const fast = avg(items[1], seconds);
  assert.ok(fast > 2.8 * MB, `fast got only ${fast / MB} MB/s`);
  assert.ok(avg(items[0], seconds) + fast < 4.6 * MB);
});

test('sequential mode: head gets the bandwidth, the queue crawls but never stops', () => {
  const seconds = 30;
  const { items, log } = simulate({
    downloads: [{}, {}, {}],
    settings: { enabled: true, limitBps: 4 * MB, mode: 'sequential', perFile: {} },
    seconds,
  });
  const [head, q1, q2] = items.map((d) => avg(d, seconds));
  assert.ok(head > 2.5 * MB, `head ${head / MB}`);
  assert.ok(q1 > 0 && q2 > 0, 'queued downloads must keep moving (snail mode)');
  assert.ok(q1 < head / 3 && q2 < head / 3, `queue too fast q1=${q1 / MB} q2=${q2 / MB}`);
  const last = log.at(-1);
  assert.equal(last.stats.get(1).role, 'head');
  assert.equal(last.stats.get(2).role, 'snail');
  assert.equal(last.stats.get(3).role, 'snail');
});

test('no download stays paused longer than MAX_PAUSE_S (keeps connections alive)', () => {
  const { pausedFor } = simulate({
    downloads: [{}, {}],
    settings: { enabled: true, limitBps: 64 * KB, mode: 'sequential', perFile: {} },
    seconds: 60,
    lineRate: 50 * MB,
  });
  for (const id of [1, 2]) {
    assert.ok(pausedFor.get(id) <= (MAX_PAUSE_S + 1) * 1000, `id ${id} paused ${pausedFor.get(id)}ms`);
  }
});

test('limit holds despite stale reports and socket backlog', () => {
  const seconds = 60;
  for (const lineRate of [8 * MB, 16 * MB, 25 * MB]) {
    const { items } = simulate({
      downloads: [{}],
      settings: { enabled: true, limitBps: 2 * MB, mode: 'share', perFile: {} },
      seconds,
      lineRate,
    });
    const rate = avg(items[0], seconds);
    assert.ok(rate > 1.7 * MB && rate < 2.3 * MB, `line ${lineRate / MB} MB/s -> ${(rate / MB).toFixed(2)} MB/s`);
  }
});


test('sequential mode promotes the next download when the head finishes', () => {
  const engine = createEngine();
  const settings = { enabled: true, limitBps: 4 * MB, mode: 'sequential', perFile: {} };
  const d1 = { id: 1, state: 'in_progress', paused: false, bytesReceived: 0, totalBytes: 100, startTime: '2026-01-01T00:00:00Z' };
  const d2 = { id: 2, state: 'in_progress', paused: false, bytesReceived: 0, totalBytes: 100, startTime: '2026-01-01T00:00:05Z' };
  let plan = planTick(engine, [d1, d2], settings, 0);
  assert.equal(plan.stats.get(1).role, 'head');
  plan = planTick(engine, [d2], settings, TICK_MS);
  assert.equal(plan.stats.get(2).role, 'head');
});

// Per-file caps are tested at realistic line/cap ratios. Far lower caps on
// far faster lines are exceeded by design (see MAX_PAUSE_S).
test('per-file limit applies with the global limiter off', () => {
  const seconds = 60;
  const { items } = simulate({
    downloads: [{ id: 1 }, { id: 2 }],
    settings: { enabled: false, limitBps: 4 * MB, mode: 'share', perFile: { 1: 1 * MB } },
    seconds,
    lineRate: 8 * MB,
  });
  const a = avg(items[0], seconds);
  assert.ok(a > 0.8 * MB && a < 1.2 * MB, `limited ${a / MB}`);
  assert.ok(avg(items[1], seconds) > 5 * MB, 'unlimited download must run free');
});

test('per-file limit below the fair share frees bandwidth for others', () => {
  const seconds = 60;
  const { items } = simulate({
    downloads: [{ id: 1 }, { id: 2 }],
    settings: { enabled: true, limitBps: 4 * MB, mode: 'share', perFile: { 1: 0.5 * MB } },
    seconds,
    lineRate: 8 * MB,
  });
  const a = avg(items[0], seconds);
  const b = avg(items[1], seconds);
  assert.ok(a < 0.7 * MB, `capped ${a / MB}`);
  assert.ok(b > 3 * MB, `other ${b / MB}`);
});

test('a download paused by the user is never resumed', () => {
  const { log, items } = simulate({
    downloads: [{ id: 1 }, { id: 2 }],
    settings: { enabled: true, limitBps: 2 * MB, mode: 'share', perFile: {} },
    seconds: 10,
    userPaused: [1],
  });
  assert.ok(log.every((p) => !p.resume.includes(1)));
  assert.equal(items[0].bytesReceived, 0);
  assert.equal(log.at(-1).stats.get(1).role, 'userPaused');
});

test('turning the limiter off resumes everything we paused', () => {
  const engine = createEngine();
  const on = { enabled: true, limitBps: 1 * MB, mode: 'share', perFile: {} };
  const d = { id: 7, state: 'in_progress', paused: false, bytesReceived: 0, totalBytes: 1e9, startTime: '2026-01-01T00:00:00Z' };
  planTick(engine, [d], on, 0);
  d.bytesReceived = 10 * MB; // blew far past the bucket
  const p1 = planTick(engine, [d], on, TICK_MS);
  assert.deepEqual(p1.pause, [7]);
  d.paused = true;
  const p2 = planTick(engine, [d], { ...on, enabled: false }, 2 * TICK_MS);
  assert.deepEqual(p2.resume, [7]);
  assert.equal(engine.ourPaused.size, 0);
});

test('a download resumed externally is taken back under management', () => {
  const engine = createEngine();
  const on = { enabled: true, limitBps: 1 * MB, mode: 'share', perFile: {} };
  const d = { id: 3, state: 'in_progress', paused: false, bytesReceived: 0, totalBytes: 1e9, startTime: '2026-01-01T00:00:00Z' };
  planTick(engine, [d], on, 0);
  d.bytesReceived = 10 * MB;
  planTick(engine, [d], on, TICK_MS);
  assert.ok(engine.ourPaused.has(3));
  // User hits "resume" on chrome://downloads: item is running though we paused it.
  const p = planTick(engine, [d], on, 2 * TICK_MS);
  assert.equal(p.stats.get(3).role, 'throttled');
  assert.ok(p.pause.includes(3), 'still over budget, so it is paused again');
});

test('finished downloads are forgotten', () => {
  const engine = createEngine();
  const on = { enabled: true, limitBps: 1 * MB, mode: 'share', perFile: {} };
  const d = { id: 9, state: 'in_progress', paused: false, bytesReceived: 0, totalBytes: 1e9, startTime: '2026-01-01T00:00:00Z' };
  planTick(engine, [d], on, 0);
  d.bytesReceived = 10 * MB;
  planTick(engine, [d], on, TICK_MS);
  const p = planTick(engine, [], on, 2 * TICK_MS);
  assert.deepEqual(p.forget, [9]);
  assert.equal(engine.items.size, 0);
  assert.equal(engine.ourPaused.size, 0);
});
