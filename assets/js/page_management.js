/**
 * @file page_management.js
 * @brief Sayfa yönetimi, navigasyon ve stream kontrolü
 * Vecihi Configurator için modüler JS
 */

// === SAYFA DURUMU ===
let currentPage = '';

// Veri beklenen sayfalar (ESP'den page_data gelmeden kaydet engellenir)
const DATA_PAGES = new Set(['calibration', 'outputs', 'transmitter', 'modes', 'pid', 'advanced', 'osd', 'waypoint']);

// Loading timeout handle'ları (sayfa başına)
const loadingTimeouts = {};

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

    // 3. Firmware sayfası bağlantısız da çalışır
    if (targetPage === 'firmware') {
        if (typeof initFirmwarePage === 'function') initFirmwarePage();
    }
}

/**
 * @brief Sayfa değişiminde stream'leri yönetir
 * @param {string} page - Sayfa adı
 */
function managePageStreams(page) {
    log(`Yönlendiriliyor: ${page}...`, 'info');

    // Firmware sayfası için komut gönderme — sadece UI güncelle
    if (page === 'firmware') return;

    // A) Tüm stream'leri durdur
    stopAllStreams();

    // B) Sayfa verilerini iste (50ms gecikme)
    if (DATA_PAGES.has(page)) showPageLoading(page);
    setTimeout(() => {
        if (page === 'waypoint') {
            sendCommand('GET_WAYPOINTS');
        } else if (page === 'calibration') {
            sendCommand('calibration_page_data');
            // sensor_align ayrı gecikmeyle gönder — firmware single current_command'ı
            // aynı anda iki komut gelirse üzerine yazar, 300ms yeterli süre bırakır
            setTimeout(() => {
                if (typeof onSensorAlignInit === 'function') onSensorAlignInit();
            }, 300);
        } else if (page !== 'sensors') {
            sendCommand(page + '_page_data');
        }
    }, 50);

    // C) Sayfaya özel stream başlat — kalibrasyonun page_data yanıtından SONRA (600ms)
    setTimeout(() => {
        startPageSpecificStream(page);
    }, 600);
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
    const safetyEl = document.getElementById('safetyCheck');
    if (safetyEl) safetyEl.checked = false;
    if (typeof safetyChecked !== 'undefined') safetyChecked = false;
    if (typeof updateSafetyWarning === 'function') updateSafetyWarning();
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
            
        case 'waypoint':
            log('Bağlam: Waypoint -> Harita başlatılıyor', 'info');
            if (typeof initWaypointPage === 'function') initWaypointPage();
            break;

        case 'firmware':
            log('Bağlam: Firmware -> Versiyon bilgisi yükleniyor', 'info');
            if (typeof initFirmwarePage === 'function') initFirmwarePage();
            break;

        default:
            // calibration, outputs, logs, advanced: stream yok
            break;
    }
}

// === SAYFA YÜKLENİYOR OVERLAY ===

/**
 * @brief Sayfa üzerinde "Veriler yükleniyor..." overlay'i gösterir ve kaydet butonunu devre dışı bırakır
 * @param {string} pageKey - Sayfa ID (örn. 'outputs', 'pid')
 */
