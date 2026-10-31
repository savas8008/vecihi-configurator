// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * Pin Taraması — IMU (I2C) ve GPS (UART) pinlerini kartın kendisine buldurur.
 *
 * Firmware komutları (vecihi/src/pin_scan.cpp):
 *   {"command":"SCAN_I2C_PINS","deep":false|true}   → {"scan_i2c":{...}}
 *   {"command":"SCAN_GPS_PINS","find_tx":false|true} → {"scan_gps":{...}}
 *   {"command":"SCAN_RX_PINS","find_tx":false|true}  → {"scan_rx":{...}}
 *
 * Ne firmware ne bu dosya sonucu KAYDETMEZ: bulunan pinler Donanım sayfasının
 * formuna doldurulur, kullanıcı tüm değişiklikleri o sayfanın tek Kaydet'iyle
 * (hardware_page.js → kısmi PINS_SAVE) uygular; kart bir kez yeniden başlar.
 *
 * Sonuçlar data-scan-result="i2c|gps|rx" taşıyan TÜM kutulara yazılır (pin
 * akordeonu + sensör hata modalı), butonlar data-scan-btn ile kilitlenir.
 */

const _pinScanLast = { i2c: null, gps: null, rx: null };
const _pinScanTimer = { i2c: null, gps: null, rx: null };
// Firmware süreleri (kartta ölçüldü): I2C <1 sn; GPS 1.2 sn dinleme + aktif pin
// başına 4×1.1 sn + TX pin başına ~0.35 sn; alıcı aktif pin başına ~1 sn + TX
// pin başına ~0.25 sn, sinyalsiz ping yedeği en kötü ~20 sn. Pay bırakılarak:
const PIN_SCAN_TIMEOUT_MS = { i2c: 20000, gps: 45000, rx: 60000 };
const RX_PROTO_LABEL = { 0: 'SBUS', 1: 'CRSF / ELRS', 2: 'MAVLink ELRS' };

function _psT(key, fallback, vars) {
    return (typeof _vT === 'function') ? _vT('pin_scan.' + key, fallback, vars) : fallback;
}

function _psRender(kind, html) {
    document.querySelectorAll(`[data-scan-result="${kind}"]`).forEach(el => { el.innerHTML = html; });
}

function _psBusy(kind, busy) {
    document.querySelectorAll(`[data-scan-btn="${kind}"]`).forEach(el => { el.disabled = busy; });
}

/**
 * @brief Taramayı başlatır.
 * @param {'i2c'|'gps'|'rx'} kind
 * @param {boolean} [aggressive] i2c: tüm güvenli çiftler; gps/rx: TX pinini de dene.
 *        İkisi de pin SÜRDÜĞÜ için önce kullanıcı onayı alınır.
 */
function startPinScan(kind, aggressive = false) {
    if (aggressive) {
        const msg = kind === 'i2c'
            ? _psT('confirm_deep', 'Tüm boştaki pinler sırayla I2C olarak denenecek. Motor/servo olarak atanmış pinlere dokunulmaz, yine de pervaneleri sökün. Devam edilsin mi?')
            : kind === 'gps'
            ? _psT('confirm_tx', 'GPS TX pinini bulmak için boştaki pinlere sırayla sorgu gönderilecek. Motor/servo olarak atanmış pinlere dokunulmaz, yine de pervaneleri sökün. Devam edilsin mi?')
            : _psT('confirm_rx_tx', 'Alıcının TX pinini bulmak için boştaki pinlerden alıcıya sırayla veri gönderilecek. Kumanda AÇIK ve alıcıya bağlı olmalı. Motor/servo olarak atanmış pinlere dokunulmaz, yine de pervaneleri sökün. Devam edilsin mi?');
        if (!confirm(msg)) return;
    }

    const cmd = kind === 'i2c' ? { command: 'SCAN_I2C_PINS', deep: aggressive }
              : kind === 'gps' ? { command: 'SCAN_GPS_PINS', find_tx: aggressive }
              :                  { command: 'SCAN_RX_PINS',  find_tx: aggressive };

    _psBusy(kind, true);
    _psRender(kind, `<span class="text-info"><span class="spinner-border spinner-border-sm me-1"></span>${
        kind === 'i2c' ? _psT('scanning_i2c', 'IMU aranıyor...')
      : kind === 'gps' ? _psT('scanning_gps', 'GPS aranıyor (birkaç saniye ile yarım dakika arası sürebilir)...')
      :                  _psT('scanning_rx', 'Alıcı aranıyor (birkaç saniye ile bir dakika arası sürebilir)...')
    }</span>`);

    clearTimeout(_pinScanTimer[kind]);
    _pinScanTimer[kind] = setTimeout(() => {
        _psBusy(kind, false);
        _psRender(kind, `<span class="text-warning">${_psT('no_reply',
            'Karttan yanıt gelmedi. Firmware bu özelliği desteklemiyor olabilir — kartı güncelleyin.')}</span>`);
    }, PIN_SCAN_TIMEOUT_MS[kind]);

    if (typeof sendCommand === 'function') sendCommand(JSON.stringify(cmd));
}

