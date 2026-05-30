// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.

/**
 * @file settings_backup.js
 * @brief Vecihi Configurator - Ayar Yedekleme / Geri Yükleme Modülü
 *
 * İçe aktarma mimarisi (CFG_SET / CFG_COMMIT):
 *   1. Backup JSON → flattenConfig() → [{key, value}] dizisi
 *   2. Her çift sırayla CFG_SET komutuyla ESP'ye gönderilir
 *   3. Her CFG_SET için ESP'den onay beklenir (ack)
 *   4. Tüm alanlar gönderilince CFG_COMMIT gönderilir
 *   5. ESP tüm config'i NVS'e kaydeder ve yeniden başlar
 */

// ============================================================================
// DIŞA AKTARMA (EXPORT)
// ============================================================================

function exportSettings() {
    try {
        const osdData = (typeof window.collectOSDConfig === 'function')
            ? window.collectOSDConfig()
            : null;

        const backup = {
            version: '1.0',
            app: 'VeciHiConfigurator',
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
        a.download = `vecihi_settings_${date}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        if (typeof log === 'function') log(`✅ Ayarlar dışa aktarıldı: ${a.download}`, 'success');
    } catch (err) {
        console.error('Dışa aktarma hatası:', err);
        if (typeof log === 'function') log(`❌ Dışa aktarma hatası: ${err.message}`, 'error');
        else alert('Dışa aktarma hatası: ' + err.message);
    }
}

// ============================================================================
// İÇE AKTARMA (IMPORT)
// ============================================================================

function importSettings() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.style.display = 'none';
    document.body.appendChild(input);

    input.onchange = (e) => {
        const file = e.target.files[0];
        document.body.removeChild(input);
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const backup = JSON.parse(event.target.result);
                _applySettings(backup);
            } catch (err) {
                if (typeof log === 'function') log(`❌ Dosya okunamadı: ${err.message}`, 'error');
                else alert('Geçersiz dosya: ' + err.message);
            }
        };
        reader.readAsText(file);
    };

    input.click();
}

// ============================================================================
// AYARLARI UYGULA
// ============================================================================

function _applySettings(backup) {
    if (!backup || !backup.settings) {
        alert('Geçersiz yedek dosyası (settings alanı bulunamadı).');
        return;
    }

    const s = backup.settings;

    // 1. JS globallerini ve UI'ı güncelle (anlık önizleme)
    _applyToUI(s);

    // 2. Cihaza gönder (bağlıysa)
    const connected = typeof window.isConnected === 'function' ? window.isConnected() : false;
    if (connected) {
        _importAndSendToDevice(s);
    } else {
        if (typeof log === 'function') {
            log('ℹ️ Ayarlar UI\'a uygulandı. Cihaza göndermek için bağlantı kurun.', 'info');
        }
    }
}

// ============================================================================
// UI GÜNCELLEME (cihaz bağlı olmasa da çalışır)
// ============================================================================

function _applyToUI(s) {
    const errors = [];

    try {
        if (s.pid) {
            if (s.pid.roll)  Object.assign(pidValues.roll,  s.pid.roll);
            if (s.pid.pitch) Object.assign(pidValues.pitch, s.pid.pitch);
            if (s.pid.yaw)   Object.assign(pidValues.yaw,   s.pid.yaw);
            if (s.pid.level) { if (!pidValues.level) pidValues.level = {}; Object.assign(pidValues.level, s.pid.level); }
            if (s.pid.tpa_factor       !== undefined) pidValues.tpa_factor       = s.pid.tpa_factor;
            if (s.pid.max_rate_roll    !== undefined) pidValues.max_rate_roll    = s.pid.max_rate_roll;
            if (s.pid.max_rate_pitch   !== undefined) pidValues.max_rate_pitch   = s.pid.max_rate_pitch;
            if (s.pid.max_rate_yaw     !== undefined) pidValues.max_rate_yaw     = s.pid.max_rate_yaw;
            if (typeof updatePIDUI === 'function') updatePIDUI();
        }
    } catch (e) { errors.push('PID: ' + e.message); }

    try {
        if (s.advanced && window.advancedConfig) {
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

    try {
        if (s.flight_modes && window.activeFlightModes) {
            Object.keys(window.activeFlightModes).forEach(k => delete window.activeFlightModes[k]);
            Object.assign(window.activeFlightModes, s.flight_modes);
            if (typeof window.renderModesPage === 'function') window.renderModesPage();
        }
    } catch (e) { errors.push('Uçuş Modları: ' + e.message); }

    try {
        if (s.transmitter) {
            if (s.transmitter.protocol  !== undefined) transmitterConfig.protocol = s.transmitter.protocol;
            if (s.transmitter.channels) Object.assign(transmitterConfig.channels, s.transmitter.channels);
            if (s.transmitter.reverse)  Object.assign(transmitterConfig.reverse  || {}, s.transmitter.reverse);
            if (typeof updateTransmitterUI === 'function') updateTransmitterUI();
        }
    } catch (e) { errors.push('Kumanda: ' + e.message); }

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
            if (typeof window.handleOutputsPageData === 'function') {
                window.handleOutputsPageData({
                    aircraft_type: selectedAircraft,
                    pins: pinConfig,
                    servo_values: servoValues
                });
            }
        }
    } catch (e) { errors.push('Çıkışlar: ' + e.message); }

    try {
        if (s.osd && typeof window.applyOSDConfig === 'function') {
            window.applyOSDConfig(s.osd);
        }
    } catch (e) { errors.push('OSD: ' + e.message); }

    if (errors.length > 0) {
        const msg = `⚠️ UI güncellemede bazı hatalar:\n${errors.join('\n')}`;
        if (typeof log === 'function') log(msg, 'warning');
    }
}

// ============================================================================
// CFG_SET ANAHTAR ŞEMASI — backup.settings → [{key, value}]
// ============================================================================

function _flattenConfig(s) {
    const pairs = [];

    function push(key, value) {
        if (value === undefined || value === null) return;
        pairs.push({ key, value });
    }

    // --- PID ---
    if (s.pid) {
        const p = s.pid;
        ['roll', 'pitch', 'yaw'].forEach(axis => {
            if (!p[axis]) return;
            push(`pid.${axis}.p`,       p[axis].p);
            push(`pid.${axis}.i`,       p[axis].i);
            push(`pid.${axis}.d`,       p[axis].d);
            push(`pid.${axis}.ff`,      p[axis].ff);
            push(`pid.${axis}.i_limit`, p[axis].i_limit);
        });
        if (p.level) push('pid.level_p', p.level.p);
        push('pid.tpa_factor',     p.tpa_factor);
        push('pid.max_rate_roll',  p.max_rate_roll);
        push('pid.max_rate_pitch', p.max_rate_pitch);
        push('pid.max_rate_yaw',   p.max_rate_yaw);
    }

    // --- UÇUŞ MODLARI ---
    if (s.flight_modes) {
        const modeNames = ['manual','angle','horizon','rth','acro','cruise',
                           'althold','autotune','flaperon','waypoint','land_assist','gcs'];
        modeNames.forEach(name => {
            const m = s.flight_modes[name];
            if (!m) return;
            push(`modes.${name}.channel`, m.channel);
            push(`modes.${name}.min`,     m.min);
            push(`modes.${name}.max`,     m.max);
        });
    }

    // --- KUMANDA ---
    if (s.transmitter) {
        const t = s.transmitter;
        push('tx.protocol', t.protocol);
        if (t.channels) {
            push('tx.ch_roll',     t.channels.roll);
            push('tx.ch_pitch',    t.channels.pitch);
            push('tx.ch_throttle', t.channels.throttle);
            push('tx.ch_yaw',      t.channels.yaw);
        }
        if (t.reverse) {
            push('tx.rev_roll',     t.reverse.roll     ? 1 : 0);
            push('tx.rev_pitch',    t.reverse.pitch    ? 1 : 0);
            push('tx.rev_throttle', t.reverse.throttle ? 1 : 0);
            push('tx.rev_yaw',      t.reverse.yaw      ? 1 : 0);
        }
        if (t.ch_arm !== undefined) push('tx.ch_arm', t.ch_arm);
    }

    // --- ÇIKIŞLAR ---
    if (s.outputs) {
        const o = s.outputs;
        push('out.aircraft_type', o.aircraft_type);
        if (o.pins) {
            const pn = o.pins;
            push('out.pin_motor1',      pn.motor1);
            push('out.pin_motor2',      pn.motor2);
            push('out.pin_servo1',      pn.servo1);
            push('out.pin_servo2',      pn.servo2);
            push('out.pin_servo3',      pn.servo3);
            push('out.pin_servo4',      pn.servo4);
            push('out.pin_rx_tx',       pn.rx_tx);
            push('out.pin_rx_rx',       pn.rx_rx);
            push('out.pin_gps_rx',      pn.gps_rx);
            push('out.pin_gps_tx',      pn.gps_tx);
            push('out.pin_osd_rx',      pn.osd_rx);
            push('out.pin_osd_tx',      pn.osd_tx);
            push('out.pin_i2c_sda',     pn.i2c_sda);
            push('out.pin_i2c_scl',     pn.i2c_scl);
            push('out.pin_adc_voltage', pn.adc_voltage);
            push('out.pin_adc_current', pn.adc_current);
            push('out.pin_adc_scale',   pn.adc_voltage_scale);
        }
        if (o.servo_values) {
            [1, 2, 3, 4].forEach(n => {
                const sv = o.servo_values[`servo${n}`];
                if (!sv) return;
                push(`out.servo${n}_min`, sv.min);
                push(`out.servo${n}_mid`, sv.mid);
                push(`out.servo${n}_max`, sv.max);
                push(`out.servo${n}_rev`, sv.reverse ? 1 : 0);
            });
        }
        if (o.mixer) {
            push('out.mixer_roll',  o.mixer.roll_mix);
            push('out.mixer_pitch', o.mixer.pitch_mix);
            push('out.mixer_yaw',   o.mixer.yaw_mix);
            push('out.mixer_thr',   o.mixer.throttle_mix);
        }
        if (o.esc_hz          !== undefined) push('out.esc_hz',          o.esc_hz);
        if (o.servo_hz        !== undefined) push('out.servo_hz',        o.servo_hz);
        if (o.flaperon_offset !== undefined) push('out.flaperon_offset', o.flaperon_offset);
    }

    // --- GELİŞMEŞ ---
    if (s.advanced) {
        const a = s.advanced;

        if (a.filters) {
            const f = a.filters;
            push('adv.filters.gyro_lpf_hz',    f.gyro_lpf_hz);
            push('adv.filters.acc_lpf_hz',     f.acc_lpf_hz);
            push('adv.filters.rpm_min_freq',   f.rpm_min_freq);
            push('adv.filters.rpm_max_freq',   f.rpm_max_freq);
            push('adv.filters.rpm_bw_percent', f.rpm_bw_percent);
            push('adv.filters.mpu_dlpf_mode',  f.mpu_dlpf_mode);
            push('adv.filters.gyro_range',     f.gyro_range);
            push('adv.filters.accel_range',    f.accel_range);
        }

        if (a.mahony) {
            const m = a.mahony;
            push('adv.mahony.kp',               m.kp);
            push('adv.mahony.ki',               m.ki);
            push('adv.mahony.centrifugal_fade', m.centrifugal_fade);
            push('adv.mahony.comp_dir_y',       m.comp_dir_y);
            push('adv.mahony.comp_dir_z',       m.comp_dir_z);
            push('adv.mahony.dcm_kp_mag',       m.dcm_kp_mag);
            push('adv.mahony.dcm_ki_mag',       m.dcm_ki_mag);
            push('adv.mahony.gps_yaw_weight',   m.gps_yaw_weight);
            push('adv.mahony.gps_min_speed',    m.gps_min_speed);
            push('adv.mahony.gps_max_speed',    m.gps_max_speed);
        }

        if (a.nav) {
            const n = a.nav;
            push('adv.nav.stall_speed_kmh',      n.stall_speed_kmh);
            push('adv.nav.stall_pitch_drop',     n.stall_pitch_drop);
            push('adv.nav.rth_altitude',         n.rth_altitude);
            push('adv.nav.rth_radius',           n.rth_radius);
            push('adv.nav.cruise_throttle',      n.cruise_throttle);
            push('adv.nav.climb_throttle',       n.climb_throttle);
            push('adv.nav.descend_throttle',     n.descend_throttle);
            push('adv.nav.nav_max_throttle',     n.nav_max_throttle);
            push('adv.nav.nav_min_throttle',     n.nav_min_throttle);
            push('adv.nav.launch_throttle',      n.launch_throttle);
            push('adv.nav.launch_angle',         n.launch_angle);
            push('adv.nav.launch_time',          n.launch_time);
            push('adv.nav.launch_altitude',      n.launch_altitude);
            push('adv.nav.launch_acc_threshold', n.launch_acc_threshold);
            push('adv.nav.launch_spool_time',    n.launch_spool_time);
            if (n.auto_launch_on_arm !== undefined) push('adv.nav.auto_launch_on_arm', n.auto_launch_on_arm ? 1 : 0);
            if (n.disarm_on_landing  !== undefined) push('adv.nav.disarm_on_landing',  n.disarm_on_landing  ? 1 : 0);
            push('adv.nav.max_bank_angle_roll',  n.max_bank_angle_roll  ?? n.max_bank_angle);
            push('adv.nav.max_bank_angle_pitch', n.max_bank_angle_pitch);
            if (n.has_gps !== undefined) push('adv.nav.has_gps', n.has_gps ? 1 : 0);
            push('adv.nav.gps_protocol',         n.gps_protocol);
            push('adv.nav.gps_baud',             n.gps_baud);
            push('adv.nav.gps_min_sats',         n.gps_min_sats);
            push('adv.nav.gps_min_fix_type',     n.gps_min_fix_type);
            push('adv.nav.nav_p',                n.nav_p);
            push('adv.nav.nav_i',                n.nav_i);
            push('adv.nav.nav_d',                n.nav_d);
            push('adv.nav.alt_p',                n.alt_p);
            push('adv.nav.ang_lim_roll',         n.ang_lim_roll);
            push('adv.nav.ang_lim_pitch',        n.ang_lim_pitch);
            push('adv.nav.max_distance',         n.max_distance);
            if (n.climb_first !== undefined) push('adv.nav.climb_first', n.climb_first ? 1 : 0);
            push('adv.nav.fw_pitch2thr',         n.fw_pitch2thr);
            push('adv.nav.max_climb',            n.max_climb);
            push('adv.nav.max_dive',             n.max_dive);
            push('adv.nav.l1_period',            n.l1_period);
            push('adv.nav.l1_damping',           n.l1_damping);
            push('adv.nav.l1_xtrack_i_gain',     n.l1_xtrack_i_gain);
            push('adv.nav.mag_align',            n.mag_align);
            push('adv.nav.wp_capture_radius',    n.wp_capture_radius);
            push('adv.nav.loiter_direction',     n.loiter_direction);
        }

        // wp_capture_radius ayrı alan olarak da gelebilir
        if (a.nav_wp && a.nav_wp.wp_capture_radius !== undefined) {
            push('adv.nav.wp_capture_radius', a.nav_wp.wp_capture_radius);
        }

        if (a.land_assist) {
            const la = a.land_assist;
            push('adv.land.circuit_alt',             la.circuit_alt);
            push('adv.land.final_approach_distance', la.final_approach_distance);
            push('adv.land.circuit_width',           la.circuit_width);
            push('adv.land.flare_alt',               la.flare_alt);
            push('adv.land.approach_throttle',       la.approach_throttle);
            push('adv.land.flare_throttle',          la.flare_throttle);
            push('adv.land.stick_cancel_thr',        la.stick_cancel_thr);
            push('adv.land.thr_cancel_thr',          la.thr_cancel_thr);
            push('adv.land.min_wind_speed',          la.min_wind_speed);
            push('adv.land.manual_runway_hdg',       la.manual_runway_hdg);
        }

        if (a.alt_config) {
            const ac = a.alt_config;
            if (ac.has_baro !== undefined) push('adv.alt.has_baro', ac.has_baro ? 1 : 0);
            push('adv.alt.w_z_baro_p',       ac.w_z_baro_p  ?? ac.baro_p);
            push('adv.alt.w_z_baro_v',       ac.w_z_baro_v  ?? ac.acc_z_p);
            push('adv.alt.w_z_acc_bias',     ac.w_z_acc_bias);
            push('adv.alt.acc_lpf_factor',   ac.acc_lpf_factor);
            push('adv.alt.acc_deadzone_mss', ac.acc_deadzone_mss);
        }

        if (a.virt_current) {
            push('adv.virt.scale',   a.virt_current.scale);
            push('adv.virt.idle',    a.virt_current.idle);
            push('adv.virt.calib',   a.virt_current.calib);
            push('adv.virt.cap_mah', a.virt_current.cap_mah);
        }

        if (a.battery) {
            push('adv.bat.adc_pin',   a.battery.adc_pin);
            push('adv.bat.adc_scale', a.battery.adc_scale);
        }

        if (a.calib_extra) {
            push('adv.calib.trim_roll',  a.calib_extra.trim_roll);
            push('adv.calib.trim_pitch', a.calib_extra.trim_pitch);
        }

        if (a.misc && a.misc.esc_hz   !== undefined) push('out.esc_hz',   a.misc.esc_hz);
        if (a.misc && a.misc.servo_hz !== undefined) push('out.servo_hz', a.misc.servo_hz);
        if (a.flaperon_offset !== undefined) push('out.flaperon_offset', a.flaperon_offset);
    }

    // --- OSD ---
    if (s.osd && s.osd.elements) {
        const elemNames = ['spd','rssi','bat','alt','vario','home','hor',
                           'arm','msg','wind','thr','mode','lat','lon','gcode','sat','time'];
        elemNames.forEach(name => {
            const el = s.osd.elements[name];
            if (!el) return;
            push(`osd.${name}.col`, el.x);
            push(`osd.${name}.row`, el.y);
            push(`osd.${name}.v`,   el.v !== undefined ? el.v : (el.visible ? 1 : 0));
        });
    }

    return pairs;
}

// ============================================================================
// CİHAZA GÖNDER (CFG_SET sırası + CFG_COMMIT)
// ============================================================================

function _sendCfgSetWait(key, value) {
    return new Promise((resolve, reject) => {
        window._setCfgPending(resolve, reject, 3000);
        sendCommand(JSON.stringify({ command: 'CFG_SET', key: key, value: String(value) }));
    });
}

function _sendCfgCommit() {
    return new Promise((resolve, reject) => {
        window._setCfgPending(resolve, reject, 8000);
        sendCommand(JSON.stringify({ command: 'CFG_COMMIT' }));
    });
}

async function _importAndSendToDevice(settings) {
    const pairs = _flattenConfig(settings);
    const total  = pairs.length;

    if (typeof log === 'function') {
        log(`🔄 ${total} ayar cihaza gönderiliyor...`, 'info');
    }

    for (let i = 0; i < pairs.length; i++) {
        const { key, value } = pairs[i];
        try {
            await _sendCfgSetWait(key, value);
            // Her 20 adımda bir ilerleme logu
            if (i % 20 === 0 && typeof log === 'function') {
                log(`📤 ${i + 1}/${total}: ${key}`, 'info');
            }
        } catch (err) {
            const msg = `"${key}" gönderilemedi: ${err.message}`;
            if (typeof log === 'function') log(`❌ İçe aktarma durdu — ${msg}`, 'error');
            if (typeof showModal === 'function') {
                showModal('İçe Aktarma Hatası', msg, 'error');
            }
            return;
        }
    }

    if (typeof log === 'function') {
        log('✅ Tüm alanlar gönderildi. Cihaz kaydedip yeniden başlatılıyor...', 'success');
    }

    try {
        await _sendCfgCommit();
    } catch (_) {
        // CFG_COMMIT sonrası ESP hemen restart olur.
        // "completed" yanıtı gelmeden bağlantı kopabilir — bu normaldir.
    }
}

// ============================================================================
// GLOBAL EXPORT
// ============================================================================

window.exportSettings = exportSettings;
window.importSettings = importSettings;

console.log('✅ Settings Backup modülü yüklendi');
