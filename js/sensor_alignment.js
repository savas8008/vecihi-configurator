/**
 * @file sensor_alignment.js
 * @brief MPU6050 sensör yönelim (board alignment) sayfası
 * X-Flight Configurator için modüler JS
 */

// Mevcut hizalama değeri (advanced_page_data'dan gelir)
let currentSensorAlign = 0;
let pendingSensorAlign = 0;

// 8 yönelim tanımı
// Her biri için: id, etiket, kısa açıklama ve SVG diyagram
const ALIGN_OPTIONS = [
    {
        id: 0,
        label: 'CW 0°',
        desc: 'Normal montaj',
        flipped: false,
        rotation: 0
    },
    {
        id: 1,
        label: 'CW 90°',
        desc: 'Saat yönünde 90°',
        flipped: false,
        rotation: 90
    },
    {
        id: 2,
        label: 'CW 180°',
        desc: 'Saat yönünde 180°',
        flipped: false,
        rotation: 180
    },
    {
        id: 3,
        label: 'CW 270°',
        desc: 'Saat yönünde 270°',
        flipped: false,
        rotation: 270
    },
    {
        id: 4,
        label: 'CW 0° + Flip',
        desc: 'Tepetaklak, 0° dönüş',
        flipped: true,
        rotation: 0
    },
    {
        id: 5,
        label: 'CW 90° + Flip',
        desc: 'Tepetaklak, 90° dönüş',
        flipped: true,
        rotation: 90
    },
    {
        id: 6,
        label: 'CW 180° + Flip',
        desc: 'Tepetaklak, 180° dönüş',
        flipped: true,
        rotation: 180
    },
    {
        id: 7,
        label: 'CW 270° + Flip',
        desc: 'Tepetaklak, 270° dönüş',
        flipped: true,
        rotation: 270
    }
];

/**
 * Bir yönelim kartı için SVG oluşturur.
 * Kart içinde küçük bir F/C tahtası + ok diyagramı gösterilir.
 */
function buildAlignSvg(opt) {
    const rot = opt.rotation;
    const flip = opt.flipped;

    // Tepetaklak durumda Y ekseni çevrilir (scaleY=-1) + renk değişir
    const flipTransform = flip ? 'scale(1,-1)' : '';
    const boardColor = flip ? '#7c3aed' : '#2563eb';
    const arrowColor = flip ? '#a78bfa' : '#60a5fa';

    // Dönüş + flip transformu birleştir
    const transform = `rotate(${rot}, 40, 40) ${flipTransform}`;

    return `
    <svg viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" style="width:72px;height:72px;">
      <g transform="${transform}">
        <!-- Kart gövdesi -->
        <rect x="16" y="20" width="48" height="40" rx="4" ry="4"
              fill="${boardColor}" opacity="0.18" stroke="${boardColor}" stroke-width="1.5"/>
        <!-- Bağlantı noktaları (connector) -->
        <rect x="30" y="15" width="20" height="7" rx="2" ry="2"
              fill="${boardColor}" opacity="0.5"/>
        <!-- İleri oku (north arrow) -->
        <line x1="40" y1="36" x2="40" y2="20" stroke="${arrowColor}" stroke-width="2.5"
              stroke-linecap="round"/>
        <polygon points="40,14 36,22 44,22" fill="${arrowColor}"/>
        <!-- Merkez nokta -->
        <circle cx="40" cy="42" r="3" fill="${boardColor}" opacity="0.7"/>
      </g>
      ${flip ? `<text x="40" y="77" text-anchor="middle" font-size="7" fill="#7c3aed" font-family="monospace">FLIP</text>` : ''}
    </svg>`;
}

/**
 * Sayfa içeriğini render eder.
 */
