import { toBps, fromBps, formatBytes, formatSpeed, formatEta, badgeText } from './lib/units.js';
import { TABS, MORE_FILTERS, categoryOf, statusOf, matchesTab, extensionOf, sortDownloads } from './lib/categories.js';

const REFRESH_MS = 1000;
const UNIT_LABELS = { KBps: 'KB/s', MBps: 'MB/s', Mbps: 'Mbps' };
const ROLE_KEYS = {
  throttled: 'roleThrottled',
  head: 'roleHead',
  snail: 'roleSnail',
  free: 'roleFree',
  userPaused: 'roleUserPaused',
};
const TAB_KEYS = {
  all: 'tabAll',
  active: 'tabActive',
  completed: 'tabCompleted',
  image: 'tabImage',
  video: 'tabVideo',
  audio: 'tabAudio',
  document: 'tabDocument',
  archive: 'tabArchive',
  program: 'tabProgram',
  other: 'tabOther',
  failed: 'tabFailed',
};
const STATUS_KEYS = { failed: 'statusFailed', canceled: 'statusCanceled', missing: 'statusMissing' };
// What a row's main button does, per status.
const ROW_ACTION = {
  active: { icon: 'pause', op: 'pause', title: 'pause' },
  paused: { icon: 'play', op: 'resume', title: 'resume' },
  failed: { icon: 'retry', op: 'retry', title: 'retry' },
  canceled: { icon: 'retry', op: 'retry', title: 'retry' },
  complete: { icon: 'play', op: 'open', title: 'openFile' },
  missing: { icon: 'play', op: null, title: 'statusMissing' },
};

const t = (key, subs) => chrome.i18n.getMessage(key, subs) || key;
const $ = (id) => document.getElementById(id);
const send = (msg) => chrome.runtime.sendMessage(msg);

const els = {
  addBtn: $('addBtn'),
  resumeBtn: $('resumeBtn'),
  pauseBtn: $('pauseBtn'),
  removeBtn: $('removeBtn'),
  folderBtn: $('folderBtn'),
  search: $('search'),
  addForm: $('addForm'),
  addUrl: $('addUrl'),
  addClose: $('addClose'),
  addError: $('addError'),
  tabs: $('tabs'),
  filterBtn: $('filterBtn'),
  filterLabel: $('filterLabel'),
  filterMenu: $('filterMenu'),
  selectAll: $('selectAll'),
  list: $('list'),
  listWrap: document.querySelector('.list-wrap'),
  empty: $('empty'),
  tpl: $('itemTpl'),
  limitbar: $('limitbar'),
  enabled: $('enabled'),
  limit: $('limit'),
  unit: $('unit'),
  limitError: $('limitError'),
  snail: $('snail'),
  snailLabel: $('snailLabel'),
  speedNow: $('speedNow'),
  speedAvg: $('speedAvg'),
  toast: $('toast'),
  rowMenu: $('rowMenu'),
};
const ETA_FMT = {
  h: (h, m) => t('etaHours', [String(h), String(m)]),
  m: (m, s) => t('etaMinutes', [String(m), String(s)]),
  s: (s) => t('etaSeconds', [String(s)]),
};

const rows = new Map(); // download id -> <li>
const tabButtons = new Map(); // tab -> <button>
const filterItems = new Map(); // extra filter -> menu <button>
const selected = new Set();
const expanded = new Set();
let state = null;
let tab = 'all';
let query = '';
let visible = []; // downloads currently shown
let menuFor = null; // download id the row menu is open for

// View and sort order are per-viewer conveniences; storage may be unavailable.
function loadPref(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(`ars.${key}`)) ?? fallback;
  } catch {
    return fallback;
  }
}
function savePref(key, value) {
  try {
    localStorage.setItem(`ars.${key}`, JSON.stringify(value));
  } catch {
    // Not saved; the popup still works.
  }
}
let view = loadPref('view', 'list');
let sort = loadPref('sort', { key: null, dir: 'asc' });

