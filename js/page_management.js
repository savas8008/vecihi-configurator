/**
 * @file page_management.js
 * @brief Sayfa yönetimi, navigasyon ve stream kontrolü
 * X-Flight Configurator için modüler JS
 */

// === SAYFA DURUMU ===
let currentPage = 'calibration';

// === SAYFA DEĞİŞTİRME ===

/**
 * @brief Aktif sayfayı değiştirir ve gerekli stream'leri yönetir
 * @param {string} targetPage - Hedef sayfa adı
 */
function changePage(targetPage) {
    // 1. UI Güncellemeleri
    document.querySelectorAll('.nav-link').forEach(nav => nav.classList.remove('active'));
    document.querySelectorAll('.page').forEach(page => page.classList.remove('active'));
    
    const activeLink = document.querySelector(`.nav-link[data-page="${targetPage}"]`);
    if (activeLink) activeLink.classList.add('active');
    
    const targetPageEl = $(targetPage);
    if (targetPageEl) targetPageEl.classList.add('active');
    
    currentPage = targetPage;
    updateConnectionStatus();
    
    // 2. Bağlantı varsa stream yönetimi
    if (isConnected) {
        managePageStreams(targetPage);
    }
}

/**
 * @brief Sayfa değişiminde stream'leri yönetir
 * @param {string} page - Sayfa adı
 */
function managePageStreams(page) {
    log(`Yönlendiriliyor: ${page}...`, 'info');
    
    // A) Tüm stream'leri durdur
    stopAllStreams();
    
    // B) Sayfa verilerini iste (50ms gecikme)
    setTimeout(() => {
        if (page !== 'sensors') {
            sendCommand(page + '_page_data');
        }
    }, 50);
    
    // C) Sayfaya özel stream başlat (100ms gecikme)
    setTimeout(() => {
        startPageSpecificStream(page);
    }, 100);
}

/**
 * @brief Tüm aktif stream'leri durdurur
 */
function stopAllStreams() {
    sendCommand('stop_quaternion_stream');
    sendCommand('stop_receiver_stream');
    sendCommand('stop_gyro_stream');
    sendCommand('stop_sensor_stream');
    stopThrottleUpdates();
}

/**
 * @brief Sayfaya özel stream'i başlatır
 * @param {string} page - Sayfa adı
 */
function startPageSpecificStream(page) {
    switch (page) {
        case 'calibration':
            log('Bağlam: Kalibrasyon -> Quaternion Stream Başlatılıyor', 'info');
            startQuaternionStream();
            break;
            
        case 'sensors':
            log('Bağlam: Sensörler -> Sensor Stream Başlatılıyor', 'info');
            initMap();
            sendCommand('start_sensor_stream');
            break;
            
        case 'transmitter':
            log('Bağlam: Kumanda -> Receiver Stream Başlatılıyor', 'info');
            sendCommand('start_receiver_stream');
            break;
            
        case 'modes':
            log('Bağlam: Uçuş Modları -> Receiver Stream Başlatılıyor', 'info');
            sendCommand('start_receiver_stream');
            break;
            
        case 'osd':
            log('Bağlam: OSD -> OSD Konfigürasyonu İsteniyor', 'info');
            // OSD için stream yok, tek seferlik veri
            break;
            
        case 'pid':
            log('Bağlam: PID -> Gyro Stream Başlatılıyor', 'info');
            sendCommand('start_gyro_stream');
            break;
            
        default:
            // calibration, outputs, logs, advanced: stream yok
            break;
    }
}

// === SAYFA VERİSİ KAYDETME ===

/**
 * @brief Belirli bir sayfanın verilerini kaydeder
 * @param {string} page - Sayfa adı
 */
function savePageData(page) {
    if (!isConnected) {
        showModal('Uyarı', 'Lütfen önce cihaza bağlanın.', 'warning');
        return;
    }

    const btn = $('btnSave' + page.charAt(0).toUpperCase() + page.slice(1));
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i> Kaydediliyor...';
    }

    let saveCommand = '';
    let payload = null;

    switch (page) {
        case 'calibration':
            saveCalibration();
            return;

        case 'outputs':
            saveCommand = 'OUTPUT_SAVE';
            payload = {
                aircraft_type: selectedAircraft,
                servos: servoValues
            };
            break;

        case 'transmitter':
            saveCommand = 'TRANSMITTER_SAVE';
            payload = {
                protocol: $('rcProtocol').value,
                channel_map: $('channelMap').value,
                rssi_channel: parseInt($('rssiChannel').value),
                failsafe_mode: $('failsafeMode').value,
                battery_pin: parseInt($('batteryPin').value)
            };
            break;

        case 'modes':
            saveCommand = 'MODES_SAVE';
            payload = collectModesData();
            break;

        case 'pid':
            saveCommand = 'PID_SAVE';
            payload = pidValues;
            break;

        case 'advanced':
            saveAdvancedConfig();
            resetSaveButton(btn, 2000);
            return;
    }

    if (saveCommand && payload) {
        sendCommand(saveCommand + ' ' + JSON.stringify(payload));
    }

    resetSaveButton(btn, 2000);
}

