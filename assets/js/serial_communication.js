// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file serial_communication.js
 * @brief Seri port bağlantısı ve veri iletişimi
 * Vecihi Configurator için modüler JS
 */

// === GLOBAL DEĞİŞKENLER ===
let port = null;
let reader = null;
let writer = null;
let isConnected = false;
let jsonBuffer = '';
const textEncoder = new TextEncoder();
let userInitiatedDisconnect = false; // Kullanıcı kendi bağlantıyı kestiyse true
let pendingReconnect = false;        // Restart sonrası otomatik yeniden bağlanma bekleniyor
let pendingReconnectTimer = null;    // Timeout: restart gelmezse bayrağı temizle
let postConnectDataTimer = null;     // Bağlantı sonrası veri gelmezse uçuş modu uyarısı

// === CFG_SET / CFG_COMMIT ACK MEKANİZMASI ===
let _cfgPending = null; // { resolve, reject, timeout }

function _setCfgPending(resolve, reject, timeoutMs = 3000) {
    if (_cfgPending) {
        clearTimeout(_cfgPending.timeout);
        _cfgPending.reject(new Error('Replaced'));
    }
    _cfgPending = {
        resolve, reject,
        timeout: setTimeout(() => {
            _cfgPending = null;
            reject(new Error('CFG_SET timeout'));
        }, timeoutMs)
    };
}

function _resolveCfgPending(err) {
    if (!_cfgPending) return;
    clearTimeout(_cfgPending.timeout);
    const p = _cfgPending;
    _cfgPending = null;
    if (err) p.reject(err);
    else p.resolve();
}

window._setCfgPending = _setCfgPending;
window._resolveCfgPending = _resolveCfgPending;

// === TEMEL KOMUT FONKSİYONLARI ===

/**
 * @brief Cihaza komut gönderir (sonuna \n ekler)
 * @param {string} command - Gönderilecek komut
 * @returns {boolean} Başarılı/Başarısız
 */
function sendCommand(command) {
    if (!isConnected || !writer) {
        return false;
    }
    try {
        const fullCommand = command + '\n';
        writer.write(textEncoder.encode(fullCommand));
        return true;
    } catch (error) {
        log(`❌ Komut gönderilemedi: ${error.message}`, 'error');
        return false;
    }
}

/**
 * @brief HTML'deki inline onclick'ler için global fonksiyon
 * @param {string} command - Gönderilecek komut
 */
function sendQuickCommand(command) {
    if (!isConnected) {
        log('❌ Komut göndermek için bağlantı gerekli', 'error');
        return;
    }
    log(`📤 KOMUT: ${command}`, 'command');
    logStats.commands++;
    updateLogStats();
    sendCommand(command);
}

/**
 * @brief Log sayfasındaki komut input'u için
 */
function sendCommandFromInput() {
    const commandInput = $('commandInput');
    const command = commandInput.value.trim();
    if (command) {
        sendQuickCommand(command);
        commandInput.value = '';
        commandInput.focus();
    }
}

/**
 * @brief Log sayfasındaki komut input'u için (Enter tuşu)
 * @param {KeyboardEvent} event - Klavye olayı
 */
function handleCommandKeypress(event) {
    if (event.key === 'Enter') {
        sendCommandFromInput();
    }
}

// === DONANIM DISCONNECT EVENT ===
// reader.read() Chrome'da fiziksel disconnect'te takılı kalabiliyor.
// navigator.serial 'disconnect' eventi her zaman güvenilir şekilde tetiklenir.
if (navigator.serial) {
    navigator.serial.addEventListener('disconnect', (event) => {
        if (port && event.port === port) {
            handleDisconnect();
        }
    });
}

// === BAĞLANTI FONKSİYONLARI ===

/**
 * @brief Sayfa açılışında veya restart sonrası daha önce izin verilmiş porta otomatik bağlanır.
 *        requestPort() gerektirmez — kullanıcı etkileşimsiz çalışır.
 */
