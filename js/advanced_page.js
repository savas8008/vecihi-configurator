/**
 * @file advanced_page.js
 * @brief Gelişmiş ayarlar sayfası yönetimi
 * X-Flight Configurator için modüler JS
 */

// === GLOBAL DEĞİŞKENLER ===

let advancedConfig = {
    filters: { 
        gyro_lpf_beta: 0.2, 
        rpm_min_freq: 100, 
        rpm_max_freq: 400, 
        rpm_bw_percent: 0.2 
    },
    mahony: { 
        kp: 2.0, 
        ki: 0.05, 
        centrifugal_fade: 20.0 
    },
    nav: { 
        // Temel Ayarlar
        rth_altitude: 50, 
        max_bank_angle: 45, 
        cruise_throttle: 1450, 
        
        // Navigasyon ve Stall
        rth_radius: 50,
        stall_speed_kmh: 40.0,
        stall_pitch_drop: 3.0,
        climb_throttle: 1700,
        descend_throttle: 1100,
        
        // Navigasyon PID
        nav_p: 1.5, 
        nav_i: 0.05, 
        nav_d: 0.0,

        // GPS Donanım
        has_gps: false, 
        gps_protocol: 0, 
        gps_baud: 9600,
        
        // Launch
        launch_throttle: 1700, 
        launch_angle: 20, 
        launch_time: 2000
    }, 
    misc: { 
        tpa: 0.00, 
        esc_hz: 50 
    },
    // Altitude & GPS Karışımı
    alt_config: { 
        baro_p: 1.0, 
        acc_z_p: 1.5, 
        acc_z_i: 0.1, 
        use_gps: true, 
        gps_weight: 0.05 
    },
    // Kart Hizalama
    calib_extra: {
        trim_roll: 0.0,
        trim_pitch: 0.0
    },
    // Waypoint misyon genel
    nav_wp: {
        wp_capture_radius: 25
    },
    // Flaperon
    flaperon_offset: 150,
    // İniş Asistanı Ayarları
    land_assist: {
        circuit_alt: 50,
        final_approach_distance: 0,
        circuit_width: 150,
        flare_alt: 5.0,
        approach_throttle: 1200,
        flare_throttle: 1000,
        stick_cancel_thr: 100,
        thr_cancel_thr: 1150,
        min_wind_speed: 2.0,
        manual_runway_hdg: 0.0
    },
};

// === VERİ İŞLEME ===

/**
 * @brief ESP'den gelen advanced sayfa verilerini işler
 * @param {Object} data - Gelen veri objesi
 */
function handleAdvancedPageData(data) {
    // 1) Filtreler (kısmi veri gelirse default kaybolmasın)
    if (data.filters) {
        advancedConfig.filters = Object.assign({}, advancedConfig.filters, data.filters);
    }

    // 2) Mahony
    if (data.mahony) {
        advancedConfig.mahony = Object.assign({}, advancedConfig.mahony, data.mahony);
    }

    // 3) Nav
    if (data.nav) {
        advancedConfig.nav = Object.assign({}, advancedConfig.nav, data.nav);
    }

    // 4) Misc
    if (data.misc) {
        advancedConfig.misc = Object.assign({}, advancedConfig.misc, data.misc);
    }

    // 5) Altitude config
    if (data.alt_config) {
        advancedConfig.alt_config = Object.assign({}, advancedConfig.alt_config, data.alt_config);
    }

    // 6) Trim
    if (data.calib_extra) {
        advancedConfig.calib_extra = Object.assign({}, advancedConfig.calib_extra, data.calib_extra);
    }

    // 7) Nav waypoint
    if (data.nav_wp) {
        advancedConfig.nav_wp = Object.assign({}, advancedConfig.nav_wp, data.nav_wp);
    }

    // 8) Landing Assist
    if (data.land_assist) {
        advancedConfig.land_assist = Object.assign({}, advancedConfig.land_assist, data.land_assist);
    }

    // 9) Flaperon Offset
    if (data.flaperon_offset !== undefined) {
        advancedConfig.flaperon_offset = data.flaperon_offset;
    }

    updateAdvancedUI();
}