// Taze bir sonuç işlenirken true; dil değişimi için yeniden çizimde false —
// o zaman form tekrar doldurulmaz (kullanıcının sonradan yaptığı düzeltme kalır).
let _psFresh = true;

// Sonucu forma doldurur ve kullanıcıya Kaydet'i hatırlatan notu döndürür.
function _psFilled(kind) {
    if (_psFresh) applyScannedPins(kind);
    return `<div class="text-info mt-1"><i class="bi bi-pencil-square me-1"></i>${
        _psT('filled', 'Forma dolduruldu — uygulamak için Donanım Ayarlarını Kaydet\'e basın.')}</div>`;
}

function _psRetryButton(kind, label) {
    return `<button class="btn btn-outline-warning btn-sm mt-1" data-scan-btn="${kind}" onclick="startPinScan('${kind}', true)">
        <i class="bi bi-search me-1"></i>${label}</button>`;
}

function _psList(pins) {
    return (pins && pins.length) ? pins.map(p => 'GPIO' + p).join(', ') : '—';
}

/**
 * @brief Firmware'den gelen scan_i2c / scan_gps yanıtını işler.
 */
function handlePinScanResult(kind, res, rerender = false) {
    _psFresh = !rerender;
    if (!rerender) {
        clearTimeout(_pinScanTimer[kind]);
        _psBusy(kind, false);
        _pinScanLast[kind] = res;
    }

    if (res.error === 'armed') {
        _psRender(kind, `<span class="text-danger">${_psT('armed', 'Kollar açıkken (ARM) tarama yapılmaz.')}</span>`);
        return;
    }

    if (kind === 'i2c') {
        // Üzerinde sinyal görüldüğü için denenmeyen pinler (ör. alıcının SBUS hattı)
        const busyNote = (res.busy && res.busy.length)
            ? `<div class="text-secondary">${_psT('busy_note', 'Sinyal taşıdığı için atlanan pinler: {pins}', { pins: _psList(res.busy) })}</div>`
            : '';
        if (res.found) {
            const addr = '0x' + Number(res.addr).toString(16).toUpperCase();
            const baro = res.baro ? ' + BMP180' : '';
            _psRender(kind, `<div class="text-success"><i class="bi bi-check-circle me-1"></i>${
                _psT('i2c_found', 'Bulundu: {imu} ({addr}){baro} — SDA GPIO{sda}, SCL GPIO{scl}',
                     { imu: res.imu, addr, baro, sda: res.sda, scl: res.scl })}</div>
                ${_psFilled('i2c')}`);
            if (_psFresh && typeof log === 'function') log(`🔎 ${_psT('log_imu', 'IMU bulundu')}: ${res.imu} SDA=${res.sda} SCL=${res.scl}`, 'success');
        } else if (!res.deep) {
            _psRender(kind, `<div class="text-warning">${
                _psT('i2c_not_found_quick', 'Pull-up direnci olan pinlerde IMU bulunamadı (aday pinler: {pins}).',
                     { pins: _psList(res.candidates) })}</div>${busyNote}
                ${_psRetryButton('i2c', _psT('try_deep', 'Tüm pinleri dene'))}`);
        } else {
            _psRender(kind, `<div class="text-danger">${
                _psT('i2c_not_found_deep', 'IMU hiçbir pin çiftinde yanıt vermedi. Besleme (3.3V/GND) ve kabloları kontrol edin. Motor/servo olarak atanmış pinler taranmadı; IMU onlardan birindeyse önce çıkış pinlerini değiştirin.')}</div>${busyNote}`);
        }
        return;
    }

    if (kind === 'rx') { _psRenderRx(res); return; }

    // GPS
    if (!res.found) {
        _psRender(kind, `<div class="text-danger">${
            _psT('gps_not_found', 'GPS verisi hiçbir pinde görülmedi (sinyal görülen pinler: {pins}). GPS modülünün beslendiğinden emin olun; uydu bulmasa da veri gönderir.',
                 { pins: _psList(res.active) })}</div>`);
        return;
    }

    let html = `<div class="text-success"><i class="bi bi-check-circle me-1"></i>${
        _psT('gps_rx_found', 'GPS verisi bulundu: RX GPIO{rx}, {baud} baud ({proto})',
             { rx: res.rx, baud: res.baud, proto: res.proto })}</div>`;
    if (res.tx >= 0) {
        html += `<div class="text-success">${_psT('gps_tx_found', 'TX GPIO{tx} — GPS sorguya yanıt verdi', { tx: res.tx })}</div>`;
        html += _psFilled('gps');
    } else if (!res.find_tx) {
        html += `<div class="text-secondary">${_psT('gps_tx_hint', 'TX pini (ESP → GPS) dinleyerek bulunamaz; GPS\'e sorgu gönderilerek aranmalı.')}</div>`;
        html += _psRetryButton('gps', _psT('find_tx', 'TX pinini de bul'));
    } else {
        html += `<div class="text-warning">${_psT('gps_tx_not_found',
            'TX pini bulunamadı ({n} pin denendi). RX seçildi; TX\'i elle seçip kaydedin.', { n: res.tx_tried })}</div>`;
        html += _psFilled('gps');
    }
    _psRender(kind, html);
    if (_psFresh && typeof log === 'function') log(`🔎 ${_psT('log_gps', 'GPS bulundu')}: RX=${res.rx} TX=${res.tx} @${res.baud}`, 'success');
}

