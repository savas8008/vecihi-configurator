// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file osd.js
 * @brief Vecihi Configurator - OSD (On-Screen Display) Modülü
 * @description DJI HD Sistem için OSD element yönetimi, drag-drop ve konfigürasyon
 * 
 * @requires serial_communication.js - sendCommand, isConnected
 * @requires page_management.js - log fonksiyonu
 */

// ============================================================================
// SABITLER VE AYARLAR
// ============================================================================

const OSD_COLS = 53;  // DJI HD Sistem karakter sayısı (yatay)
const OSD_ROWS = 20;  // DJI HD Sistem satır sayısı (dikey)

// ============================================================================
// ELEMENT EŞLEŞTIRME HARİTALARI
// ============================================================================

// HTML ID -> JSON Key eşleştirmesi
const osdElementMapping = {
    'prev_arm_status':   'arm',
    'prev_flight_mode':  'mode',
    'prev_speed':        'spd',
    'prev_rssi':         'rssi',
    'prev_battery':      'bat',
    'prev_altitude':     'alt',
    'prev_vario':        'vario',
    'prev_horizon':      'hor',
    'prev_home_dir':     'home',
    'prev_throttle':     'thr',
    'prev_wind':         'wind',
    'prev_sys_msg':      'msg',
    'prev_timer':        'time',
    'prev_sats':         'sat',
    'prev_lat':          'lat',
    'prev_lon':          'lon',
    'prev_gcode':        'gcode'
};

// JSON Key -> HTML ID (ters eşleştirme)
const osdReverseMapping = {};
for (const [htmlId, jsonKey] of Object.entries(osdElementMapping)) {
    osdReverseMapping[jsonKey] = htmlId;
}

// JSON Key -> Toggle Checkbox ID eşleştirmesi
const osdToggleMapping = {
    'arm':   'osd_show_arm',
    'mode':  'osd_show_mode',
    'spd':   'osd_show_spd',
    'rssi':  'osd_show_rssi',
    'bat':   'osd_show_bat',
    'alt':   'osd_show_alt',
    'vario': 'osd_show_vario',
    'hor':   'osd_show_horizon',
    'home':  'osd_show_home',
    'thr':   'osd_show_thr',
    'wind':  'osd_show_wind',
    'msg':   'osd_show_msg',
    'time':  'osd_show_timer',
    'sat':   'osd_show_sats',
    'lat':   'osd_show_lat',
    'lon':   'osd_show_lon',
    'gcode': 'osd_show_gcode'
};

// ============================================================================
// DRAG & DROP İŞLEVSELLİĞİ
// ============================================================================

/**
 * @brief OSD elementleri için sürükle-bırak özelliğini başlatır
 */
function initOSDDragDrop() {
    const monitor = document.getElementById('osd-preview-screen');
    const osdItems = document.querySelectorAll('.osd-draggable');

    if (!monitor) {
        console.warn("OSD preview screen bulunamadı");
        return;
    }

    osdItems.forEach(item => {
        item.style.position = 'absolute';
        item.style.cursor = 'move';
        item.style.zIndex = '10';

        let isDragging = false;

        item.addEventListener('mousedown', e => {
            if (e.button !== 0) return; // Sadece sol tık
            isDragging = true;
            item.style.zIndex = 1000;
            item.style.outline = '1px dashed #00ff00';
        });

        document.addEventListener('mousemove', e => {
            if (!isDragging) return;
            e.preventDefault();

            const rect = monitor.getBoundingClientRect();
            let mouseX = e.clientX - rect.left;
            let mouseY = e.clientY - rect.top;

            const cellW = rect.width / OSD_COLS;
            const cellH = rect.height / OSD_ROWS;

            // Izgaraya Yapıştır (Snap to Grid)
            let gridX = Math.floor(mouseX / cellW);
            let gridY = Math.floor(mouseY / cellH);

            // Sınır Kontrolü
            gridX = Math.max(0, Math.min(gridX, OSD_COLS - 1));
            gridY = Math.max(0, Math.min(gridY, OSD_ROWS - 1));

            // Konumlandırma (%)
            item.style.left = (gridX * (100 / OSD_COLS)) + "%";
            item.style.top  = (gridY * (100 / OSD_ROWS)) + "%";

            // Veriyi kaydet
            item.dataset.gridX = gridX;
            item.dataset.gridY = gridY;
        });

        document.addEventListener('mouseup', () => {
            if (!isDragging) return;
            isDragging = false;
            item.style.zIndex = 10;
            item.style.outline = 'none';
        });
    });

    console.log("OSD Drag & Drop başlatıldı");
}