// === UI GÜNCELLEME ===

/**
 * @brief advancedConfig objesindeki verileri UI'a yansıtır
 */
function updateAdvancedUI() {
    const getEl = (id) => document.getElementById(id);

    const setVal = (id, v) => {
        const el = getEl(id);
        if (!el || v === undefined || v === null) return;
        el.value = v;
    };

    const setChk = (id, v) => {
        const el = getEl(id);
        if (!el || v === undefined || v === null) return;
        el.checked = !!v;
    };

    // --- Filters ---
    if (advancedConfig.filters) {
        const f = advancedConfig.filters;
        setVal("inp_gyro_beta", f.gyro_lpf_beta);
        setVal("inp_rpm_min_freq", f.rpm_min_freq);
        setVal("inp_rpm_max_freq", f.rpm_max_freq);
        setVal("inp_rpm_bw_percent", f.rpm_bw_percent);
    }

    // --- Mahony ---
    if (advancedConfig.mahony) {
        setVal("inp_mahony_kp", advancedConfig.mahony.kp);
        setVal("inp_mahony_ki", advancedConfig.mahony.ki);
    }

    // --- Nav ---
    if (advancedConfig.nav) {
        const n = advancedConfig.nav;

        // Angle mode limitleri
        setVal("inp_ang_lim_roll", n.ang_lim_roll);
        setVal("inp_ang_lim_pitch", n.ang_lim_pitch);

        // Auto launch
        setVal("inp_launch_acc_threshold", n.launch_acc_threshold);
        setVal("inp_launch_throttle", n.launch_throttle);
        setVal("inp_launch_time", n.launch_time);
        setVal("inp_launch_altitude", n.launch_altitude);
        setVal("inp_launch_angle", n.launch_angle);
        setVal("inp_launch_spool_time", n.launch_spool_time);

        // Stall koruması
        setVal("inp_stall_speed_kmh", n.stall_speed_kmh);
        setVal("inp_stall_pitch_drop", n.stall_pitch_drop);

        // GPS donanım
        setChk("inp_has_gps", n.has_gps);
        toggleGpsSettings();
        setVal("inp_gps_proto", n.gps_protocol);
        setVal("inp_gps_baud", n.gps_baud);
        setVal("inp_mag_align", n.mag_align);

        // GPS güvenlik
        setVal("inp_gps_min_sats", n.gps_min_sats);
        setVal("inp_gps_min_fix_type", n.gps_min_fix_type);

        // RTH
        setVal("inp_nav_rth_alt", n.rth_altitude);
        setVal("inp_nav_radius", n.rth_radius);
        setVal("inp_nav_max_dist", n.max_distance);
        setChk("inp_nav_climb_first", n.climb_first);

        // Nav açı limitleri
        setVal("inp_nav_max_bank_roll", n.max_bank_angle_roll);
        setVal("inp_nav_max_bank_pitch", n.max_bank_angle_pitch);
        setVal("inp_nav_max_climb", n.max_climb);
        setVal("inp_nav_max_dive", n.max_dive);

        // Throttle ayarları
        setVal("inp_nav_min_throttle", n.nav_min_throttle);
        setVal("inp_nav_descend", n.descend_throttle);
        setVal("inp_nav_cruise", n.cruise_throttle);
        setVal("inp_nav_climb", n.climb_throttle);
        setVal("inp_nav_max_throttle", n.nav_max_throttle);

        // Otopilot kazançları
        setVal("inp_nav_fw_alt_p", n.fw_alt_p);
        setVal("inp_nav_fw_thr_p", n.fw_thr_p);
        setVal("inp_nav_fw_pitch2thr", n.fw_pitch2thr);

        // L1 navigasyon
        setVal("inp_nav_l1_period", n.l1_period);
        setVal("inp_nav_l1_damping", n.l1_damping);
    }

    // --- Altitude config ---
    if (advancedConfig.alt_config) {
        const ac = advancedConfig.alt_config;
        setChk("inp_alt_has_baro", ac.has_baro);
        setVal("inp_alt_w_z_baro_p", ac.w_z_baro_p);
        setVal("inp_alt_w_z_baro_v", ac.w_z_baro_v);
        setVal("inp_alt_w_z_acc_bias", ac.w_z_acc_bias);
        setVal("inp_alt_acc_deadzone", ac.acc_deadzone_mss);
        setVal("inp_alt_acc_lpf", ac.acc_lpf_factor);
    }

    // --- Misc ---
    if (advancedConfig.misc) {
        setVal("inp_esc_hz", advancedConfig.misc.esc_hz);
    }

    // --- Trim ---
    if (advancedConfig.calib_extra) {
        setVal("inp_trim_roll", advancedConfig.calib_extra.trim_roll);
        setVal("inp_trim_pitch", advancedConfig.calib_extra.trim_pitch);
    }

    // --- Nav Waypoint ---
    if (advancedConfig.nav_wp) {
        setVal("inp_wp_capture_radius", advancedConfig.nav_wp.wp_capture_radius);
    }

    // --- Flaperon ---
    if (advancedConfig.flaperon_offset !== undefined) {
        const slider = document.getElementById('flaperonOffsetSlider');
        const label  = document.getElementById('flaperonOffsetValue');
        if (slider) slider.value = advancedConfig.flaperon_offset;
        if (label)  label.textContent = advancedConfig.flaperon_offset;
    }

    // --- Landing Assist ---
    if (advancedConfig.land_assist) {
        const la = advancedConfig.land_assist;
        setVal("inp_la_circuit_alt", la.circuit_alt);
        setVal("inp_la_final_approach_distance", la.final_approach_distance);
        setVal("inp_la_circuit_width", la.circuit_width);
        setVal("inp_la_flare_alt", la.flare_alt);
        setVal("inp_la_approach_throttle", la.approach_throttle);
        setVal("inp_la_flare_throttle", la.flare_throttle);
        setVal("inp_la_stick_cancel_thr", la.stick_cancel_thr);
        setVal("inp_la_thr_cancel_thr", la.thr_cancel_thr);
        setVal("inp_la_min_wind_speed", la.min_wind_speed);
        setVal("inp_la_manual_runway_hdg", la.manual_runway_hdg);
    }

}

