// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file waypoint.js
 * @brief Waypoint misyon planlayıcı — Harita, liste yönetimi ve FC iletişimi
 * Vecihi Configurator
 */

// ==================== DURUM ====================
let wpMap = null;          // Leaflet harita nesnesi
let wpMarkers = [];        // Harita üzerindeki waypoint markerları
let wpPolyline = null;     // Waypoint rotası çizgisi
let waypoints = [];        // [{lat, lon, alt, task, speed_mode, throttle, target_spd, kamikaze}, ...]
let homeMarker = null;     // Home konumu markeri
let _pendingWaypointData = null; // Harita hazır olmadan önce gelen FC verisi
const MAX_WP = 16;

// Görev tipleri
const WP_TASKS = [
    { value: 0, label: 'Cruise',       color: '#0d6efd',  group: 'nav' },
    { value: 1, label: 'Tırmanma',     color: '#198754',  group: 'nav' },
    { value: 5, label: 'Kamikaze',     color: '#dc3545',  group: 'nav' },
    { value: 2, label: 'Rüzgar Altı',  color: '#0dcaf0',  group: 'land' },
    { value: 3, label: 'Esas Bacak',   color: '#6f42c1',  group: 'land' },
    { value: 4, label: 'Son Yaklaşma', color: '#fd7e14',  group: 'land' },
    { value: 6, label: 'Flare',        color: '#ffc107',  group: 'land' },
];

// Hız modları
const WP_SPEED_MODES = [
    { value: 0, label: 'Gaz (PWM)',    disabled: false },
    { value: 1, label: 'Yer Hızı (km/h)', disabled: false },
    { value: 2, label: 'Hava Hızı',    disabled: true },
];

// Boş kamikaze config — varsa şablon input'larından, yoksa sabit varsayılanlar
function defaultKamikaze() {
    if (typeof getKamikazeDefaults === 'function') return getKamikazeDefaults();
    return { dive_mode: 0, dive_angle: 45, alt_offset: 0, trigger_alt: 15, mission_servo: 0 };
}

// Boş waypoint oluştur
function newWaypoint(lat, lon, alt) {
    return {
        lat, lon, alt,
        task: 0, speed_mode: 0, throttle: 0, target_spd: 0,
        kamikaze: defaultKamikaze()
    };
}

// ==================== SAYFA AÇILIŞI ====================

/**
 * Waypoint sayfası açıldığında haritayı başlatır.
 * page_management.js'teki startPageSpecificStream'den çağrılır.
 */
function initWaypointPage() {
    setTimeout(() => {
        if (!wpMap) {
            initWpMap();
        } else {
            wpMap.invalidateSize();
        }
        // FC'deki mevcut waypoint listesini al
        if (window.isConnected && window.isConnected()) sendCommand('GET_WAYPOINTS');
    }, 150);
}

function initWpMap() {
    const mapEl = document.getElementById('wp-map');
    if (!mapEl || wpMap) return;

    // Varsayılan merkez: Türkiye
    wpMap = L.map('wp-map').setView([39.9, 32.8], 10);

    // --- Katmanlar ---
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    const satelliteLayer = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
            attribution: 'Tiles © Esri &mdash; Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
            maxZoom: 19
        }
    );

    // Varsayılan: uydu
    satelliteLayer.addTo(wpMap);

    // Katman seçici (sağ üst)
    L.control.layers(
        { 'Uydu': satelliteLayer, 'Harita': osmLayer },
        {},
        { position: 'topright', collapsed: false }
    ).addTo(wpMap);

    // Haritaya tıklandığında waypoint ekle
    wpMap.on('click', function(e) {
        if (waypoints.length >= MAX_WP) {
            log(`Maksimum ${MAX_WP} waypoint eklenebilir`, 'warning');
            return;
        }
        const altVal = parseFloat(document.getElementById('inp-wp-alt').value) || 50;
        addWaypoint(e.latlng.lat, e.latlng.lng, altVal);
    });

    // GPS pozisyonunu home olarak göster (sensor stream'den geliyorsa)
    trySetHomeOnMap();

    // Harita hazır olmadan önce gelen FC waypoint verisi varsa şimdi uygula
    if (_pendingWaypointData) {
        _applyWaypointData(_pendingWaypointData);
        _pendingWaypointData = null;
    }
}

