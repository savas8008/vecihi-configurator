window.VECIHI_LOCALE_TR = {
  "header": {
    "connection_none": "Bağlantı Yok",
    "disconnect": "Bağlantıyı Kes",
    "hw_gyro_title": "Jiroskop (MPU6050)",
    "hw_accel_title": "İvmeölçer (MPU6050)",
    "hw_baro_title": "Barometre",
    "hw_pitot_title": "Pitot Tüpü (MS4525DO)",
    "hw_receiver_title": "RC Alıcı"
  },

  "ticker": {
    "label": "Son Güncellemeler"
  },

  "nav": {
    "sensors": "Sensörler",
    "calibration": "Kalibrasyon",
    "mixer": "Mikser",
    "gps": "Navigasyon & GPS",
    "transmitter": "Kumanda",
    "modes": "Uçuş Modları",
    "pid": "PID",
    "advanced": "Tercihler",
    "osd": "OSD",
    "waypoint": "Waypoint",
    "logs": "Loglar",
    "home": "Konfiguratör",
    "firmware": "Firmware",
    "ground_control": "Yer Kontrol",
    "kml": "Log → KML",
    "docs": "Dokümanlar"
  },

  "connection": {
    "title": "Konfiguratöre Giriş",
    "description": "Cihazınıza enerji verdikten sonra",
    "description_bold": "ilk 10 saniye içinde",
    "description_end": "seri porta bağlayın. Aksi takdirde uçuş moduna geçer.",
    "connect_btn": "Porta Bağlan"
  },

  "pin_common": {
    "reboot_warning": "Kaydet butonuna basıldığında cihaz",
    "reboot_warning_bold": "otomatik olarak yeniden başlatılır",
    "reboot_warning_end": "ve bağlantı kendiliğinden yeniden kurulur.",
    "recommend": "Tavsiye: GPIO"
  },

  "firmware": {
    "title": "Firmware Güncelleme",
    "subtitle": "ESP32 üzerine Vecihi firmware yükler",
    "current_version": "Mevcut versiyon:",
    "loading": "Yükleniyor...",
    "build_date": "Derleme:",
    "flash_warning": "Flash işlemi için önce seri bağlantıyı kesin ve tarayıcı sekmesini yenileyin.",
    "flash_btn": "Flash Başlat"
  },

  "kml": {
    "title": "EdgeTX Log → KML Dönüştürücü",
    "subtitle": "EdgeTX CSV log kaydını Google Earth'e aktarın — bağlantı gerekmez.",
    "drop_text": "CSV dosyasını buraya sürükleyin veya tıklayarak seçin",
    "drop_hint": "EdgeTX / OpenTX log formatı (.csv)",
    "stat_date": "Tarih",
    "stat_duration": "Süre",
    "stat_alt": "Maks. İrtifa",
    "stat_speed": "Maks. Hız",
    "stat_dist": "Toplam Mesafe",
    "stat_gps": "GPS Noktası",
    "btn_download": "KML İndir",
    "btn_earth": "Google Earth'te Aç",
    "btn_reset": "Sıfırla",
    "ge_hint": "KML dosyası indirildi. Google Earth Web açıldığında",
    "ge_hint_bold": "Dosya → İçe Aktar",
    "ge_hint_end": "veya dosyayı sürükle-bırak ile yükleyin."
  },

  "docs": {
    "title": "Dokümanlar & Kaynaklar",
    "subtitle": "Kablolama, kurulum ve kullanım rehberleri.",
    "wiring_label": "Bağlantı Kılavuzu",
    "wiring_caption": "Kablolama ve bağlantı şemasını aç",
    "readme_label": "README / Kurulum",
    "readme_caption": "Kurulum ve kullanım adımlarını aç",
    "video_label": "Demo Videoları",
    "video_playlist": "Oynatma Listesi",
    "video_caption": "Kullanım ve ekran anlatım videoları",
    "hw_label": "Donanım / PCB",
    "hw_caption": "PCB üretim dosyalarını indir"
  },

  "sensors": {
    "title": "Canlı Sensör Verileri",
    "cal_view": "Kalibrasyon Görünümü",
    "flight_mode": "UÇUŞ MODU",

    "gps_title": "GPS Durumu",
    "gps_sats": "UYDU SAYISI",
    "gps_lat": "ENLEM",
    "gps_lon": "BOYLAM",
    "gps_speed": "YER HIZI (km/h)",
    "gps_airspeed": "HAVA HIZI (km/h)",

    "alt_title": "İrtifa & Pusula",
    "altitude": "İRTİFA",
    "vario": "VARİO",

    "battery_title": "Batarya",
    "voltage": "VOLTAJ",
    "adc_pin": "ADC PIN",

    "map_title": "Konum",
    "mcu_title": "MCU & Sistem Durumu",
    "core1": "CORE 1 (LOOP)",
    "core0": "CORE 0 (SYS)",
    "temperature": "SICAKLIK",
    "free_ram": "BOŞ RAM"
  },

  "calibration": {
    "page_title": "Kalibrasyon",
    "pin_title": "IMU Sensör Pinleri (I2C)",
    "pin_scl_label": "SCL",
    "pin_sda_label": "SDA",
    "pin_save": "I2C Pinlerini Kaydet",
    "gpio_scl_hint": "Tavsiye: GPIO 22",
    "gpio_sda_hint": "Tavsiye: GPIO 21",

    "pose_title": "Pozisyon Kalibrasyonu (6 Yüz)",
    "pose_hint": "Her adımda uçağı konumlandırıp tıklayın",
    "pose_zp": "Düz (tekerlekler aşağıda)",
    "pose_zn": "Ters (tekerlekler havada)",
    "pose_xp": "Burun yukarı (dik)",
    "pose_xn": "Burun aşağı (dik)",
    "pose_yp": "Sol kanat yukarı",
    "pose_yn": "Sağ kanat yukarı",

    "current_values": "Mevcut Kalibrasyon Değerleri",

    "gyro_title": "Gyro Kalibrasyonu",
    "gyro_hint": "Cihazı tamamen hareketsiz tutun ve tıklayın.",

    "level_title": "Hard Kalibrasyon (Level)",
    "level_hint": "Cihazı düz konuma alıp 2sn bekleyin, sonra tıklayın.",

    "btn_save": "Kalibrasyonu Kaydet",
    "btn_reset": "Kalibrasyonu Sıfırla",

    "align_title": "Sensör Yönelimi (Board Alignment)",
    "align_desc": "Uçuş kontrol kartının gövde içindeki montaj yönünü seçin. Değiştirildiğinde kalibrasyon sıfırlanır.",
    "align_save": "Yönelimi Kaydet"
  },

  "gps": {
    "page_title": "Navigasyon & GPS",
    "pin_title": "GPS Bağlantı Pinleri (UART)",
    "pin_tx": "TX (ESP → GPS)",
    "pin_rx": "RX (GPS → ESP)",
    "pin_save": "GPS Pinlerini Kaydet",
    "gpio_tx_hint": "Tavsiye: GPIO 5",
    "gpio_rx_hint": "Tavsiye: GPIO 18",

    "hw_title": "GPS Donanım",
    "hw_active": "GPS Modülü Aktif",
    "hw_protocol": "Protokol",
    "hw_proto_auto": "Otomatik (Önerilen)",
    "hw_proto_ubx6": "UBX Legacy (NEO-6M)",
    "hw_proto_ubx7": "UBX PVT (NEO-7+)",
    "hw_mag_align": "Mag Yönü",
    "hw_min_sats": "Min Uydu",
    "hw_min_fix": "Min Fix Tipi",
    "hw_fix_2d": "2D Fix",
    "hw_fix_3d": "3D Fix",

    "rth_title": "RTH (Eve Dönüş)",
    "rth_alt": "RTH İrtifası (m)",
    "rth_radius": "Loiter Yarıçapı (m)",
    "loiter_dir": "Loiter Yönü",
    "loiter_dir_right": "Sağ (CW)",
    "loiter_dir_left": "Sol (CCW)",
    "loiter_shared_hint": "Yarıçap ve yön, RTH bekleme dairesi ile bağımsız LOITER modu arasında ortaktır.",
    "rth_geofence": "Geofence (m)",
    "rth_geofence_hint": "0=Yok",
    "rth_climb_first": "Eve Dönerken Önce Yüksel",

    "angle_title": "Açı Limitleri",
    "angle_max_roll": "Max Roll (°)",
    "angle_max_climb": "Max Tırmanma (°)",
    "angle_max_dive": "Max Dalış (°)",

    "throttle_title": "Gaz (Throttle) Ayarları",
    "throttle_min": "Nav Min Gaz",
    "throttle_descend": "Alçalma Gazı",
    "throttle_cruise": "Seyir Gazı",
    "throttle_climb": "Tırmanma Gazı",
    "throttle_max": "Nav Max Gaz",

    "l1_title": "L1 Navigasyon",
    "l1_desc": "Rota takip algoritması parametreleri.",
    "l1_period": "L1 Periyodu (sn)",
    "l1_period_hint": "Düşük=Sert, Yüksek=Yumuşak Dönüş",
    "l1_damping": "L1 Damping",
    "l1_pitch2thr": "Pitch → Gaz",
    "l1_pitch2thr_hint": "Her 1° pitch artışı için eklenen PWM gaz miktarı.",

    "turn_assist_enabled": "Turn Assist Kullan (Koordineli Dönüş)",
    "turn_assist_warning": "Kapalıyken hiçbir modda (RTH dahil) çalışmaz. Etkinleştirmeden önce yerde/düşük irtifada test edin.",
    "turn_assist_ref_airspeed": "Referans Hız (m/s)",
    "turn_assist_ref_airspeed_hint": "Pitot/sanal airspeed yoksa kullanılır. Önerilen: uçağınızın tipik seyir hızı, genelde 12-20 m/s. Varsayılan: 15 m/s.",
    "turn_assist_yaw_gain": "Yaw Kazancı",
    "turn_assist_yaw_gain_hint": "Önerilen başlangıç: 2.0 (teorik değer 1.0 gerçek uçuşta zayıf kalabiliyor). İhtiyaca göre kademeli artırın/azaltın. Aralık: 0.5-10.",
    "turn_pitch_gain": "Pitch Kazancı (°/G)",
    "turn_pitch_gain_hint": "Dönüşte fazladan her 1G için burun kaldırma miktarı. Varsayılan: 15°.",
    "turn_throttle_gain": "Throttle Kazancı (PWM/G)",
    "turn_throttle_gain_hint": "Dönüşte fazladan her 1G için gaz takviyesi. Varsayılan: 250 PWM.",

    "btn_save": "GPS & Nav Kaydet",
    "btn_reset_nav": "Nav Ayarlarını Sıfırla"
  },

  "mixer": {
    "page_title": "Mikser",
    "pin_title": "Çıkış Pinleri",
    "pin_recommend_btn": "Tavsiye",
    "pin_save": "Çıkış Pinlerini Kaydet",
    "aux_hint1": "Yardımcı çıkış 1",
    "aux_hint2": "Yardımcı çıkış 2",

    "motor_ctrl": "MOTOR CTRL",
    "no_prop": "Pervane yok",
    "safety_warning": "⚠️ Onay gerekiyor",

    "aux_title": "Yardımcı Çıkışlar",
    "aux_desc": "Her yardımcı çıkış, seçilen RC kanalını doğrudan belirlenen GPIO pinine iletir (uçuş mikseri dışında). Kamera gimbal, iniş takımı, ışık veya ilave motor için kullanabilirsiniz.",
    "rc_channel": "RC Kanalı",
    "ch_disabled": "Devre Dışı",
    "ch_1_roll": "Kanal 1 (Roll)",
    "ch_2_pitch": "Kanal 2 (Pitch)",
    "ch_3_throttle": "Kanal 3 (Throttle)",
    "ch_4_yaw": "Kanal 4 (Yaw)",

    "aircraft_title": "Uçak Tipi Seçimi",
    "vtail_desc": "V şeklinde kuyruk yapısı",
    "ttail_desc": "T şeklinde kuyruk yapısı",
    "noruder_title": "RUDERSIZ",
    "noruder_desc": "Ruder olmadan",
    "delta_desc": "Delta kanat",

    "gains_title": "Mikser Kazançları",
    "gains_desc": "Her eksen için mikser oranını ayarlayın. 100 = normal, -100 = ters, 50 = %50 güç. Yaw tersleniyorsa Yaw değerini negatif yapın (örn: -100).",
    "btn_save": "Kaydet"
  },

  "transmitter": {
    "page_title": "Kumanda ve Alıcı Ayarları",
    "pin_title": "Alıcı Bağlantı Pinleri (UART)",
    "pin_tx": "TX (ESP → Alıcı)",
    "pin_rx": "RX (Alıcı → ESP)",
    "pin_save": "Alıcı Pinlerini Kaydet",

    "config_title": "Konfigürasyon",
    "protocol_label": "HABERLEŞME PROTOKOLÜ",
    "proto_sbus": "SBUS / IBUS",
    "proto_elrs": "CRSF (ELRS / Crossfire)",
    "proto_mavlink": "MAVLink",

    "ch_map_label": "KANAL SIRALAMASI (CHANNEL MAP)",
    "ch_map_hint": "Her eksene istediğiniz fiziksel alıcı kanalını atayın",
    "ch_reverse_label": "KANAL TERSLEME (REVERSE)",

    "live_title": "Canlı Kanal Değerleri",
    "waiting": "Veri bekleniyor... Bağlantıyı kontrol edin.",

    "btn_save": "Kumanda Ayarlarını Kaydet",

    "stick_cmds_link": "Kumanda Stick Komutları",
    "stick_modal_title": "Kumanda Stick Komutları",
    "stick_warn_important": "Önemli:",
    "stick_warn_text": "Bu komutlar yalnızca uçak",
    "stick_warn_disarm": "DISARM",
    "stick_warn_end": "konumundayken çalışır. Arm durumunda yok sayılır.",
    "stick_mode_warn_title": "Kumanda Tipi Uyarısı:",
    "stick_mode_warn_text": "Görseller varsayılan",
    "stick_mode_warn_mode": "Mode 2",
    "stick_mode_warn_end": "düzenine göredir. Kanal atamanıza göre pozisyonlar değişebilir. Komutu uygulamadan önce",
    "stick_mode_warn_pwm": "PWM eşik değerlerini",
    "stick_mode_warn_verify": "canlı kanal panelinden doğrulayın.",
    "force_arm_title": "Force Arm",
    "force_arm_desc": "Normal arm koşulları sağlanmasa bile (yetersiz uydu vb.) zorla arm eder. 2 saniye boyunca aşağıdaki pozisyonu koruyun.",
    "left_stick": "Sol Çubuk",
    "right_stick": "Sağ Çubuk",
    "arm_switch": "Arm Switch",
    "duration": "Süre",
    "save_settings_title": "Save Settings",
    "save_settings_desc": "Autotune bu oturumda yapılmışsa PID değerlerini kalıcı belleğe (NVS) yazar. Autotune yapılmamışsa kayıt",
    "save_settings_skip": "atlanır",
    "save_settings_end": "— veri bozulması riski yoktur. 2 saniye boyunca aşağıdaki pozisyonu koruyun."
  },

  "modes": {
    "page_title": "Uçuş Modları",
    "btn_save": "Modları Kaydet"
  },

  "pid": {
    "page_title": "PID Ayarları",
    "level_desc": "Uçağın kendini düzeltme sertliği.",
    "tpa_desc": "throttle veya pitot tüpü varsa hava hızı arttıkça PIFF kazancını yüzde bazında düşürür.",
    "btn_save": "PID Kaydet"
  },

  "advanced": {
    "page_title": "Tercihler",

    "bat_pin_title": "Batarya Voltaj Ölçümü (ADC)",
    "bat_pin_label": "ADC GPIO Pin",
    "bat_pin_save": "ADC Pinlerini Kaydet",
    "adc_pin_hint": "Tavsiye: GPIO 34, 35 veya 36 (giriş-only)",

    "tab_flight": "Uçuş Limitleri",
    "tab_alt": "İrtifa",
    "tab_hw": "Donanım & Filtreler",
    "tab_battery": "Batarya",
    "tab_pitot": "Pitot Tüpü",

    "flight_section": "Uçuş Limitleri & Auto Launch",
    "angle_limits": "Angle Mod Limitleri",
    "angle_max_roll": "Max Roll Açısı (°)",
    "angle_max_pitch": "Max Pitch Açısı (°)",

    "launch_section": "Otomatik Kalkış (Auto Launch)",
    "launch_auto_on_arm": "Her arm sonrasında otomatik kalkış moduna geç",
    "launch_disarm_on_land": "İniş sonrasında otomatik disarm",
    "launch_acc_threshold": "Fırlatma Eşiği (G)",
    "launch_acc_hint": "Kalkışı tetiklemek için gereken ivme",
    "launch_throttle": "Kalkış Gazı (PWM)",
    "launch_max_time": "Auto Launch max süresi (saniye)",
    "launch_max_alt": "Auto Launch max Yüksekliği (metre)",
    "launch_angle": "Kalkış Açısı (°)",
    "launch_spool_time": "Fırlatma ile motorun çalışması arasındaki süre (ms)",
    "launch_spool_hint": "Fırlatma öncesi motor ısınma süresi",
    "stick_cancel_thr": "Stick İptal Eşiği (PWM)",
    "stick_cancel_hint": "Merkezden stick sapması bu değeri aşarsa Auto Launch veya otomatik iniş iptal edilir (pilot devralır)",
    "thr_cancel_thr": "Gaz İptal Eşiği (PWM)",
    "thr_cancel_hint": "Gaz bu değeri aşarsa otomatik iniş iptal edilir (pilot devralır)",

    "stall_section": "Stall Koruması",
    "stall_speed": "Stall Hızı (km/h)",
    "stall_speed_hint": "Bu hızın altında stall koruması devreye girer",
    "stall_pitch_drop": "Pitch Düşürme (°)",
    "stall_pitch_hint": "Stall'da burun ne kadar düşürülsün",

    "turn_comp_section": "Dönüş Telafisi (Load Factor + Koordineli Dönüş)",
    "turn_comp_pitch_title": "Yükseklik Telafisi (RTH/WAYPOINT/LAND ASSIST'te her zaman aktif)",
    "turn_comp_yaw_title": "Turn Assist — Koordineli Dönüş (opsiyonel)",

    "flaperon_section": "Flaperon Droop",
    "flaperon_amount": "Droop Miktarı (µs)",
    "flaperon_info_title": "Flaperon Droop Ayarı:",
    "flaperon_info_1": "Flaperon aktifken aileronlara uygulanan simetrik droop. Aralık: −500–+500 µs.",
    "flaperon_info_2": "Pozitif değer: aileronlar aşağı iner (normal).",
    "flaperon_info_3": "Negatif değer: aileronlar yukarı kalkar — servo montajı nedeniyle aileronlar ters yönde hareket ediyorsa negatif değer kullanın (örn: −150).",

    "alt_section": "İrtifa Tahmini",
    "alt_sensor_source": "Sensör Kaynağı",
    "alt_use_baro": "Barometre Kullan",
    "alt_kalman": "Kalman Filtre Katsayıları",
    "alt_baro_p": "Baro Pozisyon (P)",
    "alt_baro_v": "Baro Hız (V)",
    "alt_acc_bias": "ACC Bias",
    "alt_acc_deadzone": "ACC Deadzone",
    "alt_acc_lpf": "ACC LPF",

    "hw_section": "Donanım, Sensör & Filtreler",
    "esc_section": "ESC Protokolü",
    "esc_hz_label": "ESC Hızı",
    "esc_hz_pwm": "PWM (50Hz - Analog)",
    "esc_hz_fast": "FastPWM (400Hz)",
    "servo_hz_label": "Servo Hızı",
    "servo_hz_analog": "50Hz (Analog)",
    "servo_hz_digital": "160Hz (Dijital)",
    "servo_hz_fast": "333Hz (Dijital Hızlı)",
    "servo_hz_max": "400Hz (Maksimum)",

    "gyro_section": "Gyro & IMU",
    "gyro_lpf_active": "Gyro LPF Aktif",
    "gyro_lpf_hz": "Gyro LPF (Hz)",
    "accel_lpf_hz": "Accel LPF (Hz)",
    "mahony_kp": "Mahony Kp",
    "mahony_ki": "Mahony Ki",

    "rpm_section": "RPM Filtresi",
    "rpm_active": "RPM Filtresi Aktif",
    "rpm_min_freq": "Min Frekans (Hz)",
    "rpm_max_freq": "Max Frekans (Hz)",
    "rpm_bw": "Bandwidth (%)",

    "trim_section": "Kart Hizalama (Trim)",
    "trim_roll": "Roll Trim (°)",
    "trim_pitch": "Pitch Trim (°)",

    "realtime_section": "Gerçek Zamanlı Sensör Verileri",
    "stream_start": "Veri Akışını Başlat",

    "bat_section": "Batarya",
    "bat_voltage_section": "Voltaj Ölçümü (ADC)",
    "bat_adc_hint": "ADC GPIO pin ayarı sayfanın üstündedir.",
    "bat_scale": "Ölçek Faktörü",
    "bat_scale_hint": "(R1+R2)/R2",
    "bat_voltage_help_title": "Gerilim Bölücü Hesabı:",
    "bat_voltage_help": "ESP32 ADC girişi maks. 3.3V ölçer. Lipo voltajını bölücüyle düşürmek gerekir.",
    "bat_pin_disabled_hint": "Pin -1 ise voltaj ölçümü devre dışı kalır.",

    "bat_cell_section": "Hücre Voltaj Limitleri",
    "bat_cell_section_hint": "(OSD Pil Simgesi)",
    "bat_cell_min": "Boş Hücre Voltajı",
    "bat_cell_min_hint": "Hücre başına boş voltaj — pil simgesi bu eşiğin altında boş görünür",
    "bat_cell_max": "Dolu Hücre Voltajı",
    "bat_cell_max_hint": "Hücre başına dolu voltaj — pil simgesi bu eşikte dolu görünür",
    "bat_cell_help_title": "OSD Pil Simgesi Hesabı:",

    "bat_virtual_section": "Sanal Akım Sensörü",
    "bat_max_current": "Max Akım (A)",
    "bat_max_current_hint": "Tam gazda motor + tüm elektroniklerin toplam çektiği akım (A)",
    "bat_idle_current": "Boşta Akım (A)",
    "bat_idle_current_hint": "Gaz sıfırken alıcı + servo + ESP32 toplam boşta akım (A)",
    "bat_calibration": "Kalibrasyon",
    "bat_calibration_hint": "İlk uçuş sonrası ince ayar: gerçek_tüketim / tahmin_tüketim",
    "bat_capacity": "Kapasite (mAh)",
    "bat_capacity_hint": "Pilin toplam kapasitesi — kumandada Bat% göstergesi bu değere göre hesaplanır",
    "bat_cal_steps_title": "Kalibrasyon Adımları:",

    "bat_calc_section": "Kalibrasyon Hesaplayıcılar",
    "volt_calc_title": "Voltaj Kalibrasyonu",
    "volt_calc_shown": "Telemetride görünen (V)",
    "volt_calc_actual": "Gerçekte ölçülen (V)",
    "volt_calc_btn": "Ölçeği Hesapla ve Uygula",
    "volt_calc_hint": "Multimetre ile ölçülen gerçek voltajı gir.",

    "mah_calc_title": "Kapasite Kalibrasyonu",
    "mah_calc_reported": "Tahmin edilen tüketim (mAh)",
    "mah_calc_actual": "Gerçek tüketim (mAh)",
    "mah_calc_btn": "Kalibrasyonu Hesapla ve Uygula",
    "mah_calc_hint": "Şarj cihazının yüklediği mAh'ı gir.",

    "pitot_section": "MS4525DO Pitot Tüpü",
    "pitot_sensor_label": "Pitot Sensörü",
    "pitot_enabled": "Etkin",
    "pitot_disabled_hint": "Devre dışıyken hava hızı GPS bazlı (sanal) hesaplanır.",
    "pitot_scale_label": "Ölçek (Scale)",
    "pitot_scale_hint": "Varsayılan: 1.00 · Tüp açısı veya uzunluk farkı için ince ayar.",

    "btn_save": "Tercihleri Kaydet"
  },

  "osd": {
    "page_title": "OSD Tasarımcı",
    "page_subtitle": "Ekran öğelerini ve sistem bilgilerini özelleştirin",
    "pin_title": "OSD Bağlantı Pinleri (UART)",
    "pin_tx": "TX (ESP → OSD)",
    "pin_rx": "RX (OSD → ESP)",
    "pin_save": "OSD Pinlerini Kaydet",
    "osd_active": "OSD Aktif",

    "font_warning_title": "Önemli:",
    "font_warning": "OSD sembollerinin doğru görüntülenebilmesi için gözlüğünüzde",
    "font_warning_bold": "INAV",
    "font_warning_end": "fontu seçili olmalıdır. Aksi takdirde ekranda anlamsız semboller ve karakterler görünecektir.",

    "elements_title": "Ekran Öğeleri",
    "el_arm_status": "Arm Durumu",
    "el_flight_mode": "Uçuş Modu",
    "el_speed": "Hız (Ground Speed)",
    "el_airspeed": "Hava Hızı (Airspeed)",
    "el_airspeed_hint": "Son harf kaynağı gösterir: P=Pitot (gerçek sensör), V=Virtual (GPS tahmini), ----=veri yok.",
    "el_rssi": "RSSI (Sinyal Gücü)",
    "el_battery": "Pil Voltajı",
    "el_altitude": "İrtifa",
    "el_vario": "Vario (Dikey Hız)",
    "el_horizon": "Yapay Ufuk",
    "el_home": "Home Bilgisi",
    "el_throttle": "Gaz (Throttle)",
    "el_throttle_slider": "Gaz Göstergesi (Slider)",
    "el_wind": "Rüzgar Bilgisi",
    "el_battery_cap": "Pil Kapasitesi (mAh)",
    "el_cell_voltage": "Hücre Voltajı (V/hücre)",
    "el_current": "Anlık Akım (A)",
    "el_sys_msg": "Sistem Mesajları",
    "el_sats": "Uydu Sayısı",
    "el_lat": "GPS Enlem (Lat)",
    "el_lon": "GPS Boylam (Lon)",
    "el_gcode": "Google Plus Code",
    "el_timer": "Uçuş Süresi",

    "preview_hint": "Önizleme Ekranı (50x20 Karakter Izgarası)",

    "settings_title": "Sistem & Görüntü Ayarları",
    "screen_ratio": "Ekran Oranı",
    "pilot_name": "Pilot Adı (Callsign)",
    "craft_name": "Hava Aracı Adı",
    "units": "Ölçü Birimi",
    "units_metric": "Metrik (m, km/h)",
    "units_imperial": "Imperial (ft, mph)",
    "low_voltage": "Düşük Voltaj (V)",
    "max_dist": "Mesafe Uyarısı (m)",
    "btn_save": "Ayarları Cihaza Kaydet"
  },

  "logs": {
    "page_title": "Komut Konsolu & Sistem Logları",

    "shortcuts_title": "Kısayollar",
    "acc_system": "Sistem & Konfigürasyon",
    "btn_factory": "FABRİKA AYARLARI",
    "btn_pid_reset": "PID SIFIRLA",
    "btn_calib_del": "KALİB. SİL",

    "acc_calibration": "Kalibrasyon İşlemleri",
    "btn_gyro_reset": "JİROSKOP SIFIRLA",
    "btn_level": "TERAZİ (TRIM)",
    "btn_cal_start": "BAŞLAT",
    "btn_cal_solve": "HESAPLA & KAYDET",

    "acc_streams": "Canlı Veri Akışları",
    "stream_sensors": "SENSÖRLER (GPS/BARO)",
    "stream_imu": "IMU (JİRO/İVME)",
    "stream_3d": "3D DURUŞ (QUAT/EULER)",
    "stream_receiver": "ALICI & KANALLAR",
    "btn_open": "AÇ",
    "btn_close": "KAPAT",

    "acc_pages": "Sayfa Verilerini Güncelle",
    "btn_advanced": "GELİŞMİŞ",
    "btn_outputs": "ÇIKIŞLAR",
    "btn_modes": "MODLAR",
    "btn_receiver": "ALICI",

    "acc_backup": "Ayar Yedekleme",
    "btn_export": "Dışa Aktar",
    "btn_import": "İçe Aktar",

    "search_placeholder": "Loglarda arama yap...",
    "filter_all": "Tüm Kayıtlar",
    "filter_info": "Bilgi (Info)",
    "filter_success": "Başarılı",
    "filter_warning": "Uyarılar",
    "filter_error": "Hatalar",
    "filter_command": "Giden Komutlar",
    "filter_receive": "Gelen Veri",

    "auto_scroll": "Oto. Kaydır",
    "pause": "Akışı Durdur",
    "btn_clear": "Temizle",
    "btn_save_log": "Kaydet",

    "log_title": "Sistem Kayıtları (Logs)",
    "cmd_label": "MANUEL KOMUT GİRİŞİ",
    "cmd_placeholder": "Örn: CAL_GYRO yazıp gönderin...",

    "stats_title": "İletişim İstatistikleri",
    "stat_total": "Toplam Satır",
    "stat_commands": "Giden Komut",
    "stat_errors": "Hata Sayısı",
    "stat_success": "Başarılı:",
    "stat_warning": "Uyarı:",
    "stat_error": "Hata:"
  },

  "waypoint": {
    "page_title": "Waypoint Misyon Planlayıcı",
    "map_title": "Harita",
    "map_hint": "Haritaya tıklayarak waypoint ekleyin",

    "upload_title": "FC'ye Yükle",
    "btn_upload": "Waypoint'leri Kaydet",
    "btn_clear_all": "Tüm Waypoint'leri Temizle",

    "list_title": "Waypoint Listesi",
    "list_empty": "Henüz waypoint eklenmedi.",
    "list_empty_hint": "Haritaya tıklayın.",
    "manual_add": "Manuel Ekle",
    "btn_add": "Ekle",

    "kamikaze_title": "Kamikaze Görev Ayarları",
    "dive_section": "DALIŞ",
    "dive_angle": "Dalış Açısı (°)",
    "dive_angle_hint": "5° = sığ  —  90° = dik dik",
    "dive_alt_offset": "Başlama İrtifa Farkı (m)",
    "dive_alt_hint": "0 = WP irtifasından  —  negatif = daha alçak",

    "mission_section": "GÖREV SİSTEMİ",
    "trigger_alt": "Tetikleme İrtifası (m AGL)",
    "trigger_alt_hint": "Bu irtifada servo tam gaz konumuna geçer",
    "mission_servo": "Görev Servosu",
    "mission_servo_disabled": "Devre Dışı",

    "usage_section": "KULLANIM",
    "usage_1": "Sol taraftaki alanlarda dalış açısı ve servo ayarlarını yapın",
    "usage_2": "WP Parametrelerini Kaydet butonuna basın",
    "usage_3": "Haritaya hedef noktasını tıklayın",
    "usage_4": "Waypoint görevini",
    "usage_4_bold": "Kamikaze",
    "usage_4_end": "olarak seçin",
    "usage_5": "Waypoint'leri FC'ye yükleyin",
    "usage_note": "Dalış açısı sabit tutulur; başlama mesafesi mevcut irtifaya göre otomatik hesaplanır.",

    "mission_params_title": "Misyon Genel Parametreleri",
    "wp_capture_radius": "WP Yakalama Yarıçapı (m)",
    "wp_capture_hint": "Varsayılan: 25m",

    "land_assist_title": "İniş Asistan Ayarları",
    "land_assist_subtitle": "Land Assist — Rüzgara Göre Otomatik Devre",

    "approach_section": "Yaklaşma",
    "approach_alt": "Yaklaşma İrtifası (m AGL)",
    "circuit_dir": "Devre Yönü",
    "circuit_right": "Sağ Devre",
    "circuit_left": "Sol Devre",

    "final_section": "Son Yaklaşma (Final)",
    "final_distance": "Final Başlangıç Mesafesi (m)",
    "final_distance_hint": "0 = Otomatik (irtifa÷tan3°)",
    "circuit_width": "Devre Genişliği (m)",

    "flare_section": "Flare & Gaz",
    "flare_alt": "Flare Başlangıç İrtifası (m AGL)",
    "approach_throttle": "Yaklaşma Gazı (PWM)",
    "flare_throttle": "Flare Gazı (PWM)",

    "runway_section": "Pist",
    "min_wind_speed": "Min Rüzgar Hızı (m/s)",
    "manual_runway_hdg": "Manuel Pist Başlığı (°)",

    "btn_save_wp": "WP Parametrelerini Kaydet"
  },

  "modal": {
    "confirm_title": "Onay",
    "btn_cancel": "İptal",
    "btn_confirm": "Devam Et",
    "save_title": "Kayıt Durumu",
    "btn_close": "Kapat",

    "pins_title": "Tavsiye Edilen Pinler",
    "pins_subtitle": "Aşağıdaki eşleşmeler paylaştığın görselden çıkarılmış öneri yerleşimidir.",
    "pins_warning_title": "Önemli bağlantı notu",
    "pins_warning_text": "GPS, alıcı gibi RF bağlantıları ile IMU bileşenleri arasında besleme hattında mutlaka uygun kapasitör kullanın. Ani akım çekişi ve parazitler IMU verisini bozabilir, reset veya ölçüm kararsızlığı oluşturabilir.",
    "pins_motor_section": "Motor ve Servo Çıkışları",
    "pins_aux_section": "AUX Portları"
  },

  "common": {
    "save": "Kaydet",
    "cancel": "İptal",
    "close": "Kapat",
    "reset": "Sıfırla",
    "loading": "Yükleniyor...",
    "rev": "Rev",
    "on": "AÇ",
    "off": "KAPAT",
    "disabled": "Devre Dışı",
    "recommended": "Tavsiye"
  }
};
