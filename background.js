import { createEngine, planTick, TICK_MS } from './lib/throttle.js';
import { badgeText } from './lib/units.js';
import { loadSettings, saveSettings, loadOurPaused, saveOurPaused } from './lib/state.js';

const engine = createEngine();
let settings = null;
let lastPlan = null;
let timer = null;
let savedPaused = '';
// Downloads we already tried to revive after an interruption.
const revived = new Set();

const ready = init();

async function init() {
  settings = await loadSettings();
  for (const id of await loadOurPaused()) engine.ourPaused.add(id);
  savedPaused = JSON.stringify([...engine.ourPaused]);
  await dropStalePerFile();
  updateBadge();
}

// The tick loop runs while there is anything to watch. Each tick calls
// chrome.downloads.search, which also keeps the service worker alive.
function kick() {
  if (timer == null) timer = setTimeout(tick, 0);
}

async function tick() {
  let busy = true;
  try {
    await ready;
    const downloads = await chrome.downloads.search({ state: 'in_progress' });
    const plan = planTick(engine, downloads, settings, Date.now());
    lastPlan = plan;
    await Promise.allSettled([
      ...plan.pause.map((id) => chrome.downloads.pause(id).catch(() => engine.ourPaused.delete(id))),
      ...plan.resume.map((id) => chrome.downloads.resume(id).catch(() => {})),
    ]);
    if (plan.forget.some((id) => id in settings.perFile)) await dropStalePerFile();
    await persistOurPaused();
    busy = downloads.length > 0 || engine.ourPaused.size > 0;
  } catch (e) {
    console.warn('tick failed', e);
  } finally {
    // Always reschedule (or clear), so a failure can't wedge the loop.
    timer = busy ? setTimeout(tick, TICK_MS) : null;
  }
}

async function persistOurPaused() {
  const now = JSON.stringify([...engine.ourPaused]);
  if (now === savedPaused) return;
  savedPaused = now;
  await saveOurPaused(engine.ourPaused);
}

async function dropStalePerFile() {
  const ids = Object.keys(settings.perFile);
  if (ids.length === 0) return;
  const live = new Set((await chrome.downloads.search({ state: 'in_progress' })).map((d) => String(d.id)));
  const kept = Object.fromEntries(Object.entries(settings.perFile).filter(([id]) => live.has(id)));
  if (Object.keys(kept).length !== ids.length) await updateSettings({ perFile: kept });
}

async function updateSettings(patch) {
  settings = { ...settings, ...patch };
  await saveSettings(settings);
  updateBadge();
  kick();
}

function updateBadge() {
  const on = settings.enabled && settings.limitBps > 0;
  chrome.action.setBadgeText({ text: on ? badgeText(settings.limitBps) : '' });
  chrome.action.setBadgeBackgroundColor({ color: '#2563eb' });
  chrome.action.setBadgeTextColor?.({ color: '#ffffff' });
}

async function getState() {
  await ready;
  const downloads = await chrome.downloads.search({ state: 'in_progress', orderBy: ['startTime'] });
  return {
    settings,
    totalSpeed: lastPlan?.totalSpeed ?? 0,
    totalInstant: lastPlan?.totalInstant ?? 0,
    downloads: downloads.map((d) => {
      const s = lastPlan?.stats.get(d.id);
      return {
        id: d.id,
        filename: d.filename,
        url: d.finalUrl || d.url,
        totalBytes: d.totalBytes,
        bytesReceived: d.bytesReceived,
        paused: d.paused,
        estimatedEndTime: d.estimatedEndTime ?? null,
        role: s?.role ?? (d.paused ? 'userPaused' : 'free'),
        speed: s?.speed ?? 0,
        allocation: s?.allocation ?? null,
        perFileBps: settings.perFile[d.id] ?? null,
      };
    }),
  };
}

async function control(op, id) {
  const targets =
    id != null ? [id] : (await chrome.downloads.search({ state: 'in_progress' })).map((d) => d.id);
  await Promise.allSettled(
    targets.map((t) => {
      // A pause or resume from the popup is the user's: drop any pause of
      // ours so the engine treats the download accordingly.
      engine.ourPaused.delete(t);
      if (op === 'pause') return chrome.downloads.pause(t);
      if (op === 'resume') return chrome.downloads.resume(t);
      if (op === 'cancel') return chrome.downloads.cancel(t);
      return null;
    }),
  );
  await persistOurPaused();
  kick();
}

async function handleMessage(msg) {
  await ready;
  switch (msg?.type) {
    case 'getState':
      return getState();
    case 'setSettings': {
      const patch = {};
      if (typeof msg.enabled === 'boolean') patch.enabled = msg.enabled;
      if (Number.isFinite(msg.limitBps) && msg.limitBps > 0) patch.limitBps = msg.limitBps;
      if (['KBps', 'MBps', 'Mbps'].includes(msg.unit)) patch.unit = msg.unit;
      if (['share', 'sequential'].includes(msg.mode)) patch.mode = msg.mode;
      await updateSettings(patch);
      return getState();
    }
    case 'setPerFile': {
      const perFile = { ...settings.perFile };
      if (Number.isFinite(msg.bps) && msg.bps > 0) perFile[msg.id] = msg.bps;
      else delete perFile[msg.id];
      await updateSettings({ perFile });
      return getState();
    }
    case 'control':
      await control(msg.op, msg.id ?? null);
      return getState();
    default:
      return { error: 'unknown message' };
  }
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  handleMessage(msg).then(sendResponse, (e) => sendResponse({ error: String(e) }));
  return true;
});

chrome.downloads.onCreated.addListener(kick);
chrome.downloads.onChanged.addListener(async (delta) => {
  kick();
  // A long pause of ours may have made the server drop the connection.
  // Try to pick the download back up once.
  if (delta.state?.current === 'interrupted' && engine.items.has(delta.id) && !revived.has(delta.id)) {
    const wasOurs = engine.ourPaused.has(delta.id) || lastPlan?.stats.get(delta.id)?.role !== 'userPaused';
    const [d] = await chrome.downloads.search({ id: delta.id });
    if (wasOurs && d?.canResume) {
      revived.add(delta.id);
      chrome.downloads.resume(delta.id).catch(() => {});
    }
  }
});

chrome.storage.onChanged.addListener(async (changes, area) => {
  if (area === 'local' && changes.settings) {
    settings = await loadSettings();
    updateBadge();
    kick();
  }
});

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create('watchdog', { periodInMinutes: 0.5 });
  kick();
});
chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create('watchdog', { periodInMinutes: 0.5 });
  kick();
});
chrome.alarms.onAlarm.addListener(kick);

kick();