function trySetHomeOnMap() {
    // sensors stream'deki son bilinen GPS pozisyonu varsa haritayı oraya taşı
    if (typeof lastGpsLat !== 'undefined' && lastGpsLat !== 0) {
        wpMap.setView([lastGpsLat, lastGpsLon], 14);
        setHomeMarker(lastGpsLat, lastGpsLon);
    }
}

// ==================== WAYPOINT YÖNETİMİ ====================

function addWaypoint(lat, lon, alt) {
    alt = parseFloat(alt) || 50;
    waypoints.push(newWaypoint(lat, lon, alt));
    renderWaypointList();
    renderMapMarkers();
    log(`WP${waypoints.length} eklendi: ${lat.toFixed(6)}, ${lon.toFixed(6)}, ${alt}m`, 'info');
}

function addWaypointManual() {
    const lat = parseFloat(document.getElementById('inp-wp-lat').value);
    const lon = parseFloat(document.getElementById('inp-wp-lon').value);
    const alt = parseFloat(document.getElementById('inp-wp-alt').value) || 50;
    if (isNaN(lat) || isNaN(lon)) {
        log('Geçerli lat/lon girin', 'warning');
        return;
    }
    if (waypoints.length >= MAX_WP) {
        log(`Maksimum ${MAX_WP} waypoint eklenebilir`, 'warning');
        return;
    }
    addWaypoint(lat, lon, alt);
    document.getElementById('inp-wp-lat').value = '';
    document.getElementById('inp-wp-lon').value = '';
}

function removeWaypoint(index) {
    waypoints.splice(index, 1);
    renderWaypointList();
    renderMapMarkers();
}

function moveWaypointUp(index) {
    if (index === 0) return;
    [waypoints[index - 1], waypoints[index]] = [waypoints[index], waypoints[index - 1]];
    renderWaypointList();
    renderMapMarkers();
}

function clearAllWaypoints() {
    waypoints = [];
    renderWaypointList();
    renderMapMarkers();
    updateWpStatus('Waypoint listesi temizlendi');
}

// ==================== RENDER ====================