async function tryAutoConnect() {
    if (!navigator.serial || isConnected) return;
    try {
        const ports = await navigator.serial.getPorts();
        if (ports.length === 0) return;
        log('🔍 Önceki cihaz bulundu, otomatik bağlanılıyor...', 'info');
        await _openPort(ports[0]);
    } catch (err) {
        log(`⚠️ Otomatik bağlantı başarısız: ${err.message}`, 'warning');
    }
}

/**
 * @brief Port açma ve stream kurma — connectSerial ve tryAutoConnect tarafından paylaşılır.
 * pipeTo/TextDecoderStream kullanılmaz: port.readable doğrudan reader'a bağlanır,
 * böylece reader.cancel() portu gerçekten serbest bırakır ve port.close() güvenilir çalışır.
 */
async function _openPort(targetPort) {
    port = targetPort;
    await port.open({ baudRate: 115200 });

    reader = port.readable.getReader();
    writer = port.writable.getWriter();

    isConnected = true;
    log('✅ Seri porta bağlandı', 'success');

    clearTimeout(postConnectDataTimer);
    postConnectDataTimer = setTimeout(() => {
        if (isConnected) {
            log('⚠️ 10 saniye veri gelmedi — ESP uçuş moduna geçmiş', 'warning');
            showFlightModeWarning();
            handleDisconnect(true);
        }
    }, 10000);

    if (typeof activateSensorsPage === 'function') activateSensorsPage();
    updateConnectionStatus();

    readLoop().catch(error => {
        log(`❌ Okuma döngüsü hatası: ${error.message}`, 'error');
        handleDisconnect();
    });

    setTimeout(() => {
        log('🔄 Veriler isteniyor...', 'info');
        sendCommand('calibration_page_data'); // 'c' → ESP'yi USB moduna alır
        setTimeout(() => sendCommand('advanced_page_data'), 200);
        setTimeout(() => sendCommand('pid_page_data'), 400);
        setTimeout(() => sendCommand('outputs_page_data'), 600);
        setTimeout(() => sendCommand('transmitter_page_data'), 800);
        setTimeout(() => sendCommand('modes_page_data'), 1000);
        setTimeout(() => sendCommand('osd_page_data'), 1200);
        setTimeout(() => {
            if (typeof startQuaternionStream === 'function') startQuaternionStream();
        }, 1600);
    }, 150);
}

/**
 * @brief Seri port bağlantı isteği (buton tıklaması — kullanıcı port seçer)
 */
async function connectSerial() {
    try {
        if (!navigator.serial) {
            showModal('Hata', 'Tarayıcınız seri port API desteklemiyor. Lütfen Chrome veya Edge kullanın.', 'error');
            return;
        }
        log('🔌 Seri port bağlantısı kuruluyor...', 'info');
        const selectedPort = await navigator.serial.requestPort();
        await _openPort(selectedPort);
    } catch (error) {
        log(`❌ Bağlantı hatası: ${error.message}`, 'error');
        showModal(
            'Bağlantı Hatası',
            `<div class="text-center">
                <p>Seri porta bağlanırken hata oluştu: ${error.message}</p>
                <p class="small">Lütfen portun başka bir program tarafından kullanılmadığından emin olun.</p>
            </div>`,
            'error'
        );
        handleDisconnect();
    }
}

/**
 * @brief Seri port okuma döngüsü
 */
async function readLoop() {
    const decoder = new TextDecoder();
    try {
        while (isConnected && reader) {
            const { value, done } = await reader.read();
            if (done) {
                log('🔌 Reader kapatıldı', 'info');
                break;
            }
            if (value) {
                // value: Uint8Array (doğrudan port.readable'dan)
                processIncomingData(decoder.decode(value, { stream: true }));
            }
        }
    } catch (error) {
        if (isConnected) {
            log(`❌ Okuma hatası: ${error.message}`, 'error');
            handleDisconnect();
        }
    }
    if (isConnected) {
        handleDisconnect();
    }
}

/**
 * @brief Bağlantıyı keser (UI ve port)
 */
function disconnectSerial() {
    userInitiatedDisconnect = true;
    log('🔌 Bağlantı kesiliyor...', 'warning');
    handleDisconnect();
}

