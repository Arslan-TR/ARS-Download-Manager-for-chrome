// Speed units offered in the popup, as bytes per second per unit.
export const UNITS = {
  KBps: 1024,
  MBps: 1024 * 1024,
  Mbps: 1_000_000 / 8,
};

export function toBps(value, unit) {
  const factor = UNITS[unit];
  const n = Number(value);
  if (!factor || !Number.isFinite(n) || n <= 0) return null;
  return Math.round(n * factor);
}

export function fromBps(bps, unit) {
  const factor = UNITS[unit] ?? UNITS.MBps;
  return Math.round((bps / factor) * 100) / 100;
}

const SIZE_STEPS = ['B', 'KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '?';
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < SIZE_STEPS.length - 1) {
    v /= 1024;
    i++;
  }
  if (i === 0) return `${Math.round(v)} B`;
  const digits = i >= 3 ? 2 : 1;
  return `${v.toFixed(digits)} ${SIZE_STEPS[i]}`;
}

export function formatSpeed(bps) {
  return `${formatBytes(bps)}/s`;
}

export function formatEta(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '∞';
  const s = Math.round(seconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s % 60}s`;
  return `${s}s`;
}

// Toolbar badges fit about four characters.
export function badgeText(bps) {
  const mb = bps / UNITS.MBps;
  if (mb >= 1) return `${mb >= 10 ? Math.round(mb) : Math.round(mb * 10) / 10}M`;
  return `${Math.max(1, Math.round(bps / UNITS.KBps))}K`;
}
