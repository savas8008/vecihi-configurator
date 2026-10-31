// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file hardware_page.js
 * @brief Donanım sayfası — sensör ve haberleşme pinleri tek yerde.
 *
 * Seçim kutuları eski sayfalardaki kimlikleriyle buraya taşındı; değerleri
 * outputs_page_data → handleOutputsPageData() doldurur. Bu dosya yalnızca:
 *   - sayfanın durum rozetlerini (init_status, transmitter, pitot) günceller,
 *   - pin çakışmalarını kayıttan önce yakalar,
 *   - tek bir kayıtla (pitot + kısmi PINS_SAVE) kartı bir kez yeniden başlatır.
 * Motor/servo/aux pinleri Mikser sayfasında kalır ve buradan GÖNDERİLMEZ;
 * çakışma kontrolü onları pinConfig'ten okur.
 */

// Son init_status — dil değişince durum rozetleri yeniden çizilsin diye saklanır.
let hwLastSensors = null;
// Otomatik bulmanın bulduğu alıcı protokolü; Kaydet'e kadar bekler (pin_scan.js yazar).
let hwPendingRcProtocol = null;
// Karttaki kayıtlı protokol (transmitter_page_data'dan, 0/1/2)
let hwSavedRcProtocol = null;

const HW_PROTO_FROM_STR = { sbus: 0, elrs: 1, mavlink_elrs: 2 };
const HW_PROTO_LABEL = { 0: 'SBUS', 1: 'CRSF / ELRS', 2: 'MAVLink ELRS' };

// Sayfanın gönderdiği pin alanları: [PINS_SAVE anahtarı, select kimliği,
// çakışma uyarısındaki etiket (i18n anahtarı, Türkçe yedek)]
const HW_PIN_FIELDS = [
    ['i2c_sda',     'i2cSdaPin',     'c_i2c_sda', 'I2C SDA'],
    ['i2c_scl',     'i2cSclPin',     'c_i2c_scl', 'I2C SCL'],
    ['gps_rx',      'gpsRxPin',      'c_gps_rx',  'GPS RX'],
    ['gps_tx',      'gpsTxPin',      'c_gps_tx',  'GPS TX'],
    ['rx_rx',       'rxRxPin',       'c_rx_rx',   'Alıcı RX'],
    ['rx_tx',       'rxTxPin',       'c_rx_tx',   'Alıcı TX'],
    ['osd_rx',      'osdRxPin',      'c_osd_rx',  'OSD RX'],
    ['osd_tx',      'osdTxPin',      'c_osd_tx',  'OSD TX'],
    ['adc_voltage', 'adcVoltagePin', 'c_adc',     'Batarya ADC'],
];
// Bu sayfada düzenlenmeyen ama çakışma kontrolüne giren pinler (Mikser sayfası)
const HW_OTHER_PINS = [
    ['motor1', 'Motor 1'], ['motor2', 'Motor 2'],
    ['servo1', 'Servo 1'], ['servo2', 'Servo 2'], ['servo3', 'Servo 3'], ['servo4', 'Servo 4'],
    ['aux1', 'AUX 1'], ['aux2', 'AUX 2'],
];

function _hwT(key, fallback, vars) {
    return (typeof _vT === 'function') ? _vT('hardware.' + key, fallback, vars) : fallback;
}

function _hwStatus(id, state, text) {
    const el = document.getElementById(id);
    if (!el) return;
    el.className = 'hw-status ms-auto ' + (state ? 'hw-status-' + state : '');
    el.textContent = text || '';
}

/** Sayfaya girişte karttan gereken veriler (page_management.js çağırır). */
function requestHardwarePageData() {
    sendCommand('outputs_page_data');
    setTimeout(() => sendCommand('transmitter_page_data'), 200);
    setTimeout(() => sendCommand('pitot_page_data'), 400);
    _hwCheckConflicts();
}

/** init_status geldiğinde (serial_communication.js) — sensör durum rozetleri. */
function updateHardwareStatus(sensors) {
    if (!sensors) return;
    hwLastSensors = sensors;
    if (sensors.gyro) {
        _hwStatus('hwst-i2c', 'ok', sensors.baro ? 'IMU + BARO' : 'IMU');
    } else {
        _hwStatus('hwst-i2c', 'err', _hwT('st_imu_missing', 'IMU YOK'));
    }
    if (sensors.gps) _hwStatus('hwst-gps', 'ok', 'OK');
    else if (sensors.gps_pins_set === false) _hwStatus('hwst-gps', 'warn', _hwT('st_unassigned', 'ATANMADI'));
    else _hwStatus('hwst-gps', 'warn', _hwT('st_missing', 'YOK'));
    if (sensors.pitot !== undefined) {
        _hwStatus('hwst-pitot', sensors.pitot ? 'ok' : '', sensors.pitot ? 'OK' : _hwT('st_off', 'KAPALI / YOK'));
    }
}

