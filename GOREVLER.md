# X-Flight Configurator — Yapılacaklar Listesi

---

## 1. UI Entegrasyon — Kullanılmayan Config Değerleri

> Firmware'de kaydedilip NVS'te tutulan ama hiçbir kontrol mantığında okunmayan alanlar.
> Her biri için ya firmware implement edilecek ya da UI'dan kaldırılacak.

| Alan | Mevcut Durum | Yapılacak |
|------|-------------|-----------|
| `stall_speed_kmh` | Kaydediliyor, logic yok | Stall koruma bloğu yaz (`flight_modes.cpp`) |
| `stall_pitch_drop` | Kaydediliyor, logic yok | Stall koruma bloğuyla birlikte ekle |
| `gps_baud` | `main.cpp:160` hardcode 57600 | `config.nav.gps_baud` değerini oku, dinamik başlat |
| `mag_align` | Kaydediliyor, hiç kullanılmıyor | GPS/Compass yön rotasyonunu buna göre uygula |
| `has_gps` | GPS her zaman başlatılıyor | Başlatma bloğunu bu flag'e göre koşullandır |
| `max_distance` | Kaydediliyor, `navigation.cpp`'de yok | Geofence limiti olarak nav loop'a ekle |
| `climb_first` | Kaydediliyor, RTH mantığında yok | RTH başlangıcında önce yüksel seçeneği ekle |
| `descend_throttle` | Kaydediliyor, nav'da kullanılmıyor | Alçalma fazında `cruise_throttle` yerine bunu kullan |
| `fw_alt_p` | Sadece `fw_thr_p` çalışıyor | İrtifa → pitch kazancını implement et |
| `max_bank_angle_pitch` | Yorum satırı: "max_climb/dive kullanıyoruz" | Ya kaldır ya da Angle mod nav için anlam ver |

---

## 2. OSD — ARM Sonrası Kopma

**Sorun:** Araç ARM edildiğinde OSD bağlantısı/stream kesiliyor.

**Muhtemel Sebepler:**
- ARM olunca UART modu veya önceliği değişiyor olabilir
- OSD task'i ARM state'ine göre durdurulmuş olabilir (`osd_manager.cpp`)
- USB serial ile OSD UART aynı kaynağı paylaşıyor olabilir

**Plan:**
1. `osd_manager.cpp`'de ARM state değişikliğine tepki veren kod var mı kontrol et
2. `flight_modes.cpp` ARM geçişinde OSD task'ini etkileyen bir çağrı var mı bak
3. UART kaynak çakışması varsa buffer veya öncelik ayarını düzelt
4. ARM sonrası OSD stream'in kesilmeden devam ettiğini doğrula

---

## 3. Rüzgar Tahmincisi Geliştirme

**Mevcut Durum:** `wind_estimator.cpp` var ama tahmin kalitesi ve güvenilirliği sınırlı.

**Plan:**
1. Mevcut algoritmanın hangi yöntemi kullandığını belgele (GPS groundspeed vs airspeed farkı mı, triangle method mi?)
2. Çoklu ölçüm ortalaması (sliding window) ekle — anlık GPS gürültüsünü azalt
3. GPS fix kalitesine göre tahmin güvenilirliği ağırlıklandır
4. Rüzgar büyüklüğü makul bir eşiği geçince (örn. >30 km/h) uyarı logu ver
5. OSD'ye rüzgar hızı + yönünü göster (`prev_wind` elementi zaten var)
6. Nav loop'ta rüzgar kompanzasyonunu L1 hedef yönüne ekle

---

## 4. Autotune Geliştirme

**Mevcut Durum:** `pid_autotune_fw.cpp` var, temel Ziegler–Nichols benzeri bir yaklaşım kullanıyor.

**Plan:**
1. Mevcut autotune algoritmasının adımlarını belgele
2. Her eksen (roll/pitch/yaw) için ayrı tuning oturumu desteği ekle
3. Tuning sırasında PID sınırlarını (I_limit, FF) otomatik ayarla
4. Autotune biterken sonuçları NVS'e kaydetmeden önce kullanıcıya onay sor (UI üzerinden)
5. Autotune log'larını daha okunabilir hale getir: her adımda Kp/Ki/Kd + osilaston bilgisi
6. Autotune modunu UI'daki Flight Modes sayfasından tetikleyebilir hale getir

---

## 5. GPS Güvenlik — Glitch Koruma ve Spoofing Engelleme

**Mevcut Durum:** `gps_min_sats` ve `gps_min_fix_type` var ama glitch / spoofing tespiti yok.

**Plan:**

### 5a. Glitch Koruma
- GPS konumunun frame'ler arası maksimum hız vektörünü hesapla
- Fiziksel olarak imkânsız atlama (örn. 1 frame'de >50 m) tespit edilince GPS'i güvenilmez işaretle
- Güvenilmez durumda baro + IMU ile dead-reckoning'e geç, RTH tetikle

### 5b. Spoofing Tespiti
- Birden fazla uydu SNR (sinyal gücü) ortalamasını takip et — spoofing'de tüm uydular eşit güçlü görünür
- GPS hız vektörü ile IMU ivme entegrasyonu uyumsuzluğunu izle
- Hız tutarsızlığı eşiği aşılırsa GPS'i devre dışı bırak ve uyarı ver
- `gps_data` struct'ına `is_spoofed` ve `is_glitching` flag'leri ekle

### 5c. Genel
- Tüm GPS güvenlik olaylarını log'a yaz (spoof şüphesi, glitch, fix kaybı)
- OSD'de GPS durumunu renk kodlu göster (yeşil/sarı/kırmızı)
- `max_distance` (geofence) aşıldığında RTH'ı otomatik tetikle (madde 1'deki eksikle bağlantılı)
