// Renders Chrome Web Store images into docs/store/ from popup screenshots in
// docs/store/src/: 1280x800 screenshots (EN + TR) and the 440x280 promo tile.
// JPEG output: the store rejects PNGs with an alpha channel.
// Usage: node scripts/make-store-assets.mjs  (needs Playwright + Chromium)
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const out = path.join(root, 'docs/store');
const img = async (name) => `data:image/png;base64,${(await readFile(path.join(out, 'src', name))).toString('base64')}`;
const icon = `data:image/png;base64,${(await readFile(path.join(root, 'icons/icon128.png'))).toString('base64')}`;

const TEXT = {
  en: {
    shots: [
      { src: 'list-en.png', title: 'Slow down big downloads<br>without cancelling them', points: ['Running downloads keep going — just slower', 'Browse and stream while files download', 'Tabs, filters, sorting, list or grid view'] },
      { src: 'grid-en.png', title: 'One click on the snail<br>limits every download', points: ['Pick 1, 2, 5, 10 MB/s or your own value', 'Share the limit, or download one by one', 'Separate limit for any single file'] },
      { src: 'menu-en.png', title: 'Light and dark theme,<br>English and Turkish', points: ['See the total speed right now', 'Free, no account, no ads', 'Sends no data anywhere'] },
    ],
    tagline: 'Limit download speed without cancelling',
  },
  tr: {
    shots: [
      { src: 'list-tr.png', title: 'Büyük indirmeleri<br>iptal etmeden yavaşlatın', points: ['Süren indirmeler devam eder, sadece yavaşlar', 'İndirme sürerken rahatça gezinin, video izleyin', 'Sekmeler, filtre, sıralama, liste ya da ızgara'] },
      { src: 'grid-tr.png', title: 'Salyangoza tek tıkla<br>bütün indirmeleri sınırlayın', points: ['1, 2, 5, 10 MB/s ya da kendi değeriniz', 'Hızı paylaştırın ya da sırayla indirin', 'Tek bir dosyaya ayrı sınır koyun'] },
      { src: 'menu-tr.png', title: 'Açık ve koyu tema,<br>Türkçe ve İngilizce', points: ['Toplam anlık hızı görün', 'Ücretsiz, hesap yok, reklam yok', 'Hiçbir yere veri göndermez'] },
    ],
    tagline: 'İndirme hızını iptal etmeden sınırlayın',
  },
};

const page = (body, w, h) => `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; margin: 0; }
  body { width: ${w}px; height: ${h}px; overflow: hidden;
    font-family: "Segoe UI", system-ui, -apple-system, Roboto, sans-serif;
    background: radial-gradient(circle at 15% 20%, #3b82f6 0%, #1d4ed8 45%, #172554 100%); color: #fff; }
</style></head><body>${body}</body></html>`;

const shot = async ({ src, title, points }) => page(`
  <div style="display:flex;align-items:center;gap:56px;height:100%;padding:0 72px">
    <div style="flex:1">
      <div style="display:flex;align-items:center;gap:14px;margin-bottom:34px">
        <img src="${icon}" width="52" height="52"><span style="font-size:24px;font-weight:600;opacity:.95">ARS Download Manager</span>
      </div>
      <h1 style="font-size:44px;line-height:1.15;font-weight:700;letter-spacing:-.5px">${title}</h1>
      <ul style="list-style:none;margin-top:34px;display:grid;gap:16px;padding:0">
        ${points.map((p) => `<li style="font-size:21px;display:flex;gap:12px;align-items:center;opacity:.95"><span style="width:10px;height:10px;border-radius:50%;background:#fbbf24;flex:none"></span>${p}</li>`).join('')}
      </ul>
    </div>
    <img src="${await img(src)}" width="630" height="540" style="border-radius:14px;box-shadow:0 30px 70px rgba(0,0,0,.45)">
  </div>`, 1280, 800);

const promo = (tagline) => page(`
  <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:16px;text-align:center;padding:0 24px">
    <img src="${icon}" width="96" height="96">
    <div style="font-size:30px;font-weight:700">ARS Download Manager</div>
    <div style="font-size:17px;opacity:.92">${tagline}</div>
  </div>`, 440, 280);

const browser = await chromium.launch();
const tab = await browser.newPage();
for (const [lang, t] of Object.entries(TEXT)) {
  for (const [i, s] of t.shots.entries()) {
    await tab.setViewportSize({ width: 1280, height: 800 });
    await tab.setContent(await shot(s));
    await tab.screenshot({ path: path.join(out, `screenshot-${i + 1}-${lang}.jpg`), type: 'jpeg', quality: 92 });
  }
  await tab.setViewportSize({ width: 440, height: 280 });
  await tab.setContent(promo(t.tagline));
  await tab.screenshot({ path: path.join(out, `promo-440x280-${lang}.jpg`), type: 'jpeg', quality: 92 });
}
await browser.close();
console.log('store assets written to docs/store/');