/**
 * @brief Bağlantı kesildiğinde portları ve UI'ı temizler
 * @param {boolean} skipWarning - true ise kopuş modalı gösterilmez (çağıran zaten gösterdi)
 */
async function handleDisconnect(skipWarning = false) {
    const wasUnexpected = isConnected && !userInitiatedDisconnect;
    isConnected = false;
    userInitiatedDisconnect = false;

    // Await cleanup sıraya uygun — reader → writer → port
    if (reader) {
        try { await reader.cancel(); } catch (_) {}
        reader = null;
    }
    if (writer) {
        try { await writer.close(); } catch (_) {}
        writer = null;
    }
    if (port) {
        try { await port.close(); } catch (_) {}
        port = null;
    }

    updateConnectionStatus();
    log('🔌 Bağlantı kesildi', 'warning');

    if (wasUnexpected) {
        if (pendingReconnect) {
            pendingReconnect = false;
            clearTimeout(pendingReconnectTimer);
            attemptAutoReconnect();
        } else if (!skipWarning) {
            // Ani kopuş (USB çekildi vb.) — sadece log, büyük modal gösterme
            log('⚠️ Beklenmedik bağlantı kopması', 'warning');
        }
    }
}

/**
 * @brief Restart bekleniyor bayrağını ayarlar; 6s içinde disconnect gelmezse iptal eder
 */
function setPendingReconnect() {
    pendingReconnect = true;
    clearTimeout(pendingReconnectTimer);
    pendingReconnectTimer = setTimeout(() => {
        pendingReconnect = false;
    }, 6000);
}

/**
 * @brief ESP.restart() sonrası yeniden bağlanma akışını başlatır.
 * USB-serial köprüsü (CP2102/CH340) restart'ta bağlı kaldığı için
 * disconnect eventi gelmez — JS bağlantıyı kendisi keser.
 */
function initiateReconnect(delayMs = 400) {
    setPendingReconnect();
    setTimeout(() => {
        if (isConnected) handleDisconnect(); // wasUnexpected=true → attemptAutoReconnect()
    }, delayMs);
}

/**
 * @brief Restart sonrası otomatik yeniden bağlanma dener (max 4 deneme, exponential backoff)
 */
async function attemptAutoReconnect() {
    showReconnectOverlay('Cihaz yeniden başlatılıyor...');
    await new Promise(r => setTimeout(r, 1200)); // ESP32 boot süresi

    const MAX_TRIES = 6;
    for (let attempt = 1; attempt <= MAX_TRIES; attempt++) {
        updateReconnectStatus(`Bağlanılıyor... (${attempt}/${MAX_TRIES})`);
        try {
            const ports = await navigator.serial.getPorts();
            if (ports.length === 0) { hideReconnectOverlay(); showFlightModeWarning(); return; }
            await _openPort(ports[0]);
            hideReconnectOverlay(); // Başarıda overlay kapat, sensörler sayfası açılmış olur
            log('✅ Otomatik yeniden bağlandı', 'success');
            return;
        } catch (err) {
            log(`⚠️ Yeniden bağlanma denemesi ${attempt} başarısız: ${err.message}`, 'warning');
            if (attempt < MAX_TRIES) await new Promise(r => setTimeout(r, 800));
        }
    }

    hideReconnectOverlay();
    showFlightModeWarning();
}

/**
 * @brief Yeniden bağlanma overlay'ini gösterir
 */
function showReconnectOverlay(title) {
    let overlay = document.getElementById('reconnectOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'reconnectOverlay';
        overlay.innerHTML = `
            <div class="reconnect-box">
                <div class="spinner-border reconnect-spinner" role="status"></div>
                <h5 id="reconnectTitle">Yeniden Bağlanılıyor</h5>
                <p id="reconnectStatus">Lütfen bekleyin...</p>
                <div class="reconnect-steps">
                    Cihaz kaydedilen ayarları uyguluyor ve yeniden başlatılıyor.<br>
                    Bu işlem birkaç saniye sürebilir.
                </div>
            </div>`;
        document.body.appendChild(overlay);
    }
    document.getElementById('reconnectTitle').textContent = title;
    document.getElementById('reconnectStatus').textContent = 'Lütfen bekleyin...';
    overlay.style.display = 'flex';
}