// ============================================================================
// TOGGLE (GİZLE/GÖSTER) KONTROLLERİ
// ============================================================================

/**
 * @brief OSD toggle checkbox'ları için event listener'ları kurar
 */
function initOSDToggles() {
    document.querySelectorAll('.osd-toggle').forEach(chk => {
        chk.addEventListener('change', function() {
            const targetId = this.dataset.target;
            const targetEl = document.getElementById(targetId);
            if (targetEl) {
                targetEl.style.display = this.checked ? 'block' : 'none';
            }
        });
    });

    console.log("OSD Toggle kontrolleri başlatıldı");
}

// ============================================================================
// KONFİGÜRASYON UYGULAMA (ESP32'DEN GELEN VERİ)
// ============================================================================

/**
 * @brief ESP32'den gelen OSD konfigürasyonunu ekrana yansıtır
 * @param {Object} data - OSD konfigürasyon verisi
 */
function applyOSDConfig(data) {
    console.log("applyOSDConfig çağrıldı:", data);

    if (!data || !data.elements) {
        console.error("OSD verisi geçersiz:", data);
        return;
    }

    const elements = data.elements;

    for (const [jsonKey, config] of Object.entries(elements)) {
        // 1. Preview elementini bul
        const htmlId = osdReverseMapping[jsonKey];
        if (!htmlId) {
            console.warn(`Bilinmeyen JSON key: ${jsonKey}`);
            continue;
        }

        const previewEl = document.getElementById(htmlId);
        if (!previewEl) {
            console.warn(`Preview element bulunamadı: ${htmlId}`);
            continue;
        }

        // 2. Pozisyonu ayarla (x, y -> grid koordinatları)
        let gridX = config.x || 0;
        const gridY = config.y || 0;

        // Horizon elementi için özel offset
        if (jsonKey === 'hor') {
            gridX = gridX - 8;
        }

        // CSS pozisyonunu ayarla
        previewEl.style.left = (gridX * (100 / OSD_COLS)) + "%";
        previewEl.style.top  = (gridY * (100 / OSD_ROWS)) + "%";

        // Dataset'e kaydet (sürükleme için)
        previewEl.dataset.gridX = gridX;
        previewEl.dataset.gridY = gridY;

        // 3. Görünürlük ayarla (v: 1=görünür, 0=gizli)
        const isVisible = (config.v === 1);
        previewEl.style.display = isVisible ? 'block' : 'none';

        // 4. Toggle checkbox'ı güncelle
        const toggleId = osdToggleMapping[jsonKey];
        if (toggleId) {
            const toggleEl = document.getElementById(toggleId);
            if (toggleEl) {
                toggleEl.checked = isVisible;
            }
        }

        console.log(`✓ ${jsonKey}: x=${gridX}, y=${gridY}, v=${config.v}`);
    }

    // Genel OSD ayarlarını uygula
    if (data.enabled !== undefined) {
        const enabledEl = document.getElementById('osd_enabled');
        if (enabledEl) enabledEl.checked = data.enabled;
    }

    if (data.video_format) {
        const formatEl = document.getElementById('osd_video_format');
        if (formatEl) formatEl.value = data.video_format;
    }

    if (data.pilot_name) {
        const pilotEl = document.getElementById('osd_pilot_name');
        if (pilotEl) pilotEl.value = data.pilot_name;
    }

    if (data.craft_name) {
        const craftEl = document.getElementById('osd_craft_name');
        if (craftEl) craftEl.value = data.craft_name;
    }

    if (data.units) {
        const unitRadio = document.querySelector(`input[name="osd_units"][value="${data.units}"]`);
        if (unitRadio) unitRadio.checked = true;
    }

    if (data.low_battery !== undefined) {
        const lowBatEl = document.getElementById('osd_low_bat');
        if (lowBatEl) lowBatEl.value = data.low_battery;
    }

    if (data.max_distance !== undefined) {
        const maxDistEl = document.getElementById('osd_max_dist');
        if (maxDistEl) maxDistEl.value = data.max_distance;
    }

    console.log("OSD konfigürasyonu ekrana yansıtıldı");
}

