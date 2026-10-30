# ARS Download Manager for Chrome

Chrome (Manifest V3) extension that **limits the speed of downloads that are already running — without cancelling or restarting them** — so a few huge downloads don't eat the whole connection while you browse or watch video.

Arayüz Türkçe ve İngilizce'dir (tarayıcı diline göre otomatik). Turkish and English UI, picked from the browser language.

> 📘 **Step-by-step install & usage guide: [English](docs/INSTALL.md) · [Türkçe](docs/KURULUM.md)**

![popup](docs/popup-en.png)

## Features

- **Live list of active downloads** — name, size, downloaded amount, progress bar, speed, time left, URL.
- **Global speed limit** in KB/s, MB/s or Mbps, with 1/2/5/10 MB/s presets and an on/off switch.
- **Two distribution modes**
  - **Share** — the limit is split evenly; a download whose server is slower than its share gives the unused part to the others.
  - **One by one** — the oldest download gets the bandwidth; the rest crawl in **snail mode** instead of stopping, so their connections stay alive. When the first one finishes, the next takes over.
- **Per-file limit** on any download, with or without the global limit.
- **Pause all / Resume all / Cancel all** (cancel asks for a second click), plus per-download pause/resume/cancel.
- Downloads you pause yourself stay paused — the limiter never resumes them.
- Toolbar badge shows the active limit (e.g. `2M`).

## Install (developer mode)

Beginner-friendly step-by-step guide: [English](docs/INSTALL.md) · [Türkçe](docs/KURULUM.md).

1. Clone or download this repository (**Code → Download ZIP**, then unzip to a folder you keep).
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → select the repository folder.

Requires Chrome 116+.

## How it works

Extensions cannot shape bandwidth directly. Like the PRD specifies, the limiter uses `chrome.downloads.pause` / `resume` in a token-bucket loop (`lib/throttle.js`):

- Every ~200 ms the service worker reads the active downloads. Each limited download has a token bucket refilled at its allocated rate; received bytes are taken out of it.
- When a bucket runs dry the download is paused; when it has refilled, it is resumed.
- Chrome's pause stops reading from the socket but keeps the connection open, so TCP flow control stops the server. Nothing is cancelled or re-requested.

Measured Chrome behaviour the design accounts for:

- Chrome publishes `bytesReceived` only about every 500 ms while a download runs, and not while it is paused.
- After a pause the server keeps sending until socket and pipe buffers are full (several MB); every resume drains them.

So data arrives in **bursts of several MB** followed by a pause that repays them. Speeds are correct **on average** (the popup shows a 20 s average), not smooth second by second.

## Limitations

- **No pause lasts longer than ~15 s**, so servers don't drop the connection (typical send timeouts are 60 s). If one burst would take longer than that to repay — a very low limit on a very fast line — the extra is forgiven and the real speed ends up above the limit. Example: on a 16 MB/s line, limits from roughly 1–2 MB/s upward hold well.
- For the same reason, **snail mode is "as slow as possible while staying connected"**: about one burst every 15 s (≈1 MB/s on a 16 MB/s line). What snails use is taken out of the first download's share, so the total stays near the limit.
- If a server still drops a paused connection, the extension tries to resume the download once (works when the server supports HTTP Range).
- Only Chrome downloads are limited, not other tab or app traffic.

## Development

No dependencies.

```sh
npm test            # unit tests (node:test) incl. a simulator modelled on Chrome's behaviour
npm run test:e2e    # loads the extension in Chromium via Playwright, downloads from a paced local server
E2E_LANG=tr E2E_SHOTS=./out npm run test:e2e   # Turkish UI, save popup screenshots
node scripts/make-icons.mjs                    # re-render icons/icon*.png from icons/icon.svg
```

The e2e run needs Playwright with Chromium available; it checks the limit, share/one-by-one modes, user pauses, releasing the limit, file integrity (SHA-256) and that no download reconnected.

## Layout

```
manifest.json        MV3 manifest (downloads, storage, alarms)
background.js        service worker: tick loop, applies decisions, messages, badge
lib/throttle.js      pure throttling engine (token buckets, allocation, modes)
lib/units.js         unit conversion and formatting
lib/state.js         settings (storage.local) and our-paused set (storage.session)
popup.html/css/js    toolbar popup
_locales/{en,tr}     UI strings
docs/PRD.md          product requirements
```
