/**
 * parameters.js — Parametreler sayfası (ArduPilot tarzı tam parametre listesi)
 *
 * Akış:
 *   sayfa açılır → sendCommand('param_list')
 *   firmware 10'arlık parçalar halinde {"param_list":{...}} gönderir
 *   handleParamListChunk() parçaları biriktirir, hepsi gelince tablo çizilir
 *   satırdaki KAYDET → {"command":"PARAM_SET","name":"...","value":...}
 *   firmware yazdığı (gerekirse kırpılmış) değeri geri bildirir → kutu düzeltilir
 *
 * Açıklamalar param_meta.js'ten (TR/EN) gelir; varsayılan ve aralık bilgisi
 * firmware'den gelen gerçek değerlerden üretilir.
 */

/**
 * @brief Güvenli log — log() sayfanın başka bir yerinde hata verirse
 *        parametre tablosunun çizimi buna takılıp durmasın.
 */
function plog(msg, type) {
    try {
        if (typeof log === 'function') log(msg, type);
    } catch (e) { /* yut */ }
}

const PARAM_TYPE_NAMES = ['float', 'int', 'uint16', 'uint8', 'int8', 'bool'];

let paramList = [];            // [{n, v, t, g, mn, mx, d}]
let paramChunks = {};          // biriken parçalar
let paramExpectedChunks = -1;
let paramFilterText = '';
let paramFilterGroup = 'all';
let paramShowChangedOnly = false;
let paramPendingSave = new Set();

/**
 * @brief Sayfa açıldığında firmware'den tam listeyi ister
 */
function requestParamList() {
    paramChunks = {};
    paramExpectedChunks = -1;
    const body = document.getElementById('paramTableBody');
    if (body) {
        body.innerHTML = '<tr><td colspan="4" class="text-center text-muted py-4">' +
                         '<span class="spinner-border spinner-border-sm me-2"></span>Parametreler okunuyor…</td></tr>';
    }
    if (typeof sendCommand === 'function') sendCommand('param_list');
}
window.requestParamList = requestParamList;

/**
 * @brief Firmware'den gelen param_list parçasını işler
 * @param {Object} d - {chunk, chunks, total, params:[...]}
 */
function handleParamListChunk(d) {
    if (!d || !Array.isArray(d.params)) return;
    paramExpectedChunks = d.chunks;
    paramChunks[d.chunk] = d.params;

    if (Object.keys(paramChunks).length >= paramExpectedChunks) {
        paramList = [];
        for (let i = 0; i < paramExpectedChunks; i++) {
            if (paramChunks[i]) paramList = paramList.concat(paramChunks[i]);
        }
        plog(`⚙️ ${paramList.length} parametre alındı`, 'success');
        if (typeof hidePageLoading === 'function') hidePageLoading('parameters');
        renderParamTable();
    }
}
window.handleParamListChunk = handleParamListChunk;

/**
 * @brief PARAM_SET yanıtı — firmware yazdığı değeri geri bildirir (kırpılmış olabilir)
 */
function handleParamSetResponse(name, value) {
    paramPendingSave.delete(name);
    const p = paramList.find(x => x.n === name);
    if (p) p.v = value;

    const input = document.querySelector(`[data-param-input="${name}"]`);
    if (input) {
        input.value = formatParamValue(value, p ? p.t : 0);
        input.classList.remove('param-dirty');
    }
    const btn = document.querySelector(`[data-param-save="${name}"]`);
    if (btn) {
        btn.classList.remove('btn-warning');
        btn.classList.add('btn-success');
        btn.innerHTML = '<i class="bi bi-check-lg"></i><span class="param-save-label">' +
                        (paramLang() === 'en' ? 'Saved' : 'Kaydedildi') + '</span>';
        setTimeout(() => {
            btn.classList.remove('btn-success');
            btn.classList.add('btn-outline-info');
            btn.innerHTML = '<i class="bi bi-save2"></i><span class="param-save-label">' +
                            (paramLang() === 'en' ? 'Save' : 'Kaydet') + '</span>';
        }, 1500);
    }
    updateParamRowState(name);
}
window.handleParamSetResponse = handleParamSetResponse;

function paramLang() {
    return (localStorage.getItem('vc_lang') === 'en') ? 'en' : 'tr';
}

