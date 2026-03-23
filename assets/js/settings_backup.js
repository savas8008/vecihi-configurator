/**
 * @file settings_backup.js
 * @brief X-Flight Configurator - Ayar Yedekleme / Geri Yükleme Modülü
 * @description Tüm kullanıcı ayarlarını tek JSON dosyasına aktarır ve geri yükler.
 *
 * Dışa aktarılan ayarlar:
 *   - PID (pidValues)
 *   - Gelişmiş ayarlar (advancedConfig)
 *   - Uçuş modları (activeFlightModes)
 *   - Kumanda (transmitterConfig)
 *   - Çıkışlar / pin / servo (selectedAircraft, pinConfig, servoValues)
 *   - OSD (DOM'dan toplanır)
 */

// ============================================================================
// DIŞA AKTARMA (EXPORT)
// ============================================================================

/**
 * @brief Tüm ayarları JSON dosyası olarak indirir.
 */
function exportSettings() {
    try {
        // OSD: DOM'dan topla
        const osdData = (typeof window.collectOSDConfig === 'function')
            ? window.collectOSDConfig()
            : null;

        const backup = {
            version: '1.0',
            app: 'XFlightConfigurator',
            exported_at: new Date().toISOString(),
            settings: {
                pid: JSON.parse(JSON.stringify(pidValues || {})),
                advanced: JSON.parse(JSON.stringify(window.advancedConfig || {})),
                flight_modes: JSON.parse(JSON.stringify(window.activeFlightModes || {})),
                transmitter: JSON.parse(JSON.stringify(transmitterConfig || {})),
                outputs: {
                    aircraft_type: selectedAircraft || 'v-tail',
                    pins: JSON.parse(JSON.stringify(pinConfig || {})),
                    servo_values: JSON.parse(JSON.stringify(servoValues || {}))
                },
                osd: osdData
            }
        };

        const json = JSON.stringify(backup, null, 2);
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const date = new Date().toISOString().slice(0, 10);
        const a = document.createElement('a');
        a.href = url;
        a.download = `xflight_settings_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof log === 'function') {
            log(`✅ Ayarlar dışa aktarıldı: ${a.download}`, 'success');
        }
    } catch (err) {
        console.error('Dışa aktarma hatası:', err);
        if (typeof log === 'function') {
            log(`❌ Dışa aktarma hatası: ${err.message}`, 'error');
        } else {
            alert('Dışa aktarma hatası: ' + err.message);
        }
    }
}

// ============================================================================
// İÇE AKTARMA (IMPORT)
// ============================================================================

/**
 * @brief Dosya seçici açar, seçilen JSON'u yükler ve ayarları uygular.
 */
function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';

    input.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                _applySettings(backup);
            } catch (err) {
                if (typeof log === 'function') {
                    log(`❌ Dosya okunamadı: ${err.message}`, 'error');
                } else {
                    alert('Geçersiz dosya: ' + err.message);
                }
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

/**
 * @brief Yedek objesindeki ayarları global değişkenlere ve UI'a uygular.
 * @param {Object} backup - exportSettings ile oluşturulmuş obje
 */
function _applySettings(backup) {
    if (!backup || !backup.settings) {
        alert('Geçersiz yedek dosyası (settings alanı bulunamadı).');
        return;
    }

    const s = backup.settings;
    const errors = [];

    // --- PID ---
    try {
        if (s.pid) {
            // pidValues HTML'de let ile tanımlı, doğrudan property'lerini güncelle
            if (s.pid.roll)  Object.assign(pidValues.roll,  s.pid.roll);
            if (s.pid.pitch) Object.assign(pidValues.pitch, s.pid.pitch);
            if (s.pid.yaw)   Object.assign(pidValues.yaw,   s.pid.yaw);
            if (s.pid.level) {
                if (!pidValues.level) pidValues.level = {};
                Object.assign(pidValues.level, s.pid.level);
            }
            if (s.pid.tpa_factor  !== undefined) pidValues.tpa_factor  = s.pid.tpa_factor;
            if (s.pid.max_rate_roll  !== undefined) pidValues.max_rate_roll  = s.pid.max_rate_roll;
            if (s.pid.max_rate_pitch !== undefined) pidValues.max_rate_pitch = s.pid.max_rate_pitch;
            if (s.pid.max_rate_yaw   !== undefined) pidValues.max_rate_yaw   = s.pid.max_rate_yaw;

            if (typeof updatePIDUI === 'function') updatePIDUI();
        }
    } catch (e) { errors.push('PID: ' + e.message); }

    // --- Gelişmiş Ayarlar ---
    try {
        if (s.advanced && window.advancedConfig) {
            // Derin birleştirme: her alt objeyi ayrı assign et
            for (const key of Object.keys(s.advanced)) {
                if (typeof s.advanced[key] === 'object' && s.advanced[key] !== null) {
                    if (!window.advancedConfig[key]) window.advancedConfig[key] = {};
                    Object.assign(window.advancedConfig[key], s.advanced[key]);
                } else {
                    window.advancedConfig[key] = s.advanced[key];
                }
            }
            if (typeof window.updateAdvancedUI === 'function') window.updateAdvancedUI();
        }
    } catch (e) { errors.push('Gelişmiş: ' + e.message); }

    // --- Uçuş Modları ---
    try {
        if (s.flight_modes && window.activeFlightModes) {
            // Mevcut referansı koruyarak güncelle
            Object.keys(window.activeFlightModes).forEach(k => delete window.activeFlightModes[k]);
            Object.assign(window.activeFlightModes, s.flight_modes);
            if (typeof window.renderModesPage === 'function') window.renderModesPage();
        }
    } catch (e) { errors.push('Uçuş Modları: ' + e.message); }

    // --- Kumanda ---
    try {
        if (s.transmitter) {
            if (s.transmitter.protocol !== undefined) transmitterConfig.protocol = s.transmitter.protocol;
            if (s.transmitter.channels) Object.assign(transmitterConfig.channels, s.transmitter.channels);
            if (s.transmitter.reverse)  Object.assign(transmitterConfig.reverse || {}, s.transmitter.reverse);
            if (typeof updateTransmitterUI === 'function') updateTransmitterUI();
        }
    } catch (e) { errors.push('Kumanda: ' + e.message); }

    // --- Çıkışlar / Pinler / Servolar ---
    try {
        if (s.outputs) {
            if (s.outputs.aircraft_type) selectedAircraft = s.outputs.aircraft_type;
            if (s.outputs.pins) Object.assign(pinConfig, s.outputs.pins);
            if (s.outputs.servo_values) {
                for (const sv of Object.keys(s.outputs.servo_values)) {
                    if (!servoValues[sv]) servoValues[sv] = {};
                    Object.assign(servoValues[sv], s.outputs.servo_values[sv]);
                }
            }
            // handleOutputsPageData zaten tüm UI'ı günceller
            if (typeof window.handleOutputsPageData === 'function') {
                window.handleOutputsPageData({
                    aircraft_type: selectedAircraft,
                    pins: pinConfig,
                    servo_values: servoValues
                });
            }
        }
    } catch (e) { errors.push('Çıkışlar: ' + e.message); }

    // --- OSD ---
    try {
        if (s.osd && typeof window.applyOSDConfig === 'function') {
            window.applyOSDConfig(s.osd);
        }
    } catch (e) { errors.push('OSD: ' + e.message); }

    // Sonuç bildirimi
    if (errors.length > 0) {
        const msg = `⚠️ İçe aktarma tamamlandı, bazı hatalar oluştu:\n${errors.join('\n')}`;
        if (typeof log === 'function') log(msg, 'warning');
        else alert(msg);
    } else {
        if (typeof log === 'function') {
            log('✅ Tüm ayarlar başarıyla içe aktarıldı.', 'success');
        }
    }
}

// ============================================================================
// GLOBAL EXPORT
// ============================================================================

window.exportSettings = exportSettings;
window.importSettings = importSettings;

console.log('✅ Settings Backup modülü yüklendi');