function localize() {
  document.documentElement.lang = chrome.i18n.getUILanguage();
  for (const el of document.querySelectorAll('[data-i18n]')) el.textContent = t(el.dataset.i18n);
  for (const el of document.querySelectorAll('[data-i18n-title]')) el.title = t(el.dataset.i18nTitle);
  for (const el of document.querySelectorAll('[data-i18n-aria]')) el.setAttribute('aria-label', t(el.dataset.i18nAria));
  for (const el of document.querySelectorAll('[data-i18n-placeholder]')) el.placeholder = t(el.dataset.i18nPlaceholder);
}

function basename(path) {
  return String(path).split(/[\\/]/).pop() || path;
}

function hostOf(url) {
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

let toastTimer = null;
function toast(text) {
  clearTimeout(toastTimer);
  els.toast.textContent = text;
  els.toast.hidden = false;
  toastTimer = setTimeout(() => (els.toast.hidden = true), 2000);
}

function findDownload(id) {
  return state?.downloads.find((d) => d.id === id);
}

// ---------- Tabs and filter menu ----------

function setTab(key) {
  tab = key;
  closeMenus();
  render(state);
}

function buildTabs() {
  for (const key of TABS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tab';
    b.setAttribute('role', 'tab');
    b.addEventListener('click', () => {
      b.scrollIntoView({ inline: 'nearest', block: 'nearest' });
      setTab(key);
    });
    els.tabs.append(b);
    tabButtons.set(key, b);
  }
  for (const key of MORE_FILTERS) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'menuitemradio');
    b.innerHTML = '<span class="label-text"></span><span class="count"></span>';
    b.addEventListener('click', () => setTab(key));
    els.filterMenu.append(b);
    filterItems.set(key, b);
  }
}

function updateTabFades() {
  const { scrollLeft, scrollWidth, clientWidth } = els.tabs;
  els.tabs.classList.toggle('more-left', scrollLeft > 2);
  els.tabs.classList.toggle('more-right', scrollLeft + clientWidth < scrollWidth - 2);
}

function renderTabs(downloads) {
  const count = (key) => downloads.filter((d) => matchesTab(d, key)).length;
  for (const [key, b] of tabButtons) {
    b.textContent = `${t(TAB_KEYS[key])} (${count(key)})`;
    b.setAttribute('aria-selected', String(key === tab));
  }
  for (const [key, b] of filterItems) {
    b.querySelector('.label-text').textContent = t(TAB_KEYS[key]);
    b.querySelector('.count').textContent = count(key);
    b.setAttribute('aria-checked', String(key === tab));
  }
  // The filter button shows the extra filter in use, if any.
  const extra = MORE_FILTERS.includes(tab);
  els.filterBtn.setAttribute('aria-selected', String(extra));
  els.filterLabel.textContent = extra ? `${t(TAB_KEYS[tab])} (${count(tab)})` : '';
  updateTabFades();
}

// ---------- Menus ----------

function closeMenus() {
  els.filterMenu.hidden = true;
  els.filterBtn.setAttribute('aria-expanded', 'false');
  els.rowMenu.hidden = true;
  menuFor = null;
}

function openRowMenu(id, anchor) {
  const d = findDownload(id);
  if (!d) return;
  const status = statusOf(d);
  const inProgress = status === 'active' || status === 'paused';
  const show = { limit: inProgress, copy: true, redownload: !inProgress, cancel: inProgress, remove: true };
  for (const b of els.rowMenu.querySelectorAll('[data-action]')) b.hidden = !show[b.dataset.action];

  closeMenus();
  menuFor = id;
  els.rowMenu.hidden = false;
  // Place under the button, flipping up or left when it would run off the popup.
  const r = anchor.getBoundingClientRect();
  const m = els.rowMenu.getBoundingClientRect();
  const top = r.bottom + 4 + m.height > window.innerHeight ? r.top - m.height - 4 : r.bottom + 4;
  els.rowMenu.style.top = `${Math.max(4, top)}px`;
  els.rowMenu.style.left = `${Math.max(4, Math.min(r.right - m.width, window.innerWidth - m.width - 4))}px`;
  els.rowMenu.querySelector('button:not([hidden])')?.focus();
}

