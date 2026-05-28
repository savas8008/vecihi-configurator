// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file outputs_page.js
 * @brief Vecihi Configurator - Outputs (Konfigürasyon) Sayfası Modülü
 * @description Motor, servo, pin konfigürasyonu ve throttle yönetimi
 * 
 * @requires serial_communication.js - sendCommand, isConnected
 * @requires Ana HTML'deki global değişkenler:
 *   - selectedAircraft, pinConfig, servoValues
 *   - throttleValue, throttleInterval, safetyChecked
 *   - throttleSlider, safetyWarning
 *   - $() selector fonksiyonu
 */

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

/**
 * @brief DOM element seçici ($ tanımlı değilse kullan)
 */
function _$(id) {
    return typeof $ === 'function' ? $(id) : document.getElementById(id);
}

/**
 * @brief Log fonksiyonu wrapper
 */
function _log(message, type = 'info') {
    if (typeof log === 'function') {
        log(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

// ============================================================================
// VERİ İŞLEME FONKSİYONLARI
// ============================================================================

/**
 * @brief ESP'den gelen Outputs sayfa verilerini işler
 * @param {Object} data - Gelen veri objesi
 */
function handleOutputsPageData(data) {
    // 1. Uçak Tipi
    if (data.aircraft_type) {
        selectedAircraft = data.aircraft_type;
        document.querySelectorAll('.aircraft-card').forEach(card => {
            card.classList.toggle('active', card.getAttribute('data-aircraft-type') === selectedAircraft);
        });
        updateServoNames();
    }

    // 2. PİNLER
    if (data.pins) {
        pinConfig = data.pins;

        // Yardımcı fonksiyon: Element varsa değeri ata
        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (el) {
                el.value = val;
            } else {
                console.warn(`⚠️ Pin select bulunamadı: ${id}, Değer: ${val}`);
            }
        };

        // Motor & Servo
        setVal('motor1Pin', pinConfig.motor1);
        setVal('motor2Pin', pinConfig.motor2);
        setVal('servo1Pin', pinConfig.servo1);
        setVal('servo2Pin', pinConfig.servo2);
        setVal('servo3Pin', pinConfig.servo3);
        setVal('servo4Pin', pinConfig.servo4);

        // ALICI
        setVal('rxTxPin', pinConfig.rx_tx || -1);
        setVal('rxRxPin', pinConfig.rx_rx || -1);

        // GPS
        setVal('gpsRxPin', pinConfig.gps_rx);
        setVal('gpsTxPin', pinConfig.gps_tx);

        // OSD
        setVal('osdRxPin', pinConfig.osd_rx);
        setVal('osdTxPin', pinConfig.osd_tx);

        // I2C
        setVal('i2cSdaPin', pinConfig.i2c_sda);
        setVal('i2cSclPin', pinConfig.i2c_scl);

        // ADC
        setVal('adcVoltagePin', pinConfig.adc_voltage);
        const scaleEl = document.getElementById('voltageAdcScale');
        if (scaleEl && pinConfig.adc_voltage_scale != null) {
            scaleEl.value = pinConfig.adc_voltage_scale;
        }
        // Sensors sayfasındaki pin göstergesi
        const batPinEl = document.getElementById('sens-bat-pin');
        if (batPinEl) {
            batPinEl.textContent = (pinConfig.adc_voltage > 0) ? `GPIO${pinConfig.adc_voltage}` : '--';
        }
    }
    // Pin accordion başlıklarını güncelle
    updatePinSummaries();

    // 3. Servo Değerleri
    if (data.servo_values) {
        servoValues = data.servo_values;
        updateServoValuesUI();
    }

    // 4. Canlı PWM Çıkışları
    if (data.outputs) {
        updatePwmOutputs(data.outputs);
    }

    // 5. Mikser Kazançları
    if (data.mixer) {
        const setMix = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
        setMix('mixRoll',     data.mixer.roll_mix);
        setMix('mixPitch',    data.mixer.pitch_mix);
        setMix('mixYaw',      data.mixer.yaw_mix);
        setMix('mixThrottle', data.mixer.throttle_mix);
    }
}

/**
 * @brief PWM stream verisini işler
 * @param {Array|Object} data - PWM değerleri
 */
function handlePwmStream(data) {
    if (data && data.length >= 6) {
        updatePwmOutputs(data);
    }
}

// ============================================================================
// PWM VE SERVO FONKSİYONLARI
// ============================================================================

/**
 * @brief PWM çıkış değerlerini UI'da günceller
 * @param {Array|Object} outputs - PWM değerleri
 */
function updatePwmOutputs(outputs) {
    if (Array.isArray(outputs)) {
        _$('output1').textContent = outputs[0];
        _$('output2').textContent = outputs[1];
        _$('servo1').textContent = outputs[2];
        _$('servo2').textContent = outputs[3];
        _$('servo3').textContent = outputs[4];
        _$('servo4').textContent = outputs[5];
    } else {
        _$('output1').textContent = outputs.motor1;
        _$('output2').textContent = outputs.motor2;
        _$('servo1').textContent = outputs.servo1;
        _$('servo2').textContent = outputs.servo2;
        _$('servo3').textContent = outputs.servo3;
        _$('servo4').textContent = outputs.servo4;
    }
}

/**
 * @brief Seçili uçak tipine göre servo isimlerini günceller ve kullanılmayan servoları gizler
 */
function updateServoNames() {
    const names = {
        'v-tail':      { servo1: 'ROLL SOL', servo2: 'ROLL SAĞ', servo3: 'SAĞ KUYRUK',  servo4: 'SOL KUYRUK' },
        't-tail':      { servo1: 'ROLL SOL', servo2: 'ROLL SAĞ', servo3: 'ELEVATOR',     servo4: 'RUDDER'     },
        'no-ruder':    { servo1: 'ROLL SOL', servo2: 'ROLL SAĞ', servo3: 'ELEVATOR',     servo4: null         },
        'delta':       { servo1: 'ELEVON SOL', servo2: 'ELEVON SAĞ', servo3: null,       servo4: 'RUDDER'     },
        'flying-wing': { servo1: 'ELEVON SOL', servo2: 'ELEVON SAĞ', servo3: null,       servo4: 'RUDDER'     },
    };

    const servoNames = names[selectedAircraft] || names['v-tail'];

    for (let i = 1; i <= 4; i++) {
        const name = servoNames[`servo${i}`];
        const titleEl = document.getElementById(`servo${i}Title`);
        const cardEl  = document.getElementById(`servo${i}Card`);
        if (titleEl) titleEl.textContent = name || `SERVO ${i}`;
        if (cardEl)  cardEl.style.display = (name === null) ? 'none' : '';
    }
}

/**
 * @brief Servo ayar oklarının aktiflik durumunu günceller
 * @param {string} servo - Servo adı (servo1, servo2, vb.)
 */
function updateArrowButtons(servo) {
    if (!servoValues[servo]) return;

    const { min, mid, max } = servoValues[servo];

    // Min Butonları
    const minDown = document.querySelector(`[data-servo="${servo}"][data-type="min"][data-direction="down"]`);
    const minUp = document.querySelector(`[data-servo="${servo}"][data-type="min"][data-direction="up"]`);
    if (minDown) minDown.disabled = min <= 1000;
    if (minUp) minUp.disabled = min >= mid - 10;

    // Mid Butonları
    const midDown = document.querySelector(`[data-servo="${servo}"][data-type="mid"][data-direction="down"]`);
    const midUp = document.querySelector(`[data-servo="${servo}"][data-type="mid"][data-direction="up"]`);
    if (midDown) midDown.disabled = mid <= min + 10;
    if (midUp) midUp.disabled = mid >= max - 10;

    // Max Butonları
    const maxDown = document.querySelector(`[data-servo="${servo}"][data-type="max"][data-direction="down"]`);
    const maxUp = document.querySelector(`[data-servo="${servo}"][data-type="max"][data-direction="up"]`);
    if (maxDown) maxDown.disabled = max <= mid + 10;
    if (maxUp) maxUp.disabled = max >= 2000;
}

/**
 * @brief Servo değerlerini UI'da günceller
 */
function updateServoValuesUI() {
    for (let i = 1; i <= 4; i++) {
        const servo = `servo${i}`;
        if (servoValues[servo]) {
            if (_$(`${servo}Min`)) _$(`${servo}Min`).textContent = servoValues[servo].min;
            if (_$(`${servo}Mid`)) _$(`${servo}Mid`).textContent = servoValues[servo].mid;
            if (_$(`${servo}Max`)) _$(`${servo}Max`).textContent = servoValues[servo].max;

            // Reverse durumunu işle
            if (_$(`revServo${i}`)) {
                _$(`revServo${i}`).checked = servoValues[servo].reverse === true;
            }

            updateArrowButtons(servo);
        }
    }
}

/**
 * @brief Servo değerini değiştirir (ok butonları için)
 * @param {string} servo - Servo adı
 * @param {string} type - Değer tipi (min, mid, max)
 * @param {string} direction - Yön (up, down)
 */
function changeServoValue(servo, type, direction) {
    const step = 10;
    let newValue = servoValues[servo][type] + (direction === 'up' ? step : -step);

    if (type === 'min') {
        newValue = Math.max(1000, Math.min(newValue, servoValues[servo].mid - 10));
    } else if (type === 'mid') {
        newValue = Math.max(servoValues[servo].min + 10, Math.min(newValue, servoValues[servo].max - 10));
    } else if (type === 'max') {
        newValue = Math.max(servoValues[servo].mid + 10, Math.min(newValue, 2000));
    }

    servoValues[servo][type] = newValue;
    updateServoValuesUI();
}

// ============================================================================
// THROTTLE FONKSİYONLARI
// ============================================================================

/**
 * @brief Throttle değerini günceller
 * @param {number|string} value - Yeni throttle değeri
 */
function updateThrottle(value) {
    throttleValue = parseInt(value);
    
    if (_$('throttleValue')) _$('throttleValue').textContent = throttleValue;
    if (throttleSlider) throttleSlider.value = throttleValue;
    if (_$('output1')) _$('output1').textContent = throttleValue;
    if (_$('output2')) _$('output2').textContent = throttleValue;
    
    if (typeof isConnected !== 'undefined' && isConnected && safetyChecked) {
        if (typeof sendCommand === 'function') {
            sendCommand(`THROTTLE ${throttleValue}`);
        }
    }
}

/**
 * @brief Güvenlik uyarısı metnini günceller
 */
function updateSafetyWarning() {
    if (!safetyWarning) return;
    
    if (safetyChecked) {
        safetyWarning.textContent = '✅ PWM gönderimi aktif';
        safetyWarning.style.color = '#198754';
    } else {
        safetyWarning.textContent = '⚠️ Güvenlik onayı gerekiyor';
        safetyWarning.style.color = '#ffc107';
    }
}

/**
 * @brief Throttle keep-alive güncellemelerini başlatır
 */
function startThrottleUpdates() {
    if (throttleInterval) return;

    throttleInterval = setInterval(() => {
        if (typeof isConnected !== 'undefined' && isConnected && safetyChecked) {
            if (typeof sendCommand === 'function') {
                sendCommand(`THROTTLE ${throttleValue}`);
            }
        }
    }, 100);
}

/**
 * @brief Throttle güncellemelerini durdurur
 */
function stopThrottleUpdates() {
    if (throttleInterval) {
        clearInterval(throttleInterval);
        throttleInterval = null;
        if (typeof isConnected !== 'undefined' && isConnected) {
            if (typeof sendCommand === 'function') {
                sendCommand('THROTTLE_STOP');
            }
        }
    }
}

// ============================================================================
// MİKSER SAYFA VERİSİ HANDLER
// ============================================================================

function handleMixerPageData(data) {
    if (data.aircraft_type) {
        selectedAircraft = data.aircraft_type;
        document.querySelectorAll('.aircraft-card').forEach(card => {
            card.classList.toggle('active', card.getAttribute('data-aircraft-type') === selectedAircraft);
        });
        updateServoNames();
    }
    const setMix = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
    setMix('mixRoll',     data.roll_mix);
    setMix('mixPitch',    data.pitch_mix);
    setMix('mixYaw',      data.yaw_mix);
    setMix('mixThrottle', data.throttle_mix);
}

// ============================================================================
// KAYDETME FONKSİYONLARI
// ============================================================================

function saveGpsConfig() {
    // GPS pinlerini pinConfig'e yaz, ardından tüm pin kaydını gönder
    const tx = parseInt(document.getElementById('gpsTxPin')?.value ?? -1);
    const rx = parseInt(document.getElementById('gpsRxPin')?.value ?? -1);
    if (!isNaN(tx)) pinConfig.gps_tx = tx;
    if (!isNaN(rx)) pinConfig.gps_rx = rx;
    savePinsConfig();
    updatePinSummaries();
    // Nav ayarlarını kaydet (SAVE_ADVANCED_CONFIG — tüm inp_nav_* elemanları DOM'da)
    if (typeof saveAdvancedConfig === 'function') {
        saveAdvancedConfig();
    }
    _log('📤 GPS & Nav ayarları kaydediliyor...', 'info');
}

function saveGpsPinsOnly() {
    const tx = parseInt(document.getElementById('gpsTxPin')?.value ?? -1);
    const rx = parseInt(document.getElementById('gpsRxPin')?.value ?? -1);
    if (!isNaN(tx)) pinConfig.gps_tx = tx;
    if (!isNaN(rx)) pinConfig.gps_rx = rx;
    savePinsConfig();
    updatePinSummaries();
    _log('📤 GPS pinleri kaydediliyor...', 'info');
}

function saveAdcPins() {
    const adcEl   = document.getElementById('adcVoltagePin');
    const scaleEl = document.getElementById('adcVoltageScale');
    if (adcEl)   pinConfig.adc_voltage       = parseInt(adcEl.value);
    if (scaleEl) pinConfig.adc_voltage_scale  = parseFloat(scaleEl.value);
    savePinsConfig();
    updatePinSummaries();
    _log('📤 ADC pinleri kaydediliyor...', 'info');
}

function saveRxPins() {
    const tx = parseInt(document.getElementById('rxTxPin')?.value ?? -1);
    const rx = parseInt(document.getElementById('rxRxPin')?.value ?? -1);
    if (isNaN(tx) || isNaN(rx)) {
        _log('❌ Geçersiz alıcı pin değeri', 'error');
        return;
    }
    pinConfig.rx_tx = tx;
    pinConfig.rx_rx = rx;
    savePinsConfig();
    updatePinSummaries();
    _log(`📤 Alıcı pinleri kaydediliyor — TX: GPIO${tx}, RX: GPIO${rx}`, 'info');
}

function saveI2CPins() {
    const scl = parseInt(document.getElementById('i2cSclPin')?.value ?? -1);
    const sda = parseInt(document.getElementById('i2cSdaPin')?.value ?? -1);
    if (isNaN(scl) || isNaN(sda)) {
        _log('❌ Geçersiz I2C pin değeri', 'error');
        return;
    }
    // Mevcut pinConfig'e yaz, ardından tam kayıt gönder
    pinConfig.i2c_scl = scl;
    pinConfig.i2c_sda = sda;
    savePinsConfig();
    updatePinSummaries();
    _log(`📤 I2C pinleri kaydediliyor — SCL: GPIO${scl}, SDA: GPIO${sda}`, 'info');
}

function saveOsdPins() {
    const tx = parseInt(document.getElementById('osdTxPin')?.value ?? -1);
    const rx = parseInt(document.getElementById('osdRxPin')?.value ?? -1);
    pinConfig.osd_tx = tx;
    pinConfig.osd_rx = rx;
    savePinsConfig();
    updatePinSummaries();
    _log(`📤 OSD pinleri kaydediliyor — TX: GPIO${tx}, RX: GPIO${rx}`, 'info');
}

function savePinsConfig() {
    const getPin = (id, fallback = -1) => {
        const el = _$(id);
        if (!el) return fallback;
        const v = parseInt(el.value);
        return isNaN(v) ? fallback : v;
    };

    const pins = {
        motor1:      getPin('motor1Pin',  pinConfig.motor1   ?? -1),
        motor2:      getPin('motor2Pin',  pinConfig.motor2   ?? -1),
        servo1:      getPin('servo1Pin',  pinConfig.servo1   ?? -1),
        servo2:      getPin('servo2Pin',  pinConfig.servo2   ?? -1),
        servo3:      getPin('servo3Pin',  pinConfig.servo3   ?? -1),
        servo4:      getPin('servo4Pin',  pinConfig.servo4   ?? -1),
        rx_tx:       getPin('rxTxPin',    pinConfig.rx_tx    ?? -1),
        rx_rx:       getPin('rxRxPin',    pinConfig.rx_rx    ?? -1),
        gps_tx:      getPin('gpsTxPin',   pinConfig.gps_tx   ?? -1),
        gps_rx:      getPin('gpsRxPin',   pinConfig.gps_rx   ?? -1),
        osd_tx:      getPin('osdTxPin',   pinConfig.osd_tx   ?? -1),
        osd_rx:      getPin('osdRxPin',   pinConfig.osd_rx   ?? -1),
        i2c_scl:     getPin('i2cSclPin',  pinConfig.i2c_scl  ?? -1),
        i2c_sda:     getPin('i2cSdaPin',  pinConfig.i2c_sda  ?? -1),
        adc_voltage: pinConfig.adc_voltage ?? -1,
    };

    if (pinConfig.adc_voltage_scale != null) pins.adc_voltage_scale = pinConfig.adc_voltage_scale;

    for (let i = 1; i <= 4; i++) {
        const checkbox = _$(`revServo${i}`);
        if (servoValues[`servo${i}`] && checkbox) {
            servoValues[`servo${i}`].reverse = checkbox.checked;
        }
    }

    const payload = { pins, servo_values: servoValues };
    _log('📤 Pin ayarları gönderiliyor...', 'info');
    if (typeof sendCommand === 'function') {
        sendCommand(`PINS_SAVE ${JSON.stringify(payload)}`);
    }
}

function saveMixerConfig() {
    const getMixVal = (id, def) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseInt(el.value);
        return (isNaN(v) || v < -200 || v > 200) ? def : v;
    };

    const payload = {
        aircraft_type: selectedAircraft,
        mixer: {
            roll_mix:     getMixVal('mixRoll', 100),
            pitch_mix:    getMixVal('mixPitch', 100),
            yaw_mix:      getMixVal('mixYaw', 100),
            throttle_mix: getMixVal('mixThrottle', 100),
        }
    };
    _log('📤 Mikser ayarları gönderiliyor...', 'info');
    if (typeof sendCommand === 'function') {
        sendCommand(`MIXER_SAVE ${JSON.stringify(payload)}`);
    }
}

/**
 * @brief Outputs konfigürasyonunu ESP'ye kaydeder (eski tam kayıt - uyumluluk için)
 */
function saveOutputsConfig() {
    // Pinleri al
    pinConfig.motor1 = parseInt(_$('motor1Pin').value);
    pinConfig.motor2 = parseInt(_$('motor2Pin').value);
    pinConfig.servo1 = parseInt(_$('servo1Pin').value);
    pinConfig.servo2 = parseInt(_$('servo2Pin').value);
    pinConfig.servo3 = parseInt(_$('servo3Pin').value);
    pinConfig.servo4 = parseInt(_$('servo4Pin').value);

    // ALICI PİNLERİ
    pinConfig.rx_tx = parseInt(_$('rxTxPin')?.value);
    pinConfig.rx_rx = parseInt(_$('rxRxPin')?.value);

    // GPS
    pinConfig.gps_tx = parseInt(_$('gpsTxPin')?.value);
    pinConfig.gps_rx = parseInt(_$('gpsRxPin')?.value);

    // OSD
    pinConfig.osd_tx = parseInt(_$('osdTxPin')?.value);
    pinConfig.osd_rx = parseInt(_$('osdRxPin')?.value);

    // I2C
    pinConfig.i2c_scl = parseInt(_$('i2cSclPin')?.value);
    pinConfig.i2c_sda = parseInt(_$('i2cSdaPin')?.value);

    // ADC — değerler pinConfig cache'inden gelir (voltageAdcPin/Scale artık DOM'da yok)

    // Servo Reverse
    for (let i = 1; i <= 4; i++) {
        const servoKey = `servo${i}`;
        const checkbox = _$(`revServo${i}`);
        if (servoValues[servoKey] && checkbox) {
            servoValues[servoKey].reverse = checkbox.checked;
        }
    }

    // Mikser kazançları
    const getMixVal = (id, def) => {
        const el = document.getElementById(id);
        if (!el) return def;
        const v = parseInt(el.value);
        return (isNaN(v) || v < -200 || v > 200) ? def : v;
    };
    const mixer = {
        roll_mix:     getMixVal('mixRoll', 100),
        pitch_mix:    getMixVal('mixPitch', 100),
        yaw_mix:      getMixVal('mixYaw', 100),
        throttle_mix: getMixVal('mixThrottle', 100),
    };

    const outputData = {
        aircraft_type: selectedAircraft,
        pins: pinConfig,
        servo_values: servoValues,
        mixer: mixer
    };

    _log('📤 Outputs konfigürasyonu gönderiliyor...', 'info');
    
    if (typeof sendCommand === 'function') {
        sendCommand(`OUTPUT_SAVE ${JSON.stringify(outputData)}`);
    } else {
        console.error("sendCommand fonksiyonu bulunamadı!");
    }
}
const defaultMixerValues = {
    'v-tail':      { roll: 100, pitch:  50, yaw:  50 },
    't-tail':      { roll: 100, pitch: 100, yaw: 100 },
    'no-ruder':    { roll: 100, pitch: 100, yaw:   0 },
    'delta':       { roll:  50, pitch:  50, yaw: 100 },
    'flying-wing': { roll:  50, pitch:  50, yaw: 100 },
};

function applyDefaultMixerValues(aircraftType) {
    const defaults = defaultMixerValues[aircraftType];
    if (!defaults) return;
    const rollEl  = document.getElementById('mixRoll');
    const pitchEl = document.getElementById('mixPitch');
    const yawEl   = document.getElementById('mixYaw');
    if (rollEl)  rollEl.value  = defaults.roll;
    if (pitchEl) pitchEl.value = defaults.pitch;
    if (yawEl)   yawEl.value   = defaults.yaw;
}

document.querySelectorAll('.aircraft-card').forEach(card => {
                card.addEventListener('click', () => {
                    document.querySelectorAll('.aircraft-card').forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    selectedAircraft = card.getAttribute('data-aircraft-type');
                    updateServoNames();
                    applyDefaultMixerValues(selectedAircraft);
                });
            });
            document.querySelectorAll('.servo-arrow').forEach(arrow => {
                arrow.addEventListener('click', () => {
                    const servo = arrow.getAttribute('data-servo');
                    const type = arrow.getAttribute('data-type');
                    const direction = arrow.getAttribute('data-direction');
                    changeServoValue(servo, type, direction);
                });
            });

// ADC pin input değişince badge'i güncelle
const _adcPinInput = document.getElementById('adcVoltagePin');
if (_adcPinInput) { _adcPinInput.addEventListener('change', updatePinSummaries); }

// ============================================================================
// PIN ACCORDION
// ============================================================================

/**
 * @brief Pin accordion başlığındaki badge özet etiketlerini günceller.
 *        handleOutputsPageData ve her kayıt sonrası çağrılmalı.
 */
function updatePinSummaries() {
    const pinLabel = (id) => {
        const el = document.getElementById(id);
        if (!el) return null;
        const v = parseInt(el.value);
        return v === -1 ? null : `GPIO${v}`;
    };

    const setBadges = (containerId, entries) => {
        const el = document.getElementById(containerId);
        if (!el) return;
        el.innerHTML = entries
            .map(([label, id]) => {
                const val = pinLabel(id);
                if (!val) return `<span class="pin-badge disabled">${label}:—</span>`;
                return `<span class="pin-badge">${label}:${val}</span>`;
            })
            .join('');
    };

    setBadges('motorServoPinBadges', [
        ['M1', 'motor1Pin'], ['M2', 'motor2Pin'],
        ['S1', 'servo1Pin'], ['S2', 'servo2Pin'],
        ['S3', 'servo3Pin'], ['S4', 'servo4Pin'],
    ]);

    setBadges('i2cPinBadges', [
        ['SCL', 'i2cSclPin'], ['SDA', 'i2cSdaPin'],
    ]);

    setBadges('gpsPinBadges', [
        ['TX', 'gpsTxPin'], ['RX', 'gpsRxPin'],
    ]);

    setBadges('rxPinBadges', [
        ['TX', 'rxTxPin'], ['RX', 'rxRxPin'],
    ]);

    setBadges('osdPinBadges', [
        ['TX', 'osdTxPin'], ['RX', 'osdRxPin'],
    ]);

    const adcEl = document.getElementById('adcPinBadges');
    if (adcEl) {
        const adcInput = document.getElementById('adcVoltagePin');
        const v = adcInput ? parseInt(adcInput.value) : -1;
        adcEl.innerHTML = v === -1
            ? '<span class="pin-badge disabled">ADC:—</span>'
            : `<span class="pin-badge">ADC:GPIO${v}</span>`;
    }
}

/**
 * @brief Pin accordion header'a tıklanınca body'yi aç/kapa.
 */
function togglePinAcc(headerEl) {
    headerEl.classList.toggle('open');
    const body = headerEl.nextElementSibling;
    if (body && body.classList.contains('pin-acc-body')) {
        body.classList.toggle('open');
    }
}

// ============================================================================
// GLOBAL EXPORT
// ============================================================================

// Tüm fonksiyonları global scope'a aktar
window.handleOutputsPageData = handleOutputsPageData;
window.handleMixerPageData = handleMixerPageData;
window.savePinsConfig = savePinsConfig;
window.saveMixerConfig = saveMixerConfig;
window.saveI2CPins = saveI2CPins;
window.saveRxPins = saveRxPins;
window.saveOsdPins = saveOsdPins;
window.saveGpsConfig = saveGpsConfig;
window.saveGpsPinsOnly = saveGpsPinsOnly;
window.saveAdcPins = saveAdcPins;
window.handlePwmStream = handlePwmStream;
window.updatePwmOutputs = updatePwmOutputs;
window.togglePinAcc = togglePinAcc;
window.updatePinSummaries = updatePinSummaries;
window.updateServoNames = updateServoNames;
window.updateArrowButtons = updateArrowButtons;
window.updateServoValuesUI = updateServoValuesUI;
window.changeServoValue = changeServoValue;
window.updateThrottle = updateThrottle;
window.updateSafetyWarning = updateSafetyWarning;
window.startThrottleUpdates = startThrottleUpdates;
window.stopThrottleUpdates = stopThrottleUpdates;
window.saveOutputsConfig = saveOutputsConfig;

console.log('✅ Outputs Page Module yüklendi');