function formatParamValue(v, type) {
    if (type === 0) { // float
        const a = Math.abs(v);
        if (a !== 0 && a < 0.01) return String(Number(v.toPrecision(3)));
        return String(Number(v.toFixed(4)));
    }
    return String(Math.round(v));
}

function paramMetaFor(name) {
    const meta = window.PARAM_META || {};
    return meta[name] || null;
}

function paramGroupOf(name) {
    const m = paramMetaFor(name);
    return m ? m.grp : 'other';
}

function paramDescription(name) {
    const m = paramMetaFor(name);
    if (!m) return '';
    return m[paramLang()] || m.tr || '';
}

/**
 * @brief Grup filtre çiplerini çizer
 */
function renderParamGroupChips() {
    const wrap = document.getElementById('paramGroupChips');
    if (!wrap) return;
    const lang = paramLang();
    const groups = window.PARAM_GROUPS || {};

    // Yalnızca gerçekten parametresi olan gruplar gösterilir
    const present = new Set(paramList.map(p => paramGroupOf(p.n)));
    const counts = {};
    paramList.forEach(p => {
        const g = paramGroupOf(p.n);
        counts[g] = (counts[g] || 0) + 1;
    });

    let html = `<button type="button" class="param-chip ${paramFilterGroup === 'all' ? 'active' : ''}" data-group="all">
                    ${lang === 'en' ? 'All' : 'Tümü'} <span class="param-chip-count">${paramList.length}</span>
                </button>`;
    Object.keys(groups).forEach(key => {
        if (!present.has(key)) return;
        const g = groups[key];
        html += `<button type="button" class="param-chip ${paramFilterGroup === key ? 'active' : ''}" data-group="${key}">
                    <i class="bi ${g.icon}"></i> ${g[lang] || g.tr} <span class="param-chip-count">${counts[key] || 0}</span>
                 </button>`;
    });
    wrap.innerHTML = html;
    wrap.querySelectorAll('.param-chip').forEach(btn => {
        btn.addEventListener('click', () => {
            paramFilterGroup = btn.getAttribute('data-group');
            renderParamGroupChips();
            renderParamTable();
        });
    });
}

function paramIsChanged(p) {
    // float karşılaştırmasında küçük tolerans
    return Math.abs(p.v - p.d) > Math.max(1e-6, Math.abs(p.d) * 1e-4);
}

/**
 * @brief Ana tabloyu çizer
 */