function rowMenuAction(action) {
  const id = menuFor;
  const d = findDownload(id);
  closeMenus();
  if (!d) return;
  if (action === 'limit') {
    expanded.add(id);
    render(state);
    rows.get(id)?.querySelector('.perfile-input')?.focus();
  } else if (action === 'copy') {
    navigator.clipboard.writeText(d.url).then(() => toast(t('copied')), () => toast(d.url));
  } else if (action === 'redownload') {
    send({ type: 'control', op: 'retry', ids: [id] }).then(render);
  } else if (action === 'cancel') {
    send({ type: 'control', op: 'cancel', ids: [id] }).then(render);
  } else if (action === 'remove') {
    selected.delete(id);
    send({ type: 'control', op: 'erase', ids: [id] }).then(render);
  }
}

// ---------- Rows ----------

function openFile(id) {
  // Called straight from the click so Chrome sees the user gesture it requires.
  chrome.downloads.open(id).catch(() => toast(t('openFailed')));
}

function createRow(id) {
  const li = els.tpl.content.firstElementChild.cloneNode(true);
  li.dataset.id = id;

  const sel = li.querySelector('.sel');
  sel.setAttribute('aria-label', t('select'));
  sel.addEventListener('change', () => {
    if (sel.checked) selected.add(id);
    else selected.delete(id);
    renderSelection();
  });

  li.querySelector('.primary-act').addEventListener('click', (e) => {
    const op = e.currentTarget.dataset.op;
    if (op === 'open') openFile(id);
    else if (op) send({ type: 'control', op, ids: [id] }).then(render);
  });
  li.querySelector('.folder-act').addEventListener('click', () => send({ type: 'show', id }));
  li.querySelector('.more-act').addEventListener('click', (e) => {
    e.stopPropagation();
    if (menuFor === id) closeMenus();
    else openRowMenu(id, e.currentTarget);
  });

  // Clicking a row selects it; double-clicking a finished file opens it.
  const main = li.querySelector('.row-main');
  main.addEventListener('click', (e) => {
    if (e.target.closest('input, button')) return;
    sel.checked = !sel.checked;
    sel.dispatchEvent(new Event('change'));
  });
  main.addEventListener('dblclick', (e) => {
    if (e.target.closest('input, button')) return;
    const d = findDownload(id);
    if (d && statusOf(d) === 'complete') openFile(id);
  });

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
  return li;
}

function sizeOf(d) {
  return d.fileSize > 0 ? d.fileSize : d.totalBytes;
}

