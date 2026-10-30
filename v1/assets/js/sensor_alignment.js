// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file sensor_alignment.js
 * @brief MPU6050 sensör yönelim (board alignment) — kalibrasyon sayfasına entegre
 */

let currentSensorAlign = 0;
let pendingSensorAlign = 0;

const ALIGN_OPTIONS = [
    { id: 0, label: 'CW 0°',         desc: 'Normal montaj' },
    { id: 1, label: 'CW 90°',        desc: 'Saat yönünde 90°' },
    { id: 2, label: 'CW 180°',       desc: 'Saat yönünde 180°' },
    { id: 3, label: 'CW 270°',       desc: 'Saat yönünde 270°' },
    { id: 4, label: 'CW 0° + Flip',  desc: 'Tepetaklak, 0° dönüş' },
    { id: 5, label: 'CW 90° + Flip', desc: 'Tepetaklak, 90° dönüş' },
    { id: 6, label: 'CW 180° + Flip',desc: 'Tepetaklak, 180° dönüş' },
    { id: 7, label: 'CW 270° + Flip',desc: 'Tepetaklak, 270° dönüş' }
];

function renderAlignSelect() {
    const sel = document.getElementById('sensorAlignSelect');
    if (!sel) return;

    if (sel.options.length === 0) {
        ALIGN_OPTIONS.forEach(opt => {
            const o = document.createElement('option');
            o.value = opt.id;
            o.textContent = `${opt.label} — ${opt.desc}`;
            sel.appendChild(o);
        });
    }

    sel.value = pendingSensorAlign;
    updateAlignSaveBtn();
}

function selectAlignOption(alignId) {
    pendingSensorAlign = alignId;
    updateAlignSaveBtn();
}

function updateAlignSaveBtn() {
    const btn = document.getElementById('btnSaveAlign');
    if (!btn) return;
    btn.disabled = !isConnected;
}

function saveSensorAlign() {
    if (!isConnected) {
        showModal('Bağlantı Yok', 'Kaydetmek için önce cihaza bağlanın.', 'error');
        return;
    }
    const newOpt = ALIGN_OPTIONS.find(o => o.id === pendingSensorAlign);
    const label = newOpt ? newOpt.label : `#${pendingSensorAlign}`;
    sendCommand(`SAVE_SENSOR_ALIGN ${JSON.stringify({ align: pendingSensorAlign })}`);
    log(`Sensör hizalaması gönderildi: ${label}`, 'command');
}

function handleSensorAlignPageData(data) {
    if (typeof data.align !== 'undefined') {
        currentSensorAlign = data.align;
        pendingSensorAlign = data.align;
        renderAlignSelect();
        log(`Sensör hizalaması yüklendi: ${ALIGN_OPTIONS[data.align]?.label || data.align}`, 'success');
    }
}

function handleSensorAlignStatusResponse(command, result, data) {
    if (command !== 'SAVE_SENSOR_ALIGN') return false;

    if (result === 'completed') {
        currentSensorAlign = pendingSensorAlign;
        const calib_reset = data && data.status && data.status.calib_reset;
        let message = `Sensör yönelimi <strong>${ALIGN_OPTIONS[currentSensorAlign]?.label}</strong> olarak kaydedildi.`;
        if (calib_reset) {
            message += '<br><br><span class="text-warning"><i class="bi bi-exclamation-triangle me-1"></i>Kalibrasyon verileri sıfırlandı. Lütfen kalibrasyonu yeniden yapın.</span>';
        }
        showModal(calib_reset ? '⚠️ Hizalama Kaydedildi' : '✅ Hizalama Kaydedildi', message, calib_reset ? 'warning' : 'success');
        log(`Sensör hizalaması kaydedildi${calib_reset ? ' (kalibrasyon sıfırlandı)' : ''}`, 'success');
    } else {
        showModal('Hata', `Hizalama kaydedilemedi: ${result}`, 'error');
        log(`Sensör hizalama hatası: ${result}`, 'error');
    }
    return true;
}

function onSensorAlignInit() {
    if (typeof advancedConfig !== 'undefined' && advancedConfig.nav) {
        currentSensorAlign = advancedConfig.nav.mag_align || 0;
        pendingSensorAlign = currentSensorAlign;
    }
    renderAlignSelect();
    if (isConnected) {
        sendCommand('sensor_align_page_data');
    }
}

window.selectAlignOption = selectAlignOption;
window.saveSensorAlign = saveSensorAlign;
window.handleSensorAlignPageData = handleSensorAlignPageData;
window.handleSensorAlignStatusResponse = handleSensorAlignStatusResponse;
window.onSensorAlignInit = onSensorAlignInit;
