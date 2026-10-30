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
 * Firmware sonucu KAYDETMEZ. Kullanıcı "Kaydet" deyince yalnızca bulunan pinler
 * kısmi PINS_SAVE ile gönderilir — gyro yokken outputs_page_data hiç istenmediği
 * için pinConfig boş olabilir; tam kayıt (savePinsConfig) motor pinlerini ezerdi.
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

function _psSaveButton(kind, label) {
    return `<button class="btn btn-success btn-sm mt-1" data-scan-btn="${kind}" onclick="applyScannedPins('${kind}')">
        <i class="bi bi-save me-1"></i>${label}</button>`;
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
function handlePinScanResult(kind, res) {
    clearTimeout(_pinScanTimer[kind]);
    _psBusy(kind, false);
    _pinScanLast[kind] = res;

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
                ${_psSaveButton('i2c', _psT('save', 'Bu pinleri kaydet (kart yeniden başlar)'))}`);
            if (typeof log === 'function') log(`🔎 IMU bulundu: ${res.imu} SDA=${res.sda} SCL=${res.scl}`, 'success');
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
        html += _psSaveButton('gps', _psT('save', 'Bu pinleri kaydet (kart yeniden başlar)'));
    } else if (!res.find_tx) {
        html += `<div class="text-secondary">${_psT('gps_tx_hint', 'TX pini (ESP → GPS) dinleyerek bulunamaz; GPS\'e sorgu gönderilerek aranmalı.')}</div>`;
        html += _psRetryButton('gps', _psT('find_tx', 'TX pinini de bul'));
    } else {
        html += `<div class="text-warning">${_psT('gps_tx_not_found',
            'TX pini bulunamadı ({n} pin denendi). RX seçildi; TX\'i elle seçip kaydedin.', { n: res.tx_tried })}</div>`;
        const rxSel = document.getElementById('gpsRxPin');
        if (rxSel) rxSel.value = res.rx;
    }
    _psRender(kind, html);
    if (typeof log === 'function') log(`🔎 GPS bulundu: RX=${res.rx} TX=${res.tx} @${res.baud}`, 'success');
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
        html += _psSaveButton('rx', _psT('save', 'Bu pinleri kaydet (kart yeniden başlar)'));
    } else if (res.tx >= 0) {
        html += `<div class="text-success">${_psT('rx_tx_found', 'TX GPIO{tx} — alıcı yanıt verdi', { tx: res.tx })}</div>`;
        html += _psSaveButton('rx', _psT('save', 'Bu pinleri kaydet (kart yeniden başlar)'));
    } else {
        html += res.find_tx
            ? `<div class="text-warning">${_psT('rx_tx_not_found',
                'TX pini doğrulanamadı ({n} pin denendi). Alıcı, kumandaya bağlı değilken karttan gelen veriyi kabul etmez — kumandayı açıp tekrar deneyin.', { n: res.tx_tried })}</div>`
            : `<div class="text-secondary">${_psT('rx_tx_hint', 'TX pini (ESP → alıcı) telemetri için gerekir; alıcıya veri gönderilerek aranır.')}</div>`;
        html += _psRetryButton('rx', _psT('find_tx', 'TX pinini de bul'));
        html += ' ' + _psSaveButton('rx', _psT('rx_save_rx_only', 'Yalnızca RX ve protokolü kaydet'));
    }
    _psRender('rx', html);
    if (typeof log === 'function') log(`🔎 Alıcı bulundu: ${proto} RX=${res.rx} TX=${res.tx}`, 'success');
}

/**
 * @brief Son taramanın bulduğu pinleri kısmi PINS_SAVE ile kaydeder.
 *        Firmware kayıttan sonra yeniden başlar.
 */
function applyScannedPins(kind) {
    const res = _pinScanLast[kind];
    if (!res || !res.found) return;

    let pins;
    const extra = {};
    if (kind === 'i2c') {
        pins = { i2c_sda: res.sda, i2c_scl: res.scl };
    } else if (kind === 'gps') {
        if (!(res.tx >= 0)) return;
        pins = { gps_rx: res.rx, gps_tx: res.tx };
    } else {
        // TX bulunmadıysa kayıtlı TX'e dokunulmaz; protokol pinle birlikte kaydedilir.
        pins = { rx_rx: res.rx };
        if (res.tx >= 0) pins.rx_tx = res.tx;
        extra.rc_protocol = res.protocol;
    }

    if (typeof pinConfig !== 'undefined' && pinConfig) Object.assign(pinConfig, pins);
    const selMap = { i2c_sda: 'i2cSdaPin', i2c_scl: 'i2cSclPin', gps_rx: 'gpsRxPin', gps_tx: 'gpsTxPin',
                     rx_rx: 'rxRxPin', rx_tx: 'rxTxPin' };
    Object.keys(pins).forEach(k => {
        const el = document.getElementById(selMap[k]);
        if (el) el.value = pins[k];
    });

    _psBusy(kind, true);
    _psRender(kind, `<span class="text-info">${_psT('saving', 'Kaydediliyor, kart yeniden başlıyor...')}</span>`);
    if (typeof log === 'function') log(`📤 Bulunan pinler kaydediliyor: ${JSON.stringify({ pins, ...extra })}`, 'info');
    if (typeof sendCommand === 'function') sendCommand(`PINS_SAVE ${JSON.stringify({ pins, ...extra })}`);
}

/**
 * @brief Sensör hata modalına, eksik donanım için tarama önerisini ekler.
 *        serial_communication.js init_status işleyicisinden çağrılır.
 */
function renderSensorModalScanOffers(sensors) {
    const box = document.getElementById('sensorModalScan');
    if (!box) return;

    const parts = [];
    if (!sensors.gyro) {
        parts.push(`<div class="mb-2">
            <div class="small text-light mb-1">${_psT('modal_imu',
                'IMU yanıt vermiyor (kayıtlı pinler: SDA GPIO{sda}, SCL GPIO{scl}). Kart, IMU\'nun takılı olduğu pinleri kendisi arayabilir.',
                { sda: sensors.i2c_sda ?? '?', scl: sensors.i2c_scl ?? '?' })}</div>
            <button class="btn btn-info btn-sm" data-scan-btn="i2c" onclick="startPinScan('i2c')">
                <i class="bi bi-search me-1"></i>${_psT('i2c_btn', 'IMU Pinlerini Otomatik Bul')}</button>
            <div class="small mt-1" data-scan-result="i2c"></div>
        </div>`);
    }
    // gps_pins_set yalnızca yeni firmware'de var; yoksa (eski kart) öneri gösterilmez.
    if (!sensors.gps && sensors.gps_pins_set === false) {
        parts.push(`<div class="mb-2">
            <div class="small text-light mb-1">${_psT('modal_gps', 'GPS pinleri henüz atanmamış.')}</div>
            <button class="btn btn-info btn-sm" data-scan-btn="gps" onclick="startPinScan('gps')">
                <i class="bi bi-search me-1"></i>${_psT('gps_btn', 'GPS Pinlerini Otomatik Bul')}</button>
            <div class="small mt-1" data-scan-result="gps"></div>
        </div>`);
    }
    box.innerHTML = parts.join('');
    box.classList.toggle('d-none', parts.length === 0);
}
