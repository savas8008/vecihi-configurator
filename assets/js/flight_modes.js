// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file flight_modes.js
 * @brief Vecihi Configurator - Uçuş Modları (Modes) Sayfası Modülü
 * @description Uçak uçuş modlarını, kategori ve aralıklarını yönetir
 * 
 * @requires serial_communication.js - sendCommand, isConnected
 * @requires page_management.js - currentPage, log
 */

// ============================================================================
// MOD TANIMLARI
// ============================================================================

/**
 * Modların Kategorileri ve Varsayılanları
 * @type {Array<Object>}
 */
const modeDefinitions = [
    // --- GÜVENLİK (SAFETY) ---
    { key: 'arm', name: 'ARM (Motor Kilidi)', cat: 'safety', defaultMin: 1800, defaultMax: 2100, defaultCh: 5 },

    // --- UÇUŞ MODLARI (FLIGHT MODES) - Genelde 3'lü Switch ---
    { key: 'manual', name: 'MANUAL (Passthrough)', cat: 'flight', defaultMin: 900, defaultMax: 1300, defaultCh: 0 },
    { key: 'angle', name: 'ANGLE (Stabilize)', cat: 'flight', defaultMin: 1301, defaultMax: 1700, defaultCh: 0 },
    { key: 'horizon', name: 'HORIZON', cat: 'flight', defaultMin: 1701, defaultMax: 2100, defaultCh: 0 },
    { key: 'acro', name: 'ACRO (Rate)', cat: 'flight', defaultMin: 900, defaultMax: 900, defaultCh: 0 },

    // --- NAVİGASYON (NAV MODES) - Yüksek Öncelik ---
    { key: 'rth', name: 'RTH (Eve Dön)', cat: 'nav', defaultMin: 1800, defaultMax: 2100, defaultCh: 0 },
    { key: 'launch', name: 'AUTO LAUNCH', cat: 'nav', defaultMin: 1800, defaultMax: 2100, defaultCh: 0 },
    { key: 'waypoint', name: 'WAYPOINT', cat: 'nav', defaultMin: 1800, defaultMax: 2100, defaultCh: 0 },
    { key: 'land_assist', name: 'LAND ASSIST (İniş Asistanı)', cat: 'nav', defaultMin: 1800, defaultMax: 2100, defaultCh: 0 },

    // --- ASİSTANLAR (ASSIST) - Eklenebilir ---
    { key: 'cruise', name: 'CRUISE', cat: 'assist', defaultMin: 1500, defaultMax: 1700, defaultCh: 0 },
    { key: 'althold', name: 'ALTITUDE HOLD', cat: 'assist', defaultMin: 1800, defaultMax: 2100, defaultCh: 0 },
    { key: 'autotune', name: 'AUTO TUNE', cat: 'assist', defaultMin: 1800, defaultMax: 2100, defaultCh: 0 },
    { key: 'flaperon', name: 'FLAPERON', cat: 'assist', defaultMin: 1800, defaultMax: 2100, defaultCh: 0 }
];

// ============================================================================
// DURUM DEĞİŞKENLERİ
// ============================================================================

// Mevcut yüklü konfigürasyon (ESP'den gelecek)
let activeFlightModes = {};

// Kanal verilerini tutmak için (Receiver stream'den güncellenir)
let currentChannelValues = new Array(16).fill(1500);

// ============================================================================
// YARDIMCI FONKSİYONLAR
// ============================================================================

/**
 * @brief DOM element seçici ($ tanımlı değilse kullan)
 * @param {string} id - Element ID
 * @returns {HTMLElement|null}
 */
function _$(id) {
    return typeof $ === 'function' ? $(id) : document.getElementById(id);
}

/**
 * @brief Log fonksiyonu (tanımlı değilse console.log kullan)
 * @param {string} message - Log mesajı
 * @param {string} type - Log tipi
 */
function _log(message, type = 'info') {
    if (typeof log === 'function') {
        log(message, type);
    } else {
        console.log(`[${type.toUpperCase()}] ${message}`);
    }
}

/**
 * @brief Aktif sayfa kontrolü
 * @returns {string} Aktif sayfa adı
 */
function _getCurrentPage() {
    // Global currentPage varsa kullan
    if (typeof currentPage !== 'undefined') {
        return currentPage;
    }
    // window.currentPage varsa kullan
    if (typeof window.currentPage !== 'undefined') {
        return window.currentPage;
    }
    // Fallback: DOM'dan kontrol et
    const activePage = document.querySelector('.page.active');
    return activePage ? activePage.id : '';
}

// ============================================================================
// SAYFA VERİSİ İŞLEME
// ============================================================================

/**
 * @brief Modes sayfası verilerini işler (page_management.js tarafından çağrılır)
 * @param {Object} data - ESP32'den gelen mod verileri
 */