function updateReconnectStatus(msg) {
    const el = document.getElementById('reconnectStatus');
    if (el) el.textContent = msg;
}

function hideReconnectOverlay() {
    const overlay = document.getElementById('reconnectOverlay');
    if (overlay) overlay.style.display = 'none';
}

/**
 * @brief Cihaz beklenmedik kapandığında (restart/uçuş modu) uyarı gösterir
 */
function showFlightModeWarning() {
    if (typeof showModal !== 'function') return;
    showModal(
        '✈️ ESP Uçuş Modunda',
        `<div style="line-height:1.7">
            <p>ESP yanıt vermiyor — konfiguratör bağlantısı kurulmadan <strong>uçuş moduna</strong> geçmiş.</p>
            <hr style="border-color:#ffffff30">
            <p class="mb-1"><strong>Yeniden bağlanmak için:</strong></p>
            <ol class="text-start mb-0" style="padding-left:1.2em">
                <li>USB kablosunu çıkarın</li>
                <li>Varsa batarya fişini de çıkarıp takın</li>
                <li>USB'yi tekrar takın</li>
                <li><strong>10 saniye içinde</strong> "Porta Bağlan" butonuna tıklayın</li>
            </ol>
        </div>`,
        'warning'
    );
}

// === VERİ İŞLEME FONKSİYONLARI ===

/**
 * @brief Cihazdan gelen veriyi satır satır işler
 * @param {string} data - Gelen ham veri
 */
function processIncomingData(data) {
    // İlk veri geldi → post-connect timeout iptal
    clearTimeout(postConnectDataTimer);
    jsonBuffer += data;
    const lines = jsonBuffer.split('\n');
    jsonBuffer = lines.pop() || '';
    
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line === '') continue;
        processSingleLine(line);
    }
    
    // Buffer overflow koruması
    if (jsonBuffer.length > 10000) {
        jsonBuffer = jsonBuffer.substring(jsonBuffer.length - 2000);
    }
}

/**
 * @brief Tek bir satırı işler (JSON veya düz metin)
 * @param {string} line - İşlenecek satır
 */
function processSingleLine(line) {
    // Debug fonksiyonu varsa çağır
    if (typeof debugIncomingData === 'function') {
        debugIncomingData(line);
    }
    
    if (line.startsWith('{') && line.endsWith('}')) {
        try {
            const jsonData = JSON.parse(line);
            log(`📥 ALINDI: ${line}`, 'receive');
            handleStandardJsonData(jsonData);
        } catch (e) {
            log(`❌ JSON parse hatası: ${e.message} - Veri: ${line}`, 'error');
        }
    } else {
        log(`📨 CİHAZ: ${line}`, 'info');
    }
}

/**
 * @brief Standart JSON veri yapısını işler
 * @param {Object} data - Parse edilmiş JSON objesi
 */