function renderWaypointList() {
    const listEl = document.getElementById('wp-list');
    const badge  = document.getElementById('wp-count-badge');
    if (!listEl) return;

    badge.textContent = `${waypoints.length} / ${MAX_WP}`;

    if (waypoints.length === 0) {
        listEl.innerHTML = '<p class="text-muted text-center small mt-3">Henüz waypoint eklenmedi.<br>Haritaya tıklayın.</p>';
        return;
    }

    let html = '';
    waypoints.forEach((wp, i) => {
        const taskInfo  = WP_TASKS.find(t => t.value === (wp.task || 0)) || WP_TASKS[0];
        const isKamikaze = (wp.task === 5);
        const spdMode = wp.speed_mode || 0;

        // Hız modu seçenekleri
        const spdOpts = WP_SPEED_MODES.map(m =>
            `<option value="${m.value}" ${m.disabled ? 'disabled' : ''} ${spdMode === m.value ? 'selected' : ''}>${m.label}</option>`
        ).join('');

        // Görev tipi seçenekleri (gruplu)
        const navOpts  = WP_TASKS.filter(t => t.group === 'nav').map(t =>
            `<option value="${t.value}" ${wp.task === t.value ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        const landOpts = WP_TASKS.filter(t => t.group === 'land').map(t =>
            `<option value="${t.value}" ${wp.task === t.value ? 'selected' : ''}>${t.label}</option>`
        ).join('');
        const taskOpts = `${navOpts}<optgroup label="─── Otomatik İniş ───">${landOpts}</optgroup>`;

        // Hız değeri alanı: Gaz (1000-2000) veya Yer Hızı (km/h)
        const inputStyle = 'width:70px;background:#2a2a3e;border:1px solid #555;border-radius:4px;color:#fff;font-size:0.85em;padding:1px 4px;';
        let spdValueHtml = '';
        if (spdMode === 1) {
            spdValueHtml = `<input type="number" min="20" max="300" step="1" value="${wp.target_spd || ''}"
                placeholder="km/h" style="${inputStyle}"
                onchange="waypoints[${i}].target_spd=parseFloat(this.value)||0;">`;
        } else {
            spdValueHtml = `<input type="number" min="1000" max="2000" step="10" value="${wp.throttle > 0 ? wp.throttle : ''}"
                placeholder="varsayılan" style="${inputStyle}"
                onchange="waypoints[${i}].throttle=parseInt(this.value)||0;">`;
        }

        const selectStyle = 'background:#2a2a3e;border:1px solid #555;color:#fff;font-size:0.82em;border-radius:4px;padding:2px 5px;';
        html += `
        <div class="mb-2 p-2 rounded" style="background:#1e1e30;border-left:3px solid ${taskInfo.color};">
            <div class="d-flex align-items-start gap-2">
                <span class="badge mt-1 flex-shrink-0" style="background:${taskInfo.color};min-width:22px;text-align:center;">${i + 1}</span>
                <div class="flex-grow-1" style="min-width:0;">
                    <div style="color:#e0e0e0;font-size:0.82em;font-weight:500;margin-bottom:4px;">${wp.lat.toFixed(6)}, ${wp.lon.toFixed(6)}</div>
                    <div style="display:grid;grid-template-columns:auto auto 1fr;gap:4px 6px;align-items:center;font-size:0.8em;">
                        <span style="color:#aaa;">İrtifa</span>
                        <input type="number" step="1" value="${wp.alt}"
                            style="width:55px;background:#2a2a3e;border:1px solid #555;border-radius:4px;color:#e0e0e0;font-size:0.85em;padding:1px 4px;"
                            onchange="waypoints[${i}].alt=parseFloat(this.value)||50;renderMapMarkers();">
                        <span style="color:#aaa;">m</span>

                        <span style="color:#aaa;">Görev</span>
                        <select style="${selectStyle};grid-column:2/4;"
                            onchange="waypoints[${i}].task=parseInt(this.value);renderWaypointList();renderMapMarkers();">
                            ${taskOpts}
                        </select>

                        <span style="color:#aaa;">Hız</span>
                        <select style="${selectStyle}"
                            onchange="waypoints[${i}].speed_mode=parseInt(this.value);renderWaypointList();">
                            ${spdOpts}
                        </select>
                        ${spdValueHtml}
                    </div>
                    ${isKamikaze ? `<div style="font-size:0.75em;color:#ff7070;margin-top:4px;"><i class="bi bi-bullseye me-1"></i>Kamikaze — detaylar aşağıdaki kutudan</div>` : ''}
                </div>
                <div class="d-flex flex-column gap-1 flex-shrink-0">
                    ${i > 0 ? `<button class="btn btn-outline-secondary btn-sm py-0 px-1" style="font-size:0.75em;" onclick="moveWaypointUp(${i})" title="Yukarı"><i class="bi bi-arrow-up"></i></button>` : ''}
                    <button class="btn btn-outline-danger btn-sm py-0 px-1" style="font-size:0.75em;" onclick="removeWaypoint(${i})" title="Sil"><i class="bi bi-x-lg"></i></button>
                </div>
            </div>
        </div>`;
    });
    listEl.innerHTML = html;
}

function renderMapMarkers() {
    if (!wpMap) return;

    // Eski marker ve çizgileri kaldır
    wpMarkers.forEach(m => wpMap.removeLayer(m));
    wpMarkers = [];
    if (wpPolyline) { wpMap.removeLayer(wpPolyline); wpPolyline = null; }

    if (waypoints.length === 0) return;

    const latlngs = [];

    waypoints.forEach((wp, i) => {
        const taskInfo = WP_TASKS.find(t => t.value === (wp.task || 0)) || WP_TASKS[0];
        const icon = L.divIcon({
            className: '',
            html: `<div style="background:${taskInfo.color};color:#fff;border-radius:50%;width:24px;height:24px;
                              display:flex;align-items:center;justify-content:center;
                              font-size:11px;font-weight:bold;border:2px solid #fff;
                              box-shadow:0 0 4px rgba(0,0,0,0.5);">${i + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([wp.lat, wp.lon], { icon, draggable: true })
            .bindTooltip(`WP${i + 1} | ${wp.alt}m | ${taskInfo.label}`, { permanent: false })
            .addTo(wpMap);

        marker.on('dragend', function(e) {
            const pos = e.target.getLatLng();
            waypoints[i].lat = pos.lat;
            waypoints[i].lon = pos.lng;
            renderWaypointList();
            renderMapMarkers();
        });

        wpMarkers.push(marker);
        latlngs.push([wp.lat, wp.lon]);
    });

    // Rota çizgisi
    wpPolyline = L.polyline(latlngs, { color: '#0d6efd', weight: 2, dashArray: '6,4' }).addTo(wpMap);

    // Home → WP1 ok çizgisi
    if (homeMarker && waypoints.length > 0) {
        const homePos = homeMarker.getLatLng();
        L.polyline([[homePos.lat, homePos.lng], latlngs[0]], { color: '#198754', weight: 2, dashArray: '4,4' }).addTo(wpMap);
    }
}

function setHomeMarker(lat, lon) {
    if (!wpMap) return;
    if (homeMarker) wpMap.removeLayer(homeMarker);
    const icon = L.divIcon({
        className: '',
        html: `<div style="background:#198754;color:#fff;border-radius:50%;width:22px;height:22px;
                          display:flex;align-items:center;justify-content:center;font-size:10px;
                          border:2px solid #fff;box-shadow:0 0 4px rgba(0,0,0,0.5);">H</div>`,
        iconSize: [22, 22], iconAnchor: [11, 11]
    });
    homeMarker = L.marker([lat, lon], { icon }).bindTooltip('Home', { permanent: true }).addTo(wpMap);
}

// ==================== FC İLETİŞİMİ ====================

function uploadWaypoints() {
    if (!window.isConnected || !window.isConnected()) { log('Önce cihaza bağlanın', 'warning'); return; }
    if (waypoints.length === 0) { log('Önce waypoint ekleyin', 'warning'); return; }

    // Kamikaze ayarlarını kutucuktan al (tüm KM WP'ler aynı ayarı kullanır)
    const kmDefaults = defaultKamikaze();

    // Her WP için uygun alanları hazırla; kamikaze alanları yalnızca task==5'te gönder
    const serialized = waypoints.map(wp => {
        const obj = {
            lat: wp.lat, lon: wp.lon, alt: wp.alt,
            task: wp.task || 0,
            spd_mode: wp.speed_mode || 0,
            thr: wp.throttle || 0,
            target_spd: wp.target_spd || 0
        };
        if (wp.task === 5) {
            obj.km_mode        = 0;                           // GPS Tabanlı
            obj.km_angle       = kmDefaults.dive_angle  || 45;
            obj.km_alt_offset  = kmDefaults.alt_offset  || 0;
            obj.km_trigger_alt = kmDefaults.trigger_alt || 15;
            obj.km_servo       = kmDefaults.mission_servo|| 0;
        }
        return obj;
    });

    const payload = JSON.stringify({ waypoints: serialized });
    sendCommand('UPLOAD_WAYPOINTS ' + payload);
    log(`${waypoints.length} waypoint yükleniyor...`, 'info');
}

function startWaypointMission() {
    if (!window.isConnected || !window.isConnected()) { log('Önce cihaza bağlanın', 'warning'); return; }
    sendCommand('START_WAYPOINT_MISSION');
    updateWpStatus('Misyon başlatıldı...', 'success');
    log('Waypoint misyonu başlatıldı', 'info');
}

function stopWaypointMission() {
    if (!window.isConnected || !window.isConnected()) { log('Önce cihaza bağlanın', 'warning'); return; }
    sendCommand('STOP_WAYPOINT_MISSION');
    updateWpStatus('Misyon durduruldu');
    log('Waypoint misyonu durduruldu', 'warning');
}

// ==================== YANIT IŞLEME ====================

/**
 * FC'den gelen WP listesini yerel dizi ve haritaya uygular.
 * Sadece harita hazırsa çağrılabilir.
 */
function _applyWaypointData(data) {
    waypoints = data.points.map(p => {
        const km = defaultKamikaze();
        if (p.task === 5) {
            if (p.km_mode        !== undefined) km.dive_mode     = p.km_mode;
            if (p.km_angle       !== undefined) km.dive_angle    = p.km_angle;
            if (p.km_alt_offset  !== undefined) km.alt_offset    = p.km_alt_offset;
            if (p.km_trigger_alt !== undefined) km.trigger_alt   = p.km_trigger_alt;
            if (p.km_servo       !== undefined) km.mission_servo = p.km_servo;
        }
        return {
            lat:        p.lat,
            lon:        p.lon,
            alt:        p.alt        !== undefined ? p.alt        : 50,
            task:       p.task       !== undefined ? p.task       : 0,
            speed_mode: p.spd_mode   !== undefined ? p.spd_mode   : 0,
            throttle:   p.thr        !== undefined ? p.thr        : 0,
            target_spd: p.target_spd !== undefined ? p.target_spd : 0,
            kamikaze: km
        };
    });
    renderWaypointList();
    renderMapMarkers();
    if (wpMap && waypoints.length > 0) {
        wpMap.setView([waypoints[0].lat, waypoints[0].lon], 16);
    }
}

/**
 * serial_communication.js'teki handlePageData() tarafından çağrılır.
 * Gelen waypoint sayfa verisini UI'a uygular.
 */
function handleWaypointPageData(data) {
    if (!data) return;

    // FC'deki WP listesini UI'a yükle (henüz yerel liste boşsa)
    if (data.points && data.count > 0 && waypoints.length === 0) {
        if (!wpMap) {
            // Harita henüz hazır değil — veriyi tamponla, initWpMap() uygulayacak
            _pendingWaypointData = data;
        } else {
            _applyWaypointData(data);
        }
    }

    const statusType = data.active ? 'success' : (data.finished ? 'info' : 'secondary');
    const statusMsg  = data.active
        ? `▶ Misyon aktif — WP ${data.current + 1} / ${data.count}`
        : data.finished
            ? `✓ Misyon tamamlandı (${data.count} WP)`
            : `${data.count} WP yüklü — başlatılmadı`;
    updateWpStatus(statusMsg, statusType);

    // Aktif waypoint marker'ını vurgula
    if (wpMap && data.active && data.current < wpMarkers.length) {
        wpMarkers[data.current].openTooltip();
    }
}

function updateWpStatus(msg, type = 'secondary') {
    const el = document.getElementById('wp-status-text');
    if (!el) return;
    const colorMap = { success: '#198754', info: '#0dcaf0', warning: '#ffc107', danger: '#dc3545', secondary: '#6c757d' };
    el.style.color = colorMap[type] || '#6c757d';
    el.textContent = msg;
}

// ==================== SAYFA YÖNETİMİ İNTEGRASYONU ====================

// serial_communication.js'teki handlePageData waypoints case'i bu fonksiyonu çağırır
window.handleWaypointData = function(data) {
    handleWaypointPageData(data);
};

// Sensör stream'inden GPS pozisyonunu al ve harita/home için kullan
let lastGpsLat = 0, lastGpsLon = 0;

// serial_communication.js'deki onSensorStreamForWaypoint hook'u
window.onSensorStreamForWaypoint = function(data) {
    if (data && data.lat && data.lat !== 0) {
        lastGpsLat = data.lat;
        lastGpsLon = data.lon;
        if (typeof currentPage !== 'undefined' && currentPage === 'waypoint') {
            if (!homeMarker || Math.abs(homeMarker.getLatLng().lat - data.lat) > 0.0001) {
                setHomeMarker(data.lat, data.lon);
            }
        }
    }
};

// Global API
window.initWaypointPage   = initWaypointPage;
window.addWaypointManual  = addWaypointManual;
window.removeWaypoint     = removeWaypoint;
window.moveWaypointUp     = moveWaypointUp;
window.clearAllWaypoints  = clearAllWaypoints;
window.uploadWaypoints    = uploadWaypoints;
window.startWaypointMission = startWaypointMission;
window.stopWaypointMission  = stopWaypointMission;
