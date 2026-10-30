// End-to-end check: loads the unpacked extension into Chromium, downloads
// from a paced local server and measures what the limiter actually does.
// Pause/resume throttling moves data in bursts of several MB, so speeds are
// averaged over long windows.
//
//   node tests/e2e/run.mjs                 (English UI)
//   E2E_LANG=tr node tests/e2e/run.mjs     (Turkish UI)
//   E2E_SHOTS=/some/dir node tests/e2e/run.mjs   (save popup screenshots)
import { mkdtemp, rm, open, readFile } from 'node:fs/promises';
import { createHash, randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { startServer } from './server.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const MB = 1024 * 1024;
const FILE_SIZE = 420 * MB;
const LINE_RATE = 16 * MB;
const extDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const lang = process.env.E2E_LANG ?? 'en';
const shots = process.env.E2E_SHOTS;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const fmt = (bps) => `${(bps / MB).toFixed(2)} MB/s`;

const results = [];
function check(name, ok, detail) {
  results.push({ name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  (${detail})`);
}

const tmp = await mkdtemp(path.join(tmpdir(), 'arsdm-e2e-'));
const src = path.join(tmp, 'src.bin');
{
  const fh = await open(src, 'w');
  for (let i = 0; i < FILE_SIZE / MB; i++) await fh.write(randomBytes(MB));
  await fh.close();
}
const sha = async (p) => createHash('sha256').update(await readFile(p)).digest('hex');
const srcHash = await sha(src);

const server = await startServer({ file: src, lineRate: LINE_RATE });
const base = `http://127.0.0.1:${server.address().port}`;

const ctx = await chromium.launchPersistentContext(path.join(tmp, 'profile'), {
  // Full Chromium (new headless); the headless shell can't load extensions.
  channel: 'chromium',
  headless: true,
  acceptDownloads: true,
  downloadsPath: path.join(tmp, 'dl'),
  args: [`--disable-extensions-except=${extDir}`, `--load-extension=${extDir}`, `--lang=${lang}`],
});

try {
  let [sw] = ctx.serviceWorkers();
  if (!sw) sw = await ctx.waitForEvent('serviceworker');
  const extId = new URL(sw.url()).host;

  const setSettings = (patch) =>
    sw.evaluate(async (p) => {
      const { settings = {} } = await chrome.storage.local.get('settings');
      await chrome.storage.local.set({ settings: { ...settings, ...p } });
    }, patch);
  const startDownload = (name) =>
    sw.evaluate((url) => chrome.downloads.download({ url }), `${base}/f?name=${name}`);
  const items = (ids) =>
    sw.evaluate(async (ids) => {
      const all = await chrome.downloads.search({});
      return ids.map((id) => all.find((d) => d.id === id));
    }, ids);
  async function measure(ids, seconds) {
    const a = await items(ids);
    await sleep(seconds * 1000);
    const b = await items(ids);
    return b.map((d, i) => (d.bytesReceived - a[i].bytesReceived) / seconds);
  }

  // 1. Single download held at the global limit.
  await setSettings({ enabled: true, limitBps: 2 * MB, unit: 'MBps', mode: 'share', perFile: {} });
  const A = await startDownload('a.bin');
  await sleep(3000);
  const [r1] = await measure([A], 15);
  check('single download limited to 2 MB/s', r1 > 1.6 * MB && r1 < 2.4 * MB, fmt(r1));

  // 2. Share mode splits 4 MB/s between two downloads.
  await setSettings({ limitBps: 4 * MB });
  const B = await startDownload('b.bin');
  await sleep(3000);
  // Each download gets a burst every few seconds; a short window can hold
  // one more burst of one than the other, so fairness needs a long window.
  const [a2, b2] = await measure([A, B], 45);
  check('share mode: total near 4 MB/s', a2 + b2 > 3.2 * MB && a2 + b2 < 4.8 * MB, `A ${fmt(a2)} + B ${fmt(b2)}`);
  check('share mode: split evenly', Math.abs(a2 - b2) < 0.25 * (a2 + b2), `A ${fmt(a2)}, B ${fmt(b2)}`);

  // 3. Sequential mode: A (older) leads, B crawls in snail mode but keeps moving.
  await setSettings({ mode: 'sequential', limitBps: 8 * MB });
  await sleep(4000);
  if (shots) {
    const page = await ctx.newPage();
    await page.setViewportSize({ width: 380, height: 560 });
    await page.goto(`chrome-extension://${extId}/popup.html`);
    await sleep(1500);
    await page.screenshot({ path: path.join(shots, `popup-${lang}.png`), fullPage: true });
    await page.close();
  }
  const [a3, b3] = await measure([A, B], 16);
  check('sequential: head gets most of the limit', a3 > 4 * MB, `A ${fmt(a3)}`);
  check('sequential: total stays near the limit', a3 + b3 < 9.6 * MB, `total ${fmt(a3 + b3)}`);
  check('sequential: queued download crawls, never stops', b3 > 0 && b3 < a3 / 3, `B ${fmt(b3)}`);

  // 4. A download the user pauses from the popup stays paused.
  const popup = await ctx.newPage();
  await popup.goto(`chrome-extension://${extId}/popup.html`);
  const popupSend = (msg) => popup.evaluate((m) => chrome.runtime.sendMessage(m), msg);
  await popupSend({ type: 'control', op: 'pause', id: B });
  await sleep(1000);
  const [b4a] = await items([B]);
  await sleep(4000);
  const [b4b] = await items([B]);
  check('user pause is respected', b4b.paused && b4b.bytesReceived === b4a.bytesReceived, `paused=${b4b.paused}`);

  // 5. Limiter off: downloads run free again.
  await popupSend({ type: 'control', op: 'resume', id: B });
  await popupSend({ type: 'setSettings', enabled: false });
  await popup.close();
  await sleep(2000);
  const before = await items([A, B]);
  const [a5, b5] = await measure([A, B], 4);
  check(
    'limiter off: speed released',
    before.every((d) => d.state === 'in_progress') && a5 + b5 > 8 * MB,
    `total ${fmt(a5 + b5)}, states ${before.map((d) => d.state)}`,
  );

  // 6. Both finish intact, over their original connection.
  const deadline = Date.now() + 120_000;
  let done = [];
  while (Date.now() < deadline) {
    done = await items([A, B]);
    if (done.every((d) => d.state !== 'in_progress')) break;
    await sleep(1000);
  }
  for (const d of done) {
    const name = d.url.includes('a.bin') ? 'A' : 'B';
    const ok = d.state === 'complete' && (await sha(d.filename)) === srcHash;
    check(`download ${name} complete and intact`, ok, `state=${d.state}`);
  }
  const reconnects = server.ranges.filter((r) => r.start > 0).length;
  check('no reconnects or restarts', server.ranges.length === 2 && reconnects === 0, `${server.ranges.length} requests`);
} finally {
  await ctx.close();
  server.close();
  await rm(tmp, { recursive: true, force: true });
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
