# Chrome Web Store Publishing Kit — Template

Hand this file to an AI assistant working **inside another Chrome extension's repository**.
It tells the assistant what to check, what to create, and how every Chrome Web Store (CWS)
dashboard field should be filled. Everything for the store is written in **English**
(other UI languages of the extension can be mentioned as "also supports …").

---

## Part A — Instructions for the AI assistant

**Goal:** prepare everything needed to publish this extension on the Chrome Web Store, so the
human only has to pay, upload and paste.

**Rules**
1. **Read the code before writing anything.** Never describe features, permissions or data
   handling that you have not confirmed in the source.
2. **Don't guess facts about the human.** Ask for anything you can't find in the repo: developer/publisher name, contact e-mail, support URL, whether the repository is (or will be) public.
3. Write all store texts in **English**. Use the placeholders below (`{{LIKE_THIS}}`) and replace every one of them. When you're done, no `{{…}}` may be left.
4. **Do not** publish, pay, submit for review or change account settings yourself. Produce files and a filled form; the human submits.
5. When finished, report: files created, open questions, and anything that could get the item rejected (Part F).

**Deliverables** (create them in the repository):

| Path | What |
|---|---|
| `docs/PRIVACY.md` | Privacy policy (template in Part D) |
| `docs/store/STORE-FORM.md` | Every dashboard field with its final value (template in Part E) |
| `docs/store/screenshot-1.jpg` … `-5.jpg` | 1280×800 store screenshots, JPEG |
| `docs/store/promo-440x280.jpg` | Small promo tile, JPEG |
| `docs/store/marquee-1400x560.jpg` | *(optional)* Marquee promo tile |
| `scripts/build-zip.sh` (or equivalent) | Builds the upload ZIP from runtime files only |
| `dist/{{EXT_SLUG}}-v{{VERSION}}.zip` | The package to upload (not committed) |

---

## Part B — Audit the extension first

Do these checks and write the results at the top of `STORE-FORM.md` under "Audit".

1. **manifest.json**
   - `manifest_version` is **3**.
   - `name`: max **75** characters. Must not suggest it is made or endorsed by Google ("Chrome" may appear only as "for Chrome"-style description, not as the brand of the item).
   - `description` (this becomes the store **summary**): max **132** characters, plain sentence, no keyword lists.
   - `version`: dotted numbers only (e.g. `1.2.0`). Every new upload needs a higher version.
   - `icons`: at least **128×128** (also 16, 32, 48 recommended).
   - If `_locales/` exists, `name`/`description` may be `__MSG_…__`; check the English (`en`) messages.
2. **Permissions**
   - List every entry of `permissions`, `optional_permissions` and `host_permissions`.
   - For each one, find where the code uses it. **Remove permissions the code doesn't use**: unused permissions are a top rejection reason.
   - Prefer `activeTab` over broad host permissions like `<all_urls>` when possible.
3. **Remote code**: there must be no `<script src="https://…">`, no `eval`/`new Function` on downloaded strings, no code loaded from a server. All JS ships inside the package.
4. **Network & data flows**: search the code for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, `http://`, `https://`, analytics SDKs.
   Write down exactly: what data the extension **reads** (even if only locally), what it **stores**, and what it **sends** and to where.
5. **Data types** (needed for the Privacy tab): map what you found in step 4 to the CWS categories in Part C §4. **Local-only handling still has to be declared.**

---

## Part C — Dashboard fields and how to fill them

> Human prerequisites (do these once, before anything else):
> - Register at https://chrome.google.com/webstore/devconsole. There is a **one-time registration fee (US$5)**; listing a free extension costs nothing more.
> - **Account / Settings → Contact e-mail**: enter it **and verify it** (click the link in the e-mail). Publishing is blocked until it is verified.
> - If any link (privacy policy, images) points to GitHub, the repository must be **public**, or the links return 404 and the item is rejected.
> - Review usually takes a few days; you get an e-mail with the result.

### 1. Package
- **+ New item** → upload `dist/{{EXT_SLUG}}-v{{VERSION}}.zip`.
- The ZIP must have `manifest.json` **at its root** (not inside a sub-folder), and contain only runtime files: no `.git`, `node_modules`, tests, docs, source maps you don't need, `.env`, keys.