function handleStandardJsonData(data) {
    console.log("[DEBUG] handleStandardJsonData:", data);
    // ==========================================
    // YENİ EKLENEN KISIM: EL SIKIŞMA VE SENSÖR KONTROLÜ
    // ==========================================

    // 2. ADIM: Sensör statüsü geldi mi?
    if (data.stream_data && data.stream_data.type === 'init_status') {
        const sensors = data.stream_data.data;

        // Kritik sensörler (Gyro ve Accel) çalışıyor mu?
        const isSystemReady = sensors.gyro && sensors.accel;
        // Herhangi bir sensör eksik mi?
        const hasMissingSensor = !sensors.gyro || !sensors.accel || !sensors.baro || !sensors.gps;

        // GPS donanım durumunu global'e yaz — flight modes disabled/enabled için kaynak
        window.gpsAvailable = !!sensors.gps;
        if (typeof updateNavModesGpsState === 'function') updateNavModesGpsState(!!sensors.gps);

        if (isSystemReady) {
            if (hasMissingSensor) {
                log('⚠️ Bazı sensörler bağlı değil, uyarı modalı gösteriliyor.', 'warning');
            } else {
                log('✅ Tüm sensörler çalışıyor. Sayfa verileri ve akış başlatılıyor...', 'success');
            }

            // Eğer varsa modalı kapat (sonra tekrar açılacak)
            const modalEl = document.getElementById('sensorErrorModal');
            if (modalEl) {
                const modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.hide();
            }

            // Sensörler sağlamsa, başlangıçta (connectSerial'da) sildiğimiz
            // diğer sayfa verilerini ŞİMDİ iste.
            sendCommand('calibration_page_data');
            setTimeout(() => sendCommand('advanced_page_data'), 200);
            setTimeout(() => sendCommand('pid_page_data'), 400);
            setTimeout(() => sendCommand('outputs_page_data'), 600);
            setTimeout(() => sendCommand('transmitter_page_data'), 800);
            setTimeout(() => sendCommand('modes_page_data'), 1000);
            setTimeout(() => sendCommand('osd_page_data'), 1200);
            setTimeout(() => {
                if (typeof startQuaternionStream === 'function') {
                    startQuaternionStream();
                }
            }, 1600);

        } else {
            log('⚠️ Kritik sensör hatası algılandı, modal gösteriliyor.', 'warning');
        }

        // Herhangi bir sensör eksikse modalı göster
        if (hasMissingSensor) {
            const modalEl = document.getElementById('sensorErrorModal');
            const modalContent = modalEl?.querySelector('.modal-content');
            const modalTitle = document.getElementById('sensorErrorModalLabel');
            const modalDesc = modalEl?.querySelector('.modal-body > p');

            if (isSystemReady) {
                // Sadece GPS/baro eksik: uyarı stili, backdrop kapatılabilir
                if (modalEl) {
                    modalEl.removeAttribute('data-bs-backdrop');
                    modalEl.removeAttribute('data-bs-keyboard');
                }
                if (modalContent) {
                    modalContent.classList.remove('border-danger');
                    modalContent.classList.add('border-warning');
                }
                if (modalTitle) {
                    modalTitle.className = 'modal-title text-warning';
                    modalTitle.innerHTML = '<i class="bi bi-exclamation-triangle me-2"></i>Sensör Uyarısı';
                }
                if (modalDesc) {
                    modalDesc.textContent = 'Bazı sensörler tespit edilemedi. Sistem çalışıyor ancak eksik donanımı kontrol edin.';
                }
            } else {
                // MPU6050 eksik: kritik hata stili, backdrop kilitli
                if (modalEl) {
                    modalEl.setAttribute('data-bs-backdrop', 'static');
                    modalEl.setAttribute('data-bs-keyboard', 'false');
                }
                if (modalContent) {
                    modalContent.classList.remove('border-warning');
                    modalContent.classList.add('border-danger');
                }
                if (modalTitle) {
                    modalTitle.className = 'modal-title text-danger';
                    modalTitle.innerHTML = '<i class="bi bi-exclamation-triangle-fill me-2"></i>Donanım Başlatma Hatası';
                }
                if (modalDesc) {
                    modalDesc.textContent = 'Uçuş kontrolcüsü kritik sensörlerle iletişim kuramadı. Lütfen bağlantıları kontrol edin.';
                }
            }

            // Listeyi dinamik doldur
            const statusList = document.getElementById('sensorStatusList');
            if (statusList) {
                statusList.innerHTML = `
                    <li class="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center">
                        Jiroskop (MPU6050)
                        <span class="badge ${sensors.gyro ? 'bg-success' : 'bg-danger'} rounded-pill">${sensors.gyro ? 'OK' : 'BAĞLI DEĞİL'}</span>
                    </li>
                    <li class="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center">
                        İvmeölçer (MPU6050)
                        <span class="badge ${sensors.accel ? 'bg-success' : 'bg-danger'} rounded-pill">${sensors.accel ? 'OK' : 'BAĞLI DEĞİL'}</span>
                    </li>
                    <li class="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center">
                        Barometre
                        <span class="badge ${sensors.baro ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${sensors.baro ? 'OK' : 'BAĞLI DEĞİL'}</span>
                    </li>
                    <li class="list-group-item bg-dark text-light border-secondary d-flex justify-content-between align-items-center">
                        GPS
                        <span class="badge ${sensors.gps ? 'bg-success' : 'bg-warning text-dark'} rounded-pill">${sensors.gps ? 'OK' : 'BAĞLI DEĞİL'}</span>
                    </li>
                `;
            }

            // Modalı göster
            if (modalEl) {
                let modalInstance = bootstrap.Modal.getInstance(modalEl);
                if (modalInstance) modalInstance.dispose();
                modalInstance = new bootstrap.Modal(modalEl);
                modalInstance.show();
            }
        }

        return; // İşlem tamamlandı, geri dön
    }
    // ==========================================
    // YENİ EKLENEN KISIM BİTTİ
    // ==========================================
    if (data.page_data) {
        handlePageData(data.page_data.type, data.page_data.data);
        return;
    }
    if (data.stream_data) {
        handleStreamData(data.stream_data.type, data.stream_data.data);
        return;
    }
    if (data.status) {
        console.log("[DEBUG] Status received:", data.status);
        handleStatusResponse(data.status.command, data.status.result, data);
        return;
    }
    if (data.error) {
        handleErrorResponse(data.error.command, data.error.message);
        return;
    }
    console.log("[DEBUG] Unknown data format:", data);
}

