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

### Betaflight Karşılaştırması (Kök Neden Analizi)

Betaflight'ın `osd.c` kaynak kodu incelendi. OSD-ARM geçişini şu şekilde yönetir:

**Betaflight'ın doğru yaptığı:**
```c
// osd.c - osdProcessStats1()
if (armState != ARMING_FLAG(ARMED)) {
    if (ARMING_FLAG(ARMED)) {
        osdStatsEnabled = false;
        osdStatsVisible = false;
        osdResetStats();
        resumeRefreshAt = osdShowArmed() + currentTimeUs;  // ARM geçici ekran
    }
    armState = ARMING_FLAG(ARMED);
}
```

```c
// osdShowArmed() — ARM geçişinde ne olur:
static timeDelta_t osdShowArmed(void) {
    displayClearScreen(osdDisplayPort, DISPLAY_CLEAR_WAIT);  // Ekranı temizle
    displayWrite(..., "ARMED");   // Ortaya "ARMED" yaz
    return (REFRESH_1S / 2);     // 500ms bekle, sonra normal OSD devam eder
}
```

```c
// osdUpdate() — ARM sonrası resume koruması:
if (resumeRefreshAt) {
    if (cmp32(currentTimeUs, resumeRefreshAt) < 0) {
        return;  // Timer dolana kadar render etme
    }
    // Timer doldu → resumeRefreshAt = 0 → normal OSD devam
}
```

**Betaflight'ın kritik tasarım kararları:**
1. OSD task ASLA suspend/delete edilmez — ARM boyunca çalışmaya devam eder
2. ARM'da ekran temizlenip "ARMED" yazısı gösterilir, 500ms sonra normal OSD geri gelir
3. OSD task'i `TASK_PRIORITY_LOW` olarak kalır, önceliği ARM'da değişmez
4. State machine (`osdState`) ile rendering birden fazla scheduler döngüsüne yayılır
5. `resumeRefreshAt` değişkeni ile render geçici olarak durdurulur, task değil

### X-Flight'ta Tespit Edilen Muhtemel Hatalar

**BUG-1: OSD task'inin suspend edilmesi (En Olası)**

`osd_manager.cpp` veya `flight_modes.cpp` içinde büyük ihtimalle şu var:
```cpp
// YANLIŞ — Betaflight'ta böyle bir şey YOK
if (is_armed) {
    vTaskSuspend(osd_task_handle);   // BUG: task asla devam etmez
}
```

Doğru yaklaşım:
```cpp
// DOĞRU — Betaflight yaklaşımı
if (arm_state_changed && is_armed) {
    osd_clear_screen();
    osd_write_center("ARMED");
    resume_at = current_time_us + 500000;  // 500ms sonra devam
    // Task hiç durdurulmuyor
}
if (current_time_us < resume_at) return;  // Task çalışıyor, sadece return
```

**BUG-2: ARM geçişinde UART reset / baud değişimi**

ARM olunca ESC telemetri veya başka bir amaç için OSD UART'ı yeniden yapılandırılıyorsa:
```cpp
// YANLIŞ
if (is_armed) {
    uart_init(OSD_UART, new_baud);  // OSD bağlantısını keser
}
```

Düzeltme: ARM geçişinde OSD UART konfigürasyonu değiştirilmemeli.

**BUG-3: FreeRTOS task priority çakışması**

ARM'da flight control task'ının önceliği yükseltiliyorsa ve OSD task aynı çekirdeği paylaşıyorsa:
```cpp
// Kontrol edilecek: flight_modes.cpp içinde
vTaskPrioritySet(flight_ctrl_task, PRIORITY_REALTIME);
// OSD task aynı core'daysa hiç çalışamaz hale gelir
```

Düzeltme:
- OSD task'ini ayrı bir ESP32 core'a ata (`xTaskCreatePinnedToCore`)
- Flight control: Core 1 (PRO_CPU), OSD: Core 0 (APP_CPU)

**BUG-4: Stack overflow (sessiz çökme)**

ESP32'de FreeRTOS task'ı stack overflow'da sessizce çöker. ARM'da yığın kullanımı artar.
```cpp
// osd_manager.cpp başlatma kısmında stack boyutunu artır
xTaskCreate(osd_task, "OSD", 4096, NULL, 2, &osd_task_handle);
//                            ^^^^
// 2048 ise yetersiz olabilir, 4096+ dene
```

### Düzeltme Planı (Öncelik Sırasıyla)

1. **`osd_manager.cpp` kontrol:** ARM state callback'te `vTaskSuspend` veya `vTaskDelete` var mı?
   - Varsa: sil, yerine `resume_at` timer + erken return ekle

2. **`flight_modes.cpp` kontrol:** ARM transition callback'te OSD ile ilgili herhangi bir çağrı var mı?
   - Varsa: kaldır

3. **Task core affinity:** OSD task'i `xTaskCreatePinnedToCore(..., 0)` ile Core 0'a, uçuş görevlerini Core 1'e sabitle

4. **Stack boyutu:** OSD task stack'i en az 4096 byte olarak ayarla

5. **ARM geçiş animasyonu:** Betaflight yaklaşımıyla:
   - ARM → ekranı temizle → "ARMED" yaz → 500ms bekle → normal OSD devam
   - DISARM → istatistik ekranı göster (60s) → normal OSD devam

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

## 5. Navigasyon — Gaz ve Yer Hızı Integral Kontrolü

**Hedef:** Nav modunda sabit yer hızı tutabilmek için gaz çıkışına integral (I) terimi ekle.

**Mevcut Durum:** Nav loop gaz çıkışını büyük ihtimalle sadece P kazancıyla ya da sabit `cruise_throttle` ile hesaplıyor; sürekli rüzgar veya eğim gibi kalıcı hatalarda hedef yer hızına ulaşılamıyor.

**Plan:**
1. `navigation.cpp`'de groundspeed → throttle döngüsünü bul
2. Hız hatası (hedef groundspeed − ölçülen groundspeed) integralini tut (`speed_error_integral`)
3. Anti-windup sınırı ekle — integral ±throttle_max'ın belirli bir yüzdesini geçemesin
4. Integral sıfırlama koşulları tanımla: nav modu çıkışı, throttle satürasyon, ARM değişimi
5. Yeni PI kazançlarını (`nav_speed_i`) config struct'a ekle ve UI'dan ayarlanabilir yap
6. Test: farklı rüzgar ve eğim koşullarında groundspeed sabitliğini logla, P-only ile karşılaştır

---

## 6. GPS Güvenlik — Glitch Koruma ve Spoofing Engelleme

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

**** landing Son Yaklaşma (Final)
Final Başlangıç Mesafesi (m) 3 derece eğim 1500 metre saçmalığı kalkacak default olarak 350 metre girilecek
son yaklaşmada otomatik flaperon
