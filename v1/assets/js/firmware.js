// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file firmware.js
 * @brief Vecihi Firmware Yükleyici Modülü
 * @description vecihi-public reposundan manifest.json ve versions.json çeker,
 *              versiyon/build bilgisini gösterir, kullanıcının flaşlanacak
 *              sürümü seçmesini sağlar.
 */

const FIRMWARE_PUBLIC_BASE = 'https://savas8008.github.io/vecihi-public/';
const FIRMWARE_MANIFEST_URL = FIRMWARE_PUBLIC_BASE + 'manifest.json';
const FIRMWARE_VERSIONS_URL = FIRMWARE_PUBLIC_BASE + 'versions.json';

// Bu configurator'ın flaşlamasına izin verilen firmware ana sürümü.
// serial_communication.js'deki COMPATIBLE_FIRMWARE_MAJOR'dan okunur — böylece
// aynı dosya hem kökteki (v2) hem /v1/ arşivindeki configurator'da doğru
// sürüm ailesini seçer. Kök manifest.json her zaman "en son sürüm"ü gösterdiği
// için (bkz. vecihi CI), arşiv configurator'ın onu kullanması yanlış ana sürümü
// flaşlatırdı; manifest bu yüzden versions.json'dan seçiliyor.
const FIRMWARE_TARGET_MAJOR = (typeof COMPATIBLE_FIRMWARE_MAJOR !== 'undefined') ? COMPATIBLE_FIRMWARE_MAJOR : 1;

function firmwareMajorOf(version) {
    return parseInt(String(version || '').split('.')[0], 10);
}

/**
 * @brief versions.json'ı çeker; bu configurator'ın ana sürümüne ait girdileri
 *        (en yeni en üstte) ve diğerlerini ayrı ayrı döndürür.
 */
async function fetchFirmwareVersions() {
    const response = await fetch(FIRMWARE_VERSIONS_URL, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const versions = await response.json();
    if (!Array.isArray(versions)) throw new Error('Geçersiz liste');
    return {
        compatible: versions.filter(v => firmwareMajorOf(v.version) === FIRMWARE_TARGET_MAJOR),
        others: versions.filter(v => firmwareMajorOf(v.version) !== FIRMWARE_TARGET_MAJOR)
    };
}

/**
 * @brief Firmware manifest bilgilerini yükler ve UI'ı günceller
 */
async function loadFirmwareInfo() {
    const versionEls = Array.from(document.querySelectorAll('.firmware-version'));
    const dateEls = Array.from(document.querySelectorAll('.firmware-build-date'));

    if (!versionEls.length) return;

    try {
        // Bu ana sürümün en yeni manifest'i; listede yoksa (ör. v2 configurator
        // yayında ama 2.0 firmware henüz derlenmedi) kök manifest'e düşülür.
        let manifestUrl = FIRMWARE_MANIFEST_URL;
        try {
            const { compatible } = await fetchFirmwareVersions();
            if (compatible.length) manifestUrl = FIRMWARE_PUBLIC_BASE + compatible[0].manifest;
        } catch (e) { /* kök manifest'le devam */ }

        const response = await fetch(manifestUrl, { cache: 'no-store' });
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
 * @brief Verilen flash wrapper'ı içindeki esp-web-install-button'ı yeni bir manifest ile
 *        yeniden oluşturur. Web component attribute değişikliğini güvenilir şekilde
 *        yakalamayabildiği için eleman DOM'dan kaldırılıp yeniden ekleniyor.
 */
function setFlashManifestForWrapper(wrapper, manifestUrl) {
    if (!wrapper || !manifestUrl) return;

    const oldButton = wrapper.querySelector('esp-web-install-button');
    if (!oldButton) return;

    const newButton = document.createElement('esp-web-install-button');
    newButton.setAttribute('manifest', manifestUrl);
    newButton.innerHTML = oldButton.innerHTML;
    oldButton.replaceWith(newButton);
}

/**
 * @brief Sürüm seçim kutusu değiştiğinde çağrılır (bkz. configurator.html onchange)
 * @param {HTMLSelectElement} selectEl - data-flash-wrapper attribute'u hedef wrapper id'sini verir
 */
function handleFirmwareVersionChange(selectEl) {
    if (!selectEl) return;
    const wrapper = document.getElementById(selectEl.dataset.flashWrapper);
    setFlashManifestForWrapper(wrapper, selectEl.value);
}

/**
 * @brief vecihi-public/versions.json'ı yükler ve sayfadaki tüm sürüm seçim kutularını doldurur
 *        (bağlantısız karşılama ekranı + bağlı uygulamanın Firmware sekmesi — ikisi de aynı listeyi kullanır)
 */
async function loadFirmwareVersions() {
    const selects = Array.from(document.querySelectorAll('.firmware-version-select'));
    if (!selects.length) return;

    try {
        const { compatible, others } = await fetchFirmwareVersions();
        // Yalnızca bu configurator'ın ana sürümü listelenir. Hiç yoksa (geçiş anı:
        // configurator yeni ana sürüme geçti ama firmware henüz yayınlanmadı) diğer
        // sürümler etiketlenerek gösterilir — bağlanınca sürüm kontrolü kullanıcıyı
        // uygun configurator'a yönlendirir.
        const versions = compatible.length ? compatible : others;
        if (versions.length === 0) throw new Error('Boş liste');

        selects.forEach(select => {
            select.innerHTML = '';
            versions.forEach(entry => {
                const option = document.createElement('option');
                option.value = FIRMWARE_PUBLIC_BASE + entry.manifest;
                const foreign = firmwareMajorOf(entry.version) !== FIRMWARE_TARGET_MAJOR;
                option.textContent = `v${entry.version} — ${entry.date || '—'}` +
                    (foreign ? ` (bu configurator v${FIRMWARE_TARGET_MAJOR}.x içindir)` : '');
                select.appendChild(option);
            });
            select.disabled = false;
            setFlashManifestForWrapper(document.getElementById(select.dataset.flashWrapper), select.value);
        });
    } catch (err) {
        selects.forEach(select => {
            select.innerHTML = '<option value="">Sürüm listesi yüklenemedi</option>';
            select.disabled = true;
        });
        console.warn('[Firmware] versions.json yüklenemedi:', err);
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
    loadFirmwareVersions();
    updateFirmwarePageState();
}

window.initFirmwarePage = initFirmwarePage;
window.updateFirmwarePageState = updateFirmwarePageState;
window.handleFirmwareVersionChange = handleFirmwareVersionChange;

// Manifest ve sürüm listesi bilgilerini sayfa yüklendiğinde de önden çek
// (bağlantısız karşılama ekranı initFirmwarePage() çağrılmadan görünür olabiliyor)
loadFirmwareInfo();
loadFirmwareVersions();
