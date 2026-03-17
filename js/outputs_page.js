/**
 * @file outputs_page.js
 * @brief X-Flight Configurator - Outputs (Konfigürasyon) Sayfası Modülü
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
        setVal('voltageAdcPin', pinConfig.adc_voltage);
    }

    // 3. Servo Değerleri
    if (data.servo_values) {
        servoValues = data.servo_values;
        updateServoValuesUI();
    }

    // 4. Canlı PWM Çıkışları
    if (data.outputs) {
        updatePwmOutputs(data.outputs);
    }

    // 5. Flaperon Offset (artık Tercihler sayfasında, aynı ID ile okunur)
    if (data.flaperon_offset !== undefined) {
        const slider = document.getElementById('flaperonOffsetSlider');
        const label  = document.getElementById('flaperonOffsetValue');
        if (slider) slider.value = data.flaperon_offset;
        if (label)  label.textContent = data.flaperon_offset;
    }

    // 6. Mikser Kazançları
    if (data.mixer) {
        const setMix = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
        setMix('mixRoll',     data.mixer.roll_mix);
        setMix('mixPitch',    data.mixer.pitch_mix);
        setMix('mixYaw',      data.mixer.yaw_mix);
        setMix('mixThrottle', data.mixer.throttle_mix);
    }

    // 7. Sensör Konfigürasyonu
    if (data.sensor_config) {
        const sc = data.sensor_config;
        const setChk = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.checked = !!val; };
        const setVal = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };
        setVal('cfg_imu_model',    sc.imu_model);
        setVal('cfg_imu_orient',   sc.imu_orient);
        setChk('cfg_has_baro',     sc.has_baro);
        setChk('cfg_has_mag',      sc.has_mag);
        setChk('cfg_has_airspeed', sc.has_airspeed);
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
// KAYDETME FONKSİYONU
// ============================================================================

/**
 * @brief Outputs konfigürasyonunu ESP'ye kaydeder
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

    // ADC
    pinConfig.adc_voltage = parseInt(_$('voltageAdcPin')?.value);

    // Servo Reverse
    for (let i = 1; i <= 4; i++) {
        const servoKey = `servo${i}`;
        const checkbox = _$(`revServo${i}`);
        if (servoValues[servoKey] && checkbox) {
            servoValues[servoKey].reverse = checkbox.checked;
        }
    }

    // Flaperon offset
    const flaperonSlider = _$('flaperonOffsetSlider');
    const flaperon_offset = flaperonSlider ? parseInt(flaperonSlider.value) : 150;

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

    // Sensör Konfigürasyonu
    const getBool = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };
    const getInt  = (id) => { const el = document.getElementById(id); return el ? parseInt(el.value) : 0; };
    const sensor_config = {
        imu_model:    getInt('cfg_imu_model'),
        imu_orient:   getInt('cfg_imu_orient'),
        has_baro:     getBool('cfg_has_baro'),
        has_mag:      getBool('cfg_has_mag'),
        has_airspeed: getBool('cfg_has_airspeed'),
    };

    const outputData = {
        aircraft_type: selectedAircraft,
        pins: pinConfig,
        servo_values: servoValues,
        flaperon_offset: flaperon_offset,
        mixer: mixer,
        sensor_config: sensor_config,
    };

    _log('📤 Outputs konfigürasyonu gönderiliyor...', 'info');
    
    if (typeof sendCommand === 'function') {
        sendCommand(`OUTPUT_SAVE ${JSON.stringify(outputData)}`);
    } else {
        console.error("sendCommand fonksiyonu bulunamadı!");
    }
}
// ============================================================================
// KONFİGÜRASYON SAYFASI ALT NAVİGASYON (Sub-Nav Tabs)
// ============================================================================

/**
 * @brief Konfigürasyon sayfası alt menü tab'larını başlatır
 */
function initConfigSubNav() {
    const tabButtons = document.querySelectorAll('.cfg-tab-btn[data-cfg-tab]');
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabId = btn.getAttribute('data-cfg-tab');
            switchConfigTab(tabId);
        });
    });
}

/**
 * @brief Belirtilen konfigürasyon tab'ına geçiş yapar
 * @param {string} tabId - Tab kimliği (ucak-tipi, mikser, motor-servo, sensorler)
 */
function switchConfigTab(tabId) {
    // Tüm tab butonlarından active kaldır
    document.querySelectorAll('.cfg-tab-btn[data-cfg-tab]').forEach(btn => {
        btn.classList.remove('active');
    });
    // Tüm cfg-section'ları gizle
    document.querySelectorAll('.cfg-section').forEach(section => {
        section.classList.add('d-none');
    });

    // Aktif tab'ı işaretle
    const activeBtn = document.querySelector(`.cfg-tab-btn[data-cfg-tab="${tabId}"]`);
    if (activeBtn) activeBtn.classList.add('active');

    // İlgili section'ı göster
    const activeSection = document.getElementById(`cfg-${tabId}`);
    if (activeSection) activeSection.classList.remove('d-none');
}

// Aircraft card ve servo arrow event listener'ları
document.querySelectorAll('.aircraft-card').forEach(card => {
    card.addEventListener('click', () => {
        document.querySelectorAll('.aircraft-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
        selectedAircraft = card.getAttribute('data-aircraft-type');
        updateServoNames();
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

// Sub-nav başlat
initConfigSubNav();

// ============================================================================
// GLOBAL EXPORT
// ============================================================================

// Tüm fonksiyonları global scope'a aktar
window.handleOutputsPageData = handleOutputsPageData;
window.handlePwmStream = handlePwmStream;
window.updatePwmOutputs = updatePwmOutputs;
window.updateServoNames = updateServoNames;
window.updateArrowButtons = updateArrowButtons;
window.updateServoValuesUI = updateServoValuesUI;
window.changeServoValue = changeServoValue;
window.updateThrottle = updateThrottle;
window.updateSafetyWarning = updateSafetyWarning;
window.startThrottleUpdates = startThrottleUpdates;
window.stopThrottleUpdates = stopThrottleUpdates;
window.saveOutputsConfig = saveOutputsConfig;
window.initConfigSubNav = initConfigSubNav;
window.switchConfigTab = switchConfigTab;

console.log('✅ Outputs Page Module yüklendi');