function handleModesPageData(data) {
    if (data && typeof data === 'object') {
        activeFlightModes = data;
        _log('✅ Uçuş modları yüklendi.', 'success');
    }
    renderModesPage();
}

// Global erişim için
window.handleModesPageData = handleModesPageData;

// ============================================================================
// SAYFA RENDER FONKSİYONLARI
// ============================================================================

/**
 * @brief Mod sayfasını kategorilere göre çizer
 */
function renderModesPage() {
    const wrapper = _$('modesWrapper');
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const categories = {
        'safety': { title: '⚠️ Güvenlik & Sistem', icon: 'bi-shield-check' },
        'nav': { title: '🛰️ Navigasyon & Otonom', icon: 'bi-geo-alt' },
        'flight': { title: '✈️ Temel Uçuş Modları', icon: 'bi-joystick' },
        'assist': { title: '🛠️ Asistanlar', icon: 'bi-magic' }
    };

    Object.keys(categories).forEach(catKey => {
        const catConfig = categories[catKey];
        const catModes = modeDefinitions.filter(m => m.cat === catKey);
        if (catModes.length === 0) return;

        let html = `<div class="col-12"><div class="panel4 mb-1">`;
        html += `<div class="mode-category-title"><i class="bi ${catConfig.icon}"></i> ${catConfig.title}</div>`;

        catModes.forEach(def => {
            const savedData = activeFlightModes[def.key] || {};

            // Kayıtlı veri varsa onu al, yoksa varsayılanı kullan
            const channel = savedData.channel !== undefined ? savedData.channel : def.defaultCh;
            const min = savedData.min !== undefined ? savedData.min : def.defaultMin;
            const max = savedData.max !== undefined ? savedData.max : def.defaultMax;

            html += `
            <div class="mode-card panel4" id="card-${def.key}" data-key="${def.key}">
                <div class="mode-header-row">
                    <span class="mode-name">${def.name}</span>
                    <select class="mode-channel-select" id="ch-${def.key}" onchange="updateModeUI('${def.key}')">
                        <option value="0" ${channel === 0 ? 'selected' : ''}>DEVRE DIŞI</option>
                        
                        ${Array.from({length: 12}, (_, i) => { 
                            const chNum = i + 5; // Kanal 5'ten başla (AUX 1)
                            const auxNum = i + 1; 
                            return `<option value="${chNum}" ${chNum === channel ? 'selected' : ''}>CH ${chNum}</option>`;
                        }).join('')}
                        
                    </select>
                </div>

                <div class="range-track-container" id="track-container-${def.key}">
                    <div class="range-fill" id="fill-${def.key}" style="left:0%; width:0%;"></div>
                    <div class="live-marker" id="marker-${def.key}" data-val="1500" style="left: 50%; display: none;"></div>

                    <input type="range" class="input-range" id="min-${def.key}" min="900" max="2100" value="${min}" step="25" oninput="updateModeUI('${def.key}')">
                    <input type="range" class="input-range" id="max-${def.key}" min="900" max="2100" value="${max}" step="25" oninput="updateModeUI('${def.key}')">
                </div>

                <div class="d-flex justify-content-between text-muted small">
                    <span>900</span>
                    <span id="label-${def.key}">Aralık: ${min} - ${max}</span>
                    <span>2100</span>
                </div>
            </div>`;
        });

        html += `</div></div>`;
        wrapper.innerHTML += html;
    });

    // UI'ı güncelle
    modeDefinitions.forEach(def => updateModeUI(def.key));
}

// Global erişim için
window.renderModesPage = renderModesPage;

// ============================================================================
// UI GÜNCELLEME FONKSİYONLARI
// ============================================================================

/**
 * @brief Slider değiştiğinde veya veri geldiğinde arayüzü günceller
 * @param {string} key - Mod anahtarı (örn: 'arm', 'angle', 'rth')
 */
