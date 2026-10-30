// Pure throttling logic. No chrome.* calls here: planTick() looks at the
// current download list and decides which downloads to pause or resume.
// background.js applies those decisions with chrome.downloads.pause/resume.
//
// How it limits speed: every download that is being limited gets a token
// bucket refilled at its allocated rate. Bytes received are taken out of the
// bucket; when it runs dry the download is paused, and resumed once the bucket
// has refilled a little. Chrome's pause only stops reading from the socket,
// so pauses throttle the sender via TCP flow control without dropping the
// connection.
//
// Measured Chrome behaviour this is tuned for:
// - bytesReceived is published about every 500 ms while running, on a timer
//   that restarts on resume (runs shorter than that report nothing);
// - after a pause the sender keeps going until socket and pipe buffers are
//   full (several MB), and every resume drains them.
// So each run moves a burst of several MB no matter how short it is. We let
// runs last until Chrome reports them and repay the burst with a pause.

export const TICK_MS = 200;
// Bucket size, in seconds of allocated rate. Must cover Chrome's ~500 ms
// reporting period or steady downloads get paused needlessly.
export const BURST_S = 1;
// Resume once the bucket is refilled to this fraction of its size.
export const RESUME_FRACTION = 0.25;
// A download is never kept paused much longer than this, so servers don't
// drop the connection (common send timeouts are 60 s). Debt beyond this is
// forgiven, which means very low limits on very fast lines are exceeded.
export const MAX_PAUSE_S = 15;
export const MIN_BUCKET_BYTES = 16 * 1024;
// Queued downloads in sequential mode crawl at this rate instead of stopping.
export const SNAIL_MIN_BPS = 8 * 1024;
export const SNAIL_FRACTION = 0.02;
// The head download in sequential mode always keeps at least this share.
const HEAD_MIN_FRACTION = 0.25;
// Short window: tells whether a download that runs unhindered is limited by
// its server. Long window: shown speed, spans several pause/resume cycles.
const SPEED_WINDOW_MS = 2000;
const AVG_WINDOW_MS = 20000;
// Headroom over a measured rate before we call a download server-limited
// and hand its unused share to others.
const DEMAND_HEADROOM = 1.25;

export function createEngine() {
  return {
    items: new Map(), // id -> per-download record
    ourPaused: new Set(), // ids paused by us (anything else paused = user)
    lastTick: null,
  };
}

export function snailRate(limitBps) {
  return Math.max(SNAIL_MIN_BPS, limitBps * SNAIL_FRACTION);
}

// Max-min fair split of `capacity` among entries with a `demand` cap.
export function waterFill(capacity, entries) {
  const sorted = [...entries].sort((a, b) => a.demand - b.demand);
  const out = new Map();
  let remaining = capacity;
  sorted.forEach((e, i) => {
    const share = remaining / (sorted.length - i);
    const a = Math.min(e.demand, share);
    out.set(e.id, a);
    remaining -= a;
  });
  return out;
}

function perFileLimit(settings, id) {
  const v = settings.perFile?.[id];
  return Number.isFinite(v) && v > 0 ? v : null;
}

// What a download could use if we let it. Only a download that has run
// unhindered for a whole window tells us; anything we keep pausing wants
// more than it gets.
function demandOf(rec, now, cap) {
  const unhindered = rec.runningSince != null && now - rec.runningSince >= SPEED_WINDOW_MS;
  return Math.min(unhindered ? rec.speed * DEMAND_HEADROOM : Infinity, cap ?? Infinity);
}

function newRecord(d, now) {
  return {
    lastBytes: d.bytesReceived,
    samples: [[now, d.bytesReceived]],
    speed: 0,
    avgSpeed: 0,
    delta: 0,
    tokens: null,
    runningSince: d.paused ? null : now,
  };
}

function measure(rec, d, now) {
  const delta = Math.max(0, d.bytesReceived - rec.lastBytes);
  rec.lastBytes = d.bytesReceived;
  rec.delta = delta;
  rec.samples.push([now, d.bytesReceived]);
  while (rec.samples.length > 2 && now - rec.samples[1][0] >= AVG_WINDOW_MS) rec.samples.shift();
  const rateSince = ([t, b]) => (now > t ? Math.max(0, d.bytesReceived - b) / ((now - t) / 1000) : 0);
  rec.avgSpeed = rateSince(rec.samples[0]);
  rec.speed = rateSince(rec.samples.find(([t]) => now - t <= SPEED_WINDOW_MS) ?? rec.samples.at(-1));
}

/**
 * @param engine   state from createEngine(), mutated in place
 * @param downloads chrome.downloads items currently in_progress
 * @param settings {enabled, limitBps, mode: 'share'|'sequential', perFile: {id: bps}}
 * @param now      ms timestamp
 * @returns {pause: id[], resume: id[], forget: id[],
 *           stats: Map<id, {role, allocation, speed, instantSpeed, pausedByUs}>,
 *           totalSpeed, totalInstant}
 */
