# Chrome Web Store form — ARS Download Manager

This file is meant to be handed to an AI assistant (or a person) that fills in the
**Chrome Web Store Developer Dashboard** for this extension. Every field, its value and
every file to upload is listed below.

## Rules for the assistant filling the form

1. The item already exists in the dashboard (name **ARS Download Manager**, publisher **Arslan-TR**). Only fill in the fields below. **Do not** upload a new package, delete the item, change the publisher account or pay anything.
2. Everything entered is **English**. The dashboard itself may be shown in Turkish, so each field is given as **English label** (*Turkish label*); if a label differs slightly, match it by meaning.
3. Copy values **exactly** — text inside code blocks is pasted as-is, without the code-block markers.
4. Click **Save draft** (*Taslağı kaydet*) after each tab.
5. **Do not click "Submit for review"** (*İnceleme için gönder*). When everything is filled in, stop and tell the human what was filled and anything that failed.
6. Files to upload can be downloaded from the URLs given (the GitHub repository must be public for the links to work).

---

## Tab 1 — Store listing (*Mağaza girişi*)

**Language** (*Mevcut düzenleme dili*) = **English – en (default)** (*İngilizce – en (varsayılan)*). The whole listing is in English.

**Description** (*Açıklama*) — required, max 16,000 characters:

```
ARS Download Manager slows down Chrome downloads that are already running — without cancelling or restarting them — so big downloads stop eating your whole connection while you browse, watch videos or work.

★ Speed limit in one click
Click the snail at the bottom of the window to turn the limit on or off. Pick 1, 2, 5 or 10 MB/s, or type your own value in KB/s, MB/s or Mbps.

★ Share or one by one
• Share: the limit is split evenly between your downloads.
• One by one: the first download gets the speed; the others keep crawling slowly ("snail mode") so their connections never drop.

★ A real download manager window
• All your downloads in one list: active, paused, finished, failed
• Tabs: All, Active, Completed, Images, Video, Music, Documents, Archives
• Search, select several, pause, resume, retry, show in folder
• Start a new download by pasting a link
• See the total download speed right now and its average
• Separate speed limit for any single file

★ Safe and private
• Downloads are never cancelled or restarted by the limiter
• Downloads you pause yourself stay paused
• "Remove" only clears the list — your files are never deleted
• No account, no ads, no tracking; the extension sends no data anywhere

Works in English and Turkish, light and dark theme.

How it works: Chrome has no built-in speed limit for downloads, so the extension pauses and resumes them in short cycles. The average speed matches your limit; the instant speed jumps around, which is normal.

Open source: https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome
```

**Category** (*Kategori*) — required, applies to all languages:
- Choose **Tools** (*Araçlar*).
- If that option does not exist, choose **Workflow & Planning** (*İş akışı ve planlama*).

**Graphic assets** (*Grafik öğeler*):

| Field | File to upload | Download URL |
|---|---|---|
| Store icon (*Mağaza simgesi*) 128×128 — required | `icons/icon128.png` | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/icons/icon128.png |
| Screenshots (*Ekran görüntüleri*) 1280×800 — at least 1 | `docs/store/screenshot-1-en.jpg` | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/screenshot-1-en.jpg |
| | `docs/store/screenshot-2-en.jpg` | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/screenshot-2-en.jpg |
| | `docs/store/screenshot-3-en.jpg` | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/screenshot-3-en.jpg |
| Small promo tile (*Küçük tanıtım karosu*) 440×280 — required | `docs/store/promo-440x280-en.jpg` | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/promo-440x280-en.jpg |
| Marquee promo tile 1400×560 (*Büyük tanıtım karosu*) | — leave empty | |
| YouTube video (*Tanıtım videosu*) | — leave empty | |

**Additional fields** (*Ek alanlar*):