// === KAYDETME ===

/**
 * @brief UI'daki değerleri toplar ve ESP'ye gönderir
 */
function saveAdvancedConfig() {
    const getEl = (id) => document.getElementById(id);

    const num = (id) => {
        const el = getEl(id);
        if (!el) return undefined;
        const v = parseFloat(el.value);
        return Number.isFinite(v) ? v : undefined;
    };

    const int = (id) => {
        const el = getEl(id);
        if (!el) return undefined;
        const v = parseInt(el.value, 10);
        return Number.isFinite(v) ? v : undefined;
    };

    const bool = (id) => {
        const el = getEl(id);
        if (!el) return undefined;
        return !!el.checked;
    };

    const selInt = (id) => {
        const el = getEl(id);
        if (!el) return undefined;
        const v = parseInt(el.value, 10);
        return Number.isFinite(v) ? v : undefined;
    };

    const setIf = (obj, key, val) => {
        if (val !== undefined) obj[key] = val;
    };

    const cfg = {};

    // -------- Filters --------
    const filters = {};
    setIf(filters, "gyro_lpf_beta", num("inp_gyro_beta"));
    setIf(filters, "rpm_min_freq", num("inp_rpm_min_freq"));
    setIf(filters, "rpm_max_freq", num("inp_rpm_max_freq"));
    setIf(filters, "rpm_bw_percent", num("inp_rpm_bw_percent"));
    if (Object.keys(filters).length) cfg.filters = filters;

    // -------- Mahony --------
    const mahony = {};
    setIf(mahony, "kp", num("inp_mahony_kp"));
    setIf(mahony, "ki", num("inp_mahony_ki"));
    if (Object.keys(mahony).length) cfg.mahony = mahony;

    // -------- Nav --------
    const nav = {};

    // Angle mode limitleri
    setIf(nav, "ang_lim_roll", int("inp_ang_lim_roll"));
    setIf(nav, "ang_lim_pitch", int("inp_ang_lim_pitch"));

    // Auto launch
    setIf(nav, "launch_acc_threshold", num("inp_launch_acc_threshold"));
    setIf(nav, "launch_throttle", int("inp_launch_throttle"));
    setIf(nav, "launch_time", int("inp_launch_time"));
    setIf(nav, "launch_altitude", int("inp_launch_altitude"));
    setIf(nav, "launch_angle", int("inp_launch_angle"));
    setIf(nav, "launch_spool_time", int("inp_launch_spool_time"));

    // Stall koruması
    setIf(nav, "stall_speed_kmh", num("inp_stall_speed_kmh"));
    setIf(nav, "stall_pitch_drop", num("inp_stall_pitch_drop"));

    // GPS donanım
    setIf(nav, "has_gps", bool("inp_has_gps"));
    setIf(nav, "gps_protocol", selInt("inp_gps_proto"));
    setIf(nav, "gps_baud", selInt("inp_gps_baud"));
    setIf(nav, "mag_align", selInt("inp_mag_align"));

    // GPS güvenlik
    setIf(nav, "gps_min_sats", int("inp_gps_min_sats"));
    setIf(nav, "gps_min_fix_type", int("inp_gps_min_fix_type"));

    // RTH & limits
    setIf(nav, "rth_altitude", int("inp_nav_rth_alt"));
    setIf(nav, "rth_radius", int("inp_nav_radius"));
    setIf(nav, "max_distance", int("inp_nav_max_dist"));
    setIf(nav, "climb_first", bool("inp_nav_climb_first"));

    // Nav açı limitleri
    setIf(nav, "max_bank_angle_roll", int("inp_nav_max_bank_roll"));
    setIf(nav, "max_bank_angle_pitch", int("inp_nav_max_bank_pitch"));
    setIf(nav, "max_climb", int("inp_nav_max_climb"));
    setIf(nav, "max_dive", int("inp_nav_max_dive"));

    // Throttle ayarları
    setIf(nav, "nav_min_throttle", int("inp_nav_min_throttle"));
    setIf(nav, "descend_throttle", int("inp_nav_descend"));
    setIf(nav, "cruise_throttle", int("inp_nav_cruise"));
    setIf(nav, "climb_throttle", int("inp_nav_climb"));
    setIf(nav, "nav_max_throttle", int("inp_nav_max_throttle"));

    // Otopilot kazançları
    setIf(nav, "fw_alt_p", num("inp_nav_fw_alt_p"));
    setIf(nav, "fw_thr_p", num("inp_nav_fw_thr_p"));
    setIf(nav, "fw_pitch2thr", num("inp_nav_fw_pitch2thr"));

    // L1 navigasyon
    setIf(nav, "l1_period", int("inp_nav_l1_period"));
    setIf(nav, "l1_damping", num("inp_nav_l1_damping"));

    if (Object.keys(nav).length) cfg.nav = nav;

    // -------- Altitude config --------
    const alt = {};
    setIf(alt, "has_baro", bool("inp_alt_has_baro"));
    setIf(alt, "w_z_baro_p", num("inp_alt_w_z_baro_p"));
    setIf(alt, "w_z_baro_v", num("inp_alt_w_z_baro_v"));
    setIf(alt, "w_z_acc_bias", num("inp_alt_w_z_acc_bias"));
    setIf(alt, "acc_deadzone_mss", num("inp_alt_acc_deadzone"));
    setIf(alt, "acc_lpf_factor", num("inp_alt_acc_lpf"));
    if (Object.keys(alt).length) cfg.alt_config = alt;

    // -------- Misc --------
    const misc = {};
    setIf(misc, "esc_hz", selInt("inp_esc_hz"));
    if (Object.keys(misc).length) cfg.misc = misc;

    // -------- Calibration extras (trim) --------
    const calib = {};
    setIf(calib, "trim_roll", num("inp_trim_roll"));
    setIf(calib, "trim_pitch", num("inp_trim_pitch"));
    if (Object.keys(calib).length) cfg.calib_extra = calib;

    // -------- Nav Waypoint --------
    const nav_wp = {};
    setIf(nav_wp, "wp_capture_radius", int("inp_wp_capture_radius"));
    if (Object.keys(nav_wp).length) cfg.nav_wp = nav_wp;

    // -------- Flaperon --------
    const flaperonSlider = document.getElementById('flaperonOffsetSlider');
    if (flaperonSlider) {
        cfg.flaperon_offset = parseInt(flaperonSlider.value, 10);
    }

    // -------- Landing Assist --------
    const la = {};
    setIf(la, "circuit_alt", int("inp_la_circuit_alt"));
    setIf(la, "final_approach_distance", int("inp_la_final_approach_distance"));
    setIf(la, "circuit_width", int("inp_la_circuit_width"));
    setIf(la, "flare_alt", num("inp_la_flare_alt"));
    setIf(la, "approach_throttle", int("inp_la_approach_throttle"));
    setIf(la, "flare_throttle", int("inp_la_flare_throttle"));
    setIf(la, "stick_cancel_thr", int("inp_la_stick_cancel_thr"));
    setIf(la, "thr_cancel_thr", int("inp_la_thr_cancel_thr"));
    setIf(la, "min_wind_speed", num("inp_la_min_wind_speed"));
    setIf(la, "manual_runway_hdg", num("inp_la_manual_runway_hdg"));
    if (Object.keys(la).length) cfg.land_assist = la;

    console.log("[ADV] SAVE payload =", cfg);
    sendCommand(`SAVE_ADVANCED_CONFIG ${JSON.stringify(cfg)}`);
}