function renderSensorAlignPage() {
    const container = document.getElementById('alignCardsContainer');
    if (!container) return;

    container.innerHTML = '';

    ALIGN_OPTIONS.forEach(opt => {
        const isActive = (opt.id === currentSensorAlign);
        const card = document.createElement('div');
        card.className = 'col-6 col-md-3';
        card.innerHTML = `
            <div class="align-card ${isActive ? 'align-card--active' : ''}"
                 data-align-id="${opt.id}"
                 onclick="selectAlignOption(${opt.id})"
                 title="${opt.desc}">
                <div class="align-card__icon">
                    ${buildAlignSvg(opt)}
                </div>
                <div class="align-card__label">${opt.label}</div>
                <div class="align-card__desc">${opt.desc}</div>
                ${isActive ? '<div class="align-card__badge"><i class="bi bi-check-circle-fill"></i> Aktif</div>' : ''}
            </div>`;
        container.appendChild(card);
    });

    // Kaydet butonu durumu
    updateAlignSaveBtn();
}

/**
 * Kullanıcı bir kart seçtiğinde çağrılır.
 */
function selectAlignOption(alignId) {
    pendingSensorAlign = alignId;

    // Kartları güncelle (seçim göstergesi)
    document.querySelectorAll('.align-card').forEach(card => {
        const id = parseInt(card.dataset.alignId);
        card.classList.toggle('align-card--selected', id === alignId);
    });

    updateAlignSaveBtn();
}

function updateAlignSaveBtn() {
    const btn = document.getElementById('btnSaveAlign');
    if (!btn) return;
    btn.disabled = !isConnected();
    btn.className = 'btn btn-warning shadow-sm';
    btn.innerHTML = '<i class="bi bi-save me-1"></i> Kaydet';
}

/**
 * Kaydet butonuna tıklandığında çağrılır.
 */
function saveSensorAlign() {
    if (!isConnected()) {
        showModal('Bağlantı Yok', 'Kaydetmek için önce cihaza bağlanın.', 'error');
        return;
    }

    const newOpt = ALIGN_OPTIONS.find(o => o.id === pendingSensorAlign);
    const label = newOpt ? newOpt.label : `#${pendingSensorAlign}`;
    const payload = JSON.stringify({ align: pendingSensorAlign });
    sendCommand(`SAVE_SENSOR_ALIGN ${payload}`);
    log(`Sensör hizalaması gönderildi: ${label}`, 'command');
}

/**
 * Cihazdan gelen sensor_align page_data'yı işler.
 */
function handleSensorAlignPageData(data) {
    if (typeof data.align !== 'undefined') {
        currentSensorAlign = data.align;
        pendingSensorAlign = data.align;
        renderSensorAlignPage();
        log(`📐 Sensör hizalaması yüklendi: ${ALIGN_OPTIONS[data.align]?.label || data.align}`, 'success');
    }
}

/**
 * SAVE_SENSOR_ALIGN komutunun yanıtını işler.
 * serial_communication.js handleStatusResponse'dan çağrılır.
 * @returns {boolean} true=işlendi, false=ilgisiz
 */
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
        renderSensorAlignPage();
        log(`✅ Sensör hizalaması kaydedildi${calib_reset ? ' (kalibrasyon sıfırlandı)' : ''}`, 'success');
    } else {
        showModal('Hata', `Hizalama kaydedilemedi: ${result}`, 'error');
        log(`❌ Sensör hizalama hatası: ${result}`, 'error');
    }
    return true;
}

/**
 * Sensor Alignment sayfası açıldığında çağrılır (page_management.js hook).
 */
function onSensorAlignPageShow() {
    // advanced_page_data zaten bağlantıda yükleniyor;
    // oradan mag_align değerini al, ayrıca cihazdan da isteyelim.
    if (typeof advancedConfig !== 'undefined' && advancedConfig.nav) {
        currentSensorAlign = advancedConfig.nav.mag_align || 0;
        pendingSensorAlign = currentSensorAlign;
    }
    renderSensorAlignPage();

    if (isConnected()) {
        sendCommand('sensor_align_page_data');
    }
}

// Global erişim
window.selectAlignOption = selectAlignOption;
window.saveSensorAlign = saveSensorAlign;
window.handleSensorAlignPageData = handleSensorAlignPageData;
window.handleSensorAlignStatusResponse = handleSensorAlignStatusResponse;
window.onSensorAlignPageShow = onSensorAlignPageShow;