/**
 * @brief Sayfa verilerini ilgili handler'a yönlendirir
 * @param {string} pageType - Sayfa tipi
 * @param {Object} pageData - Sayfa verileri
 */
function handlePageData(pageType, pageData) {
    log(`📊 ${pageType} sayfası verileri alındı`, 'success');

    // Overlay'i kaldır (veri geldi, artık kaydet butonu aktif)
    // 'waypoints' (ESP tipi) → 'waypoint' (sayfa ID) uyumsuzluğunu çöz
    const pageId = pageType === 'waypoints' ? 'waypoint' : pageType;
    if (typeof hidePageLoading === 'function') {
        hidePageLoading(pageId);
        if (pageType === 'outputs') { hidePageLoading('mixer'); hidePageLoading('gps'); }
        if (pageType === 'advanced') hidePageLoading('gps');
    }

    switch (pageType) {
        case 'calibration': 
            if (typeof handleCalibrationPageData === 'function') handleCalibrationPageData(pageData); 
            break;
        case 'outputs':
            if (typeof handleOutputsPageData === 'function') handleOutputsPageData(pageData);
            break;
        case 'mixer':
            if (typeof handleMixerPageData === 'function') handleMixerPageData(pageData);
            break;
        case 'transmitter': 
            if (typeof handleTransmitterPageData === 'function') handleTransmitterPageData(pageData); 
            break;
        case 'modes':       
            if (typeof handleModesPageData === 'function') handleModesPageData(pageData); 
            break;
        case 'pid':         
            if (typeof handlePIDPageData === 'function') handlePIDPageData(pageData); 
            break;
        case 'osd': 
            if (typeof handleOSDPageData === 'function') handleOSDPageData(pageData); 
            break;
        case 'advanced': 
            if (typeof handleAdvancedPageData === 'function') handleAdvancedPageData(pageData); 
            break;
        case 'waypoints':
            if (typeof handleWaypointData === 'function') handleWaypointData(pageData);
            break;
        case 'sensor_align':
            if (typeof handleSensorAlignPageData === 'function') handleSensorAlignPageData(pageData);
            break;
        case 'logs':
            break; // Log sayfası için özel işlem yok
        default:
            log(`❌ Bilinmeyen sayfa tipi: ${pageType}`, 'error');
    }
}

/**
 * @brief Stream verilerini ilgili handler'a yönlendirir
 * @param {string} streamType - Stream tipi
 * @param {Object} streamData - Stream verileri
 */