export function planTick(engine, downloads, settings, now) {
  const dt = engine.lastTick == null ? 0 : Math.min(2, Math.max(0, (now - engine.lastTick) / 1000));
  engine.lastTick = now;

  const pause = [];
  const resume = [];
  const forget = [];
  const stats = new Map();

  const live = downloads.filter((d) => d.state === 'in_progress');
  const liveIds = new Set(live.map((d) => d.id));
  for (const id of engine.items.keys()) {
    if (!liveIds.has(id)) {
      engine.items.delete(id);
      engine.ourPaused.delete(id);
      forget.push(id);
    }
  }
  for (const id of engine.ourPaused) {
    if (!liveIds.has(id)) engine.ourPaused.delete(id);
  }

  for (const d of live) {
    let rec = engine.items.get(d.id);
    if (!rec) {
      rec = newRecord(d, now);
      engine.items.set(d.id, rec);
    }
    measure(rec, d, now);
    if (d.paused) rec.runningSince = null;
    else if (rec.runningSince == null) rec.runningSince = now;
    // Paused by us, but running now: someone resumed it outside the
    // extension. It stays under management; forget our pause.
    if (engine.ourPaused.has(d.id) && !d.paused) engine.ourPaused.delete(d.id);
  }

  const managed = live.filter((d) => !(d.paused && !engine.ourPaused.has(d.id)));
  const userPaused = live.filter((d) => d.paused && !engine.ourPaused.has(d.id));

  // Allocate a rate (bytes/s) to each managed download; null = unlimited.
  const alloc = new Map();
  const roles = new Map();
  if (settings.enabled && settings.limitBps > 0) {
    const limit = settings.limitBps;
    if (settings.mode === 'sequential' && managed.length > 0) {
      const queue = [...managed].sort((a, b) => String(a.startTime).localeCompare(String(b.startTime)) || a.id - b.id);
      const [head, ...rest] = queue;
      const snail = snailRate(limit);
      let snailUsed = 0;
      for (const d of rest) {
        alloc.set(d.id, snail);
        roles.set(d.id, 'snail');
        snailUsed += engine.items.get(d.id).avgSpeed;
      }
      // Whatever the snails actually pull comes out of the head's budget.
      const headRate = Math.max(limit - snailUsed, limit * HEAD_MIN_FRACTION);
      alloc.set(head.id, Math.min(headRate, perFileLimit(settings, head.id) ?? Infinity));
      roles.set(head.id, 'head');
    } else {
      const fair = waterFill(
        limit,
        managed.map((d) => ({ id: d.id, demand: demandOf(engine.items.get(d.id), now, perFileLimit(settings, d.id)) })),
      );
      for (const d of managed) {
        let a = fair.get(d.id);
        // A per-file cap is a hard limit even if its demand estimate is higher.
        const cap = perFileLimit(settings, d.id);
        if (cap != null) a = Math.min(a, cap);
        alloc.set(d.id, a);
        roles.set(d.id, 'throttled');
      }
    }
  } else {
    for (const d of managed) {
      const cap = perFileLimit(settings, d.id);
      alloc.set(d.id, cap);
      roles.set(d.id, cap != null ? 'throttled' : 'free');
    }
  }

  for (const d of managed) {
    const rec = engine.items.get(d.id);
    const rate = alloc.get(d.id);
    if (rate == null) {
      rec.tokens = null;
      if (engine.ourPaused.has(d.id)) {
        engine.ourPaused.delete(d.id);
        resume.push(d.id);
      }
    } else {
      const size = Math.max(rate * BURST_S, MIN_BUCKET_BYTES);
      if (rec.tokens == null) rec.tokens = size - rec.delta;
      else rec.tokens = Math.min(size, rec.tokens + rate * dt - rec.delta);
      rec.tokens = Math.max(rec.tokens, -rate * MAX_PAUSE_S);
      if (!d.paused && rec.tokens <= 0) {
        engine.ourPaused.add(d.id);
        pause.push(d.id);
      } else if (d.paused && rec.tokens >= size * RESUME_FRACTION) {
        engine.ourPaused.delete(d.id);
        resume.push(d.id);
      }
    }
    stats.set(d.id, {
      role: roles.get(d.id),
      allocation: rate,
      speed: rec.avgSpeed,
      instantSpeed: rec.speed,
      pausedByUs: engine.ourPaused.has(d.id),
    });
  }
  for (const d of userPaused) {
    const rec = engine.items.get(d.id);
    rec.tokens = null;
    stats.set(d.id, { role: 'userPaused', allocation: 0, speed: 0, instantSpeed: 0, pausedByUs: false });
  }

  let totalSpeed = 0;
  let totalInstant = 0;
  for (const s of stats.values()) {
    totalSpeed += s.speed;
    totalInstant += s.instantSpeed;
  }
  return { pause, resume, forget, stats, totalSpeed, totalInstant };
}