function _psRenderRx(res) {
    if (!res.found) {
        let html = `<div class="text-danger">${_psT('rx_not_found',
            'Alıcı verisi hiçbir pinde görülmedi (sinyal görülen pinler: {pins}). ELRS alıcıları kumandaya bağlı değilken veri göndermez — kumandayı açıp tekrar deneyin.',
            { pins: _psList(res.active) })}</div>`;
        if (!res.find_tx) html += _psRetryButton('rx', _psT('rx_try_ping', 'TX ile birlikte ara (CRSF)'));
        _psRender('rx', html);
        return;
    }

    const proto = RX_PROTO_LABEL[res.protocol] || res.proto;
    let html = `<div class="text-success"><i class="bi bi-check-circle me-1"></i>${
        _psT('rx_found', 'Alıcı bulundu: {proto}, RX GPIO{rx}', { proto, rx: res.rx })}</div>`;

    // Kart yalnızca düz (ters çevrilmemiş) SBUS'ı okuyabiliyor (receiver.cpp).
    if (res.protocol === 0 && res.inverted) {
        html += `<div class="text-warning">${_psT('rx_sbus_inverted',
            'Sinyal standart (ters) SBUS. Kart şu an yalnızca ters çevrilmemiş SBUS okuyabiliyor: alıcının "uninverted SBUS" çıkışını kullanın ya da araya bir invertör koyun.')}</div>`;
        _psRender('rx', html);
        return;
    }

    if (res.protocol === 0) {
        html += `<div class="text-secondary">${_psT('rx_sbus_no_tx', 'SBUS tek yönlüdür, TX pini gerekmez.')}</div>`;
        html += _psFilled('rx');
    } else if (res.tx >= 0) {
        html += `<div class="text-success">${_psT('rx_tx_found', 'TX GPIO{tx} — alıcı yanıt verdi', { tx: res.tx })}</div>`;
        html += _psFilled('rx');
    } else {
        html += res.find_tx
            ? `<div class="text-warning">${_psT('rx_tx_not_found',
                'TX pini doğrulanamadı ({n} pin denendi). Alıcı, kumandaya bağlı değilken karttan gelen veriyi kabul etmez — kumandayı açıp tekrar deneyin.', { n: res.tx_tried })}</div>`
            : `<div class="text-secondary">${_psT('rx_tx_hint', 'TX pini (ESP → alıcı) telemetri için gerekir; alıcıya veri gönderilerek aranır.')}</div>`;
        html += _psFilled('rx');
        html += _psRetryButton('rx', _psT('find_tx', 'TX pinini de bul'));
    }
    _psRender('rx', html);
    if (_psFresh && typeof log === 'function') log(`🔎 ${_psT('log_rx', 'Alıcı bulundu')}: ${proto} RX=${res.rx} TX=${res.tx}`, 'success');
}