function renderParamTable() {
    const body = document.getElementById('paramTableBody');
    if (!body) return;
    const lang = paramLang();

    renderParamGroupChips();

    const q = paramFilterText.trim().toLowerCase();
    const rows = paramList.filter(p => {
        if (paramFilterGroup !== 'all' && paramGroupOf(p.n) !== paramFilterGroup) return false;
        if (paramShowChangedOnly && !paramIsChanged(p)) return false;
        if (!q) return true;
        return p.n.toLowerCase().includes(q) || paramDescription(p.n).toLowerCase().includes(q);
    });

    const countEl = document.getElementById('paramVisibleCount');
    if (countEl) countEl.textContent = `${rows.length} / ${paramList.length}`;

    if (rows.length === 0) {
        body.innerHTML = `<tr><td colspan="4" class="text-center text-muted py-4">
            ${lang === 'en' ? 'No parameters match the filter.' : 'Filtreye uyan parametre yok.'}</td></tr>`;
        return;
    }

    const defLabel   = lang === 'en' ? 'Default' : 'Varsayılan';
    const rangeLabel = lang === 'en' ? 'Range'   : 'Aralık';
    const saveTitle  = lang === 'en' ? 'Write to board' : 'Karta yaz';
    const saveBtnText= lang === 'en' ? 'Save' : 'Kaydet';

    let html = '';
    rows.forEach(p => {
        const changed = paramIsChanged(p);
        const isBool  = (p.t === 5);
        const step    = (p.t === 0) ? 'any' : '1';
        const desc    = paramDescription(p.n);
        const grpKey  = paramGroupOf(p.n);
        const grp     = (window.PARAM_GROUPS || {})[grpKey];
        const grpName = grp ? (grp[lang] || grp.tr) : '';

        const valueCell = isBool
            ? `<select class="form-control form-control-sm param-input" data-param-input="${p.n}">
                   <option value="1" ${p.v >= 0.5 ? 'selected' : ''}>${lang === 'en' ? 'On' : 'Açık'}</option>
                   <option value="0" ${p.v < 0.5 ? 'selected' : ''}>${lang === 'en' ? 'Off' : 'Kapalı'}</option>
               </select>`
            : `<input type="number" class="form-control form-control-sm param-input"
                      data-param-input="${p.n}" step="${step}" min="${p.mn}" max="${p.mx}"
                      value="${formatParamValue(p.v, p.t)}">`;

        html += `
        <tr data-param-row="${p.n}" class="${changed ? 'param-row-changed' : ''}">
            <td class="param-name-cell">
                <div class="param-name">${p.n}</div>
                <div class="param-group-tag">${grpName}</div>
            </td>
            <td class="param-desc-cell">
                <div class="param-desc">${desc || '<span class="text-muted">—</span>'}</div>
                <div class="param-limits">
                    <span class="param-default">${defLabel}: <strong>${formatParamValue(p.d, p.t)}</strong></span>
                    ${isBool ? '' : `<span class="param-range">${rangeLabel}: ${formatParamValue(p.mn, p.t)} … ${formatParamValue(p.mx, p.t)}</span>`}
                    <span class="param-type">${PARAM_TYPE_NAMES[p.t] || ''}</span>
                </div>
            </td>
            <td class="param-value-cell">${valueCell}</td>
            <td class="param-save-cell">
                <button type="button" class="btn btn-sm btn-outline-info param-save-btn"
                        data-param-save="${p.n}" title="${saveTitle}">
                    <i class="bi bi-save2"></i><span class="param-save-label">${saveBtnText}</span>
                </button>
                <button type="button" class="btn btn-sm btn-outline-secondary param-default-btn"
                        data-param-default="${p.n}" title="${lang === 'en' ? 'Restore default' : 'Varsayılana dön'}">
                    <i class="bi bi-arrow-counterclockwise"></i>
                </button>
            </td>
        </tr>`;
    });
    body.innerHTML = html;

    body.querySelectorAll('[data-param-input]').forEach(el => {
        el.addEventListener('input', () => {
            el.classList.add('param-dirty');
            const btn = document.querySelector(`[data-param-save="${el.getAttribute('data-param-input')}"]`);
            if (btn) { btn.classList.remove('btn-outline-info'); btn.classList.add('btn-warning'); }
        });
        // Enter → kaydet
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') saveParam(el.getAttribute('data-param-input'));
        });
    });
    body.querySelectorAll('[data-param-save]').forEach(btn => {
        btn.addEventListener('click', () => saveParam(btn.getAttribute('data-param-save')));
    });
    body.querySelectorAll('[data-param-default]').forEach(btn => {
        btn.addEventListener('click', () => {
            const name = btn.getAttribute('data-param-default');
            const p = paramList.find(x => x.n === name);
            if (!p) return;
            const input = document.querySelector(`[data-param-input="${name}"]`);
            if (input) {
                input.value = formatParamValue(p.d, p.t);
                input.classList.add('param-dirty');
            }
            const sbtn = document.querySelector(`[data-param-save="${name}"]`);
            if (sbtn) { sbtn.classList.remove('btn-outline-info'); sbtn.classList.add('btn-warning'); }
        });
    });
}

function updateParamRowState(name) {
    const p = paramList.find(x => x.n === name);
    const row = document.querySelector(`[data-param-row="${name}"]`);
    if (!p || !row) return;
    row.classList.toggle('param-row-changed', paramIsChanged(p));
}

/**
 * @brief Tek parametreyi karta yazar
 */
function saveParam(name) {
    const input = document.querySelector(`[data-param-input="${name}"]`);
    const p = paramList.find(x => x.n === name);
    if (!input || !p) return;

    const val = parseFloat(input.value);
    if (!isFinite(val)) {
        if (typeof showModal === 'function') showModal('Geçersiz Değer', `${name} için sayısal bir değer girin.`, 'error');
        return;
    }
    if (val < p.mn || val > p.mx) {
        // Firmware zaten kırpar; kullanıcıyı önceden uyaralım
        plog(`${name}: değer aralık dışı, ${p.mn}…${p.mx} arasına kırpılacak`, 'warning');
    }

    paramPendingSave.add(name);
    if (typeof sendCommand === 'function') {
        sendCommand(JSON.stringify({ command: 'PARAM_SET', name: name, value: val }));
    }
}
window.saveParam = saveParam;

