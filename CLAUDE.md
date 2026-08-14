# Vecihi Configurator — Claude Geliştirme Rehberi

## Proje Hakkında

Bu repo, ESP32 tabanlı Vecihi uçuş kontrol yazılımı için tarayıcı arayüzü içerir.
Ana bileşenler:
- `configurator.html` — PID, mixer, sensör ayarları yapılandırma ekranı
- `elrs_backpack.html` — ELRS Backpack üzerinden çalışan Yer Kontrol İstasyonu (YKİ)

---

## Yer Kontrol İstasyonu (YKİ) — Tasarım Hedefleri

### GCS Pasif / Aktif Mod Davranışı

**GCS switch KAPALI (pasif mod):**
- YKİ yalnızca uçaktan gelen telemetri verilerini görüntüler.
- Uçağa hiçbir komut (stick paketi) gönderilmez; bant genişliği korunur.
- Kontrol tamamen kumandadaki pilotta kalır.
- `telemetry.gcsActive = false` → `gcsActive = false` → paket gönderimi durur.

**GCS switch AÇIK (aktif mod):**
- Kumandadaki GCS kanalı aktif edildiğinde uçak tüm kontrolü YKİ'ye devreder.
- YKİ'nin slider'larından gönderilen stick komutları uçağa uygulanır.
- Paket akışı anında başlar (50 Hz, Web Worker ile tarayıcı throttling'inden bağımsız).
- `telemetry.gcsActive = true` → `gcsActive = true` → paket gönderimi başlar.

### Uçak (firmware) tarafında beklenti — `src/flight_modes.cpp`

- `update_flight_mode_selection()`: RC GCS kanalı aktifken `current_flight_mode = FlightMode::GCS`.
- GCS switch kapalıyken uçak tamamen kumandadan yönetilir; YKİ komutları dikkate alınmaz.
- `case FlightMode::GCS`: 5 saniyedir GCS paketi gelmediyse `gcs_fresh = false` →
  seviye uçuş + gaz kesme (GCS bağlantı koptu güvenliği). **Bu davranış kasıtlıdır.**
- `last_gcs_manual_time`: `GCS_MSG_STICK` (150) veya `GCS_MSG_MODE` (151) veya
  `MANUAL_CONTROL` (69) veya `RC_CHANNELS_OVERRIDE` (70) paketlerinden güncellenir.

---

## Bilinen Sorun ve Uygulanan Düzeltme

### Sorun: Sabit Konumlu Slider Komutları 5 Saniye Sonra Düşüyor

**Kök neden (birincil):** `elrs_backpack.html`'deki 50 Hz `setInterval` zamanlayıcısı,
tarayıcı sekmesi arkaplanda olduğunda (başka bir sekme aktifken) tarayıcı tarafından
throttle edilir (1 Hz'e düşürülür veya tamamen durdurulur). Bu durumda uçağa
`GCS_MSG_STICK` paketi gitmez; firmware'deki `last_gcs_manual_time` güncellenmez.
5 saniye dolunca `gcs_fresh = false` tetiklenir → throttle sıfır, kanatlar düz.
Kullanıcı sekmeye döndüğünde paketler yeniden başlar → "geri gelir" etkisi.

**Kök neden (ikincil):** ELRS Backpack bazı durumlarda custom `GCS_MSG_STICK` (msg_id=150)
paketlerini standart `RC_CHANNELS_OVERRIDE` (msg_id=70)'a dönüştürebilir. Bu durumda
`process_mavlink_rc_override()` çağrılır, fakat bu fonksiyon orijinal kodda
`last_gcs_manual_time`'ı güncellemiyordu.

**Uygulanan düzeltme 1 — `elrs_backpack.html`:**
- `setInterval` → **inline Web Worker** ile değiştirildi.
  Web Worker'lar sekme arka planda olsa bile throttle edilmez; 50 Hz sürekli devam eder.
- `gcsActive = false` iken paket gönderilmez (gerçek pasif mod).

**Uygulanan düzeltme 2 — `src/receiver.cpp`:**
- `process_mavlink_rc_override()` içine `last_gcs_manual_time = millis();` eklendi.
  RC_CHANNELS_OVERRIDE (70), fiziksel vericiden değil GCS'ten gelir; timer güncellemek güvenlidir.

---

## elrs_backpack.html — Mimari Notlar

- WebSocket → ELRS Backpack → ELRS Radyo → Uçak ESP32 zinciri üzerinden çalışır.
- Gelen telemetri: Backpack binary MAVLink'i ayrıştırır, HTML'e JSON olarak gönderir.
- `telemetry.gcsActive`: Firmware heartbeat `payload[2]` alanından gelir (`gcs_switch_on`).
- `gcsActive` değişkeni: `renderAll()` içinde `telemetry.gcsActive`'dan güncellenir.
- Stick paketleri: Custom MAVLink v2, `msg_id=150 (GCS_MSG_STICK)`.
- Mode paketleri: Custom MAVLink v2, `msg_id=151 (GCS_MSG_MODE)`.

---

## OSD Sayfası — Yeni Eleman Eklerken

Bir OSD elemanı iki repoda yedi dosyaya birden dokunulmadan çalışmaz ve
eksik halka **sessizce** bozulmaya yol açar (derleme geçer, hata çıkmaz;
eleman ya görünmez ya konumu kaydedilmez). Tam iş planı firmware tarafında:
**bkz. `vecihi/CLAUDE.md` → "OSD'ye Yeni Eleman Ekleme — İş Planı"**.

Bu repodaki dokunulacak yerler özetle:

| Dosya | Ne |
|---|---|
| `configurator.html` | OSD sayfası anahtarı (`osd_show_<key>`) **ve** önizleme kutusu (`prev_<ad>`) — iki ayrı yer |
| `assets/js/osd.js` | `osdElementMapping` + `osdToggleMapping` (`osdReverseMapping` otomatik türetilir, dokunma) |
| `assets/locales/tr.js` / `en.js` | `osd.el_<key>` ve `osd.el_<key>_hint` — ikisine de |
| `assets/changelog.json` | kullanıcı onayıyla |

Kısa anahtar (`<key>`) firmware'deki JSON alanıyla **birebir aynı** olmalı;
`send_osd_page_data()` ve `save_osd_layout()` bu anahtarla eşleşiyor.

---

## Simülatör (SITL) Sayfası

`configurator.html` → sol menü **Simülatör (SITL)**. Uçağın gerçek uçuş
yazılımı WebAssembly'ye derlenip tarayıcıda koşar; bu repoda **kaynak yok**,
yalnızca derlenmiş çıktı (`assets/sitl/sitl.js`) durur. Kaynağı ve derleme
betiği firmware reposundadır: `vecihi/sitl/` → `build_wasm.sh`.

| Dosya | Ne |
|---|---|
| `assets/js/sitl.js` | Sayfa mantığı: WASM yükleme, senaryo formu, kare döngüsü, harita/3B, canlı RC |
| `assets/sitl/sitl.js` | **Üretilmiş** WASM motoru (~180 KB, elle düzenlenmez) |
| `configurator.html` | `#sitlPage` bloğu + `.nav-always` menü öğesi |
| `assets/css/style.css` | `.sitl-*` sınıfları |

### Bilinmesi gerekenler

- **`.nav-always` / `.page-always`:** SITL, bağlantı durumundan bağımsız
  görünen tek sayfadır. Diğer sayfalar ya online ya offline; SITL ikisidir de
  (senaryo modu bağlantısız, canlı kumanda kart bağlıyken). `page_management.js`
  bu iki sınıfı özel olarak ele alır — bağlanınca sayfadan atmaz, menüden
  gizlemez. Yeni "her iki durumda da çalışan" bir sayfa eklenirse aynı yol.
- **`sitl_page_data` diye bir firmware komutu YOKTUR.** `managePageStreams()`
  içinde `sitl` bilinçli olarak dışarıda bırakıldı; simülasyon tarayıcıda koşar,
  karttan yalnızca alıcı akışı okunur.
- **Canlı kanal girdisi** `serial_communication.js` → `case 'receiver'` içinden
  `onReceiverStreamForSitl()` ile gelir. Alıcı akışını başlatan tek yer
  `startPageSpecificStream('sitl')`'dir (600 ms gecikmeli) — başka yerden de
  göndermeyin, firmware'in tek `current_command` bayrağına aynı anda iki komut
  gitmiş olur.
- **WASM motoru sayfaya girilince dinamik `<script>` ile yüklenir**, `sw.js`
  listesinde bilerek yoktur (ilk açılışta 180 KB indirmemek için).
- **Firmware'de imza/global değiştiyse WASM yeniden derlenmeli**, yoksa sayfa
  eski ikiliyi koşturmaya devam eder.

⚠️ **Güvenlik metnini zayıflatmayın:** canlı kumanda modunda kart kendi uçuş
mantığını da koşar ve arm switch'i açılınca motor/servo çıkışları gerçekten
canlanır. "PERVANEYİ SÖKÜN" uyarısı anahtar açılınca görünür olmalıdır.

---

## Tespit Edilen Eksikleri Kaydetme

Bu repoda bir iş sırasında tespit edilen ama o an kapsam dışı bırakılan eksikler
**`vecihi/GOREVLER.md` içindeki "Bakım Listesi" bölümüne** eklenir — configurator
için ayrı bir liste tutulmaz, iki repo tek listede izlenir. Kural ve format için
bkz. `vecihi/CLAUDE.md`.

---

## Geliştirici Notları

- Tarayıcı sekme throttling'ini her zaman göz önünde bulundur; zamanlayıcı gerektiren
  kritik döngüleri Web Worker'a taşı.
- `gcsActive` true olmadan hiçbir zaman komut gönderme; pasif mod mimarisini koru.
- ELRS bant genişliği kısıtlıdır; pasif modda gereksiz paket gönderme.
- `last_gcs_manual_time` 5 saniyelik timeout kasıtlı güvenlik mekanizmasıdır; süreyi uzatma.
