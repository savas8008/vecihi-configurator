// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file failsafe_page.js
 * @brief Failsafe sayfası yönetimi (RF Failsafe, Geofence, Sensör Failsafe)
 * Vecihi Configurator için modüler JS
 */

// === GLOBAL DEĞİŞKENLER ===

let failsafeConfig = {
    rf: {
        mode: 0,              // 0=RTH, 1=ANGLE, 2=FIXED_PWM (firmware RfFailsafeMode enum'uyla eşleşir)
        short_ms: 500,
        long_ms: 3000,
        angle_roll: 0,
        angle_pitch: 0,
        angle_throttle: 1650,
        fixed_roll: 1500,
        fixed_pitch: 1500,
        fixed_throttle: 1000
    },
    geofence: {
        max_distance: 0
    },
    sensor: {
        gps_glitch_dist: 50
    }
};

const FS_MODE_INT_TO_STR = { 0: 'rth', 1: 'angle', 2: 'fixed_pwm' };
const FS_MODE_STR_TO_INT = { rth: 0, angle: 1, fixed_pwm: 2 };

// === VERİ İŞLEME ===

/**
 * @brief ESP'den gelen failsafe sayfa verilerini işler
 * @param {Object} data - Gelen veri objesi
 */
function handleFailsafePageData(data) {
    if (!data) return;
    if (data.rf) {
        failsafeConfig.rf = Object.assign({}, failsafeConfig.rf, data.rf);
    }
    if (data.geofence) {
        failsafeConfig.geofence = Object.assign({}, failsafeConfig.geofence, data.geofence);
    }
    if (data.sensor) {
        failsafeConfig.sensor = Object.assign({}, failsafeConfig.sensor, data.sensor);
    }
    updateFailsafeUI();
}

// === UI GÜNCELLEME ===

/**
 * @brief failsafeConfig objesindeki verileri UI'a yansıtır
 */
function updateFailsafeUI() {
    const getEl = (id) => document.getElementById(id);
    const setVal = (id, v) => {
        const el = getEl(id);
        if (!el || v === undefined || v === null) return;
        el.value = v;
    };

    const rf = failsafeConfig.rf;
    setVal('sel_rf_fs_mode', FS_MODE_INT_TO_STR[rf.mode] !== undefined ? FS_MODE_INT_TO_STR[rf.mode] : 'rth');
    setVal('inp_rf_fs_short_ms', rf.short_ms);
    setVal('inp_rf_fs_long_ms', rf.long_ms);
    setVal('inp_rf_fs_angle_roll', rf.angle_roll);
    setVal('inp_rf_fs_angle_pitch', rf.angle_pitch);
    setVal('inp_rf_fs_angle_throttle', rf.angle_throttle);
    setVal('inp_rf_fs_roll', rf.fixed_roll);
    setVal('inp_rf_fs_pitch', rf.fixed_pitch);
    setVal('inp_rf_fs_throttle', rf.fixed_throttle);

    setVal('inp_geofence_max_dist', failsafeConfig.geofence.max_distance);
    setVal('inp_gps_glitch_dist', failsafeConfig.sensor.gps_glitch_dist);

    // Seçili moda göre doğru kartı göster + geofence rozetini güncelle
    if (typeof updateRfFsModeUI === 'function') updateRfFsModeUI();
    if (typeof updateGeofenceBadge === 'function') updateGeofenceBadge();
}

// === KAYDETME ===

/**
 * @brief UI'daki değerleri toplar ve ESP'ye gönderir
 */
function saveFailsafeConfig() {
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

    const modeEl = getEl('sel_rf_fs_mode');
    const modeInt = modeEl ? FS_MODE_STR_TO_INT[modeEl.value] : undefined;

    const cfg = {
        rf: {
            mode: modeInt !== undefined ? modeInt : 0,
            short_ms: int('inp_rf_fs_short_ms'),
            long_ms: int('inp_rf_fs_long_ms'),
            angle_roll: num('inp_rf_fs_angle_roll'),
            angle_pitch: num('inp_rf_fs_angle_pitch'),
            angle_throttle: int('inp_rf_fs_angle_throttle'),
            fixed_roll: int('inp_rf_fs_roll'),
            fixed_pitch: int('inp_rf_fs_pitch'),
            fixed_throttle: int('inp_rf_fs_throttle')
        },
        geofence: {
            max_distance: int('inp_geofence_max_dist')
        },
        sensor: {
            gps_glitch_dist: num('inp_gps_glitch_dist')
        }
    };

    console.log('[FAILSAFE] SAVE payload =', cfg);
    sendCommand(`SAVE_FAILSAFE_CONFIG ${JSON.stringify(cfg)}`);
}

// === DIŞA AKTARILAN FONKSİYONLAR ===
window.handleFailsafePageData = handleFailsafePageData;
window.updateFailsafeUI = updateFailsafeUI;
window.saveFailsafeConfig = saveFailsafeConfig;
window.failsafeConfig = failsafeConfig;