// Global erişim için window objesine ekle
window.applyOSDConfig = applyOSDConfig;

// ============================================================================
// KONFİGÜRASYON KAYDETME (ESP32'YE GÖNDERME)
// ============================================================================

/**
 * @brief OSD konfigürasyonunu toplar ve ESP32'ye gönderir
 */
function saveOSDConfig() {
    console.log("OSD Yapılandırması Kaydediliyor...");

    // OSD tüm ayarlarını topla
    const osdConfig = {
        command: "SET_OSD_LAYOUT",
        elements: {}
    };

    // Genel ayarları topla (varsa)
    const enabledEl = document.getElementById('osd_enabled');
    if (enabledEl) osdConfig.enabled = enabledEl.checked;

    const formatEl = document.getElementById('osd_video_format');
    if (formatEl) osdConfig.video_format = formatEl.value;

    const pilotEl = document.getElementById('osd_pilot_name');
    if (pilotEl) osdConfig.pilot_name = pilotEl.value;

    const craftEl = document.getElementById('osd_craft_name');
    if (craftEl) osdConfig.craft_name = craftEl.value;

    const unitRadio = document.querySelector('input[name="osd_units"]:checked');
    if (unitRadio) osdConfig.units = unitRadio.value;

    const lowBatEl = document.getElementById('osd_low_bat');
    if (lowBatEl) osdConfig.low_battery = parseFloat(lowBatEl.value);

    const maxDistEl = document.getElementById('osd_max_dist');
    if (maxDistEl) osdConfig.max_distance = parseInt(maxDistEl.value);

    // Tüm element konumlarını topla
    for (const [htmlId, jsonKey] of Object.entries(osdElementMapping)) {
        const el = document.getElementById(htmlId);

        if (el) {
            // Veri setinden veya CSS stilinden konumu al
            let x = parseInt(el.dataset.gridX);
            let y = parseInt(el.dataset.gridY);

            // Horizon elementi için özel offset (geri ekle)
            if (jsonKey === 'hor') {
                x = x + 8;
            }

            // Eğer hiç sürüklenmediyse varsayılan CSS konumunu ızgaraya çevir
            if (isNaN(x) || isNaN(y)) {
                let leftPct = parseFloat(el.style.left) || 0;
                let topPct = parseFloat(el.style.top) || 0;
                x = Math.round((leftPct / 100) * OSD_COLS);
                y = Math.round((topPct / 100) * OSD_ROWS);
            }

            // Sınırları zorla
            x = Math.max(0, Math.min(x, OSD_COLS - 1));
            y = Math.max(0, Math.min(y, OSD_ROWS - 1));

            // Görünürlük - toggle checkbox'tan al
            const toggleId = osdToggleMapping[jsonKey];
            let isVisible = true;
            if (toggleId) {
                const toggleEl = document.getElementById(toggleId);
                if (toggleEl) {
                    isVisible = toggleEl.checked;
                }
            } else {
                // Fallback: element display durumundan al
                isVisible = (el.style.display !== 'none');
            }

            osdConfig.elements[jsonKey] = {
                x: x,
                y: y,
                v: isVisible ? 1 : 0
            };
        }
    }

    console.log("Oluşturulan JSON:", osdConfig);

    // ESP32'ye gönder
    const jsonString = JSON.stringify(osdConfig);

    if (typeof sendCommand === 'function') {
        sendCommand(jsonString);
        if (typeof log === 'function') {
            log('📤 OSD ayarları gönderiliyor...', 'command');
        }
        console.log("Gönderildi:", jsonString);
    } else {
        console.error("sendCommand fonksiyonu bulunamadı!");
        alert("Bağlantı hatası: Lütfen cihaza bağlı olduğunuzdan emin olun");
    }
}

// ============================================================================
// SAYFA VERİSİ İŞLEME
// ============================================================================

/**
 * @brief OSD sayfa verilerini işler (page_management.js tarafından çağrılır)
 * @param {Object} data - ESP32'den gelen OSD verisi
 */
