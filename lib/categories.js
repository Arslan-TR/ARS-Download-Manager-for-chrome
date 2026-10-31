// File-type categories and list statuses for the popup's tabs. Pure, no chrome.*.

const EXTENSIONS = {
  image: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg', 'ico', 'heic', 'tif', 'tiff', 'avif'],
  video: ['mp4', 'mkv', 'avi', 'mov', 'webm', 'wmv', 'flv', 'm4v', 'mpg', 'mpeg', '3gp', 'ts'],
  audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma'],
  document: ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'odt', 'ods', 'odp', 'rtf', 'csv', 'epub', 'md'],
  archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'dmg', 'tgz'],
  program: ['exe', 'msi', 'apk', 'deb', 'rpm', 'appimage', 'pkg'],
};

// Tabs in display order: status tabs, then the common categories.
export const TABS = ['all', 'active', 'completed', 'image', 'video', 'audio', 'document'];
// Less common filters, offered from the filter menu next to the tabs.
export const MORE_FILTERS = ['archive', 'program', 'other', 'failed'];

export function extensionOf(path) {
  const name = String(path ?? '').split(/[\\/]/).pop();
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function categoryOf({ filename, mime = '' }) {
  const ext = extensionOf(filename);
  for (const [cat, exts] of Object.entries(EXTENSIONS)) {
    if (exts.includes(ext)) return cat;
  }
  const [type] = String(mime).split('/');
  if (type === 'image' || type === 'video' || type === 'audio') return type;
  if (mime === 'application/pdf') return 'document';
  return 'other';
}

export function statusOf(d) {
  if (d.state === 'in_progress') return d.paused ? 'paused' : 'active';
  if (d.state === 'complete') return d.exists === false ? 'missing' : 'complete';
  return d.error === 'USER_CANCELED' ? 'canceled' : 'failed';
}

export function matchesTab(d, tab) {
  const status = statusOf(d);
  if (tab === 'all') return true;
  if (tab === 'active') return status === 'active' || status === 'paused';
  if (tab === 'completed') return status === 'complete' || status === 'missing';
  if (tab === 'failed') return status === 'failed' || status === 'canceled';
  return categoryOf(d) === tab;
}

function nameOf(d) {
  return String(d.filename ?? '').split(/[\\/]/).pop().toLowerCase();
}

function sizeOf(d) {
  return d.fileSize > 0 ? d.fileSize : d.totalBytes > 0 ? d.totalBytes : 0;
}

// Returns a sorted copy; with no key the input order (newest first) is kept.
export function sortDownloads(list, key, dir) {
  if (key !== 'name' && key !== 'size') return [...list];
  const sign = dir === 'desc' ? -1 : 1;
  const cmp = key === 'name' ? (a, b) => nameOf(a).localeCompare(nameOf(b)) : (a, b) => sizeOf(a) - sizeOf(b);
  return [...list].sort((a, b) => sign * cmp(a, b));
}
