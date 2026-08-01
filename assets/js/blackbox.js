// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.
//
// ============================================================================
// BLACKBOX — uçuş kaydını cihazdan çek, çöz, göster, indir
// ============================================================================
// Firmware 'dump' komutuna heksadesimal satırlarla yanıt verir:
//     --- BEGIN BLACKBOX DUMP v1 <N> bytes ---
//     A502440000...
//     ...
//     --- END BLACKBOX DUMP ---
//
// Kayıt çerçevesi (vecihi/src/logger.h ile BİREBİR aynı olmalı):
//     [0xA5][type][len][gövde]
// Koordinatlar HAM int32 (1e-7 derece) saklanır, burada dereceye çevrilir.
// ============================================================================

const BB_SYNC = 0xA5;
const BB_REC_SESSION = 0x01;
const BB_REC_SLOW    = 0x02;
const BB_REC_FAST     = 0x03;
const BB_REC_EVENT    = 0x04;

const BB_SLOW_LEN = 68;
const BB_FAST_LEN = 30;
const BB_SESSION_LEN = 12;

// src/flight_modes.h — enum sırası birebir aynı olmalı
const BB_MODE_NAMES = [
    'MANUAL', 'ANGLE', 'HORIZON', 'ACRO', 'RTH', 'LAUNCH', 'FAILSAFE',
    'CRUISE', 'ALTHOLD', 'LOITER', 'AUTOTUNE', 'WAYPOINT', 'LAND_ASSIST', 'GCS'
];

const BB_SLOW_COLS = [
    't_ms', 'roll_deg', 'pitch_deg', 'yaw_deg',
    'gyro_x_dps', 'gyro_y_dps', 'gyro_z_dps',
    'acc_x_g', 'acc_y_g', 'acc_z_g',
    'lat', 'lon', 'alt_m', 'gspd_ms', 'cog_deg',
    'wind_ms', 'wind_dir_deg',
    'sats', 'gps_fix3d', 'gps_safe', 'mode', 'mode_adi', 'armed', 'flying',
    'throttle_us', 'servo1_us', 'servo2_us', 'servo3_us', 'servo4_us',
    'dt_min_us', 'dt_avg_us', 'dt_max_us',
    'notch_reject', 'gyro_spike', 'accel_clip', 'log_drop'
];

const BB_FAST_COLS = [
    't_ms',
    'raw_gx', 'raw_gy', 'raw_gz',
    'notch_gx', 'notch_gy', 'notch_gz',
    'lpf_gx', 'lpf_gy', 'lpf_gz',
    'acc_x_g', 'acc_y_g', 'acc_z_g',
    'throttle_us'
];