/**
 * @brief Son taramanın bulduğu pinleri Donanım sayfasının formuna doldurur.
 *        Kaydetmez — kayıt hardware_page.js saveHardwareConfig() ile yapılır.
 *        Bulunamayan TX'e dokunulmaz (kayıtlı değer kalır).
 */
function applyScannedPins(kind) {
    const res = _pinScanLast[kind];
    if (!res || !res.found) return;

    const pins = kind === 'i2c' ? { i2cSdaPin: res.sda, i2cSclPin: res.scl }
               : kind === 'gps' ? { gpsRxPin: res.rx, gpsTxPin: res.tx }
               :                  { rxRxPin: res.rx, rxTxPin: res.tx };
    Object.keys(pins).forEach(id => {
        const el = document.getElementById(id);
        if (el && pins[id] >= 0) el.value = pins[id];
    });
    if (kind === 'rx' && typeof setHardwarePendingProtocol === 'function') {
        setHardwarePendingProtocol(res.protocol);
    }
    // Çakışma uyarısını tazele (hardware_page.js 'change' dinliyor)
    const any = document.getElementById(Object.keys(pins)[0]);
    if (any) any.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * @brief Sensör hata modalına, eksik donanım varsa Donanım sayfasına giden
 *        butonu ekler. serial_communication.js init_status işleyicisinden çağrılır.
 */
let _psModalSensors = null;

function renderSensorModalScanOffers(sensors) {
    const box = document.getElementById('sensorModalScan');
    if (!box) return;
    _psModalSensors = sensors;

    const lines = [];
    if (!sensors.gyro) {
        lines.push(_psT('modal_imu',
            'IMU yanıt vermiyor (kayıtlı pinler: SDA GPIO{sda}, SCL GPIO{scl}). Kart, IMU\'nun takılı olduğu pinleri kendisi arayabilir.',
            { sda: sensors.i2c_sda ?? '?', scl: sensors.i2c_scl ?? '?' }));
    }
    // gps_pins_set yalnızca yeni firmware'de var; yoksa (eski kart) öneri gösterilmez.
    if (!sensors.gps && sensors.gps_pins_set === false) {
        lines.push(_psT('modal_gps', 'GPS pinleri henüz atanmamış.'));
    }
    box.innerHTML = lines.length ? `
        ${lines.map(l => `<div class="small text-light mb-1">${l}</div>`).join('')}
        <button class="btn btn-info btn-sm mt-1" onclick="openHardwareFromModal()">
            <i class="bi bi-motherboard me-1"></i>${_psT('open_hardware', 'Donanım sayfasını aç — pinleri seç veya otomatik bul')}</button>` : '';
    box.classList.toggle('d-none', lines.length === 0);
}

function openHardwareFromModal() {
    const modalEl = document.getElementById('sensorErrorModal');
    const inst = modalEl && typeof bootstrap !== 'undefined' ? bootstrap.Modal.getInstance(modalEl) : null;
    if (inst) inst.hide();
    if (typeof changePage === 'function') changePage('hardware');
}

// Dil değişince JS ile üretilen sonuç kutularını ve modal önerisini yeniden
// çiz. Tarama sürüyorsa (zamanlayıcı bekliyor) o kutuya dokunulmaz.
document.addEventListener('i18n:changed', () => {
    ['i2c', 'gps', 'rx'].forEach(kind => {
        if (_pinScanLast[kind]) handlePinScanResult(kind, _pinScanLast[kind], true);
    });
    _psFresh = true;
    if (_psModalSensors) renderSensorModalScanOffers(_psModalSensors);
});
