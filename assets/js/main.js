/**
 * @file main.js
 * @brief Vecihi Configurator - Ana Başlatma ve Event Listener Modülü
 * @description Bu dosya, uygulamanın ana init() ve setupEventListeners() fonksiyonlarını içerir.
 *              configurator.html içindeki aynı kodlar kaldırılmalıdır.
 * 
 * @requires serial_communication.js - isConnected, sendCommand, connectSerial, disconnectSerial
 * @requires page_management.js - initPageManagement, currentPage
 * @requires sensors.js - init3DModel, startQuaternionStream
 * @requires calibration.js - setupCalibrationEventListeners
 * @requires pid.js - initPIDPage, updatePIDUI
 * @requires osd.js - applyOSDConfig
 * @requires advanced_page.js - saveAdvancedConfig
 */

// ============================================================================
// YARDIMCI FONKSİYONLAR (Kaldırılacak - Ana dosyada kalmalı)
// ============================================================================

/**
 * @brief Select dropdown'larını GPIO pinleri ile doldurur
 */
function populatePinSelectors() {
    const pinOptions = esp32Pins.map(pin => {
        if (pin === -1) return `<option value="-1">❌ Devre Dışı</option>`;
        
        // ADC Pinleri için uyarı (Sadece INPUT)
        if (pin >= 34 && pin <= 39) {
            return `<option value="${pin}">GPIO ${pin} (Sadece INPUT/ADC)</option>`;
        }
        
        // Boot/Flash pinleri için uyarı
        if (pin === 0 || pin === 2) {
            return `<option value="${pin}">GPIO ${pin} ⚠️ (Boot Pin)</option>`;
        }
        
        return `<option value="${pin}">GPIO ${pin}</option>`;
    }).join('');

    // TÜM PIN SELECT'LERİNİ BUL VE DOLDUR
    const selects = [
        // Motor & Servo
        'motor1Pin', 'motor2Pin', 
        'servo1Pin', 'servo2Pin', 'servo3Pin', 'servo4Pin',
        
        // ALICI
        'rxTxPin', 'rxRxPin',
        
        // GPS
        'gpsRxPin', 'gpsTxPin',
        
        // OSD
        'osdRxPin', 'osdTxPin',
        
        // I2C
        'i2cSclPin', 'i2cSdaPin'
    ];

    selects.forEach(id => { 
        const el = document.getElementById(id);
        if (el) {
            el.innerHTML = pinOptions;
        } else {
            console.warn(`⚠️ Element bulunamadı: ${id}`);
        }
    });
}

/**
 * @brief Select dropdown'larını RC kanalları ile doldurur
 */
function populateChannelSelectors() {
    const selects = ['rollChannel', 'pitchChannel', 'yawChannel', 'throttleChannel', 'modChannel'];
    selects.forEach(id => {
        const el = $(id);
        if (el) el.innerHTML = channelOptions;
    });
}

// ============================================================================
// EVENT LISTENERS
// ============================================================================

/**
 * @brief Tüm event listener'ları tek bir yerden kurar
 */
function setupEventListeners() {
    // --- Sistem ve Bağlantı ---
    const btnConnect = $('btnConnect');
    if (btnConnect) {
        btnConnect.addEventListener('click', connectSerial);
    }
    const btnConnectPrompt = $('btnConnectPrompt');
    if (btnConnectPrompt) {
        btnConnectPrompt.addEventListener('click', connectSerial);
    }
    $('btnDisconnect').addEventListener('click', disconnectSerial);

    // --- Kalibrasyon Sayfası Event Listener'ları ---
    if (typeof setupCalibrationEventListeners === 'function') {
        setupCalibrationEventListeners();
    }

    // --- Aircraft Card Seçimi ---
    document.querySelectorAll('.aircraft-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.aircraft-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            selectedAircraft = card.getAttribute('data-aircraft-type');
            updateServoNames();
            if (typeof applyDefaultMixerValues === 'function') applyDefaultMixerValues(selectedAircraft);
        });
    });

    // --- Servo Okları ---
    document.querySelectorAll('.servo-arrow').forEach(btn => {
        btn.addEventListener('click', () => {
            const servo = btn.getAttribute('data-servo');
            const type = btn.getAttribute('data-type');
            const direction = btn.getAttribute('data-direction');
            changeServoValue(servo, type, direction);
        });
    });

    // --- PID Sayfası Sliders ---
    document.querySelectorAll('#pid .pid-slider').forEach(slider => {
        slider.addEventListener('input', function() {
            const mAxis = this.id.match(/^(roll|pitch|yaw|level)/);
            if (!mAxis) return;
            const axis = mAxis[0];

            const mType = this.id.match(/(P|I|ILimit|FF)Slider$/);
            if (!mType) return;
            const typeRaw = mType[1];

            const type = typeRaw.toLowerCase().replace('ilimit', 'i_limit');
            const value = (type === 'i_limit') ? parseInt(this.value, 10) : parseFloat(this.value);

            if (!pidValues[axis]) pidValues[axis] = {};
            pidValues[axis][type] = value;

            const valueLabel = document.getElementById(`${axis}${typeRaw}Value`);
            if (valueLabel) {
                const decimals = (axis === 'level' && type === 'p') ? 1 : 2;
                valueLabel.textContent = (type === 'i_limit') ? String(value) : value.toFixed(decimals);
            }
        });
    });

    // --- Log Sayfası ---
    $('btnSendCommand').addEventListener('click', sendCommandFromInput);
    $('btnLogClear').addEventListener('click', clearLogs);
    $('btnLogClearAll').addEventListener('click', clearAllLogs);
    $('btnLogExport').addEventListener('click', exportLogs);
    $('logLevelFilter').addEventListener('change', filterLogs);
    $('autoScroll').addEventListener('change', toggleAutoScroll);
    $('pauseLogs').addEventListener('change', togglePauseLogs);
    $('btnLogSearch').addEventListener('click', searchLogs);
    $('btnClearSearch').addEventListener('click', clearSearch);
    $('logSearch').addEventListener('keypress', (e) => e.key === 'Enter' && searchLogs());
}

// ============================================================================
// ANA BAŞLATMA FONKSİYONU
// ============================================================================

/**
 * @brief ANA BAŞLANGIÇ FONKSİYONU
 */
function init() {
    // Throttle UI'ı başlat
    initThrottleUI();
    
    // Global DOM elementlerini seç
    statusIndicator = $('statusIndicator');
    connectionStatus = $('connectionStatus');
    connectionPrompt = $('connectionPrompt');
    throttleSlider = $('throttleSlider');
    safetyCheck = $('safetyCheck');
    safetyWarning = $('safetyWarning');
    logContainer = $('logContainer');
    
    // 3D Model ve Grafikler
    init3DModel(); 
    initCharts();
    
    // Bağlantı durumunu güncelle
    updateConnectionStatus();
    
    // Sayfa yönetimini başlat
    initPageManagement();
    
    // UI'ı varsayılanla doldur (Bağlantı olmasa bile)
    populatePinSelectors();
    renderModesPage();
    updatePIDUI();        
    updateTransmitterUI(); 
    updateServoNames();
    updateServoValuesUI();
    updateSafetyWarning();
    updateLogStats();
    
    // Tüm event listener'ları kur
    setupEventListeners();
    
    log('🚀 Flight Controller arayüzü hazır...', 'info');
    log('📡 \'Porta Bağlan\' butonuna tıklayın', 'info');
}

// ============================================================================
// DOM HAZIR OLDUĞUNDA BAŞLAT
// ============================================================================

document.addEventListener('DOMContentLoaded', init);