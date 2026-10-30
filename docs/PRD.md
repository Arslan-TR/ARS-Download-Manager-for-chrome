# Ürün Gereksinim Belgesi (PRD): Chrome İndirme Hız Sınırlandırıcı Eklentisi

## 1. Ürünün Amacı (Purpose)
Bu ürünün temel amacı; Google Chrome tarayıcısı üzerinden gerçekleştirilen büyük boyutlu dosya indirmelerinin (örneğin arka arkaya başlatılan gigabaytlarca büyüklükteki dosyalar) tüm yerel ağ ve internet bant genişliğini tüketmesini engellemektir. 

Kullanıcılar genellikle mevcut indirmelerini iptal etmek istemezler ancak indirme sırasında web'de gezinmek, video izlemek veya diğer çevrimiçi işleri yapmak istediklerinde internetleri kilitlenir. Bu eklenti, **hâlihazırda devam etmekte olan (aktif) Chrome indirmelerini iptal etmeden veya yeniden başlatmadan** tarayıcı seviyesinde global veya dosya bazlı bir hız sınırı (bandwidth throttling) uygulamak için tasarlanmıştır.

## 2. Hedef Kitle (Target Audience)
* Aynı anda birden fazla veya çok büyük boyutlu dosyalar (ISO, oyun, yüksek boyutlu arşivler vb.) indiren Chrome kullanıcıları.
* Sınırlı veya paylaşımlı internet bağlantısına sahip olup, indirme yaparken diğer ağ işlemlerinin aksamasını istemeyen profesyoneller ve bireysel kullanıcılar.

## 3. Temel Özellikler (Key Features)

### 3.1. Aktif İndirmeleri Algılama ve Listeleme
* Eklenti, Chrome'un yerleşik `chrome.downloads` API'sini kullanarak o an devam eden (inmekte olan) dosyaların listesini (Dosya adı, boyutu, inen miktar, tahmini kalan süre ve indirme URL'si) anlık olarak çeker.

### 3.2. Global Hız Sınırı (Speed Limiting)
* Kullanıcının popup arayüzünden belirleyeceği bir bant genişliği sınırı (Örn: 2 MB/s, 5 MB/s) tüm aktif indirmelere orantılı veya sırayla uygulanır.
* **Mekanizma:** `chrome.downloads.pause` ve `chrome.downloads.resume` metotları kullanılarak oluşturulan akıllı bir döngü (token bucket mantığı) ile hız kontrolü sağlanır.

### 3.3. Kolay Yönetim Paneli (Popup UI)
* Tarayıcı araç çubuğundaki eklenti simgesine tıklandığında açılan minimalist bir arayüz:
  * Aktif indirmelerin listesi ve ilerleme çubukları.
  * Hız sınırı ayar alanı (Aç/Kapat ve Mbps/MBs seçici).
  * Tüm indirmeleri duraklat / devam ettir / iptal et kısayolları.

## 4. Teknik Mimari ve Sınırlamalar (Technical Requirements)
* **Manifest Sürümü:** Manifest V3 (Google'ın güncel standartları gereği).
* **İzinler:** `downloads`, `storage`.
* **Arka Plan Servisi (Background Service Worker):** İndirme durumlarını dinler, hız sınırlandırma döngüsünü arka planda yönetir.
* **Arayüz:** `popup.html`, `popup.css`, `popup.js`.

## 5. Başarı Kriterleri (Success Metrics)
* Kullanıcının aktif indirmelerini kaybetmeden (bağlantı kopması yaşamadan) hızını kısıtlayabilmesi.
* Tarayıcının tamamının kilitlenmesini önleyerek diğer sekme ve uygulamalara internet payı bırakılması.