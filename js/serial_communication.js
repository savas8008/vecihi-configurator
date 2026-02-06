/**
 * @file serial_communication.js
 * @brief Seri port bağlantısı ve veri iletişimi
 * X-Flight Configurator için modüler JS
 */

// === GLOBAL DEĞİŞKENLER ===
let port = null;
let reader = null;
let writer = null;
let isConnected = false;
let jsonBuffer = '';
const textEncoder = new TextEncoder();

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

// === BAĞLANTI FONKSİYONLARI ===

/**
 * @brief Seri port bağlantı isteği
 */
async function connectSerial() {
    try {
        if (!navigator.serial) {
            showModal('Hata', 'Tarayıcınız seri port API desteklemiyor. Lütfen Chrome veya Edge kullanın.', 'error');
            return;
        }
        
        log('🔌 Seri port bağlantısı kuruluyor...', 'info');
        port = await navigator.serial.requestPort();
        await port.open({ baudRate: 115200 });
        log('✅ Port açıldı, reader/writer ayarlanıyor...', 'info');
        
        const textDecoder = new TextDecoderStream();
        port.readable.pipeTo(textDecoder.writable);
        reader = textDecoder.readable.getReader();
        writer = port.writable.getWriter();
        
        isConnected = true;
        log('✅ Seri porta bağlandı', 'success');
        
        // UI güncelle ve sensör sayfasını aktifle
        if (typeof activateSensorsPage === 'function') {
            activateSensorsPage();
        }
        updateConnectionStatus();
        
        // Okuma döngüsünü başlat
        readLoop().catch(error => {
            log(`❌ Okuma döngüsü hatası: ${error.message}`, 'error');
            handleDisconnect();
        });
        
        // Cihazdan ilk verileri iste
        setTimeout(() => {
            log('🔄 İlk veriler isteniyor...', 'info');
            sendCommand('calibration_page_data');
            setTimeout(() => {
                if (typeof startQuaternionStream === 'function') {
                    startQuaternionStream();
                }
            }, 1000);
        }, 500);
        
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
    try {
        while (isConnected && reader) {
            const { value, done } = await reader.read();
            if (done) {
                log('🔌 Reader kapatıldı', 'info');
                break;
            }
            if (value) {
                processIncomingData(value);
            }
        }
    } catch (error) {
        if (isConnected) {
            log(`❌ Okuma hatası: ${error.message}`, 'error');
            handleDisconnect();
        }
    }
}

/**
 * @brief Bağlantıyı keser (UI ve port)
 */
function disconnectSerial() {
    log('🔌 Bağlantı kesiliyor...', 'warning');
    handleDisconnect();
}

/**
 * @brief Bağlantı kesildiğinde portları ve UI'ı temizler
 */
function handleDisconnect() {
    isConnected = false;
    
    if (reader) { 
        reader.cancel().catch(() => {}); 
        reader = null; 
    }
    if (writer) { 
        writer.close().catch(() => {}); 
        writer = null; 
    }
    if (port) { 
        port.close().catch(() => {}); 
        port = null; 
    }
    
    updateConnectionStatus();
    log('🔌 Bağlantı kesildi', 'warning');
}

// === VERİ İŞLEME FONKSİYONLARI ===

/**
 * @brief Cihazdan gelen veriyi satır satır işler
 * @param {string} data - Gelen ham veri
 */
function processIncomingData(data) {
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
    
    switch (pageType) {
        case 'calibration': 
            if (typeof handleCalibrationPageData === 'function') handleCalibrationPageData(pageData); 
            break;
        case 'outputs':     
            if (typeof handleOutputsPageData === 'function') handleOutputsPageData(pageData); 
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
            
        case 'OUTPUT_SAVE':
            if (result === 'completed') {
                log('✅ Çıkış ayarları kaydedildi.', 'success');
                showModal('Başarılı', 'Çıkış ayarları başarıyla kaydedildi.', 'success');
            } else {
                log(`❌ Çıkış kayıt hatası: ${result}`, 'error');
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
            log(`✅ ${command}: ${result}`, 'info');
    }
}

/**
 * @brief 'error' tipindeki yanıtları işler
 * @param {string} command - Komut adı
 * @param {string} message - Hata mesajı
 */
function handleErrorResponse(command, message) {
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