/** Sayfa verisi geldiğinde (serial_communication.js handlePageData). */
function onHardwarePageData(pageType, data) {
    if (pageType === 'transmitter' && data && data.protocol !== undefined) {
        hwSavedRcProtocol = (typeof data.protocol === 'number') ? data.protocol : HW_PROTO_FROM_STR[data.protocol];
        _hwRenderProto();
    }
    if (pageType === 'outputs') {
        _hwCheckConflicts();
        _hwRenderRxStatus();
    }
}

function _hwRenderRxStatus() {
    const rx = document.getElementById('rxRxPin');
    if (rx && parseInt(rx.value) === -1) _hwStatus('hwst-rx', 'warn', _hwT('st_unassigned', 'ATANMADI'));
    else _hwStatus('hwst-rx', '', '');
}

function _hwRenderProto() {
    const el = document.getElementById('hwRxProto');
    if (!el) return;
    const saved = HW_PROTO_LABEL[hwSavedRcProtocol] || '?';
    if (hwPendingRcProtocol !== null && hwPendingRcProtocol !== hwSavedRcProtocol) {
        el.innerHTML = _hwT('proto_pending', 'Protokol: <b>{new}</b> (kayıtlı: {old}) — Kaydet ile uygulanır',
            { new: HW_PROTO_LABEL[hwPendingRcProtocol], old: saved });
    } else {
        el.innerHTML = _hwT('proto', 'Protokol: <b>{p}</b>', { p: saved });
    }
}

/** pin_scan.js: alıcı taraması protokol bulduğunda. */
function setHardwarePendingProtocol(p) {
    hwPendingRcProtocol = p;
    _hwRenderProto();
}

function _hwCollect() {
    const pins = {};
    HW_PIN_FIELDS.forEach(([key, id]) => {
        const el = document.getElementById(id);
        if (!el) return;
        const v = parseInt(el.value);
        if (!isNaN(v)) pins[key] = v;
    });
    return pins;
}

/** Aynı GPIO iki işe atanmışsa uyarıyı gösterir; çakışma varsa true. */
function _hwCheckConflicts() {
    const used = {}; // gpio → [etiket...]
    const add = (gpio, label) => {
        if (gpio === undefined || gpio === null || isNaN(gpio) || gpio < 0) return;
        (used[gpio] = used[gpio] || []).push(label);
    };
    const pins = _hwCollect();
    HW_PIN_FIELDS.forEach(([key, , lk, fb]) => add(pins[key], _hwT(lk, fb)));
    if (typeof pinConfig !== 'undefined' && pinConfig) {
        HW_OTHER_PINS.forEach(([key, label]) => add(parseInt(pinConfig[key]), label));
    }
    const clashes = Object.keys(used).filter(g => used[g].length > 1)
        .map(g => `GPIO${g}: ${used[g].join(' + ')}`);

    const box = document.getElementById('hwConflict');
    if (box) {
        box.classList.toggle('d-none', clashes.length === 0);
        box.innerHTML = clashes.length
            ? `<i class="bi bi-exclamation-triangle me-1"></i>${_hwT('conflict', 'Aynı pin birden fazla işe atanmış:')} ${clashes.join(' · ')}`
            : '';
    }
    return clashes.length > 0;
}

/**
 * @brief Tek kayıt: önce pitot (yeniden başlatmaz), sonra kısmi PINS_SAVE
 *        (pinler + varsa alıcı protokolü) — kart bir kez yeniden başlar.
 */
function saveHardwareConfig() {
    if (_hwCheckConflicts()) {
        if (typeof log === 'function') log('❌ ' + _hwT('log_conflict', 'Pin çakışması var, kaydedilmedi'), 'error');
        return;
    }
    const payload = { pins: _hwCollect() };
    if (hwPendingRcProtocol !== null) payload.rc_protocol = hwPendingRcProtocol;

    if (typeof savePitotConfig === 'function') savePitotConfig();
    setTimeout(() => {
        if (typeof log === 'function') log(`📤 ${_hwT('log_saving', 'Donanım ayarları kaydediliyor')}: ${JSON.stringify(payload)}`, 'info');
        sendCommand(`PINS_SAVE ${JSON.stringify(payload)}`);
        hwPendingRcProtocol = null;
    }, 300);
}

// Dil değişince JS ile üretilen metinleri yeniden çiz (i18n.js yalnızca
// data-i18n taşıyan statik öğeleri çevirir).
document.addEventListener('i18n:changed', () => {
    if (hwLastSensors) updateHardwareStatus(hwLastSensors);
    _hwRenderRxStatus();
    if (hwSavedRcProtocol !== null) _hwRenderProto();
    _hwCheckConflicts();
});

// Seçim değiştikçe çakışmayı canlı göster
document.addEventListener('change', (e) => {
    if (e.target && HW_PIN_FIELDS.some(([, id]) => id === e.target.id)) _hwCheckConflicts();
});

window.requestHardwarePageData = requestHardwarePageData;
window.updateHardwareStatus = updateHardwareStatus;
window.onHardwarePageData = onHardwarePageData;
window.setHardwarePendingProtocol = setHardwarePendingProtocol;
window.saveHardwareConfig = saveHardwareConfig;