const Blackbox = {
    capturing: false,
    hexParts: [],
    expectedBytes: 0,
    raw: null,        // Uint8Array
    decoded: null,    // { slow, fast, events, sessions, bad }

    // ------------------------------------------------------------------
    // Seri satır yakalama. serial_communication.js -> processSingleLine()
    // içinden ÖNCE çağrılır; true dönerse satır konsola basılmaz (binlerce
    // heks satırı log ekranını boğmasın).
    // ------------------------------------------------------------------
    feedLine(line) {
        if (line.indexOf('BEGIN BLACKBOX DUMP') >= 0) {
            this.capturing = true;
            this.hexParts = [];
            const m = line.match(/(\d+)\s*bytes/);
            this.expectedBytes = m ? parseInt(m[1], 10) : 0;
            this._setStatus(`Okunuyor... (${this.expectedBytes} bayt)`, 'info');
            if (typeof log === 'function') {
                log(`📼 Blackbox indiriliyor: ${this.expectedBytes} bayt`, 'info');
            }
            return true;
        }
        if (!this.capturing) return false;

        if (line.indexOf('END BLACKBOX DUMP') >= 0) {
            this.capturing = false;
            this._finish();
            return true;
        }
        if (/^[0-9A-Fa-f]+$/.test(line) && (line.length % 2) === 0) {
            this.hexParts.push(line);
            // Her 64 satırda bir ilerleme göster (~16 KB)
            if ((this.hexParts.length & 63) === 0) {
                const got = this.hexParts.reduce((a, s) => a + s.length / 2, 0);
                const pct = this.expectedBytes ? Math.round(got * 100 / this.expectedBytes) : 0;
                this._setStatus(`Okunuyor... %${pct} (${got}/${this.expectedBytes} bayt)`, 'info');
            }
            return true;
        }
        // Yakalama sırasında beklenmedik satır: cihaz mesajı olabilir, geçir.
        return false;
    },

    _finish() {
        const hex = this.hexParts.join('');
        const bytes = new Uint8Array(hex.length / 2);
        for (let i = 0; i < bytes.length; i++) {
            bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
        }
        this.raw = bytes;
        this.decoded = this.decode(bytes);
        this.render();
        if (typeof log === 'function') {
            log(`📼 Blackbox çözüldü: ${this.decoded.slow.length} uçuş kaydı, ` +
                `${this.decoded.fast.length} filtre kaydı, ${this.decoded.events.length} olay`, 'success');
        }
    },

    // ------------------------------------------------------------------
    // Çözücü
    // ------------------------------------------------------------------
    decode(bytes) {
        const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const slow = [], fast = [], events = [], sessions = [];
        let bad = 0, i = 0;
        const n = bytes.length;

        while (i + 3 <= n) {
            if (bytes[i] !== BB_SYNC) {
                // 0xFF = silinmiş flash dolgusu (kaydın sonu). Başka bir şeyse
                // çerçeve kaymış demektir.
                if (bytes[i] !== 0xFF) bad++;
                i++;
                continue;
            }
            const type = bytes[i + 1];
            const len  = bytes[i + 2];
            const o    = i + 3;
            if (o + len > n) break;   // yarım kayıt: kayıt aniden kesilmiş

            if (type === BB_REC_SLOW && len === BB_SLOW_LEN) {
                const gpsF = bytes[o + 41], stF = bytes[o + 43], mode = bytes[o + 42];
                slow.push([
                    dv.getUint32(o, true),
                    dv.getInt16(o + 4, true) / 100, dv.getInt16(o + 6, true) / 100,
                    dv.getInt16(o + 8, true) / 100,
                    dv.getInt16(o + 10, true) / 10, dv.getInt16(o + 12, true) / 10,
                    dv.getInt16(o + 14, true) / 10,
                    dv.getInt16(o + 16, true) / 1000, dv.getInt16(o + 18, true) / 1000,
                    dv.getInt16(o + 20, true) / 1000,
                    dv.getInt32(o + 22, true) / 1e7, dv.getInt32(o + 26, true) / 1e7,
                    dv.getInt16(o + 30, true) / 10,
                    dv.getUint16(o + 32, true) / 100, dv.getUint16(o + 34, true) / 100,
                    dv.getUint16(o + 36, true) / 100, dv.getUint16(o + 38, true) / 100,
                    bytes[o + 40],
                    (gpsF & 1) ? 1 : 0, (gpsF & 2) ? 1 : 0,
                    mode, BB_MODE_NAMES[mode] || ('?' + mode),
                    (stF & 1) ? 1 : 0, (stF & 2) ? 1 : 0,
                    dv.getUint16(o + 44, true),
                    dv.getUint16(o + 46, true), dv.getUint16(o + 48, true),
                    dv.getUint16(o + 50, true), dv.getUint16(o + 52, true),
                    dv.getUint16(o + 54, true), dv.getUint16(o + 56, true),
                    dv.getUint16(o + 58, true),
                    dv.getUint16(o + 60, true), dv.getUint16(o + 62, true),
                    dv.getUint16(o + 64, true), dv.getUint16(o + 66, true)
                ]);
            } else if (type === BB_REC_FAST && len === BB_FAST_LEN) {
                fast.push([
                    dv.getUint32(o, true),
                    dv.getInt16(o + 4, true) / 10, dv.getInt16(o + 6, true) / 10,
                    dv.getInt16(o + 8, true) / 10,
                    dv.getInt16(o + 10, true) / 10, dv.getInt16(o + 12, true) / 10,
                    dv.getInt16(o + 14, true) / 10,
                    dv.getInt16(o + 16, true) / 10, dv.getInt16(o + 18, true) / 10,
                    dv.getInt16(o + 20, true) / 10,
                    dv.getInt16(o + 22, true) / 1000, dv.getInt16(o + 24, true) / 1000,
                    dv.getInt16(o + 26, true) / 1000,
                    dv.getUint16(o + 28, true)
                ]);
            } else if (type === BB_REC_EVENT && len >= 4) {
                let txt = '';
                for (let k = 4; k < len; k++) txt += String.fromCharCode(bytes[o + k]);
                events.push([dv.getUint32(o, true), txt]);
            } else if (type === BB_REC_SESSION && len === BB_SESSION_LEN) {
                sessions.push({
                    t_ms: dv.getUint32(o, true),
                    version: dv.getUint16(o + 4, true),
                    slow_hz: dv.getUint16(o + 6, true),
                    fast_div: dv.getUint16(o + 8, true)
                });
            } else {
                bad++;
            }
            i = o + len;
        }
        return { slow, fast, events, sessions, bad };
    },

    // ------------------------------------------------------------------
    // Komutlar
    // ------------------------------------------------------------------
    request() {
        if (typeof sendCommand !== 'function') return;
        this.capturing = false;
        this.hexParts = [];
        this._setStatus('Komut gönderildi, cihaz yanıtı bekleniyor...', 'info');
        sendCommand('dump');
    },

    eraseDevice() {
        if (!confirm('Cihazdaki TÜM uçuş kayıtları silinecek. Emin misiniz?\n\n' +
                     'Not: silme birkaç saniye sürer ve YERDE yapılmalıdır.')) return;
        if (typeof sendCommand === 'function') sendCommand('clear');
        this._setStatus('Silme komutu gönderildi (birkaç saniye sürebilir)', 'warning');
    },

    // ------------------------------------------------------------------
    // Görüntüleme
    // ------------------------------------------------------------------
    _setStatus(text, kind) {
        const el = document.getElementById('bbStatus');
        if (!el) return;
        const cls = { info: 'text-info', success: 'text-success',
                      warning: 'text-warning', error: 'text-danger' }[kind] || 'text-muted';
        el.className = 'small ' + cls;
        el.textContent = text;
    },

    render() {
        const d = this.decoded;
        if (!d) return;

        const sumEl = document.getElementById('bbSummary');
        const warnEl = document.getElementById('bbWarnings');
        const btnBox = document.getElementById('bbDownloads');

        // --- Özet ---
        const rows = [];
        rows.push(['Ham veri', `${this.raw.length} bayt`]);
        rows.push(['Oturum', `${d.sessions.length}`]);
        rows.push(['Uçuş kaydı (10 Hz)', `${d.slow.length}`]);
        rows.push(['Filtre kaydı (tam hız)', `${d.fast.length}`]);
        rows.push(['Olay', `${d.events.length}`]);
        if (d.slow.length > 1) {
            const dur = (d.slow[d.slow.length - 1][0] - d.slow[0][0]) / 1000;
            rows.push(['Kayıt süresi', `${(dur / 60).toFixed(1)} dakika`]);
        }
        if (sumEl) {
            sumEl.innerHTML = rows.map(r =>
                `<div class="d-flex justify-content-between border-bottom border-secondary py-1">
                   <span class="text-muted">${r[0]}</span><span class="fw-semibold">${r[1]}</span>
                 </div>`).join('');
        }

        // --- Uyarılar: analiz sırasında ilk bakılacak şeyler ---
        const warns = [];
        if (d.slow.length) {
            const drops = d.slow.reduce((a, r) => a + r[35], 0);
            const notch = d.slow.reduce((a, r) => a + r[32], 0);
            const spike = d.slow.reduce((a, r) => a + r[33], 0);
            const clip  = d.slow.reduce((a, r) => a + r[34], 0);
            const dtMax = Math.max.apply(null, d.slow.map(r => r[31]));
            const dtMin = Math.min.apply(null, d.slow.map(r => r[29]).filter(v => v > 0));

            if (drops) warns.push(['warning',
                `${drops} kayıt RAM tamponu dolu olduğu için düşürüldü — log'da boşluk var.`]);
            if (notch) warns.push(['danger',
                `Notch filtresi ${notch} bozuk örnek üretti — döngü periyodu aşırı titriyor. ` +
                `Filtre ayarı bu uçuşta güvenilmez.`]);
            if (spike) warns.push(['warning', `${spike} gyro darbesi reddedildi.`]);
            if (clip)  warns.push(['warning', `${clip} ivmeölçer doyması (titreşim/darbe).`]);

            const jitterPct = (dtMin && dtMax) ? Math.round((dtMax - dtMin) * 100 / dtMin) : 0;
            const lvl = jitterPct > 30 ? 'danger' : (jitterPct > 20 ? 'warning' : 'success');
            warns.push([lvl,
                `Döngü periyodu ${dtMin}-${dtMax} µs (±%${jitterPct} titreme). ` +
                `%30 üstü notch filtresini bozabilir.`]);
        }
        if (d.bad) warns.push(['warning',
            `${d.bad} çözülemeyen bayt — kayıt aniden kesilmiş olabilir (kaza/güç kaybı).`]);

        if (warnEl) {
            warnEl.innerHTML = warns.length
                ? warns.map(w => `<div class="alert alert-${w[0]} py-2 px-3 mb-2 small">${w[1]}</div>`).join('')
                : '<div class="text-muted small">Kayıt temiz görünüyor.</div>';
        }

        if (btnBox) btnBox.style.display = this.raw && this.raw.length ? 'block' : 'none';

        this._renderCharts();
        this._renderTable('bbSlowTable', BB_SLOW_COLS, d.slow, 200);
        this._renderTable('bbFastTable', BB_FAST_COLS, d.fast, 200);
        this._renderEvents(d.events);

        this._setStatus(
            `Hazır — ${d.slow.length} uçuş kaydı, ${d.fast.length} filtre kaydı`, 'success');
    },

    // ------------------------------------------------------------------
    // Grafikler (Chart.js)
    // ------------------------------------------------------------------
    _charts: {},

    // Uzun kayıtta her noktayı çizmek tarayıcıyı kilitler; eşit aralıkla seyrelt.
    _thin(rows, maxPoints) {
        if (rows.length <= maxPoints) return rows;
        const step = rows.length / maxPoints;
        const out = [];
        for (let i = 0; i < maxPoints; i++) out.push(rows[Math.floor(i * step)]);
        return out;
    },

    _line(canvasId, labels, datasets, opts) {
        const el = document.getElementById(canvasId);
        if (!el || typeof Chart === 'undefined') return;
        if (this._charts[canvasId]) this._charts[canvasId].destroy();
        this._charts[canvasId] = new Chart(el.getContext('2d'), {
            type: 'line',
            data: { labels: labels, datasets: datasets },
            options: Object.assign({
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                interaction: { mode: 'index', intersect: false },
                elements: { point: { radius: 0 }, line: { borderWidth: 1.4, tension: 0.15 } },
                plugins: { legend: { labels: { boxWidth: 12, font: { size: 10 } } } },
                scales: {
                    x: { ticks: { maxTicksLimit: 12, font: { size: 9 } },
                         grid: { color: 'rgba(255,255,255,0.06)' } },
                    y: { ticks: { font: { size: 9 } },
                         grid: { color: 'rgba(255,255,255,0.06)' } }
                }
            }, opts || {})
        });
    },

    _renderCharts() {
        const d = this.decoded;
        const empty = document.getElementById('bbChartEmpty');
        const area  = document.getElementById('bbChartArea');
        if (!d || !d.slow.length) {
            if (empty) empty.style.display = 'block';
            if (area) area.style.display = 'none';
            return;
        }
        if (empty) empty.style.display = 'none';
        if (area)  area.style.display = 'block';

        const S = this._thin(d.slow, 900);
        const t0 = S[0][0];
        const lab = S.map(r => ((r[0] - t0) / 1000).toFixed(1));
        const ds = (label, idx, color) => ({
            label: label, data: S.map(r => r[idx]),
            borderColor: color, backgroundColor: color, fill: false
        });

        this._line('bbChartAtt', lab, [
            ds('roll', 1, '#4dabf7'), ds('pitch', 2, '#ffa94d')
        ]);

        this._line('bbChartAlt', lab, [
            Object.assign(ds('irtifa (m)', 12, '#69db7c'), { yAxisID: 'y' }),
            Object.assign(ds('yer hızı (m/s)', 13, '#da77f2'), { yAxisID: 'y1' })
        ], {
            scales: {
                x: { ticks: { maxTicksLimit: 12, font: { size: 9 } },
                     grid: { color: 'rgba(255,255,255,0.06)' } },
                y:  { position: 'left',  ticks: { font: { size: 9 } } },
                y1: { position: 'right', ticks: { font: { size: 9 } },
                      grid: { drawOnChartArea: false } }
            }
        });

        this._line('bbChartGyro', lab, [
            ds('gyro X', 4, '#4dabf7'), ds('gyro Y', 5, '#ffa94d'), ds('gyro Z', 6, '#69db7c')
        ]);

        this._line('bbChartDt', lab, [
            ds('min', 29, '#69db7c'), ds('ort', 30, '#adb5bd'), ds('max', 31, '#ff6b6b')
        ]);

        this._line('bbChartErr', lab, [
            ds('notch red', 32, '#ff6b6b'), ds('gyro darbe', 33, '#ffa94d'),
            ds('accel doyma', 34, '#ffd43b'), ds('düşen kayıt', 35, '#868e96')
        ]);

        // Filtre zinciri — yalnızca FAST kaydı varsa
        const fbox = document.getElementById('bbChartFilterBox');
        if (d.fast.length) {
            if (fbox) fbox.style.display = 'block';
            const F = this._thin(d.fast, 1500);
            const f0 = F[0][0];
            const flab = F.map(r => ((r[0] - f0) / 1000).toFixed(2));
            this._line('bbChartFilter', flab, [
                { label: 'ham', data: F.map(r => r[1]),
                  borderColor: '#868e96', fill: false },
                { label: 'notch sonrası', data: F.map(r => r[4]),
                  borderColor: '#ffa94d', fill: false },
                { label: 'LPF sonrası (PID)', data: F.map(r => r[7]),
                  borderColor: '#4dabf7', fill: false }
            ]);
        } else if (fbox) {
            fbox.style.display = 'none';
        }
    },

    _renderTable(id, cols, rows, limit) {
        const el = document.getElementById(id);
        if (!el) return;
        if (!rows.length) {
            el.innerHTML = '<div class="text-muted small p-2">Bu tipte kayıt yok.</div>';
            return;
        }
        const shown = rows.slice(0, limit);
        let h = '<table class="table table-sm table-dark table-striped mb-0" style="font-size:11px">';
        h += '<thead><tr>' + cols.map(c => `<th>${c}</th>`).join('') + '</tr></thead><tbody>';
        for (const r of shown) {
            h += '<tr>' + r.map(v => `<td>${typeof v === 'number' && !Number.isInteger(v)
                                            ? v.toFixed(3) : v}</td>`).join('') + '</tr>';
        }
        h += '</tbody></table>';
        if (rows.length > limit) {
            h += `<div class="text-muted small p-2">İlk ${limit} satır gösteriliyor
                  (toplam ${rows.length}). Tamamı için CSV indir.</div>`;
        }
        el.innerHTML = h;
    },

    _renderEvents(events) {
        const el = document.getElementById('bbEventList');
        if (!el) return;
        if (!events.length) {
            el.innerHTML = '<div class="text-muted small">Olay kaydı yok.</div>';
            return;
        }
        el.innerHTML = events.map(e =>
            `<div class="d-flex gap-3 border-bottom border-secondary py-1 small">
               <span class="text-info" style="min-width:90px">${(e[0] / 1000).toFixed(1)} s</span>
               <span>${e[1]}</span>
             </div>`).join('');
    },

    // ------------------------------------------------------------------
    // İndirme — yapay zekâ ile filtre ayarı için ham CSV
    // ------------------------------------------------------------------
    _toCsv(cols, rows) {
        const lines = [cols.join(',')];
        for (const r of rows) lines.push(r.join(','));
        return lines.join('\n');
    },

    _download(name, content, mime) {
        const blob = (content instanceof Uint8Array)
            ? new Blob([content], { type: mime })
            : new Blob([content], { type: mime });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        const ts = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        a.href = url;
        a.download = `vecihi-blackbox-${ts}-${name}`;
        a.click();
        URL.revokeObjectURL(url);
        if (typeof log === 'function') log(`📥 İndirildi: ${name}`, 'success');
    },

    downloadSlow() {
        if (!this.decoded) return;
        this._download('ucus.csv', this._toCsv(BB_SLOW_COLS, this.decoded.slow), 'text/csv');
    },
    downloadFast() {
        if (!this.decoded) return;
        this._download('filtre.csv', this._toCsv(BB_FAST_COLS, this.decoded.fast), 'text/csv');
    },
    downloadEvents() {
        if (!this.decoded) return;
        this._download('olaylar.csv',
            this._toCsv(['t_ms', 'mesaj'], this.decoded.events), 'text/csv');
    },
    downloadRaw() {
        if (!this.raw) return;
        this._download('ham.bin', this.raw, 'application/octet-stream');
    }
};

// Sayfa açıldığında çağrılır (page_management.js)
function initBlackboxPage() {
    Blackbox._setStatus('Hazır. "Logu Oku" ile cihazdan kaydı çekin.', 'info');
}