// === YARDIMCI FONKSİYONLAR ===

/**
 * @brief Slider değerlerini anlık göstermek için (HTML'de oninput ile çağrılıyor)
 * @param {string} key - Input key'i (inp_ prefix'i olmadan)
 */
function updateAdvDisplay(key) {
    const input = document.getElementById(`inp_${key}`);
    const display = document.getElementById(`disp_${key}`);
    if (!input || !display) return;

    const val = parseFloat(input.value);

    // Değişken tipine göre basamak sayısını ayarla
    switch (key) {
        case 'alt_w_p':
        case 'alt_w_v':
            display.textContent = val.toFixed(1);
            break;
        case 'alt_w_bias':
            display.textContent = val.toFixed(3);
            break;
        case 'alt_lpf':
        case 'alt_dzone':
            display.textContent = val.toFixed(2);
            break;
        default:
            display.textContent = input.value;
    }
}

/**
 * @brief GPS ayarları bölümünü göster/gizle
 */
function toggleGpsSettings() {
    const isChecked = document.getElementById('inp_has_gps')?.checked;
    const settingsDiv = document.getElementById('gps_hardware_settings');
    if (settingsDiv) {
        settingsDiv.style.display = isChecked ? 'block' : 'none';
    }
}

/**
 * @brief Waypoint sayfasındaki katlanabilir bölümü aç/kapat
 */