/**
 * @brief Görünen tabloda değiştirilmiş tüm kutuları sırayla kaydeder
 */
function saveAllDirtyParams() {
    const dirty = Array.from(document.querySelectorAll('.param-input.param-dirty'));
    if (dirty.length === 0) {
        if (typeof showModal === 'function') {
            showModal('Bilgi', 'Kaydedilecek değişiklik yok.', 'info', 1500);
        }
        return;
    }
    // Firmware tek komut bayrağı kullanıyor — komutları aralıklı gönder
    dirty.forEach((el, i) => {
        const name = el.getAttribute('data-param-input');
        setTimeout(() => saveParam(name), i * 120);
    });
    plog(`${dirty.length} parametre kaydediliyor…`, 'info');
}
window.saveAllDirtyParams = saveAllDirtyParams;

/**
 * @brief Tüm tabloyu fabrika varsayılanlarına döndürür (onaylı)
 */
function resetAllParams() {
    const doReset = () => {
        if (typeof sendCommand === 'function') sendCommand('PARAM_RESET_ALL');
        setTimeout(requestParamList, 1200);
    };
    if (typeof showConfirmModal === 'function') {
        showConfirmModal('Tüm Parametreleri Sıfırla',
            'Tablodaki <strong>tüm parametreler</strong> fabrika varsayılanlarına dönecek ve karta kaydedilecek. Bu işlem geri alınamaz.',
            doReset);
    } else if (confirm('Tüm parametreler varsayılana dönecek. Emin misiniz?')) {
        doReset();
    }
}
window.resetAllParams = resetAllParams;

/**
 * @brief Görünen parametreleri CSV olarak indirir (yedek / paylaşım)
 */
function exportParamsCsv() {
    if (paramList.length === 0) return;
    let csv = 'name,value,default,min,max,type\n';
    paramList.forEach(p => {
        csv += `${p.n},${p.v},${p.d},${p.mn},${p.mx},${PARAM_TYPE_NAMES[p.t] || p.t}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const ts = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
    a.download = `vecihi_parametreler_${ts}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}
window.exportParamsCsv = exportParamsCsv;

/**
 * @brief Sayfa kontrollerini bağlar (bir kez)
 */
function initParametersPage() {
    const search = document.getElementById('paramSearch');
    if (search && !search.dataset.bound) {
        search.dataset.bound = '1';
        search.addEventListener('input', () => {
            paramFilterText = search.value;
            renderParamTable();
        });
    }
    const changedChk = document.getElementById('paramChangedOnly');
    if (changedChk && !changedChk.dataset.bound) {
        changedChk.dataset.bound = '1';
        changedChk.addEventListener('change', () => {
            paramShowChangedOnly = changedChk.checked;
            renderParamTable();
        });
    }
    const btnRefresh = document.getElementById('btnParamRefresh');
    if (btnRefresh && !btnRefresh.dataset.bound) {
        btnRefresh.dataset.bound = '1';
        btnRefresh.addEventListener('click', requestParamList);
    }
    const btnSaveAll = document.getElementById('btnParamSaveAll');
    if (btnSaveAll && !btnSaveAll.dataset.bound) {
        btnSaveAll.dataset.bound = '1';
        btnSaveAll.addEventListener('click', saveAllDirtyParams);
    }
    const btnResetAll = document.getElementById('btnParamResetAll');
    if (btnResetAll && !btnResetAll.dataset.bound) {
        btnResetAll.dataset.bound = '1';
        btnResetAll.addEventListener('click', resetAllParams);
    }
    const btnExport = document.getElementById('btnParamExport');
    if (btnExport && !btnExport.dataset.bound) {
        btnExport.dataset.bound = '1';
        btnExport.addEventListener('click', exportParamsCsv);
    }
}
window.initParametersPage = initParametersPage;

document.addEventListener('DOMContentLoaded', initParametersPage);
