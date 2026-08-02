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

const BB_SLOW_LEN    = 68;   // v1
const BB_SLOW_LEN_V2 = 70;   // v2: + c_despike
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
    'notch_reject', 'gyro_spike', 'accel_clip', 'log_drop', 'despike'
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
    // i18n — I18N.t() varsa onu kullan, yoksa yedek metne düş. Sayfa dili
    // değişince metinler yeniden çizilsin diye render() tekrar çağrılabilir.
    // ------------------------------------------------------------------
    _t(key, fallback) {
        if (typeof I18N !== 'undefined' && I18N && typeof I18N.t === 'function') {
            const v = I18N.t('blackbox.' + key);
            if (v && v !== 'blackbox.' + key) return v;
        }
        return fallback;
    },

    // "{n} kayıt" gibi yer tutuculari doldurur
    _fmt(key, fallback, vars) {
        let s = this._t(key, fallback);
        for (const k in vars) s = s.split('{' + k + '}').join(vars[k]);
        return s;
    },

    // ------------------------------------------------------------------
    // Seri satır yakalama. serial_communication.js -> processSingleLine()
    // içinden ÖNCE çağrılır; true dönerse satır konsola basılmaz (binlerce
    // heks satırı log ekranını boğmasın).
    // ------------------------------------------------------------------
    feedLine(line) {
        // Cihazin gercek ayarlari — anahtarlari buna gore konumlandir.
        if (!this.capturing && line.indexOf('"command":"bb_status"') >= 0) {
            this._applyStatusLine(line);
            return false;
        }
        // Silme yanıtı: cihaz gerçekten sildi mi, kaç KB kaldı. Satırı yutmuyoruz
        // (false döner) — normal durum işleyicisi de görsün.
        if (!this.capturing && line.indexOf('"command":"clear"') >= 0) {
            const m = line.match(/"used_kb"\s*:\s*(\d+)/);
            this._setStatus(this._fmt('erase_done', 'Silindi. Cihazda {n} KB kayıt kaldı.',
                                      { n: m ? m[1] : 0 }), 'success');
            return false;
        }
        if (line.indexOf('BEGIN BLACKBOX DUMP') >= 0) {
            this.capturing = true;
            this.hexParts = [];
            const m = line.match(/(\d+)\s*bytes/);
            this.expectedBytes = m ? parseInt(m[1], 10) : 0;
            this._setStatus(this._t('status_reading', 'Okunuyor...') +
                            ` (${this.expectedBytes} ${this._t('unit_bytes', 'bayt')})`, 'info');
            if (typeof log === 'function') {
                log('📼 ' + this._fmt('log_downloading', 'Blackbox indiriliyor: {n} bayt',
                                      { n: this.expectedBytes }), 'info');
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
                this._setStatus(this._t('status_reading', 'Okunuyor...') +
                                ` %${pct} (${got}/${this.expectedBytes} ${this._t('unit_bytes','bayt')})`,
                                'info');
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
        this._range = { from: 0, to: 1 };
        const rf = document.getElementById('bbRangeFrom');
        const rt = document.getElementById('bbRangeTo');
        if (rf) rf.value = 0;
        if (rt) rt.value = 1000;
        this.render();
        if (typeof log === 'function') {
            log('📼 ' + this._fmt('log_decoded',
                'Blackbox çözüldü: {slow} uçuş kaydı, {fast} filtre kaydı, {ev} olay',
                { slow: this.decoded.slow.length, fast: this.decoded.fast.length,
                  ev: this.decoded.events.length }), 'success');
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

            if (type === BB_REC_SLOW && (len === BB_SLOW_LEN || len === BB_SLOW_LEN_V2)) {
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
                    dv.getUint16(o + 64, true), dv.getUint16(o + 66, true),
                    // v2'de eklendi; eski (68 baytlik) kayitlarda alan yok -> 0
                    (len === BB_SLOW_LEN_V2) ? dv.getUint16(o + 68, true) : 0
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
        this._setStatus(this._t('status_sent', 'Komut gönderildi, cihaz yanıtı bekleniyor...'), 'info');
        sendCommand('dump');
    },

    eraseDevice() {
        if (!confirm(this._t('erase_confirm',
                'Cihazdaki TÜM uçuş kayıtları silinecek. Emin misiniz?\n\n' +
                'Not: silme birkaç saniye sürer ve YERDE yapılmalıdır.'))) return;
        if (typeof sendCommand === 'function') sendCommand('clear');
        // Ekranda duran eski kayıt artık cihazda yok — hemen temizle, yoksa
        // silinmiş bir kaydın sayıları ekranda kalıp yanıltıyor.
        this.reset();
        this._setStatus(this._t('erase_sent', 'Silme komutu gönderildi (birkaç saniye sürebilir)'),
                        'warning');
    },

    // Görüntülenen kaydı ve tüm panelleri boşalt
    reset() {
        this.capturing = false;
        this.hexParts  = [];
        this.raw       = null;
        this.decoded   = null;
        this._range    = { from: 0, to: 1 };

        for (const id in this._charts) {
            if (this._charts[id]) this._charts[id].destroy();
        }
        this._charts = {};

        const none = `<span class="text-muted small">${this._t('not_read', 'Henüz kayıt okunmadı.')}</span>`;
        const set = (id, html) => { const e = document.getElementById(id); if (e) e.innerHTML = html; };
        set('bbSummary',   none);
        set('bbWarnings',  none);
        set('bbSlowTable', `<div class="text-muted small p-2">${this._t('not_read', 'Henüz kayıt okunmadı.')}</div>`);
        set('bbFastTable', `<div class="text-muted small p-2">${this._t('not_read', 'Henüz kayıt okunmadı.')}</div>`);
        set('bbEventList', `<div class="text-muted small p-2">${this._t('not_read', 'Henüz kayıt okunmadı.')}</div>`);

        const dl = document.getElementById('bbDownloads');
        if (dl) dl.style.display = 'none';
        const area = document.getElementById('bbChartArea');
        if (area) area.style.display = 'none';
        const empty = document.getElementById('bbChartEmpty');
        if (empty) empty.style.display = 'block';
        const lbl = document.getElementById('bbRangeLabel');
        if (lbl) lbl.textContent = '';
    },

    // "bb_status" yanıtındaki değerleri arayüze uygular
    _applyStatusLine(line) {
        const en   = /"enabled"\s*:\s*true/.test(line);
        const fast = /"fast"\s*:\s*true/.test(line);
        const dm   = line.match(/"divider"\s*:\s*(\d+)/);
        const um   = line.match(/"used_kb"\s*:\s*(\d+)/);
        const tm   = line.match(/"total_kb"\s*:\s*(\d+)/);

        const cb = document.getElementById('bbEnabled');
        if (cb) cb.checked = en;

        const div = fast ? (dm ? parseInt(dm[1], 10) : 1) : 0;
        const sel = document.getElementById('bbFastDiv');
        if (sel && [...sel.options].some(o => parseInt(o.value, 10) === div)) {
            sel.value = String(div);
        }
        const st = document.getElementById('bbFastStatus');
        if (st) {
            st.textContent = div > 0
                ? this._fmt('fast_on', 'Açık — her {n}. tur. Ayar karta kaydedildi, USB çekilince de korunur.', { n: div })
                : this._t('fast_off_msg', 'Kapalı. Ayar karta kaydedildi.');
            st.className = 'small mt-2 ' + (div > 0 ? 'text-info' : 'text-muted');
        }

        if (um && tm) {
            this._setStatus(this._fmt('status_device', 'Cihazda {u} / {t} KB dolu.',
                                      { u: um[1], t: tm[1] }), en ? 'info' : 'warning');
        }
    },

    // Ana anahtar. Firmware: "bb_enable <0|1>"
    applyEnabled() {
        const cb = document.getElementById('bbEnabled');
        if (!cb || typeof sendCommand !== 'function') return;
        sendCommand('bb_enable ' + (cb.checked ? 1 : 0));
        this._setStatus(cb.checked
            ? this._t('enable_on',  'Uçuş kaydı açıldı. Ayar karta kaydedildi.')
            : this._t('enable_off', 'Uçuş kaydı kapatıldı — uçuşta hiçbir şey yazılmayacak.'),
            cb.checked ? 'success' : 'warning');
    },

    // Cihazın gerçek ayarlarını sor (sayfa açılışında)
    requestStatus() {
        if (typeof sendCommand === 'function') sendCommand('bb_status');
    },

    // FAST (filtre ayarı) kaydını aç/kapat. Firmware: "bb_fast <bolen>"
    applyFast() {
        const sel = document.getElementById('bbFastDiv');
        if (!sel || typeof sendCommand !== 'function') return;
        const div = parseInt(sel.value, 10) || 0;
        sendCommand('bb_fast ' + div);
        const el = document.getElementById('bbFastStatus');
        if (el) {
            el.textContent = div > 0
                ? this._fmt('fast_on', 'Açık — her {n}. tur. Ayar karta kaydedildi, USB çekilince de korunur.', { n: div })
                : this._t('fast_off_msg', 'Kapalı. Ayar karta kaydedildi.');
            el.className = 'small mt-2 ' + (div > 0 ? 'text-info' : 'text-muted');
        }
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
        rows.push([this._t('sum_raw', 'Ham veri'),
                   `${this.raw.length} ${this._t('unit_bytes', 'bayt')}`]);
        rows.push([this._t('sum_sessions', 'Oturum'), `${d.sessions.length}`]);
        rows.push([this._t('sum_slow', 'Uçuş kaydı (10 Hz)'), `${d.slow.length}`]);
        rows.push([this._t('sum_fast', 'Filtre kaydı (tam hız)'), `${d.fast.length}`]);
        rows.push([this._t('sum_events', 'Olay'), `${d.events.length}`]);
        if (d.slow.length > 1) {
            const dur = (d.slow[d.slow.length - 1][0] - d.slow[0][0]) / 1000;
            rows.push([this._t('sum_duration', 'Kayıt süresi'),
                       `${(dur / 60).toFixed(1)} ${this._t('unit_min', 'dakika')}`]);
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

            if (drops) warns.push(['warning', this._fmt('warn_drop',
                "{n} kayıt RAM tamponu dolu olduğu için düşürüldü — log'da boşluk var.",
                { n: drops })]);
            if (notch) warns.push(['danger', this._fmt('warn_notch',
                'Notch filtresi {n} bozuk örnek üretti — döngü periyodu aşırı titriyor. ' +
                'Filtre ayarı bu uçuşta güvenilmez.', { n: notch })]);
            if (spike) warns.push(['warning', this._fmt('warn_spike',
                '{n} gyro darbesi reddedildi.', { n: spike })]);
            if (clip)  warns.push(['warning', this._fmt('warn_clip',
                '{n} ivmeölçer doyması (titreşim/darbe).', { n: clip })]);

            const jitterPct = (dtMin && dtMax) ? Math.round((dtMax - dtMin) * 100 / dtMin) : 0;
            const lvl = jitterPct > 30 ? 'danger' : (jitterPct > 20 ? 'warning' : 'success');
            warns.push([lvl, this._fmt('warn_jitter',
                'Döngü periyodu {min}-{max} µs (±%{pct} titreme). ' +
                '%30 üstü notch filtresini bozabilir.',
                { min: dtMin, max: dtMax, pct: jitterPct })]);
        }
        if (d.bad) warns.push(['warning', this._fmt('warn_bad',
            '{n} çözülemeyen bayt — kayıt aniden kesilmiş olabilir (kaza/güç kaybı).',
            { n: d.bad })]);

        if (warnEl) {
            warnEl.innerHTML = warns.length
                ? warns.map(w => `<div class="alert alert-${w[0]} py-2 px-3 mb-2 small">${w[1]}</div>`).join('')
                : `<div class="text-muted small">${this._t('health_clean', 'Kayıt temiz görünüyor.')}</div>`;
        }

        if (btnBox) btnBox.style.display = this.raw && this.raw.length ? 'block' : 'none';

        // Son oturumun FAST böleni: O KAYITTA ne olduğunu söyler. Seçim kutusuna
        // dokunmuyoruz — o, cihazın ŞU ANKİ ayarını gösterir (bb_status).
        if (d.sessions.length) {
            const div = d.sessions[d.sessions.length - 1].fast_div;
            const st = document.getElementById('bbFastStatus');
            if (st) {
                st.textContent = div > 0
                    ? this._fmt('fast_was_on', 'Bu kayıtta açıktı — her {n}. tur.', { n: div })
                    : this._t('fast_was_off', 'Bu kayıtta kapalıydı.');
                st.className = 'small mt-2 ' + (div > 0 ? 'text-info' : 'text-muted');
            }
        }

        this._renderCharts();
        this._renderTable('bbSlowTable', BB_SLOW_COLS, d.slow, 200);
        this._renderTable('bbFastTable', BB_FAST_COLS, d.fast, 200);
        this._renderEvents(d.events);

        this._setStatus(this._fmt('status_summary',
            'Hazır — {slow} uçuş kaydı, {fast} filtre kaydı',
            { slow: d.slow.length, fast: d.fast.length }), 'success');
    },

    // ------------------------------------------------------------------
    // Grafikler (Chart.js)
    // ------------------------------------------------------------------
    _charts: {},
    _range: { from: 0, to: 1 },   // gösterilen zaman aralığı (0..1 oran)

    onRangeChange() {
        const a = document.getElementById('bbRangeFrom');
        const b = document.getElementById('bbRangeTo');
        if (!a || !b) return;
        let f = parseInt(a.value, 10) / 1000;
        let t = parseInt(b.value, 10) / 1000;
        if (f > t) { const tmp = f; f = t; t = tmp; }   // kollar çaprazlanırsa düzelt
        if (t - f < 0.005) t = Math.min(1, f + 0.005); // en az %0.5'lik pencere
        this._range = { from: f, to: t };
        this._renderCharts();
    },

    resetRange() {
        const a = document.getElementById('bbRangeFrom');
        const b = document.getElementById('bbRangeTo');
        if (a) a.value = 0;
        if (b) b.value = 1000;
        this._range = { from: 0, to: 1 };
        this._renderCharts();
    },

    // Kayıtları seçili zaman aralığına göre keser
    _slice(rows) {
        if (!rows.length) return rows;
        const t0 = rows[0][0], t1 = rows[rows.length - 1][0];
        const span = t1 - t0;
        if (span <= 0) return rows;
        const a = t0 + span * this._range.from;
        const b = t0 + span * this._range.to;
        return rows.filter(r => r[0] >= a && r[0] <= b);
    },

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
                // Chart.js responsive + maintainAspectRatio:false, yüksekliği
                // belirsiz bir ebeveynde SONSUZ yeniden boyutlanma döngüsüne
                // girer: canvas ebeveyni büyütür, ebeveyn canvas'ı büyütür...
                // Grafik canlı veri geliyormuş gibi sürekli oynar. Ebeveyne
                // HTML'de sabit yükseklik verildi; animasyon ve resize
                // gecikmesi de kapatıldı ki tek seferde çizilsin.
                animation: false,
                animations: false,
                transitions: { active: { animation: { duration: 0 } } },
                responsiveAnimationDuration: 0,
                resizeDelay: 0,
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

        const Sall = this._slice(d.slow);
        if (!Sall.length) return;
        const S = this._thin(Sall, 900);
        const t0 = S[0][0];
        const lab = S.map(r => ((r[0] - t0) / 1000).toFixed(1));
        const ds = (label, idx, color) => ({
            label: label, data: S.map(r => r[idx]),
            borderColor: color, backgroundColor: color, fill: false
        });

        this._line('bbChartAtt', lab, [
            ds(this._t('ds_roll', 'roll'), 1, '#4dabf7'),
            ds(this._t('ds_pitch', 'pitch'), 2, '#ffa94d')
        ]);

        this._line('bbChartAlt', lab, [
            Object.assign(ds(this._t('ds_alt', 'irtifa (m)'), 12, '#69db7c'), { yAxisID: 'y' }),
            Object.assign(ds(this._t('ds_gspd', 'yer hızı (m/s)'), 13, '#da77f2'), { yAxisID: 'y1' })
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
            ds(this._t('ds_gx', 'gyro X'), 4, '#4dabf7'),
            ds(this._t('ds_gy', 'gyro Y'), 5, '#ffa94d'),
            ds(this._t('ds_gz', 'gyro Z'), 6, '#69db7c')
        ]);

        this._line('bbChartDt', lab, [
            ds(this._t('ds_min', 'min'), 29, '#69db7c'),
            ds(this._t('ds_avg', 'ort'), 30, '#adb5bd'),
            ds(this._t('ds_max', 'max'), 31, '#ff6b6b')
        ]);

        this._line('bbChartErr', lab, [
            ds(this._t('ds_notch', 'notch red'), 32, '#ff6b6b'),
            ds(this._t('ds_spike', 'gyro darbe'), 33, '#ffa94d'),
            ds(this._t('ds_clip', 'accel doyma'), 34, '#ffd43b'),
            ds(this._t('ds_drop', 'düşen kayıt'), 35, '#868e96')
        ]);

        // Aralık etiketi: yüzde değil, gerçek saniye aralığını göster
        const lblEl = document.getElementById('bbRangeLabel');
        if (lblEl && d.slow.length) {
            const base = d.slow[0][0];
            const a = ((S[0][0] - base) / 1000).toFixed(1);
            const b = ((S[S.length - 1][0] - base) / 1000).toFixed(1);
            lblEl.textContent = `${a} – ${b} s (${S.length}/${d.slow.length})`;
        }

        // Filtre zinciri — yalnızca FAST kaydı varsa
        const fbox = document.getElementById('bbChartFilterBox');
        if (d.fast.length) {
            if (fbox) fbox.style.display = 'block';
            const Fall = this._slice(d.fast);
            const F = this._thin(Fall.length ? Fall : d.fast, 1500);
            const f0 = F[0][0];
            const flab = F.map(r => ((r[0] - f0) / 1000).toFixed(2));
            this._line('bbChartFilter', flab, [
                { label: this._t('ds_raw', 'ham'), data: F.map(r => r[1]),
                  borderColor: '#868e96', fill: false },
                { label: this._t('ds_after_notch', 'notch sonrası'), data: F.map(r => r[4]),
                  borderColor: '#ffa94d', fill: false },
                { label: this._t('ds_after_lpf', 'LPF sonrası (PID)'), data: F.map(r => r[7]),
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
            el.innerHTML = `<div class="text-muted small p-2">${this._t('no_records', 'Bu tipte kayıt yok.')}</div>`;
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
            h += `<div class="text-muted small p-2">${this._fmt('table_limit',
                  'İlk {n} satır gösteriliyor (toplam {total}). Tamamı için CSV indir.',
                  { n: limit, total: rows.length })}</div>`;
        }
        el.innerHTML = h;
    },

    _renderEvents(events) {
        const el = document.getElementById('bbEventList');
        if (!el) return;
        if (!events.length) {
            el.innerHTML = `<div class="text-muted small">${this._t('no_events', 'Olay kaydı yok.')}</div>`;
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
        if (typeof log === 'function') {
            log('📥 ' + this._fmt('log_saved', 'İndirildi: {name}', { name: name }), 'success');
        }
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
    // Anahtarları cihazın gerçek ayarına göre konumlandır — HTML'deki varsayılan
    // kalırsa kullanıcı kaydın açık olduğunu sanıp uçabilir.
    Blackbox.requestStatus();
    // Kayıt zaten okunmuşsa dil değişmiş olabilir — yeniden çiz.
    if (Blackbox.decoded) { Blackbox.render(); return; }
    Blackbox._setStatus(
        Blackbox._t('status_ready', 'Hazır. "Logu Oku" ile cihazdan kaydı çekin.'), 'info');
}