| Field | Value |
|---|---|
| Official URL (*Resmi URL*) | leave empty / None (*Yok*) |
| Homepage URL (*Ana sayfa URL'si*) | `https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome` |
| Support URL (*Destek URL'si*) | `https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome/issues` |
| Mature content (*Yetişkinlere yönelik içerik*) | **No** (leave off) |

Click **Save draft** (*Taslağı kaydet*).

---

## Tab 2 — Privacy (*Gizlilik*)

**Single purpose description** (*Tek amaç açıklaması*):

```
Limits the download speed of Chrome downloads without cancelling them, and lets the user manage those downloads from a list.
```

**Permission justification** (*İzin gerekçesi*) — one box per permission (4 boxes: `downloads`, `downloads.open`, `storage`, `alarms`):

`downloads`
```
Needed to read the list and progress of Chrome downloads and to pause and resume them in short cycles to enforce the user's speed limit. Also used for the user's own actions in the popup: start a download from a pasted link, pause/resume/retry, show a file in its folder, and remove entries from the download list.
```

`downloads.open`
```
Lets the user open a finished download from the popup (the ▶ button on a completed file, or a double-click on it). Chrome only allows this in direct response to the user's click.
```

`storage`
```
Saves the user's settings (speed limit, unit, distribution mode, per-file limits) and the list of downloads the extension paused itself, so it never resumes downloads the user paused.
```

`alarms`
```
A 30-second alarm restarts the background speed-limit loop if Chrome has suspended the service worker, so the limit keeps working while downloads run.
```

(If the form also shows a box for host permissions, there are none — the extension requests no host permissions.)

**Are you using remote code?** (*Uzak kod kullanıyor musunuz?*) → **No, I am not using remote code** (*Hayır*)

**Data usage** (*Veri kullanımı*):
- Check **only Web history** (*Web geçmişi*). The extension reads download links and file names on the user's device; Google's policy says data handled locally must still be disclosed, even though nothing is transmitted.
- Leave every other data-type checkbox **unchecked** (personally identifiable information, health, financial, authentication, personal communications, location, user activity, website content).
- **Check all three** certifications:
  - I do not sell or transfer user data to third parties, outside of the approved use cases
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose
  - I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL** (*Gizlilik politikası URL'si*):

```
https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome/blob/main/docs/PRIVACY.md
```

Click **Save draft** (*Taslağı kaydet*).

---

## Tab 3 — Distribution (*Dağıtım*)

| Field | Value |
|---|---|
| Payments (*Ödemeler*) | **Free of charge** (*Ücretsiz*) |
| Visibility (*Görünürlük*) | **Public** (*Herkese açık*) |
| Regions (*Bölgeler*) | **All regions** (*Tüm bölgeler*) |

Click **Save draft** (*Taslağı kaydet*).

---

## Tab 4 — Test instructions (*Test talimatları*) — optional, helps the review

```
No account or login is needed.
1. Start any large download in Chrome (for example an ISO or a video file).
2. Click the extension icon. The download appears in the list with progress and speed.
3. Click the snail button at the bottom left to turn the speed limit on; open the panel with the arrow at the bottom right to change the limit (e.g. 1 MB/s) or the distribution mode.
4. The download keeps running (it is not cancelled or restarted); its average speed drops to the limit.
5. The toolbar buttons pause/resume selected downloads, start a new download from a pasted link, remove entries from the list (files are not deleted) and show files in their folder.
```

Click **Save draft** (*Taslağı kaydet*).

---

## Done

Stop here and report to the human. They will review and click **Submit for review** (*İnceleme için gönder*) themselves.

Known requirements before submitting:
- The GitHub repository must be **public** (otherwise the privacy policy link and image URLs do not open).
- The developer account must have its contact e-mail verified (Account page, *Hesap*).

---

## Optional appendix — Turkish store listing

The listing is English. The extension itself also supports Turkish, so a Turkish store page is **optional**. Only do this if the human asks for it: in **Store listing**, switch **Language** (*Mevcut düzenleme dili*) to **Turkish – tr** (*Türkçe*), add it if needed, and fill:

**Description** (*Açıklama*):

```
ARS Download Manager, süren Chrome indirmelerini iptal etmeden veya yeniden başlatmadan yavaşlatır; böylece büyük indirmeler siz gezinirken, video izlerken ya da çalışırken internetinizin tamamını yemez.

★ Tek tıkla hız sınırı
Penceredeki salyangoza tıklayarak sınırı açıp kapatın. 1, 2, 5 veya 10 MB/s seçin ya da kendi değerinizi KB/s, MB/s veya Mbps olarak yazın.

★ Paylaştır ya da sırayla
• Paylaştır: sınır indirmeleriniz arasında eşit bölünür.
• Sırayla: hızı ilk indirme alır; diğerleri bağlantıları hiç kopmasın diye yavaşça ilerlemeye devam eder ("salyangoz modu").

★ Gerçek bir indirme yöneticisi penceresi
• Bütün indirmeleriniz tek listede: süren, duraklatılan, biten, başarısız olan
• Sekmeler: Tümü, Aktif, Tamamlanan, Resimler, Video, Müzik, Belgeler, Arşivler
• Arama, çoklu seçim, duraklatma, sürdürme, yeniden deneme, klasörde gösterme
• Link yapıştırarak yeni indirme başlatma
• Şu anki toplam indirme hızı ve ortalaması
• Tek bir dosyaya ayrı hız sınırı

★ Güvenli ve gizli
• Hız sınırlayıcı indirmeleri asla iptal etmez veya baştan başlatmaz
• Sizin duraklattığınız indirmeler duraklatılmış kalır
• "Kaldır" sadece listeyi temizler, dosyalarınız asla silinmez
• Hesap yok, reklam yok, izleme yok; eklenti hiçbir yere veri göndermez

Türkçe ve İngilizce, açık ve koyu tema.

Nasıl çalışır: Chrome'da indirmeler için yerleşik bir hız sınırı yoktur; eklenti indirmeleri kısa aralıklarla duraklatıp sürdürür. Ortalama hız sınırınıza eşittir; anlık hızın zıplaması normaldir.

Açık kaynak: https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome
```

**Graphic assets** (*Grafik öğeler*), Turkish versions:

| Field | Download URL |
|---|---|
| Screenshots (*Ekran görüntüleri*) | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/screenshot-1-tr.jpg |
| | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/screenshot-2-tr.jpg |
| | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/screenshot-3-tr.jpg |
| Small promo tile (*Küçük tanıtım karosu*) | https://raw.githubusercontent.com/Arslan-TR/ARS-Download-Manager-for-chrome/main/docs/store/promo-440x280-tr.jpg |

(The title and summary come from the package automatically; they are not editable here.)

Click **Save draft** (*Taslağı kaydet*).