function updateRow(li, d, unit) {
  const status = statusOf(d);
  const inProgress = status === 'active' || status === 'paused';
  li.dataset.status = status;
  li.dataset.role = inProgress ? d.role : '';
  li.classList.toggle('selected', selected.has(d.id));
  li.querySelector('.sel').checked = selected.has(d.id);

  const name = basename(d.filename) || hostOf(d.url);
  li.querySelector('.name').textContent = name;
  li.querySelector('.name').title = name;

  const ftype = li.querySelector('.ftype');
  ftype.dataset.cat = categoryOf(d);
  ftype.textContent = extensionOf(d.filename).slice(0, 4) || '•';

  const action = ROW_ACTION[status];
  const act = li.querySelector('.primary-act');
  act.dataset.icon = action.icon;
  act.dataset.op = action.op ?? '';
  act.disabled = !action.op;
  act.title = t(action.title);
  act.setAttribute('aria-label', act.title);

  const folder = li.querySelector('.folder-act');
  folder.disabled = status !== 'complete';
  folder.title = t('openFolder');
  folder.setAttribute('aria-label', folder.title);
  const more = li.querySelector('.more-act');
  more.title = t('moreActions');
  more.setAttribute('aria-label', more.title);

  // Second line: limiter role, speed and time left while downloading;
  // otherwise the site it came from.
  const badge = li.querySelector('.badge');
  const speed = li.querySelector('.speed');
  const eta = li.querySelector('.eta');
  const host = li.querySelector('.host');
  if (inProgress) {
    badge.dataset.role = d.role;
    badge.textContent = t(ROLE_KEYS[d.role] ?? 'roleFree');
    const running = status === 'active';
    speed.textContent = running ? formatSpeed(d.speed) : '';
    let left = Infinity;
    if (d.totalBytes > 0 && d.speed > 1) left = (d.totalBytes - d.bytesReceived) / d.speed;
    else if (d.estimatedEndTime) left = (new Date(d.estimatedEndTime) - Date.now()) / 1000;
    eta.textContent = running ? t('etaLeft', [formatEta(left, ETA_FMT)]) : '';
    host.textContent = '';
  } else {
    badge.textContent = '';
    speed.textContent = '';
    eta.textContent = '';
    host.textContent = hostOf(d.url);
  }

  // Size column: percentage and bar while downloading, size or outcome after.
  const known = d.totalBytes > 0;
  const bar = li.querySelector('.bar');
  const sizeText = li.querySelector('.size-text');
  bar.hidden = !inProgress;
  if (inProgress) {
    const pct = known ? Math.min(100, (d.bytesReceived / d.totalBytes) * 100) : 0;
    bar.classList.toggle('indeterminate', !known && status === 'active');
    li.querySelector('.fill').style.width = `${pct}%`;
    sizeText.textContent = known ? `${Math.floor(pct)}% · ${formatBytes(d.totalBytes)}` : formatBytes(d.bytesReceived);
  } else if (STATUS_KEYS[status]) {
    sizeText.textContent = t(STATUS_KEYS[status]);
  } else {
    sizeText.textContent = formatBytes(sizeOf(d));
  }

  const url = li.querySelector('.url');
  url.textContent = d.url;
  url.title = d.url;
  const input = li.querySelector('.perfile-input');
  if (document.activeElement !== input) input.value = d.perFileBps ? fromBps(d.perFileBps, unit) : '';
  li.querySelector('.perfile-unit').textContent = UNIT_LABELS[unit];
  li.querySelector('.details').hidden = !(expanded.has(d.id) && inProgress);
}

// ---------- Selection, toolbar, sort, view ----------

function selectedDownloads() {
  return (state?.downloads ?? []).filter((d) => selected.has(d.id));
}

function renderSelection() {
  const shownIds = visible.map((d) => d.id);
  const picked = shownIds.filter((id) => selected.has(id)).length;
  els.selectAll.checked = picked > 0 && picked === shownIds.length;
  els.selectAll.indeterminate = picked > 0 && picked < shownIds.length;
  for (const li of rows.values()) li.classList.toggle('selected', selected.has(Number(li.dataset.id)));

  const sel = selectedDownloads();
  const all = state?.downloads ?? [];
  const anyIn = (list, ...statuses) => list.some((d) => statuses.includes(statusOf(d)));
  // With nothing selected, play/pause act on every download.
  const scope = sel.length > 0 ? sel : all;
  els.resumeBtn.disabled = !anyIn(scope, 'paused', ...(sel.length > 0 ? ['failed', 'canceled'] : []));
  els.pauseBtn.disabled = !anyIn(scope, 'active');
  els.removeBtn.disabled = sel.length === 0;
  if (sel.length === 0) resetRemove();
}

function toolbarAction(op) {
  const sel = selectedDownloads();
  if (sel.length === 0) {
    send({ type: 'control', op }).then(render);
    return;
  }
  if (op === 'pause') {
    const ids = sel.filter((d) => statusOf(d) === 'active').map((d) => d.id);
    if (ids.length) send({ type: 'control', op: 'pause', ids }).then(render);
    return;
  }
  const paused = sel.filter((d) => statusOf(d) === 'paused').map((d) => d.id);
  const stopped = sel.filter((d) => ['failed', 'canceled'].includes(statusOf(d))).map((d) => d.id);
  if (paused.length) send({ type: 'control', op: 'resume', ids: paused }).then(render);
  if (stopped.length) send({ type: 'control', op: 'retry', ids: stopped }).then(render);
}

