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

## Geliştirici Notları

- Tarayıcı sekme throttling'ini her zaman göz önünde bulundur; zamanlayıcı gerektiren
  kritik döngüleri Web Worker'a taşı.
- `gcsActive` true olmadan hiçbir zaman komut gönderme; pasif mod mimarisini koru.
- ELRS bant genişliği kısıtlıdır; pasif modda gereksiz paket gönderme.
- `last_gcs_manual_time` 5 saniyelik timeout kasıtlı güvenlik mekanizmasıdır; süreyi uzatma.