function toggleWpSection(bodyId) {
    const body = document.getElementById(bodyId);
    if (!body) return;
    const chevronId = bodyId.replace('-body', '-chevron');
    const chevron = document.getElementById(chevronId);
    const isHidden = body.style.display === 'none';
    body.style.display = isHidden ? '' : 'none';
    if (chevron) chevron.className = isHidden ? 'bi bi-chevron-up' : 'bi bi-chevron-down';
}

/**
 * @brief Kamikaze varsayılan değerlerini döndür (HTML input'larından)
 */
function getKamikazeDefaults() {
    const getNum = (id, def) => { const el = document.getElementById(id); return el ? (parseFloat(el.value) || def) : def; };
    const getInt = (id, def) => { const el = document.getElementById(id); return el ? (parseInt(el.value, 10) || def) : def; };
    return {
        dive_mode:     0,
        dive_angle:    getNum('km_def_dive_angle', 45),
        alt_offset:    getNum('km_def_alt_offset', 0),
        trigger_alt:   getNum('km_def_trigger_alt', 15),
        mission_servo: getInt('km_def_mission_servo', 0)
    };
}

/**
 * @brief Listedeki tüm Kamikaze waypoint'lere şablon değerlerini uygula
 */
function applyKamikazeDefaults() {
    if (typeof waypoints === 'undefined') return;
    const def = getKamikazeDefaults();
    let count = 0;
    waypoints.forEach(wp => {
        if (wp.task === 5) { wp.kamikaze = Object.assign({}, wp.kamikaze, def); count++; }
    });
    if (typeof renderWaypointList === 'function') renderWaypointList();
    if (count > 0) { if (typeof log === 'function') log(`${count} Kamikaze WP güncellendi`, 'info'); }
    else { if (typeof log === 'function') log('Listede Kamikaze WP bulunamadı', 'warning'); }
}

