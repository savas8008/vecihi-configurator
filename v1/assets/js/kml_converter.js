// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// EdgeTX CSV → KML Dönüştürücü

'use strict';

// ============================================================
//  SABITLER
// ============================================================

const KML_MODE_STYLES = {
    'MANUAL':    { kml: 'ff00ffff', css: '#ffff00' },
    'LAUNCH':    { kml: 'ff00cc00', css: '#00cc00' },
    'ANGLE':     { kml: 'ffff7000', css: '#0070ff' },
    'HORIZON':   { kml: 'ffff9900', css: '#0099ff' },
    'ACRO':      { kml: 'ff22aa44', css: '#44aa22' },
    'CRUISE':    { kml: 'ffffff00', css: '#00ffff' },
    'ALT HOLD':  { kml: 'ffbbff00', css: '#00ffbb' },
    'RTH':       { kml: 'ff0000ee', css: '#ee0000' },
    'LAND ASST': { kml: 'ff0088ff', css: '#ff8800' },
    'WAYPOINT':  { kml: 'ffee00ee', css: '#ee00ee' },
    'AUTOTUNE':  { kml: 'ff44ff44', css: '#44ff44' },
    'FAILSAFE':  { kml: 'ff0000cc', css: '#cc0000' },
    'GCS':       { kml: 'ffff5500', css: '#0055ff' },
};
const KML_DEFAULT_STYLE = { kml: 'ffaaaaaa', css: '#aaaaaa' };

function kmlModeStyle(mode) {
    return KML_MODE_STYLES[mode] || KML_DEFAULT_STYLE;
}

function kmlSafeId(str) {
    return (str || 'UNKNOWN').replace(/[^a-zA-Z0-9]/g, '_');
}


// ============================================================
//  CSV PARSE
// ============================================================

function parseCsvLine(line) {
    const out = [];
    let field = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"') { inQ = !inQ; continue; }
        if (c === ',' && !inQ) { out.push(field); field = ''; continue; }
        field += c;
    }
    out.push(field);
    return out;
}

function parseEdgeTxCsv(text) {
    const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim().split('\n');
    if (lines.length < 2) throw new Error('CSV dosyası çok kısa veya boş.');

    const rawHeader = lines[0].replace(/^﻿/, ''); // BOM
    const headers = parseCsvLine(rawHeader).map(h => h.trim());

    // Sütun indekslerini bul
    const ci = {};
    headers.forEach((h, i) => {
        const n = h.toLowerCase();
        if (h === 'Date')           ci.date  = i;
        else if (h === 'Time')      ci.time  = i;
        else if (h === 'GPS')       ci.gps   = i;
        else if (h === 'FM')        ci.fm    = i;
        else if (h === 'Sats')      ci.sats  = i;
        else if (h === 'VSpd')      ci.vspd  = i;
        else if (n.startsWith('galt')) ci.alt = i;
        else if (n.startsWith('gspd')) ci.spd = i;
        else if (n.startsWith('rxbt')) ci.bat = i;
        else if (n.startsWith('ptch')) ci.ptch = i;
        else if (n.startsWith('roll')) ci.roll = i;
        else if (n.startsWith('tqly')) ci.rqly = i;
    });

    if (ci.gps  === undefined) throw new Error('GPS sütunu bulunamadı. Lütfen EdgeTX log formatında bir CSV yükleyin.');
    if (ci.date === undefined) throw new Error('Date sütunu bulunamadı.');
    if (ci.fm   === undefined) throw new Error('FM (Flight Mode) sütunu bulunamadı.');

    const records = [];
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        const v = parseCsvLine(line);
        const get = (idx) => (idx !== undefined && v[idx] !== undefined) ? v[idx].trim() : '';

        const gpsRaw = get(ci.gps);
        let lat = 0, lon = 0, hasGps = false;
        if (gpsRaw) {
            const parts = gpsRaw.split(/\s+/);
            if (parts.length >= 2) {
                lat = parseFloat(parts[0]);
                lon = parseFloat(parts[1]);
                hasGps = isFinite(lat) && isFinite(lon) && (lat !== 0 || lon !== 0);
            }
        }

        const dateStr = get(ci.date);
        const timeStr = get(ci.time);

        records.push({
            _hasGps: hasGps,
            _lat:    lat,
            _lon:    lon,
            _alt:    parseFloat(get(ci.alt))  || 0,
            _spd:    parseFloat(get(ci.spd))  || 0,
            _vspd:   parseFloat(get(ci.vspd)) || 0,
            _sats:   parseInt(get(ci.sats))   || 0,
            _bat:    parseFloat(get(ci.bat))  || 0,
            _ptch:   parseFloat(get(ci.ptch)) || 0,
            _roll:   parseFloat(get(ci.roll)) || 0,
            _mode:   get(ci.fm),
            _date:   dateStr,
            _time:   timeStr,
            _iso:    (dateStr && timeStr) ? `${dateStr}T${timeStr}Z` : '',
        });
    }

    return records;
}

