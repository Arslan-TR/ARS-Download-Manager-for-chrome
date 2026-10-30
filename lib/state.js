// Settings live in storage.local (survive restarts). The set of downloads we
// paused lives in storage.session so a restarted service worker can tell its
// own pauses apart from the user's.

export const DEFAULT_SETTINGS = {
  enabled: false,
  limitBps: 2 * 1024 * 1024,
  unit: 'MBps',
  mode: 'share', // 'share' | 'sequential'
  perFile: {}, // downloadId -> bytes/s
};

export async function loadSettings() {
  const { settings } = await chrome.storage.local.get('settings');
  return { ...DEFAULT_SETTINGS, ...settings, perFile: { ...settings?.perFile } };
}

export async function saveSettings(settings) {
  await chrome.storage.local.set({ settings });
}

export async function loadOurPaused() {
  const { ourPaused } = await chrome.storage.session.get('ourPaused');
  return Array.isArray(ourPaused) ? ourPaused : [];
}

export async function saveOurPaused(ids) {
  await chrome.storage.session.set({ ourPaused: [...ids] });
}
