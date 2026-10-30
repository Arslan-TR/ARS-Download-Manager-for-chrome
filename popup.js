import { toBps, fromBps, formatBytes, formatSpeed, formatEta } from './lib/units.js';

const REFRESH_MS = 1000;
const UNIT_LABELS = { KBps: 'KB/s', MBps: 'MB/s', Mbps: 'Mbps' };
const ROLE_KEYS = {
  throttled: 'roleThrottled',
  head: 'roleHead',
  snail: 'roleSnail',
  free: 'roleFree',
  userPaused: 'roleUserPaused',
};

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

const els = {
  enabled: $('enabled'),
  controls: $('controls'),
  limit: $('limit'),
  unit: $('unit'),
  limitError: $('limitError'),
  summary: $('summary'),
  list: $('list'),
  empty: $('empty'),
  tpl: $('itemTpl'),
  pauseAll: $('pauseAll'),
  resumeAll: $('resumeAll'),
  cancelAll: $('cancelAll'),
};
const rows = new Map(); // download id -> <li>
let state = null;

function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
}

function basename(path) {
  return path.split(/[\\/]/).pop() || path;
}

function renderSettings(s) {
  els.enabled.checked = s.enabled;
  els.controls.classList.toggle('off', !s.enabled);
  if (document.activeElement !== els.limit) els.limit.value = fromBps(s.limitBps, s.unit);
  els.unit.value = s.unit;
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-checked', String(b.dataset.mode === s.mode));
  }
  for (const c of document.querySelectorAll('[data-preset]')) {
    c.classList.toggle('active', toBps(c.dataset.preset, 'MBps') === s.limitBps);
  }
}

function createRow(id) {
  const li = els.tpl.content.firstElementChild.cloneNode(true);
  li.dataset.id = id;
  li.querySelector('.perfile-label').textContent = t('perFileLabel');
  const input = li.querySelector('.perfile-input');
  input.placeholder = t('perFilePlaceholder');
  input.addEventListener('change', () => {
    const bps = input.value.trim() === '' ? null : toBps(input.value, state.settings.unit);
    if (input.value.trim() !== '' && bps == null) {
      input.value = '';
      return;
    }
    send({ type: 'setPerFile', id, bps }).then(render);
  });
  li.querySelector('.toggle-pause').addEventListener('click', (e) => {
    const paused = e.currentTarget.classList.contains('is-paused');
    send({ type: 'control', op: paused ? 'resume' : 'pause', id }).then(render);
  });
  const cancel = li.querySelector('.cancel');
  cancel.title = t('cancel');
  cancel.setAttribute('aria-label', t('cancel'));
  cancel.addEventListener('click', () => send({ type: 'control', op: 'cancel', id }).then(render));
  return li;
}

function updateRow(li, d, unit) {
  li.dataset.role = d.role;
  const name = basename(d.filename);
  li.querySelector('.name').textContent = name;
  li.querySelector('.name').title = name;

  const badge = li.querySelector('.badge');
  badge.dataset.role = d.role;
  badge.textContent = t(ROLE_KEYS[d.role] ?? 'roleFree');

  const known = d.totalBytes > 0;
  const bar = li.querySelector('.bar');
  bar.classList.toggle('indeterminate', !known && !d.paused);
  li.querySelector('.fill').style.width = known ? `${Math.min(100, (d.bytesReceived / d.totalBytes) * 100)}%` : '0';

  li.querySelector('.progress').textContent = known
    ? `${formatBytes(d.bytesReceived)} / ${formatBytes(d.totalBytes)}`
    : formatBytes(d.bytesReceived);
  li.querySelector('.speed').textContent = d.role === 'userPaused' ? '' : formatSpeed(d.speed);

  let eta = Infinity;
  if (known && d.speed > 1) eta = (d.totalBytes - d.bytesReceived) / d.speed;
  else if (d.estimatedEndTime) eta = (new Date(d.estimatedEndTime) - Date.now()) / 1000;
  li.querySelector('.eta').textContent = d.role === 'userPaused' ? '' : t('etaLeft', [formatEta(eta)]);

  const url = li.querySelector('.url');
  url.textContent = d.url;
  url.title = d.url;

  const input = li.querySelector('.perfile-input');
  if (document.activeElement !== input) input.value = d.perFileBps ? fromBps(d.perFileBps, unit) : '';
  li.querySelector('.perfile-unit').textContent = UNIT_LABELS[unit];

  const toggle = li.querySelector('.toggle-pause');
  const userPaused = d.role === 'userPaused';
  toggle.classList.toggle('is-paused', userPaused);
  toggle.title = t(userPaused ? 'resume' : 'pause');
  toggle.setAttribute('aria-label', toggle.title);
}

