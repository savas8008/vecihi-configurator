/**
 * @file waypoint.js
 * @brief Waypoint misyon planlayıcı — Harita, liste yönetimi ve FC iletişimi
 * X-Flight Configurator
 */

// ==================== DURUM ====================
let wpMap = null;          // Leaflet harita nesnesi
let wpMarkers = [];        // Harita üzerindeki waypoint markerları
let wpPolyline = null;     // Waypoint rotası çizgisi
let waypoints = [];        // [{lat, lon, alt}, ...]
let homeMarker = null;     // Home konumu markeri
let _pendingWaypointData = null; // Harita hazır olmadan önce gelen FC verisi
const MAX_WP = 16;

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
    waypoints.push({ lat, lon, alt });
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
        html += `
        <div class="d-flex align-items-center mb-2 p-2 rounded" style="background:#1a1a2e; font-size:0.8em;">
            <span class="badge bg-primary me-2">${i + 1}</span>
            <div class="flex-grow-1">
                <div>${wp.lat.toFixed(6)}, ${wp.lon.toFixed(6)}</div>
                <div class="text-muted">Alt: <input type="number" step="1" value="${wp.alt}"
                    style="width:55px; background:transparent; border:none; border-bottom:1px solid #444; color:#ccc; font-size:0.9em;"
                    onchange="waypoints[${i}].alt=parseFloat(this.value)||50; renderMapMarkers();">m</div>
            </div>
            <div class="btn-group btn-group-sm ms-1">
                ${i > 0 ? `<button class="btn btn-outline-secondary btn-sm py-0" onclick="moveWaypointUp(${i})" title="Yukarı"><i class="bi bi-arrow-up"></i></button>` : '<span style="width:30px"></span>'}
                <button class="btn btn-outline-danger btn-sm py-0" onclick="removeWaypoint(${i})" title="Sil"><i class="bi bi-x"></i></button>
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
        const icon = L.divIcon({
            className: '',
            html: `<div style="background:#0d6efd;color:#fff;border-radius:50%;width:24px;height:24px;
                              display:flex;align-items:center;justify-content:center;
                              font-size:11px;font-weight:bold;border:2px solid #fff;
                              box-shadow:0 0 4px rgba(0,0,0,0.5);">${i + 1}</div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker([wp.lat, wp.lon], { icon, draggable: true })
            .bindTooltip(`WP${i + 1} | ${wp.alt}m`, { permanent: false })
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

    const payload = JSON.stringify({ waypoints });
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
    waypoints = data.points.map(p => ({
        lat: p.lat,
        lon: p.lon,
        alt: p.alt !== undefined ? p.alt : 50
    }));
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