function handleOSDPageData(data) {
    if (typeof log === 'function') {
        log('✅ OSD konfigürasyonu yüklendi', 'success');
    }
    console.log("OSD Data:", data);

    applyOSDConfig(data);
}

// Global erişim için window objesine ekle
window.handleOSDPageData = handleOSDPageData;

// ============================================================================
// EVENT LISTENERS KURULUMU
// ============================================================================

/**
 * @brief OSD sayfası için tüm event listener'ları kurar
 */
function setupOSDEventListeners() {
    // Kaydet butonu
    const saveBtn = document.getElementById('btnSaveOSD');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveOSDConfig);
        console.log("OSD Kaydet butonu event listener eklendi");
    } else {
        console.warn("'btnSaveOSD' ID'li buton bulunamadı");
    }
}

// ============================================================================
// BAŞLATMA FONKSİYONU
// ============================================================================

/**
 * @brief OSD modülünü başlatır
 */
function initOSD() {
    initOSDDragDrop();
    initOSDToggles();
    setupOSDEventListeners();
    console.log("✅ OSD modülü başlatıldı");
}

// ============================================================================
// DOM HAZIR OLDUĞUNDA BAŞLAT
// ============================================================================

document.addEventListener('DOMContentLoaded', initOSD);

// ============================================================================
// DIŞA AKTARILAN FONKSİYONLAR (Global Scope)
// ============================================================================

// Bu fonksiyonlar diğer modüller tarafından çağrılabilir
window.applyOSDConfig = applyOSDConfig;
window.saveOSDConfig = saveOSDConfig;
window.handleOSDPageData = handleOSDPageData;
window.initOSD = initOSD;

// ============================================================================
// OSD KONFİGÜRASYON TOPLAMA (Göndermeden)
// ============================================================================

/**
 * @brief OSD ayarlarını DOM'dan toplar, ESP32'ye göndermez.
 * @returns {Object} OSD konfigürasyon objesi (dışa aktarma için)
 */
function collectOSDConfig() {
    const cfg = { elements: {} };

    const enabledEl = document.getElementById('osd_enabled');
    if (enabledEl) cfg.enabled = enabledEl.checked;

    const formatEl = document.getElementById('osd_video_format');
    if (formatEl) cfg.video_format = formatEl.value;

    const pilotEl = document.getElementById('osd_pilot_name');
    if (pilotEl) cfg.pilot_name = pilotEl.value;

    const craftEl = document.getElementById('osd_craft_name');
    if (craftEl) cfg.craft_name = craftEl.value;

    const unitRadio = document.querySelector('input[name="osd_units"]:checked');
    if (unitRadio) cfg.units = unitRadio.value;

    const lowBatEl = document.getElementById('osd_low_bat');
    if (lowBatEl) cfg.low_battery = parseFloat(lowBatEl.value);

    const maxDistEl = document.getElementById('osd_max_dist');
    if (maxDistEl) cfg.max_distance = parseInt(maxDistEl.value);

    for (const [htmlId, jsonKey] of Object.entries(osdElementMapping)) {
        const el = document.getElementById(htmlId);
        if (!el) continue;

        let x = parseInt(el.dataset.gridX);
        let y = parseInt(el.dataset.gridY);

        if (jsonKey === 'hor') x = x + 8;

        if (isNaN(x) || isNaN(y)) {
            x = Math.round((parseFloat(el.style.left) || 0) / 100 * OSD_COLS);
            y = Math.round((parseFloat(el.style.top) || 0) / 100 * OSD_ROWS);
        }

        x = Math.max(0, Math.min(x, OSD_COLS - 1));
        y = Math.max(0, Math.min(y, OSD_ROWS - 1));

        const toggleId = osdToggleMapping[jsonKey];
        let isVisible = true;
        if (toggleId) {
            const toggleEl = document.getElementById(toggleId);
            if (toggleEl) isVisible = toggleEl.checked;
        } else {
            isVisible = (el.style.display !== 'none');
        }

        cfg.elements[jsonKey] = { x, y, v: isVisible ? 1 : 0 };
    }

    return cfg;
}

window.collectOSDConfig = collectOSDConfig;