// ============================================================
//  İSTATİSTİK
// ============================================================

function haversineM(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2
            + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180)
            * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function computeFlightStats(gpsRecs) {
    if (!gpsRecs.length) return null;

    const first = gpsRecs[0];
    const last  = gpsRecs[gpsRecs.length - 1];

    let maxAlt = -Infinity, maxSpd = 0, totalDist = 0;
    let prev = null;

    for (const r of gpsRecs) {
        if (r._alt > maxAlt) maxAlt = r._alt;
        if (r._spd > maxSpd) maxSpd = r._spd;
        if (prev) totalDist += haversineM(prev._lat, prev._lon, r._lat, r._lon);
        prev = r;
    }

    const t1 = new Date(first._iso), t2 = new Date(last._iso);
    const durS = (!isNaN(t1) && !isNaN(t2)) ? Math.round((t2 - t1) / 1000) : gpsRecs.length;

    // Uçuşta kullanılan modlar
    const modes = [...new Set(gpsRecs.map(r => r._mode).filter(Boolean))];

    return {
        maxAlt:    maxAlt === -Infinity ? 0 : maxAlt,
        maxSpd,
        distKm:    totalDist / 1000,
        durS,
        gpsCount:  gpsRecs.length,
        modes,
        date:      first._date,
        startTime: first._time,
        endTime:   last._time,
    };
}

// ============================================================
//  KML ÜRETİMİ
// ============================================================

function buildKmlSegments(gpsRecs) {
    const segs = [];
    let cur = null;
    for (const r of gpsRecs) {
        const m = r._mode || 'UNKNOWN';
        if (!cur || cur.mode !== m) { cur = { mode: m, recs: [] }; segs.push(cur); }
        cur.recs.push(r);
    }
    return segs;
}