function render(next) {
  if (!next || next.error) return;
  state = next;
  const { settings, downloads, totalSpeed } = next;
  renderSettings(settings);

  const seen = new Set();
  downloads.forEach((d, i) => {
    seen.add(d.id);
    let li = rows.get(d.id);
    if (!li) {
      li = createRow(d.id);
      rows.set(d.id, li);
    }
    updateRow(li, d, settings.unit);
    if (els.list.children[i] !== li) els.list.insertBefore(li, els.list.children[i] ?? null);
  });
  for (const [id, li] of rows) {
    if (!seen.has(id)) {
      li.remove();
      rows.delete(id);
    }
  }

  const n = downloads.length;
  els.empty.hidden = n > 0;
  els.summary.hidden = n === 0;
  els.summary.textContent = t('summary', [String(n), formatSpeed(totalSpeed)]);
  for (const b of [els.pauseAll, els.resumeAll, els.cancelAll]) b.disabled = n === 0;
}

async function refresh() {
  try {
    render(await send({ type: 'getState' }));
  } catch {
    // Service worker restarting; next refresh will catch up.
  }
}

function commitLimit() {
  const bps = toBps(els.limit.value, els.unit.value);
  els.limitError.hidden = bps != null;
  if (bps == null) return;
  send({ type: 'setSettings', limitBps: bps, unit: els.unit.value }).then(render);
}

els.enabled.addEventListener('change', () => send({ type: 'setSettings', enabled: els.enabled.checked }).then(render));
els.limit.addEventListener('change', commitLimit);
els.limit.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') els.limit.blur();
});
els.unit.addEventListener('change', () => {
  // Changing the unit keeps the speed, just shows it in the new unit.
  if (!state) return;
  els.limit.value = fromBps(state.settings.limitBps, els.unit.value);
  send({ type: 'setSettings', unit: els.unit.value }).then(render);
});
for (const chip of document.querySelectorAll('[data-preset]')) {
  chip.addEventListener('click', () => {
    els.limitError.hidden = true;
    send({ type: 'setSettings', enabled: true, limitBps: toBps(chip.dataset.preset, 'MBps'), unit: 'MBps' }).then(render);
  });
}
for (const b of document.querySelectorAll('[data-mode]')) {
  b.addEventListener('click', () => send({ type: 'setSettings', mode: b.dataset.mode }).then(render));
}
els.pauseAll.addEventListener('click', () => send({ type: 'control', op: 'pause' }).then(render));
els.resumeAll.addEventListener('click', () => send({ type: 'control', op: 'resume' }).then(render));

let confirmTimer = null;
els.cancelAll.addEventListener('click', () => {
  if (!els.cancelAll.classList.contains('confirm')) {
    els.cancelAll.classList.add('confirm');
    els.cancelAll.textContent = t('confirmCancelAll');
    confirmTimer = setTimeout(resetCancel, 3000);
    return;
  }
  resetCancel();
  send({ type: 'control', op: 'cancel' }).then(render);
});
function resetCancel() {
  clearTimeout(confirmTimer);
  els.cancelAll.classList.remove('confirm');
  els.cancelAll.textContent = t('cancelAll');
}

localize();
refresh();
setInterval(refresh, REFRESH_MS);