/**
 * @brief Kaydet butonunu eski haline getirir
 * @param {HTMLElement} btn - Buton elementi
 * @param {number} delay - Gecikme (ms)
 */
function resetSaveButton(btn, delay = 2000) {
    setTimeout(() => {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<i class="bi bi-save2 me-2"></i> Kaydet';
        }
    }, delay);
}

// === NAVİGASYON EVENT LİSTENER'LARI ===

/**
 * @brief Navigasyon linklerine event listener ekler
 */
function setupNavigationListeners() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const targetPage = link.getAttribute('data-page');
            changePage(targetPage);
        });
    });
}

/**
 * @brief Sayfa bazlı kaydet butonlarına event listener ekler
 */
function setupSaveButtonListeners() {
    const pages = ['Calibration', 'Outputs', 'Transmitter', 'Modes', 'PID', 'Advanced'];
    
    pages.forEach(page => {
        const btn = $('btnSave' + page);
        if (btn) {
            btn.addEventListener('click', () => savePageData(page.toLowerCase()));
        }
    });
}

// === BAĞLANTI DURUMU ===

/**
 * @brief Bağlantı durumuna göre UI'ı günceller
 */
function updateConnectionStatus() {
    const connected = !!port;
    
    $('btnConnect').classList.toggle('d-none', connected);
    $('btnConnectPrompt').classList.toggle('d-none', connected);
    $('btnDisconnect').classList.toggle('d-none', !connected);
    $('connectionPrompt').classList.toggle('d-none', connected);
    $('statusIndicator').className = `status-indicator ${connected ? 'status-connected' : 'status-off'}`;
    $('connectionStatus').textContent = connected ? 'Bağlandı' : 'Bağlantı Yok';

    // Sayfaların görünürlüğünü ayarla
    document.querySelectorAll('.page').forEach(page => {
        page.style.display = connected ? (page.classList.contains('active') ? 'block' : 'none') : 'none';
    });

    // Bağlantı kesildiğinde güvenlik önlemleri
    if (!connected) {
        stopThrottleUpdates();
        if (throttleSlider) throttleSlider.disabled = true;
        if (safetyCheck) safetyCheck.checked = false;
        safetyChecked = false;
        updateThrottle(1000);
        updateSafetyWarning();
    }
}

// === İLK YÜKLEME ===

/**
 * @brief Sayfa yönetimi modülünü başlatır
 */
function initPageManagement() {
    setupNavigationListeners();
    setupSaveButtonListeners();
    updateConnectionStatus();
    
    // Varsayılan sayfa
    changePage('calibration');
}

function savePageData(page) {
    if (!isConnected) {
        showModal('Uyarı', 'Lütfen önce cihaza bağlanın.', 'warning');
        return;
    }

    const btn = $('btnSave' + page.charAt(0).toUpperCase() + page.slice(1));
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<i class="bi bi-hourglass-split me-2"></i> Kaydediliyor...';
    }

    let saveCommand = '';
    let payload = null;

    switch (page) {
        case 'calibration':
            saveCalibration();
            resetSaveButton(btn);
            return;

        case 'outputs':
            saveOutputsConfig();
            resetSaveButton(btn);
            return;

        case 'transmitter':
            saveTransmitterConfig();
            resetSaveButton(btn);
            return;

        case 'modes':
            saveFlightModesConfig();
            resetSaveButton(btn);
            return;

        case 'pid':
            savePIDConfig();
            resetSaveButton(btn);
            return;

        case 'advanced':
            saveAdvancedConfig();
            resetSaveButton(btn);
            return;
            
        default:
            log(`❌ Bilinmeyen sayfa: ${page}`, 'error');
            resetSaveButton(btn);
            return;
    }
}


// === DIŞA AKTARILAN FONKSİYONLAR ===
// Bu fonksiyonlar global scope'ta olmalı (window objesi)

window.changePage = changePage;
window.savePageData = savePageData;
window.updateConnectionStatus = updateConnectionStatus;
window.stopAllStreams = stopAllStreams;