### 2. Store listing (*Mağaza girişi*)
| Field | Rule | Value |
|---|---|---|
| Language | Default **English** | English – en |
| Description | Max 16,000 chars. What it does, main features, how it works, privacy line. No keyword stuffing, no fake reviews/claims, no other brands' names to attract searches. | `{{DESCRIPTION}}` |
| Category | One category | `{{CATEGORY}}` (e.g. Tools, Workflow & Planning, Developer Tools, Communication, Education, Accessibility…) |
| Store icon | **128×128 PNG** (artwork ~96×96 with transparent padding looks best) | `icons/icon128.png` |
| Screenshots | **1–5** images, **1280×800** (or 640×400), **JPEG or 24-bit PNG without alpha**. Show the real UI, no misleading content. | `docs/store/screenshot-*.jpg` |
| Small promo tile | **440×280**, required | `docs/store/promo-440x280.jpg` |
| Marquee promo tile | 1400×560, optional | `docs/store/marquee-1400x560.jpg` or empty |
| YouTube video | optional | empty or `{{YOUTUBE_URL}}` |
| Official URL | only for a verified domain you own | empty |
| Homepage URL | | `{{HOMEPAGE_URL}}` (e.g. the GitHub repository) |
| Support URL | | `{{SUPPORT_URL}}` (e.g. GitHub issues) |
| Mature content | | No (unless it is) |

Title and summary come from `manifest.json` and can't be edited here.