function showPageLoading(pageKey) {
    const pageEl = document.getElementById(pageKey);
    if (!pageEl) return;

    // Mevcut overlay varsa kaldır
    const existing = pageEl.querySelector('.page-loading-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'page-loading-overlay';
    overlay.id = 'loadingOverlay-' + pageKey;
    overlay.innerHTML = `
        <div class="page-loading-content">
            <div class="spinner-border" role="status"></div>
            <p>Veriler yükleniyor...</p>
            <small>Cihazdan veri bekleniyor</small>
        </div>`;
    pageEl.appendChild(overlay);

    // Kaydet butonunu da devre dışı bırak
    const saveBtn = document.getElementById('btnSave' + pageKey.charAt(0).toUpperCase() + pageKey.slice(1));
    if (saveBtn) saveBtn.disabled = true;

    // Güvenlik: 8 saniye içinde veri gelmezse overlay'i temizle
    clearTimeout(loadingTimeouts[pageKey]);
    loadingTimeouts[pageKey] = setTimeout(() => {
        const stale = document.getElementById('loadingOverlay-' + pageKey);
        if (stale) {
            stale.remove();
            if (typeof log === 'function') {
                log(`⚠️ ${pageKey} sayfası veri zaman aşımı — Yeniden bağlanmayı deneyin`, 'warning');
            }
        }
    }, 8000);
}

/**
 * @brief Sayfa overlay'ini kaldırır ve kaydet butonunu aktif eder
 * @param {string} pageKey - Sayfa ID (örn. 'outputs', 'pid')
 */
function hidePageLoading(pageKey) {
    clearTimeout(loadingTimeouts[pageKey]);
    const overlay = document.getElementById('loadingOverlay-' + pageKey);
    if (overlay) overlay.remove();

    const saveBtn = document.getElementById('btnSave' + pageKey.charAt(0).toUpperCase() + pageKey.slice(1));
    if (saveBtn) saveBtn.disabled = false;
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

    // Veri henüz yüklenmediyse kaydetmeyi engelle
    if (document.getElementById('loadingOverlay-' + page)) {
        showModal('Uyarı', 'Cihazdan veriler henüz yüklenmedi. Lütfen bekleyin.', 'warning');
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
            saveOutputsConfig();
            resetSaveButton(btn, 2000);
            return;

        case 'transmitter':
            saveTransmitterConfig();
            resetSaveButton(btn, 2000);
            return;

        case 'modes':
            saveFlightModesConfig();
            resetSaveButton(btn, 2000);
            return;

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
    // 1. Bağlantı Durumunu Kontrol Et (Daha kapsamlı kontrol)
    let connected = false;
    if (typeof window.isConnected === 'function') {
        connected = window.isConnected();
    }
    // Yedek kontrol: Fonksiyon false dönse bile port nesnesi açıksa bağlıdır
    if (!connected && window.port) {
        connected = true;
    }

    // 2. Bağlantı durumu değişince otomatik sayfa yönlendir
    // Firmware sayfası sadece kullanıcı tıkladığında görünmeli.
    if (connected && currentPage === 'firmware') {
        changePage('calibration');
        return;
    }
    if (connected && !currentPage) {
        changePage('sensors');
        return;
    }
    
    // Element seçici helper (Global $ yoksa diye)
    const el = (id) => document.getElementById(id);
    
    const btnConnect = el('btnConnect');
    if (btnConnect) btnConnect.classList.toggle('d-none', connected);
    
    const btnConnectPrompt = el('btnConnectPrompt');
    if (btnConnectPrompt) btnConnectPrompt.classList.toggle('d-none', connected);
    
    const btnDisconnect = el('btnDisconnect');
    if (btnDisconnect) btnDisconnect.classList.toggle('d-none', !connected);
    
    // Connection Prompt: Firmware sayfasındayken veya bağlıyken gizle
    const prompt = el('connectionPrompt');
    if (prompt) {
        if (connected || currentPage === 'firmware') {
            prompt.classList.add('d-none');
            prompt.style.setProperty('display', 'none', 'important');
        } else {
            prompt.classList.remove('d-none');
            prompt.style.setProperty('display', 'flex', 'important');
        }
    }

    const statusInd = el('statusIndicator');
    if (statusInd) statusInd.className = `status-indicator ${connected ? 'status-connected' : 'status-off'}`;

    const connStatusBox = el('connectionStatusBox');
    if (connStatusBox) connStatusBox.classList.toggle('is-connected', connected);

    const connStatus = el('connectionStatus');
    if (connStatus) connStatus.textContent = connected ? 'Bağlandı' : 'Bağlantı Yok';

    // Navigasyon menüsü: Bağlantı durumuna göre göster/gizle
    // - Bağlantı yok: sadece Firmware sekmesi görünür
    // - Bağlı: Firmware gizli, diğer tüm sekmeler görünür
    document.querySelectorAll('.nav-link').forEach(nav => {
        const navPage = nav.getAttribute('data-page');
        if (navPage === 'firmware') {
            // Firmware: yalnızca bağlantı yokken görünür
            nav.style.display = connected ? 'none' : '';
            if (!connected) {
                nav.style.opacity = '1';
                nav.style.pointerEvents = 'auto';
                nav.style.cursor = 'pointer';
                if (navPage === currentPage) nav.classList.add('active');
                else nav.classList.remove('active');
            } else {
                nav.classList.remove('active');
            }
        } else {
            // Diğer sekmeler: yalnızca bağlıyken görünür
            nav.style.display = connected ? '' : 'none';
            if (connected) {
                nav.style.opacity = '1';
                nav.style.pointerEvents = 'auto';
                nav.style.cursor = 'pointer';
                if (navPage === currentPage) nav.classList.add('active');
            } else {
                nav.classList.remove('active');
            }
        }
    });

    // Sol menü: bağlantı yokken tamamen gizle
    const sidebarCol = document.querySelector('.sidebar')?.closest('.col-lg-2');
    if (sidebarCol) {
        sidebarCol.style.display = connected ? '' : 'none';
    }

    // Ana içerik sütunu: bağlantı yokken tüm genişliği al ve ortala
    const mainCol = document.querySelector('.col-lg-10.col-md-9');
    if (mainCol) {
        if (!connected) {
            mainCol.style.flex = '0 0 100%';
            mainCol.style.maxWidth = '100%';
            mainCol.style.margin = '0 auto';
        } else {
            mainCol.style.flex = '';
            mainCol.style.maxWidth = '';
            mainCol.style.margin = '';
        }
    }

    // Sayfa görünürlüğü
    document.querySelectorAll('.page').forEach(page => {
        if (page.classList.contains('active')) {
            page.style.removeProperty('display');
            page.style.display = 'block';
        } else {
            page.style.display = 'none';
        }
    });

    // Bağlantı kesildiğinde güvenlik önlemleri
    if (!connected) {
        if (typeof stopThrottleUpdates === 'function') stopThrottleUpdates();
        
        const slider = el('throttleSlider');
        if (slider) slider.disabled = true;
        
        const safety = el('safetyCheck');
        if (safety) safety.checked = false;
        
        if (typeof safetyChecked !== 'undefined') safetyChecked = false;
        if (typeof updateThrottle === 'function') updateThrottle(1000);
        if (typeof updateSafetyWarning === 'function') updateSafetyWarning();
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
}


// === DIŞA AKTARILAN FONKSİYONLAR ===
// Bu fonksiyonlar global scope'ta olmalı (window objesi)

window.changePage = changePage;
window.savePageData = savePageData;
window.updateConnectionStatus = updateConnectionStatus;
window.stopAllStreams = stopAllStreams;
window.showPageLoading = showPageLoading;
window.hidePageLoading = hidePageLoading;
