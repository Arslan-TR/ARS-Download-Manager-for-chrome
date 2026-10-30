# Chrome Web Store'da Yayınlama — Adım Adım

Her adımda **ne tıklayacağınız** ve **ne yapıştıracağınız** yazıyor. Metinleri olduğu gibi kopyalayın.

> 💰 **Ücret:** Eklenti **ücretsiz** yayınlanır, kullanıcılar ücretsiz indirir. Ama Google, mağazaya ilk kez eklenti koyan herkesten **bir kereye mahsus 5 $** geliştirici kayıt ücreti alır. ([Google'ın sayfası](https://developer.chrome.com/docs/webstore/register))
>
> ⏳ **Süre:** Gönderdikten sonra Google inceler. Genelde birkaç gün sürer; onaylanınca e-posta gelir.

---

## 0. Önce: Depo herkese açık olsun

Gizlilik politikası linki GitHub'da. Depo **public** değilse link açılmaz ve inceleme reddedilir.
(GitHub → Settings → en alt: Danger Zone → Change visibility → Public)

---

## 1. Geliştirici hesabı (sadece ilk sefer)

1. **https://chrome.google.com/webstore/devconsole** adresini açın.
2. Google hesabınızla giriş yapın.
3. Sözleşmeyi kabul edin, **5 $** ödeyin.
4. **Account** bölümünde e-posta adresinizi doğrulayın (gelen maildeki linke tıklayın).

---

## 2. Eklentiyi yükleyin

1. **https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome/releases/latest** adresinden `ARS-Download-Manager-v.….zip` dosyasını indirin. **ZIP'i açmayın**, olduğu gibi kalsın.
2. Geliştirici panelinde **`+ New item`** düğmesine basın.
3. İndirdiğiniz ZIP'i seçin. Yüklenince eklentinin sayfası açılır.

---

## 3. "Store listing" sekmesi

**Description (açıklama)** kutusuna şunu yapıştırın:

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

----

ARS Download Manager, süren Chrome indirmelerini iptal etmeden veya yeniden başlatmadan yavaşlatır; böylece büyük indirmeler siz gezinirken, video izlerken internetinizin tamamını yemez.

★ Tek tıkla hız sınırı: Penceredeki salyangoza tıklayın. 1, 2, 5, 10 MB/s ya da kendi değeriniz.
★ Paylaştır ya da sırayla: Hız eşit bölünür ya da indirmeler sırayla iner; sıradakiler bağlantıları kopmasın diye yavaşça ilerler.
★ Gerçek bir indirme yöneticisi: tüm indirmeler tek listede, sekmeler, arama, toplu duraklatma/sürdürme, yeniden deneme, linkle yeni indirme, anlık toplam hız, dosya başına ayrı sınır.
★ Güvenli: indirmeler iptal edilmez, dosyalarınız silinmez, hesap/reklam/izleme yok, hiçbir yere veri gönderilmez.
```

Diğer alanlar:

| Alan | Ne yapacaksınız |
|---|---|
| **Category** | `Tools` (Araçlar) seçin |
| **Language** | `English` (Türkçe sayfayı aşağıda ekleyeceğiz) |
| **Store icon** | Depodaki `icons/icon128.png` dosyasını yükleyin |
| **Screenshots** | `docs/store/screenshot-1-en.jpg`, `screenshot-2-en.jpg`, `screenshot-3-en.jpg` |
| **Small promo tile** | `docs/store/promo-440x280-en.jpg` |
| **Official URL** | Boş bırakın |
| **Homepage URL** | `https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome` |
| **Support URL** | `https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome/issues` |

**Türkçe mağaza sayfası (isteğe bağlı ama önerilir):** Sayfanın üstündeki dil menüsünden **Türkçe**'yi ekleyin. Açıklamaya yukarıdaki metnin `----` çizgisinden sonraki Türkçe kısmını yapıştırın, görsel olarak da `screenshot-1-tr.jpg`, `screenshot-2-tr.jpg`, `screenshot-3-tr.jpg` ve `promo-440x280-tr.jpg` dosyalarını yükleyin.

Görselleri bilgisayarınıza indirmek için: GitHub'da `docs/store` klasörüne girin → dosyaya tıklayın → sağ üstteki **indir (⬇)** düğmesi.

En altta **Save draft** düğmesine basın.

---

## 4. "Privacy" sekmesi

**Single purpose description:**
```
Limits the download speed of Chrome downloads without cancelling them, and lets the user manage those downloads from a list.
```

**Permission justification** (her izin için ayrı kutu var):

`downloads`
```
Needed to read the list and progress of Chrome downloads and to pause and resume them in short cycles to enforce the user's speed limit. Also used for the user's own actions in the popup: start a download from a pasted link, pause/resume/retry, show a file in its folder, and remove entries from the download list.
```

`storage`
```
Saves the user's settings (speed limit, unit, distribution mode, per-file limits) and the list of downloads the extension paused itself, so it never resumes downloads the user paused.
```

`alarms`
```
A 30-second alarm restarts the background speed-limit loop if Chrome has suspended the service worker, so the limit keeps working while downloads run.
```

**Are you using remote code?** → **No, I am not using remote code**

**Data usage:** Listedeki kutuların **hiçbirini işaretlemeyin** (eklenti veri toplamıyor). Alttaki **üç taahhüt kutusunu işaretleyin**:
- I do not sell or transfer user data to third parties…
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose
- I do not use or transfer user data to determine creditworthiness or for lending purposes

**Privacy policy URL:**
```
https://github.com/Arslan-TR/ARS-Download-Manager-for-chrome/blob/main/docs/PRIVACY.md
```

**Save draft**.

---

## 5. "Distribution" sekmesi

| Alan | Seçim |
|---|---|
| **Payments** | Free of charge (ücretsiz) |
| **Visibility** | Public (herkese açık) |
| **Regions** | All regions (tüm bölgeler) |

**Save draft**.

---

## 6. Gönderin

Sağ üstte **`Submit for review`** düğmesine basın ve onaylayın.

İnceleme bitince Google e-posta gönderir. Reddedilirse e-postada sebebi yazar. O e-postayı bana gösterin, düzeltelim.

---

## Sonraki sürümler

1. Yeni release'i yayınlayın (README → "Releasing").
2. Geliştirici panelinde eklentiyi açın → **Package** sekmesi → **Upload new package** → yeni ZIP.
3. **Submit for review**.
