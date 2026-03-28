/**
 * @file firmware.js
 * @brief Vecihi Firmware Yükleyici Modülü
 * @description vecihi-public reposundan manifest.json çeker,
 *              versiyon ve build bilgisini gösterir.
 */

const FIRMWARE_MANIFEST_URL = 'https://savas8008.github.io/vecihi-public/manifest.json';

/**
 * @brief Firmware manifest bilgilerini yükler ve UI'ı günceller
 */
async function loadFirmwareInfo() {
    const versionEl = document.getElementById('firmwareVersion');
    const dateEl = document.getElementById('firmwareBuildDate');

    if (!versionEl) return;

    try {
        const response = await fetch(FIRMWARE_MANIFEST_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const manifest = await response.json();

        if (versionEl) {
            versionEl.textContent = manifest.version || '?';
            versionEl.className = 'badge bg-success';
        }

        if (dateEl) {
            const date = manifest.build_info && manifest.build_info.date
                ? manifest.build_info.date
                : '—';
            dateEl.textContent = date;
        }
    } catch (err) {
        if (versionEl) {
            versionEl.textContent = 'Bağlanamadı';
            versionEl.className = 'badge bg-danger';
        }
        if (dateEl) dateEl.textContent = '—';
        console.warn('[Firmware] Manifest yüklenemedi:', err);
    }
}

/**
 * @brief Flash wrapper'ını bağlantı durumuna göre günceller
 */
function updateFirmwarePageState() {
    const warning = document.getElementById('firmwareConnectedWarning');
    const wrapper = document.getElementById('firmwareFlashWrapper');
    const connected = typeof window.isConnected === 'function' ? window.isConnected() : !!window.port;

    if (warning) warning.classList.toggle('d-none', !connected);
    if (wrapper) {
        wrapper.style.opacity = connected ? '0.4' : '1';
        wrapper.style.pointerEvents = connected ? 'none' : 'auto';
    }
}

/**
 * @brief Firmware sayfası gösterildiğinde çağrılır
 */
function initFirmwarePage() {
    loadFirmwareInfo();
    updateFirmwarePageState();
}

window.initFirmwarePage = initFirmwarePage;
window.updateFirmwarePageState = updateFirmwarePageState;