function handleStreamData(streamType, streamData) {
    switch (streamType) {
        case 'quaternion': 
            if (typeof handleQuaternionStream === 'function') handleQuaternionStream(streamData); 
            break;
        case 'pwm':        
            if (typeof handlePwmStream === 'function') handlePwmStream(streamData); 
            break;
        case 'receiver':   
            if (typeof handleReceiverStream === 'function') handleReceiverStream(streamData); 
            break;
        case 'gyro':       
            if (typeof handleGyroStream === 'function') handleGyroStream(streamData); 
            break;
        case 'sensors':
            if (typeof handleSensorStream === 'function') handleSensorStream(streamData);
            // sensors stream içinde quaternion verisi de var
            if (typeof handleQuaternionStream === 'function') handleQuaternionStream(streamData);
            // Waypoint haritası için GPS konumunu güncelle
            if (typeof onSensorStreamForWaypoint === 'function') onSensorStreamForWaypoint(streamData);
            break;
        default:           
            log(`🔄 Bilinmeyen stream tipi: ${streamType}`, 'warning');
    }
}

/**
 * @brief 'status' tipindeki yanıtları işler
 * @param {string} command - Komut adı
 * @param {string} result - Sonuç
 * @param {Object} data - Tam veri objesi
 */
function handleStatusResponse(command, result, data) {
    // CFG_SET / CFG_COMMIT ack → import akışına bildir
    if (command === 'CFG_SET' || command === 'CFG_COMMIT') {
        _resolveCfgPending(null);
        return;
    }
    switch (command) {
        case 'CALIBRATE_GYRO':
            if (result === 'completed') {
                log('✅ Gyro kalibrasyonu tamamlandı!', 'success');
                showModal('Başarılı', 'Gyro kalibrasyonu başarıyla tamamlandı.', 'success');
            }
            setBusy(false);
            break;
            
        case 'CALIBRATE_ACC':
            if (result === 'completed') {
                log('✅ İvmeölçer kalibrasyonu tamamlandı!', 'success');
                showModal('Başarılı', 'İvmeölçer kalibrasyonu başarıyla tamamlandı.', 'success');
            }
            setBusy(false);
            break;
            
        case 'TRANSMITTER_SAVE':
            if (result === 'completed') {
                log('✅ Kumanda ayarları kaydedildi.', 'success');
                showModal('Başarılı', 'Kumanda ayarları başarıyla kaydedildi.', 'success');
                // Protokol değişmişse firmware restart atıyor, hazır ol
                setPendingReconnect();
            } else {
                log(`❌ Kumanda kayıt hatası: ${result}`, 'error');
                showModal('Hata', `Kayıt sırasında hata oluştu: ${result}`, 'error');
            }
            break;
            
        case 'MODES_SAVE':
            if (result === 'completed') {
                log('✅ Uçuş modları kaydedildi.', 'success');
                showModal('Başarılı', 'Uçuş modları başarıyla kaydedildi.', 'success');
            } else {
                log(`❌ Mod kayıt hatası: ${result}`, 'error');
                showModal('Hata', `Kayıt sırasında hata oluştu: ${result}`, 'error');
            }
            break;
            
        case 'PID_SAVE':
            if (result === 'completed') {
                log('✅ PID değerleri kaydedildi.', 'success');
                showModal('Başarılı', 'PID değerleri başarıyla kaydedildi.', 'success');
            } else {
                log(`❌ PID kayıt hatası: ${result}`, 'error');
                showModal('Hata', `Kayıt sırasında hata oluştu: ${result}`, 'error');
            }
            break;
            
        case 'PINS_SAVE':
            if (result === 'completed') {
                log('✅ Pin ayarları kaydedildi, cihaz yeniden başlatılıyor...', 'success');
                showModal('Pin Kaydedildi', 'Pin ayarları başarıyla kaydedildi.\nCihaz yeniden başlatılıyor — bağlantı otomatik kurulacak.', 'success', 2000);
                initiateReconnect();
            } else {
                log(`❌ Pin kayıt hatası: ${result}`, 'error');
                showModal('Hata', `Pin kayıt sırasında hata: ${result}`, 'error');
            }
            break;

        case 'OUTPUT_SAVE':
            if (result === 'completed') {
                log('✅ Çıkış ayarları kaydedildi, cihaz yeniden başlatılıyor...', 'success');
                initiateReconnect();
            } else {
                log(`❌ Çıkış kayıt hatası: ${result}`, 'error');
                showModal('Hata', `Kayıt sırasında hata oluştu: ${result}`, 'error');
            }
            break;

        case 'CFG_RESET':
            if (result === 'completed') {
                log('✅ Fabrika ayarlarına sıfırlandı, cihaz yeniden başlatılıyor...', 'success');
                initiateReconnect();
            }
            break;

        case 'SAVE_SENSOR_ALIGN':
            if (result === 'completed') {
                log('✅ Sensör hizalaması kaydedildi, cihaz yeniden başlatılıyor...', 'success');
                initiateReconnect();
            } else {
                log(`❌ Sensör hizalama hatası: ${result}`, 'error');
                showModal('Hata', `Kayıt sırasında hata oluştu: ${result}`, 'error');
            }
            break;
            
        case 'SAVE_ADVANCED_CONFIG':
            if (result === 'completed') {
                log('✅ Gelişmiş ayarlar ve filtreler kaydedildi.', 'success');
                showModal('Başarılı', 'Gelişmiş sistem ayarları başarıyla kaydedildi.', 'success');
            } else {
                log(`❌ Kayıt hatası: ${result}`, 'error');
                showModal('Hata', `Kayıt sırasında hata oluştu: ${result}`, 'error');
            }
            // Butonu sıfırla
            const saveBtnAdv = document.getElementById('globalSaveBtn');
            if (saveBtnAdv) {
                saveBtnAdv.innerHTML = '<i class="bi bi-save"></i> Kaydet';
                saveBtnAdv.disabled = false;
            }
            break;
            
        case 'OSD_SAVE':
            if (result === 'completed') {
                log('✅ OSD ayarları başarıyla kaydedildi', 'success');
                showModal('Başarılı', 'OSD ayarları cihaza kaydedildi.', 'success');
            } else {
                log(`❌ OSD kaydetme hatası: ${result}`, 'error');
                showModal('Hata', `OSD kaydedilemedi: ${result}`, 'error');
            }
            break;
            
      default:
    // Sensör hizalama modülüne devret
    if (typeof handleSensorAlignStatusResponse === 'function') {
        if (handleSensorAlignStatusResponse(command, result, data)) {
            return;
        }
    }
    // Kalibrasyon modülüne devret
    if (typeof handleCalibrationStatusResponse === 'function') {
        if (handleCalibrationStatusResponse(command, result, data)) {
            return; // Kalibrasyon modülü işledi
        }
    }
    log(`✅ ${command}: ${result}`, 'info');
    }
}