### 3. Privacy (*Gizlilik*) — single purpose and permissions
- **Single purpose description**: **one or two plain sentences saying what the extension is for.**
  ❌ Wrong (seen in practice): `downloads, storage, alarms` (that's a list of permissions, not a purpose).
  ✅ Right: `{{SINGLE_PURPOSE}}`, e.g. "Limits the download speed of Chrome downloads without cancelling them, and lets the user manage those downloads from a list."
- **Permission justification**: one box per permission and per host permission. For each: *what feature needs it and why nothing narrower works.* 1–3 sentences, concrete.
- **Are you using remote code?** → "No" (after the Part B §3 check). If yes, you must justify it, and it is usually rejected under MV3.

### 4. Privacy — data usage
Check a box when the extension **collects or handles** that data type, **even if it never leaves the user's device**. Unchecked must mean "never touches it".

| Data type (dashboard) | Check it if the extension… |
|---|---|
| Personally identifiable information | handles names, addresses, e-mail, age, ID numbers |
| Health information | handles health/medical data |
| Financial and payment information | handles transactions, card numbers, credit info |
| Authentication information | handles passwords, credentials, security answers, PINs |
| Personal communications | reads e-mails, texts, chat messages |
| Location | uses region, IP address, GPS, nearby places |
| Web history | reads lists of visited pages, URLs, titles, visit times (**download URLs/history count too**) |
| User activity | monitors network, clicks, mouse, scroll, keystrokes |
| Website content | reads page text, images, audio, video, links |

Then **check all three certifications** (no selling/transfer outside approved uses; no use unrelated to the single purpose; no creditworthiness/lending use).
They must be true, and the privacy policy must say the same thing as these boxes.

**Privacy policy URL**: link to `docs/PRIVACY.md` (e.g. `https://github.com/{{OWNER}}/{{REPO}}/blob/main/docs/PRIVACY.md`). Required whenever any data box is checked; provide it anyway.

### 5. Distribution (*Dağıtım*)
| Field | Value |
|---|---|
| Payments | Free of charge |
| Visibility | Public (or Unlisted for testing) |
| Regions | All regions |

### 6. Test instructions (*Test talimatları*) — optional but speeds up review
```
{{TEST_INSTRUCTIONS}}
```
Say whether an account is needed (if yes, give a test account), and list 3–6 steps that show every permission being used.

### 7. Submit
**Submit for review** (human). Save draft on every tab first.

---

## Part D — Privacy policy template (`docs/PRIVACY.md`)

```markdown
# Privacy Policy — {{EXT_NAME}}

*Last updated: {{DATE}}*

{{ONE_SENTENCE_SUMMARY, e.g. "{{EXT_NAME}} does not collect, sell or share any personal data."}}

## What the extension accesses
- {{DATA_ITEM_1}}: {{why, and where it stays (only on your device / sent to X)}}
- {{DATA_ITEM_2}}: …

## What is stored
- {{e.g. "Your settings are saved in Chrome's extension storage on your computer."}}

## What is sent and to whom
- {{e.g. "Nothing. The extension makes no network requests of its own."}} — or list each endpoint, what is sent, why, and retention.

## Chrome Web Store disclosure
{{Which data types are declared on the store's Privacy tab, e.g. "Download links and file names are declared as web history handled on the device; they are never transmitted."}}

## Permissions
- `{{permission}}`: {{why}}
- …

## Contact
{{SUPPORT_URL or e-mail}}
```

Rules: it must match the Privacy tab answers exactly; no promises the code doesn't keep; reachable without login.

---

## Part E — `docs/store/STORE-FORM.md` template (fill every value)

```markdown
# Store form — {{EXT_NAME}} v{{VERSION}}

## Audit
- Permissions: {{list}} — all used: {{yes/no + notes}}
- Host permissions: {{list or none}}
- Remote code: {{none / details}}
- Network requests: {{none / endpoints}}
- Data handled: {{list → CWS data types}}

## Store listing
- Language: English
- Description: (paste block below)
  ```
  {{DESCRIPTION}}
  ```
- Category: {{CATEGORY}}
- Icon: icons/icon128.png
- Screenshots: docs/store/screenshot-1.jpg … (+ raw URLs if on GitHub)
- Small promo tile: docs/store/promo-440x280.jpg
- Homepage URL: {{HOMEPAGE_URL}}
- Support URL: {{SUPPORT_URL}}
- Mature content: No

## Privacy
- Single purpose:
  ```
  {{SINGLE_PURPOSE}}
  ```
- Permission justifications:
  - `{{permission}}`:
    ```
    {{justification}}
    ```
- Remote code: No
- Data types to check: {{e.g. Web history}} — everything else unchecked
- Certifications: all three checked
- Privacy policy URL: {{PRIVACY_URL}}

## Distribution
- Free of charge · Public · All regions

## Test instructions
  ```
  {{TEST_INSTRUCTIONS}}
  ```
```

---

## Part F — Pre-submit checklist (common rejection / blocking reasons)

- [ ] Contact e-mail entered **and verified** (Account/Settings page).
- [ ] Privacy policy URL filled **and opens without login** (repository public?).
- [ ] Single purpose is a sentence about the purpose, **not** a list of permissions.
- [ ] Every permission is used by the code and has a concrete justification; no unused permissions; host permissions as narrow as possible.
- [ ] Data-type boxes match what the code actually handles (local handling included) **and** match the privacy policy.
- [ ] No remote code; all scripts are inside the package.
- [ ] Description is accurate: no keyword spam, no claims the extension can't do, no misleading screenshots, no other brands/trademarks used to attract searches.
- [ ] Name doesn't imply Google/Chrome endorsement.
- [ ] ZIP has `manifest.json` at its root, only runtime files, version higher than the last upload.
- [ ] Screenshots 1280×800 (or 640×400), JPEG or PNG **without alpha**; promo tile 440×280.
- [ ] Every `{{placeholder}}` replaced.

---

## Part G — Assets: how to produce them

- **Screenshots**: take real screenshots of the extension's UI (popup/options/page) with realistic, non-personal data. Put the UI on a 1280×800 canvas with a short headline and 2–3 bullet points. Export **JPEG** (quality ~90) to avoid alpha-channel errors.
- **Promo tile 440×280**: icon + extension name + a short tagline, on a simple background. Little text, readable when small.
- Automating with Playwright (optional): render an HTML template at the exact viewport size and call `page.screenshot({ type: 'jpeg', quality: 92 })`.
- **Package script** (example):
  ```sh
  version=$(node -p "require('./manifest.json').version")
  zip -r -X "dist/{{EXT_SLUG}}-v${version}.zip" manifest.json {{runtime files and folders}}
  ```

## Part H — Updating later
1. Bump `version` in `manifest.json`.
2. Build the new ZIP.
3. Dashboard → item → **Package** → **Upload new package** → **Submit for review**.
4. If permissions or data handling changed, update the Privacy tab **and** `PRIVACY.md` in the same submission.