function generateKml(records, filename) {
    const gpsRecs = records.filter(r => r._hasGps);
    if (!gpsRecs.length) throw new Error('Log dosyasında GPS verisi bulunamadı.');

    const stats = computeFlightStats(gpsRecs);
    const docName = `Vecihi ${stats.date} ${stats.startTime}`;
    const dM = Math.floor(stats.durS / 60), dS = stats.durS % 60;

    // --- Stiller ---
    const allModes = [...new Set(gpsRecs.map(r => r._mode).filter(Boolean))];
    const stylesXml = allModes.map(mode => {
        const s = kmlModeStyle(mode);
        const id = kmlSafeId(mode);
        return `
  <Style id="${id}">
    <LineStyle><color>${s.kml}</color><width>3</width></LineStyle>
    <IconStyle>
      <color>${s.kml}</color><scale>0.65</scale>
      <Icon><href>http://maps.google.com/mapfiles/kml/shapes/placemark_circle.png</href></Icon>
    </IconStyle>
    <LabelStyle><scale>0.75</scale></LabelStyle>
  </Style>`;
    }).join('');

    // --- Mod segmentleri ---
    const segs = buildKmlSegments(gpsRecs);
    const segsXml = segs.map(seg => {
        if (seg.recs.length < 2) return '';
        const id = kmlSafeId(seg.mode);
        const coords = seg.recs.map(r => `${r._lon},${r._lat},${Math.max(0, r._alt)}`).join(' ');
        const t0 = seg.recs[0]._time, t1 = seg.recs[seg.recs.length - 1]._time;
        return `
    <Placemark>
      <name>${seg.mode} (${t0}–${t1})</name>
      <styleUrl>#${id}</styleUrl>
      <LineString>
        <tessellate>1</tessellate>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${coords}</coordinates>
      </LineString>
    </Placemark>`;
    }).join('');

    // --- gx:Track (zaman kaydırıcısı) ---
    const whenXml  = gpsRecs.map(r => `        <when>${r._iso}</when>`).join('\n');
    const coordXml = gpsRecs.map(r =>
        `        <gx:coord>${r._lon} ${r._lat} ${Math.max(0, r._alt)}</gx:coord>`
    ).join('\n');

    // --- Mod değişim markerları ---
    const events = [];
    let prevMode = '';
    for (const r of gpsRecs) {
        if (r._mode !== prevMode) { events.push(r); prevMode = r._mode; }
    }
    const eventsXml = events.map(r => {
        const id = kmlSafeId(r._mode);
        return `
    <Placemark>
      <name>${r._mode}</name>
      <description>${r._date} ${r._time}</description>
      <TimeStamp><when>${r._iso}</when></TimeStamp>
      <styleUrl>#${id}</styleUrl>
      <Point>
        <altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${r._lon},${r._lat},${Math.max(0, r._alt)}</coordinates>
      </Point>
    </Placemark>`;
    }).join('');

    // --- İniş ve kalkış markerları ---
    const fr = gpsRecs[0], lr = gpsRecs[gpsRecs.length - 1];
    const endpointsXml = `
    <Placemark>
      <name>🛫 Kalkış (${fr._time})</name>
      <Style><IconStyle><scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon>
      </IconStyle></Style>
      <Point><altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${fr._lon},${fr._lat},0</coordinates></Point>
    </Placemark>
    <Placemark>
      <name>🛬 İniş (${lr._time})</name>
      <Style><IconStyle><scale>1.2</scale>
        <Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon>
      </IconStyle></Style>
      <Point><altitudeMode>relativeToGround</altitudeMode>
        <coordinates>${lr._lon},${lr._lat},0</coordinates></Point>
    </Placemark>`;

    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2" xmlns:gx="http://www.google.com/kml/ext/2.2">
<Document>
  <name>${docName}</name>
  <description><![CDATA[Vecihi Configurator tarafından EdgeTX log kaydından oluşturuldu.<br/>
<b>Kaynak:</b> ${filename}<br/>
<b>Tarih:</b> ${stats.date}<br/>
<b>Süre:</b> ${dM}dk ${dS}sn<br/>
<b>GPS noktası:</b> ${stats.gpsCount}<br/>
<b>Maks. irtifa:</b> ${stats.maxAlt.toFixed(0)} m (GPS)<br/>
<b>Maks. hız:</b> ${stats.maxSpd.toFixed(0)} km/h<br/>
<b>Toplam mesafe:</b> ${stats.distKm.toFixed(2)} km]]></description>
${stylesXml}

  <Folder>
    <name>📍 Kalkış / İniş</name>
    <visibility>1</visibility>
${endpointsXml}
  </Folder>

  <Folder>
    <name>🔀 Mod Değişimleri</name>
    <visibility>1</visibility>
${eventsXml}
  </Folder>

  <Folder>
    <name>✈️ Uçuş Modu Segmentleri</name>
    <visibility>1</visibility>
${segsXml}
  </Folder>

  <Folder>
    <name>⏱️ Tam İz (Zaman Kaydırıcısı)</name>
    <visibility>0</visibility>
    <Placemark>
      <name>GPS İzi</name>
      <gx:Track>
        <altitudeMode>relativeToGround</altitudeMode>
${whenXml}
${coordXml}
      </gx:Track>
    </Placemark>
  </Folder>

</Document>
</kml>`;
}

// ============================================================
//  LEAFLET HARİTA ÖNİZLEME
// ============================================================

let _kmlMap = null;
let _kmlPolylinesByMode = {};  // { 'CRUISE': [L.polyline, ...], ... }
let _kmlActiveFilter    = null; // null = tümü, 'MODE_NAME' = sadece o mod

// Cetvel araç state'i
let _rulerActive  = false;
let _rulerPoints  = [];    // [LatLng, LatLng] — en fazla 2 nokta
let _rulerMarkers = [];    // L.circleMarker[]
let _rulerLine    = null;  // L.polyline — iki nokta arası çizgi
let _rulerPopup   = null;  // L.popup — mesafe etiketi

function renderKmlLeafletMap(gpsRecs) {
    const container = document.getElementById('kmlMapPreview');
    if (!container) return;

    if (_kmlMap) { _kmlMap.remove(); _kmlMap = null; }
    _kmlPolylinesByMode = {};
    _kmlActiveFilter    = null;
    _rulerActive  = false;
    _rulerPoints  = [];
    _rulerMarkers = [];
    _rulerLine    = null;
    _rulerPopup   = null;

    _kmlMap = L.map(container, { zoomControl: true });
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://openstreetmap.org">OpenStreetMap</a>'
    }).addTo(_kmlMap);

    const bounds = [];
    const segs = buildKmlSegments(gpsRecs);

    for (const seg of segs) {
        if (seg.recs.length < 2) continue;
        const s = kmlModeStyle(seg.mode);
        const lls = seg.recs.map(r => [r._lat, r._lon]);
        const pl = L.polyline(lls, { color: s.css, weight: 3, opacity: 0.9 })
            .bindPopup(`<b>${seg.mode}</b>`)
            .addTo(_kmlMap);
        if (!_kmlPolylinesByMode[seg.mode]) _kmlPolylinesByMode[seg.mode] = [];
        _kmlPolylinesByMode[seg.mode].push(pl);
        lls.forEach(ll => bounds.push(ll));
    }

    // Kalkış/İniş markerları
    const fr = gpsRecs[0], lr = gpsRecs[gpsRecs.length - 1];
    const mkIcon = (color, label) => L.divIcon({
        className: '',
        html: `<div style="width:12px;height:12px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 0 4px #000" title="${label}"></div>`,
        iconSize: [12, 12], iconAnchor: [6, 6]
    });
    L.marker([fr._lat, fr._lon], { icon: mkIcon('#00cc00', 'Kalkış') })
     .bindPopup(`🛫 Kalkış<br/>${fr._time}`).addTo(_kmlMap);
    L.marker([lr._lat, lr._lon], { icon: mkIcon('#ee0000', 'İniş') })
     .bindPopup(`🛬 İniş<br/>${lr._time}`).addTo(_kmlMap);

    if (bounds.length) _kmlMap.fitBounds(bounds, { padding: [16, 16] });

    // ── Harita altı araç çubuğu ────────────────────────────────────
    document.getElementById('kmlMapToolbar')?.remove();
    const toolbar = document.createElement('div');
    toolbar.id = 'kmlMapToolbar';
    toolbar.className = 'kml-map-toolbar';

    const addToolbarBtn = (id, icon, label, onClick) => {
        const btn = document.createElement('button');
        btn.className = 'kml-toolbar-btn';
        btn.id = id;
        btn.innerHTML = `<i class="bi ${icon}"></i> ${label}`;
        btn.addEventListener('click', e => { e.stopPropagation(); onClick(); });
        toolbar.appendChild(btn);
    };

    addToolbarBtn('kmlRulerBtn', 'bi-rulers', 'Mesafe Ölç', toggleKmlRuler);

    document.getElementById('kmlMapWrapper').insertAdjacentElement('afterend', toolbar);

    // ── Cetvel harita click handler ────────────────────────────────
    _kmlMap.on('click', e => {
        if (!_rulerActive) return;

        // Tamamlanmış ölçüm varsa temizle, yeni ölçüme başla
        if (_rulerPoints.length === 2) clearKmlRuler();

        _rulerPoints.push(e.latlng);

        const dot = L.circleMarker(e.latlng, {
            radius: 5, color: '#fff', fillColor: '#f59e0b',
            fillOpacity: 1, weight: 2, interactive: false
        }).addTo(_kmlMap);
        _rulerMarkers.push(dot);

        if (_rulerPoints.length === 2) {
            // Çizgi
            _rulerLine = L.polyline(_rulerPoints, {
                color: '#f59e0b', weight: 2, dashArray: '7 5',
                opacity: 0.9, interactive: false
            }).addTo(_kmlMap);

            // Mesafe hesapla
            const [p0, p1] = _rulerPoints;
            const dist = haversineM(p0.lat, p0.lng, p1.lat, p1.lng);
            const label = dist >= 1000
                ? `${(dist / 1000).toFixed(3)} km`
                : `${dist.toFixed(1)} m`;

            // Popup — orta noktada
            const mid = L.latLng(
                (_rulerPoints[0].lat + _rulerPoints[1].lat) / 2,
                (_rulerPoints[0].lng + _rulerPoints[1].lng) / 2
            );
            _rulerPopup = L.popup({
                className: 'kml-ruler-popup',
                closeButton: true,
                autoClose: false,
                closeOnClick: false,
            })
                .setLatLng(mid)
                .setContent(`<span class="kml-ruler-label">📏 ${label}</span>`)
                .openOn(_kmlMap);
        }
    });
}

// ── Tam ekran genişlet/küçült ──────────────────────────────────────────────
function toggleKmlMapExpand() {
    const el = document.getElementById('kmlMapWrapper');
    if (!el) return;
    const expanded = el.classList.toggle('kml-map-expanded');

    // Toolbar'daki genişlet butonunu güncelle
    const btn = document.getElementById('kmlExpandBtn');
    if (btn) {
        btn.innerHTML = expanded
            ? `<i class="bi bi-fullscreen-exit"></i> Küçült`
            : `<i class="bi bi-arrows-fullscreen"></i> Genişlet`;
    }

    // Tam ekrandayken body'ye sabit kapat butonu ekle (her zaman görünür)
    document.getElementById('kmlMapCloseBtn')?.remove();
    if (expanded) {
        const closeBtn = document.createElement('button');
        closeBtn.id = 'kmlMapCloseBtn';
        closeBtn.className = 'kml-map-close-btn';
        closeBtn.innerHTML = '<i class="bi bi-fullscreen-exit"></i>';
        closeBtn.title = 'Küçült (Esc)';
        closeBtn.addEventListener('click', toggleKmlMapExpand);
        document.body.appendChild(closeBtn);
    }

    if (_kmlMap) setTimeout(() => _kmlMap.invalidateSize(), 60);
}

// ── Cetvel: temizle ────────────────────────────────────────────────────────
function clearKmlRuler() {
    _rulerPoints = [];
    _rulerMarkers.forEach(m => { if (_kmlMap) _kmlMap.removeLayer(m); });
    _rulerMarkers = [];
    if (_rulerLine  && _kmlMap) { _kmlMap.removeLayer(_rulerLine);  _rulerLine  = null; }
    if (_rulerPopup && _kmlMap) { _kmlMap.removeLayer(_rulerPopup); _rulerPopup = null; }
}

// ── Cetvel: aç/kapat ───────────────────────────────────────────────────────
function toggleKmlRuler() {
    _rulerActive = !_rulerActive;
    const btn = document.getElementById('kmlRulerBtn');
    if (btn) btn.classList.toggle('kml-map-ctrl-active', _rulerActive);
    if (_kmlMap) _kmlMap.getContainer().style.cursor = _rulerActive ? 'crosshair' : '';
    if (!_rulerActive) clearKmlRuler();
}

// Rozete tıklanınca çağrılır. Aynı moda tekrar tıklamak filtreyi kaldırır.
function setKmlModeFilter(mode) {
    if (_kmlActiveFilter === mode) mode = null;
    _kmlActiveFilter = mode;

    // Polyline görünürlüğü
    for (const [m, pls] of Object.entries(_kmlPolylinesByMode)) {
        const show = !mode || m === mode;
        pls.forEach(pl => pl.setStyle({
            opacity: show ? 0.9 : 0.12,
            weight:  show ? 3   : 1,
        }));
    }

    // Badge stilleri
    document.querySelectorAll('#kmlModeLegend .kml-leg-item').forEach(el => {
        const elMode = el.dataset.mode;
        if (elMode === '__all__') {
            el.classList.toggle('kml-leg-active', !mode);
        } else if (!mode) {
            el.classList.remove('kml-leg-active', 'kml-leg-dimmed');
        } else if (elMode === mode) {
            el.classList.add('kml-leg-active');
            el.classList.remove('kml-leg-dimmed');
        } else {
            el.classList.add('kml-leg-dimmed');
            el.classList.remove('kml-leg-active');
        }
    });
}

// ============================================================
//  INDIRME VE GOOGLE EARTH
// ============================================================

let _kmlBlob = null;
let _kmlFilename = 'vecihi-flight.kml';

function downloadKml() {
    if (!_kmlBlob) return;
    const url = URL.createObjectURL(_kmlBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = _kmlFilename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
}

function openInGoogleEarth() {
    // KML'i indir ve Google Earth Web'i aç
    downloadKml();
    setTimeout(() => window.open('https://earth.google.com/web/', '_blank'), 300);

    const hint = document.getElementById('kmlGEHint');
    if (hint) {
        hint.style.display = 'flex';
        setTimeout(() => { hint.style.display = 'none'; }, 9000);
    }
}

// ============================================================
//  DOSYA İŞLEME
// ============================================================

function processKmlFile(file) {
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showKmlError('Lütfen .csv uzantılı bir EdgeTX log dosyası seçin.');
        return;
    }

    const reader = new FileReader();
    reader.onload = e => {
        try {
            const records = parseEdgeTxCsv(e.target.result);
            const gpsRecs = records.filter(r => r._hasGps);

            if (!gpsRecs.length) {
                showKmlError('Bu log dosyasında GPS verisi bulunamadı. Uçuş sırasında GPS bağlantısı yoktu veya fix alınamadı.');
                return;
            }

            const kmlStr = generateKml(records, file.name);
            _kmlBlob     = new Blob([kmlStr], { type: 'application/vnd.google-earth.kml+xml' });
            _kmlFilename = file.name.replace(/\.csv$/i, '.kml');

            const stats = computeFlightStats(gpsRecs);
            renderKmlResult(gpsRecs, stats);

        } catch (err) {
            showKmlError('Hata: ' + err.message);
        }
    };
    reader.onerror = () => showKmlError('Dosya okunamadı.');
    reader.readAsText(file, 'UTF-8');
}

function showKmlError(msg) {
    const el = document.getElementById('kmlError');
    if (el) { el.textContent = msg; el.style.display = 'block'; }
    const res = document.getElementById('kmlResult');
    if (res) res.style.display = 'none';
}

function renderKmlResult(gpsRecs, stats) {
    document.getElementById('kmlError').style.display = 'none';

    // İstatistik kartları
    const dM = Math.floor(stats.durS / 60), dS = stats.durS % 60;
    document.getElementById('kmlStatDate').textContent  = stats.date + ' ' + stats.startTime;
    document.getElementById('kmlStatDur').textContent   = `${dM}dk ${dS}sn`;
    document.getElementById('kmlStatAlt').textContent   = stats.maxAlt.toFixed(0) + ' m';
    document.getElementById('kmlStatSpd').textContent   = stats.maxSpd.toFixed(0) + ' km/h';
    document.getElementById('kmlStatDist').textContent  = stats.distKm.toFixed(2) + ' km';
    document.getElementById('kmlStatGps').textContent   = stats.gpsCount;

    // Mod rozet filtresi — "Tümü" + her mod
    const legendEl = document.getElementById('kmlModeLegend');
    if (legendEl) {
        const allBadge = `<span class="kml-leg-item kml-leg-active" data-mode="__all__"
            onclick="setKmlModeFilter(null)" title="Tüm modları göster">
            <span class="kml-leg-dot" style="background:conic-gradient(#ff5555,#5555ff,#55ff55,#ff5555)"></span>Tümü</span>`;
        const modeBadges = stats.modes.map(m => {
            const s = kmlModeStyle(m);
            return `<span class="kml-leg-item" data-mode="${m}"
                onclick="setKmlModeFilter('${m}')" title="${m} modunu filtrele">
                <span class="kml-leg-dot" style="background:${s.css}"></span>${m}</span>`;
        }).join('');
        legendEl.innerHTML = allBadge + modeBadges;
    }

    // Drop zone'u gizle, boşalan alanı haritaya ekle
    const dropZone = document.getElementById('kmlDropZone');
    if (dropZone) {
        const dzH = Math.round(dropZone.getBoundingClientRect().height);
        dropZone.style.display = 'none';
        document.getElementById('kmlMapPreview').style.height = (480 + dzH) + 'px';
    }

    const res = document.getElementById('kmlResult');
    res.style.display = 'block';

    // Harita — div görünür olduktan sonra başlat
    setTimeout(() => renderKmlLeafletMap(gpsRecs), 120);
}

function resetKmlConverter() {
    _kmlBlob             = null;
    _kmlFilename         = 'vecihi-flight.kml';
    _kmlPolylinesByMode  = {};
    _kmlActiveFilter     = null;
    _rulerActive         = false;
    _rulerPoints         = [];
    _rulerMarkers        = [];
    _rulerLine           = null;
    _rulerPopup          = null;
    document.getElementById('kmlMapWrapper')?.classList.remove('kml-map-expanded');
    document.getElementById('kmlMapToolbar')?.remove();
    document.getElementById('kmlMapCloseBtn')?.remove();
    document.getElementById('kmlMapPreview').style.height = '';
    document.getElementById('kmlDropZone').style.display  = '';
    document.getElementById('kmlResult').style.display    = 'none';
    document.getElementById('kmlError').style.display     = 'none';
    document.getElementById('kmlGEHint').style.display    = 'none';
    document.getElementById('kmlFileInput').value         = '';
    if (_kmlMap) { _kmlMap.remove(); _kmlMap = null; }
}

// ============================================================
//  UI KURULUM
// ============================================================

function initKmlConverter() {
    const dropZone  = document.getElementById('kmlDropZone');
    const fileInput = document.getElementById('kmlFileInput');
    if (!dropZone || !fileInput) return;

    // Tıklama → dosya seç
    dropZone.addEventListener('click', e => {
        if (e.target !== fileInput) fileInput.click();
    });

    // Sürükle-bırak
    dropZone.addEventListener('dragover', e => {
        e.preventDefault();
        dropZone.classList.add('kml-drop-hover');
    });
    ['dragleave', 'dragend'].forEach(ev =>
        dropZone.addEventListener(ev, () => dropZone.classList.remove('kml-drop-hover'))
    );
    dropZone.addEventListener('drop', e => {
        e.preventDefault();
        dropZone.classList.remove('kml-drop-hover');
        processKmlFile(e.dataTransfer.files[0]);
    });

    fileInput.addEventListener('change', () => processKmlFile(fileInput.files[0]));

    document.getElementById('btnKmlDownload')?.addEventListener('click', downloadKml);
    document.getElementById('btnKmlGoogleEarth')?.addEventListener('click', openInGoogleEarth);
    document.getElementById('btnKmlReset')?.addEventListener('click', resetKmlConverter);

    // Esc → tam ekrandan çık
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') {
            const el = document.getElementById('kmlMapWrapper');
            if (el?.classList.contains('kml-map-expanded')) toggleKmlMapExpand();
        }
    });
}

document.addEventListener('DOMContentLoaded', initKmlConverter);