let removeTimer = null;
function resetRemove() {
  clearTimeout(removeTimer);
  els.removeBtn.classList.remove('confirm');
  els.removeBtn.title = t('removeSelected');
}

function renderSortAndView() {
  for (const b of document.querySelectorAll('.sort')) {
    if (b.dataset.sort === sort.key) b.dataset.dir = sort.dir;
    else delete b.dataset.dir;
  }
  for (const b of document.querySelectorAll('[data-view]')) b.setAttribute('aria-pressed', String(b.dataset.view === view));
  els.list.classList.toggle('grid', view === 'grid');
}

// ---------- Settings ----------

function renderSettings(s) {
  els.enabled.checked = s.enabled;
  els.limitbar.classList.toggle('off', !s.enabled);
  if (document.activeElement !== els.limit) els.limit.value = fromBps(s.limitBps, s.unit);
  els.unit.value = s.unit;
  for (const b of document.querySelectorAll('[data-mode]')) {
    b.setAttribute('aria-checked', String(b.dataset.mode === s.mode));
  }
  for (const c of document.querySelectorAll('[data-preset]')) {
    c.classList.toggle('active', toBps(c.dataset.preset, 'MBps') === s.limitBps);
  }
  const on = s.enabled && s.limitBps > 0;
  els.snail.setAttribute('aria-pressed', String(on));
  els.snailLabel.textContent = on ? `${fromBps(s.limitBps, s.unit)} ${UNIT_LABELS[s.unit]}` : t('noLimit');
  els.snail.title = t(on ? 'snailOnHint' : 'snailOffHint', [badgeText(s.limitBps)]);
}

let errorTimer = null;
function showLimitError(show) {
  clearTimeout(errorTimer);
  els.limitError.hidden = !show;
  if (show) errorTimer = setTimeout(() => (els.limitError.hidden = true), 3000);
}

function commitLimit() {
  const bps = toBps(els.limit.value, els.unit.value);
  showLimitError(bps == null);
  if (bps == null) {
    // Put the current limit back so the box never shows a value that isn't in effect.
    if (state) els.limit.value = fromBps(state.settings.limitBps, state.settings.unit);
    return;
  }
  send({ type: 'setSettings', limitBps: bps, unit: els.unit.value }).then(render);
}

// ---------- Render ----------

function render(next) {
  if (!next || next.error) return;
  state = next;
  const { settings, downloads, totalSpeed, totalInstant } = next;
  renderSettings(settings);
  renderTabs(downloads);
  renderSortAndView();

  // Forget selections of downloads that are gone.
  const ids = new Set(downloads.map((d) => d.id));
  for (const id of selected) if (!ids.has(id)) selected.delete(id);
  if (menuFor != null && !ids.has(menuFor)) closeMenus();

  const q = query.trim().toLowerCase();
  const filtered = downloads.filter(
    (d) => matchesTab(d, tab) && (!q || basename(d.filename).toLowerCase().includes(q) || d.url.toLowerCase().includes(q)),
  );
  visible = sortDownloads(filtered, sort.key, sort.dir);

  const seen = new Set();
  visible.forEach((d, i) => {
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
  els.empty.hidden = visible.length > 0;

  els.speedNow.textContent = formatSpeed(totalInstant);
  els.speedAvg.textContent = t('speedAvg', [formatSpeed(totalSpeed)]);
  renderSelection();
}

async function refresh() {
  try {
    render(await send({ type: 'getState' }));
  } catch {
    // Service worker restarting; next refresh will catch up.
  }
}

// ---------- Events ----------

els.addBtn.addEventListener('click', () => {
  els.addForm.hidden = !els.addForm.hidden;
  els.addError.hidden = true;
  if (!els.addForm.hidden) els.addUrl.focus();
});
els.addClose.addEventListener('click', () => {
  els.addForm.hidden = true;
  els.addError.hidden = true;
});
els.addUrl.addEventListener('input', () => (els.addError.hidden = true));
els.addForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const res = await send({ type: 'download', url: els.addUrl.value.trim() });
  if (res?.error) {
    els.addError.hidden = false;
    return;
  }
  els.addUrl.value = '';
  els.addForm.hidden = true;
  render(res);
});