// === DIŞA AKTARILAN FONKSİYONLAR ===
window.handleAdvancedPageData = handleAdvancedPageData;
window.updateAdvancedUI = updateAdvancedUI;
window.saveAdvancedConfig = saveAdvancedConfig;
window.updateAdvDisplay = updateAdvDisplay;
window.toggleGpsSettings = toggleGpsSettings;
window.toggleWpSection = toggleWpSection;
window.applyKamikazeDefaults = applyKamikazeDefaults;
window.getKamikazeDefaults = getKamikazeDefaults;

// advancedConfig'i dışarıdan erişilebilir yap
window.advancedConfig = advancedConfig;

function initThrottleUI() {
  const safetyCheck = document.getElementById('safetyCheck');
  const throttleSlider = document.getElementById('throttleSlider');
  const throttleValueEl = document.getElementById('throttleValue');
  const warn = document.getElementById('safetyWarning');

  let lastSentAt = 0;
  let lastLogAt = 0;
  const SEND_PERIOD_MS = 80;
  const LOG_PERIOD_MS  = 400; // log spam olmasın

  function sendThrottleNow(val) {
    if (!isConnected || !writer) return;
    if (!safetyCheck.checked) return;

    sendCommand(`THROTTLE ${val}`);

    const now = Date.now();
    if (now - lastLogAt >= LOG_PERIOD_MS) {
      lastLogAt = now;
      log(`📤 THROTTLE ${val}`, 'command'); // log sayfasında görünür
    }
  }

  throttleSlider.disabled = true;

  safetyCheck.addEventListener('change', () => {
    safetyChecked = safetyCheck.checked;   // <-- global güncelle
    updateSafetyWarning();                 // <-- yazı doğru olsun

    const armed = safetyCheck.checked;
    throttleSlider.disabled = !armed;
    if (warn) warn.style.display = armed ? 'none' : 'block';

    if (armed) {
     
      sendThrottleNow(parseInt(throttleSlider.value, 10));
    } else {

      sendCommand('THROTTLE 1000');


      throttleSlider.value = 1000;
      throttleValueEl.textContent = '1000';
    }
  });

  throttleSlider.addEventListener('input', () => {
    const v = parseInt(throttleSlider.value, 10);
    throttleValueEl.textContent = String(v);

    const now = Date.now();
    if (now - lastSentAt >= SEND_PERIOD_MS) {
      lastSentAt = now;
      sendThrottleNow(v);
    }
  });
}