function updateModeUI(key) {
    const minInput = _$(`min-${key}`);
    const maxInput = _$(`max-${key}`);
    const fillBar = _$(`fill-${key}`);
    const label = _$(`label-${key}`);
    const card = _$(`card-${key}`);
    const channelSelect = _$(`ch-${key}`);

    if (!minInput || !maxInput) return;

    let minVal = parseInt(minInput.value);
    let maxVal = parseInt(maxInput.value);

    // Çakışma kontrolü (Min, Max'ı geçemesin)
    if (minVal > maxVal - 50) {
        if (document.activeElement === minInput) {
            minInput.value = maxVal - 50;
        } else {
            maxInput.value = minVal + 50;
        }
        minVal = parseInt(minInput.value);
        maxVal = parseInt(maxInput.value);
    }

    // Yüzdeleri hesapla (900-2100 aralığı = 1200 birim)
    const totalRange = 1200;
    const leftPercent = ((minVal - 900) / totalRange) * 100;
    const widthPercent = ((maxVal - minVal) / totalRange) * 100;

    // Barı güncelle
    if (fillBar) {
        fillBar.style.left = `${leftPercent}%`;
        fillBar.style.width = `${widthPercent}%`;
    }
    
    if (label) {
        label.textContent = `Aralık: ${minVal} - ${maxVal}`;
    }

    // --- CANLI KANAL KONTROLÜ VE AKTİFLİK DURUMU ---
    if (!channelSelect) return;
    
    const selectedChIndex = parseInt(channelSelect.value) - 1; // 0-based index

    if (selectedChIndex >= 0 && selectedChIndex < 16) {
        // Canlı veri dizisinden değeri al
        const currentPwm = currentChannelValues[selectedChIndex];

        // İmleci hareket ettir
        const markerPercent = Math.max(0, Math.min(100, ((currentPwm - 900) / totalRange) * 100));
        const marker = _$(`marker-${key}`);
        if (marker) {
            marker.style.left = `${markerPercent}%`;
            marker.setAttribute('data-val', currentPwm);
            marker.style.display = 'block';
        }

        // Aktiflik kontrolü (Kanal değeri seçili aralıkta mı?)
        if (card) {
            if (currentPwm >= minVal && currentPwm <= maxVal) {
                card.classList.add('active-mode');
            } else {
                card.classList.remove('active-mode');
            }
        }
    } else {
        // Kanal "Devre Dışı" ise marker'ı gizle
        const marker = _$(`marker-${key}`);
        if (marker) marker.style.display = 'none';
        if (card) card.classList.remove('active-mode');
    }
}

// Global erişim için (HTML onclick/oninput'tan çağrılıyor)
window.updateModeUI = updateModeUI;

// ============================================================================
// CANLI VERİ GÜNCELLEME
// ============================================================================

/**
 * @brief Receiver Stream verisi geldiğinde çağrılır (Canlı İmlecleri Günceller)
 * @param {Array<number>} channelData - 16 kanallık PWM değerleri dizisi
 */
function updateLiveModeMarkers(channelData) {
    if (!channelData || !Array.isArray(channelData)) return;

    // Global kanal verisini güncelle
    currentChannelValues = channelData;

    // Sadece "Modes" sayfası açıksa UI güncellemesi yap (Performans için)
    if (_getCurrentPage() === 'modes') {
        modeDefinitions.forEach(def => {
            // Sadece hesaplama ve CSS güncellemesi yapar, DOM'u yeniden yaratmaz
            updateModeUI(def.key);
        });
    }
}

// Global erişim için
window.updateLiveModeMarkers = updateLiveModeMarkers;

// ============================================================================
// KAYDETME FONKSİYONLARI
// ============================================================================

/**
 * @brief Modları ESP'ye kaydetmek üzere paketler ve gönderir
 */
function saveFlightModesConfig() {
    _log('✈️ Uçuş modları hazırlanıyor...', 'info');
    
    let modesData = {};

    modeDefinitions.forEach(def => {
        const chEl = _$(`ch-${def.key}`);
        const minEl = _$(`min-${def.key}`);
        const maxEl = _$(`max-${def.key}`);

        if (chEl && minEl && maxEl) {
            // Sadece gerekli veriyi al (İsim vs gönderme, ESP zaten biliyor)
            modesData[def.key] = {
                channel: parseInt(chEl.value),
                min: parseInt(minEl.value),
                max: parseInt(maxEl.value)
            };
        }
    });

    // JSON string'e çevir
    const jsonString = JSON.stringify(modesData);
    _log(`📤 Paket Boyutu: ${jsonString.length} bytes`, 'info');

    // Komutu gönder
    const jsonCommand = `MODES_SAVE ${jsonString}`;

    if (typeof sendCommand === 'function') {
        if (sendCommand(jsonCommand)) {
            // Başarılı gönderildiyse local değişkeni de güncelle ki UI bozulmasın
            activeFlightModes = modesData;
            _log('✅ Uçuş modları kaydedildi.', 'success');
        }
    } else {
        console.error("sendCommand fonksiyonu bulunamadı!");
        alert("Bağlantı hatası: Lütfen cihaza bağlı olduğunuzdan emin olun");
    }
}

// Global erişim için
window.saveFlightModesConfig = saveFlightModesConfig;

// ============================================================================
// DIŞA AKTARILAN FONKSİYONLAR
// ============================================================================

// Bu değişkenler/fonksiyonlar diğer modüller tarafından kullanılabilir
window.modeDefinitions = modeDefinitions;
window.activeFlightModes = activeFlightModes;
window.currentChannelValues = currentChannelValues;