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
    const versionEls = Array.from(document.querySelectorAll('.firmware-version'));
    const dateEls = Array.from(document.querySelectorAll('.firmware-build-date'));

    if (!versionEls.length) return;

    try {
        const response = await fetch(FIRMWARE_MANIFEST_URL, { cache: 'no-store' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const manifest = await response.json();

        versionEls.forEach(versionEl => {
            versionEl.textContent = manifest.version || '?';
            versionEl.className = 'badge bg-success firmware-version';
        });

        const date = manifest.build_info && manifest.build_info.date
            ? manifest.build_info.date
            : '—';
        dateEls.forEach(dateEl => {
            dateEl.textContent = date;
        });
    } catch (err) {
        versionEls.forEach(versionEl => {
            versionEl.textContent = 'Bağlanamadı';
            versionEl.className = 'badge bg-danger firmware-version';
        });
        dateEls.forEach(dateEl => {
            dateEl.textContent = '—';
        });
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

// Manifest bilgilerini sayfa yüklendiğinde de önden çek
loadFirmwareInfo();