/**
 * @brief 'error' tipindeki yanıtları işler
 * @param {string} command - Komut adı
 * @param {string} message - Hata mesajı
 */
function handleErrorResponse(command, message) {
    // CFG_SET hatası → import akışını durdur, modal gösterme
    if (command === 'CFG_SET' || command === 'CFG_COMMIT') {
        _resolveCfgPending(new Error(message));
        return;
    }
    log(`❌ HATA (${command}): ${message}`, 'error');
    showModal('Hata', message, 'error');
    setBusy(false);
}

// === YARDIMCI FONKSİYONLAR ===

/**
 * @brief UI'ı meşgul/boş durumuna getirir
 * @param {boolean} busy - Meşgul durumu
 */
function setBusy(busy) {
    // Kalibrasyon butonlarını devre dışı bırak/aç
    const buttons = document.querySelectorAll('.calibration-btn');
    buttons.forEach(btn => {
        btn.disabled = busy;
    });
}

// === DIŞA AKTARILAN FONKSİYONLAR ===
window.sendCommand = sendCommand;
window.sendQuickCommand = sendQuickCommand;
window.sendCommandFromInput = sendCommandFromInput;
window.handleCommandKeypress = handleCommandKeypress;
window.connectSerial = connectSerial;
window.disconnectSerial = disconnectSerial;
window.isConnected = () => isConnected;

// port değişkenini dışarıdan erişilebilir yap (updateConnectionStatus için)
Object.defineProperty(window, 'port', {
    get: function() { return port; }
});