els.resumeBtn.addEventListener('click', () => toolbarAction('resume'));
els.pauseBtn.addEventListener('click', () => toolbarAction('pause'));
els.removeBtn.addEventListener('click', () => {
  // Second click within 3 s confirms.
  if (!els.removeBtn.classList.contains('confirm')) {
    els.removeBtn.classList.add('confirm');
    els.removeBtn.title = t('confirmRemove');
    removeTimer = setTimeout(resetRemove, 3000);
    return;
  }
  const ids = [...selected];
  resetRemove();
  selected.clear();
  send({ type: 'control', op: 'erase', ids }).then(render);
});
els.folderBtn.addEventListener('click', () => {
  const sel = selectedDownloads();
  const one = sel.length === 1 && statusOf(sel[0]) === 'complete' ? sel[0].id : null;
  send({ type: 'show', id: one });
});

for (const b of document.querySelectorAll('[data-view]')) {
  b.addEventListener('click', () => {
    view = b.dataset.view;
    savePref('view', view);
    render(state);
  });
}
for (const b of document.querySelectorAll('.sort')) {
  // Ascending, then descending, then back to newest first.
  b.addEventListener('click', () => {
    const key = b.dataset.sort;
    if (sort.key !== key) sort = { key, dir: 'asc' };
    else if (sort.dir === 'asc') sort = { key, dir: 'desc' };
    else sort = { key: null, dir: 'asc' };
    savePref('sort', sort);
    render(state);
  });
}

els.filterBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  const open = els.filterMenu.hidden;
  closeMenus();
  els.filterMenu.hidden = !open;
  els.filterBtn.setAttribute('aria-expanded', String(open));
});
for (const b of els.rowMenu.querySelectorAll('[data-action]')) {
  b.addEventListener('click', () => rowMenuAction(b.dataset.action));
}
document.addEventListener('click', (e) => {
  if (!e.target.closest('.menu, .filter-btn, .more-act')) closeMenus();
});
els.listWrap.addEventListener('scroll', () => {
  if (!els.rowMenu.hidden) closeMenus();
});

// A mouse wheel scrolls the tab strip sideways.
els.tabs.addEventListener('wheel', (e) => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  els.tabs.scrollLeft += e.deltaY;
  e.preventDefault();
}, { passive: false });
els.tabs.addEventListener('scroll', updateTabFades);

els.search.addEventListener('input', () => {
  query = els.search.value;
  render(state);
});
els.selectAll.addEventListener('change', () => {
  for (const d of visible) {
    if (els.selectAll.checked) selected.add(d.id);
    else selected.delete(d.id);
  }
  render(state);
});

els.snail.addEventListener('click', () =>
  send({ type: 'setSettings', enabled: els.snail.getAttribute('aria-pressed') !== 'true' }).then(render),
);
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  if (!els.rowMenu.hidden || !els.filterMenu.hidden) closeMenus();
  else if (!els.addForm.hidden) els.addForm.hidden = true;
  else return;
  e.preventDefault();
});

els.enabled.addEventListener('change', () => send({ type: 'setSettings', enabled: els.enabled.checked }).then(render));
els.limit.addEventListener('change', commitLimit);
els.limit.addEventListener('input', () => showLimitError(false));
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
    showLimitError(false);
    send({ type: 'setSettings', enabled: true, limitBps: toBps(chip.dataset.preset, 'MBps'), unit: 'MBps' }).then(render);
  });
}
for (const b of document.querySelectorAll('[data-mode]')) {
  b.addEventListener('click', () => send({ type: 'setSettings', mode: b.dataset.mode }).then(render));
}

localize();
buildTabs();
renderSortAndView();
refresh();
setInterval(refresh, REFRESH_MS);
