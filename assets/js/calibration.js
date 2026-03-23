/**
 * ============================================
 * VECİHİ CONFIGURATOR - CALIBRATION PAGE MODULE
 * ============================================
 * Kalibrasyon sayfasına ait tüm JavaScript kodları
 * 
 * Bu dosya aşağıdaki işlevleri içerir:
 * - 6 pozisyon ivmeölçer kalibrasyonu
 * - Jiroskop kalibrasyonu
 * - Level trim kalibrasyonu
 * - Kalibrasyon UI yönetimi
 * 
 * Bağımlılıklar (ana dosyadan):
 * - isConnected, sendCommand, log, $, showModal
 * - isCalibrating, poseCalibrationState (global değişkenler)
 * 
 * NOT: Bu dosya ana HTML'deki <script> bloğundan SONRA yüklenmelidir
 * veya DOMContentLoaded sonrası çağrılmalıdır.
 * 
 * HTML'de sıralama:
 * <script src="js/sensors.js"></script>
 * <script src="js/calibration.js"></script>  <!-- BURAYA -->
 * <script> ... ana kod ... </script>
 * 
 * Ana HTML'den şu FONKSİYONLAR silinmelidir:
 * - handleCalibrationPageData()
 * - handlePoseCalibrationComplete()
 * - setBusy()
 * - updateCalStepUI()
 * - resetCalibrationUI()
 * - sendPoseCommand()
 * - saveCalibration()
 * - activateCalibrationPage()
 * - setupCalibrationEventListeners() içindeki kodlar
 * 
 * Ana HTML'de KALMASI gereken değişkenler:
 * let isCalibrating = false;
 * let poseCalibrationState = { zp: false, zn: false, xp: false, xn: false, yp: false, yn: false };
 */

(function() {
    'use strict';

    // ============================================
    // KALİBRASYON UI FONKSİYONLARI
    // ============================================

    /**
     * @brief Kalibrasyon sırasında UI'ı kilitler/açar
     * @param {boolean} busyState - true: kilitle, false: aç
     */
    function setBusy(busyState) {
        // Global isCalibrating değişkenini güncelle
        if (typeof isCalibrating !== 'undefined') {
            isCalibrating = busyState;
        }

        document.querySelectorAll('#calibration .cal-step').forEach(function(stepBox) {
            if (!stepBox.classList.contains('completed')) {
                if (busyState) {
                    stepBox.classList.add('disabled');
                } else {
                    stepBox.classList.remove('disabled');
                }
            }
        });

        var saveBtn = document.getElementById('globalSaveBtn');
        if (saveBtn) {
            saveBtn.disabled = busyState;
        }
    }

    /**
     * @brief Tek bir kalibrasyon adımının (kutu) UI'ını günceller
     * @param {string} key - Pozisyon anahtarı (zp, zn, xp, xn, yp, yn, gy, level)
     * @param {boolean} isCompleted - Tamamlandı mı?
     * @param {Object} poseData - Pozisyon verisi (ax, ay, az)
     */
    function updateCalStepUI(key, isCompleted, poseData) {
        if (poseData === undefined) poseData = null;
        
        var stepBox = document.querySelector('.cal-step[data-target="#btn-pose-' + key.toLowerCase() + '"]');

        if (!stepBox) {
            console.error('HATA: Kalibrasyon kutusu bulunamadı! key:', key);
            return;
        }

        var axEl = stepBox.querySelector('.cal-val-ax');
        var ayEl = stepBox.querySelector('.cal-val-ay');
        var azEl = stepBox.querySelector('.cal-val-az');

        if (!axEl || !ayEl || !azEl) {
            // 'level' ve 'gy' butonları için bu normaldir
            if (key !== 'level' && key !== 'gy') {
                console.warn('Kutunun içindeki .cal-val-ax/ay/az span\'ları bulunamadı, key:', key);
            }
        }

        if (isCompleted) {
            stepBox.classList.add('completed');
            stepBox.classList.remove('active', 'inactive', 'disabled');

            if (poseData && axEl) {
                var val_ax = poseData.ax !== undefined ? poseData.ax.toFixed(1) : '--';
                var val_ay = poseData.ay !== undefined ? poseData.ay.toFixed(1) : '--';
                var val_az = poseData.az !== undefined ? poseData.az.toFixed(1) : '--';

                axEl.textContent = 'X: ' + val_ax;
                ayEl.textContent = 'Y: ' + val_ay;
                azEl.textContent = 'Z: ' + val_az;

                axEl.style.color = '#ff6b6b';
                ayEl.style.color = '#51cf66';
                azEl.style.color = '#339af0';
            } else if (axEl) {
                axEl.textContent = 'X: --';
                ayEl.textContent = 'Y: --';
                azEl.textContent = 'Z: --';
                axEl.style.color = '#adb5bd';
                ayEl.style.color = '#adb5bd';
                azEl.style.color = '#adb5bd';
            }

        } else {
            stepBox.classList.remove('completed', 'active', 'disabled');
            stepBox.classList.add('inactive');

            if (axEl) {
                axEl.textContent = 'X: --';
                ayEl.textContent = 'Y: --';
                azEl.textContent = 'Z: --';
                axEl.style.color = '#adb5bd';
                ayEl.style.color = '#adb5bd';
                azEl.style.color = '#adb5bd';
            }
        }
    }

    /**
     * @brief Tüm kalibrasyon UI'ını sıfırlar (kutuları gri yapar)
     */
    function resetCalibrationUI() {
        if (typeof poseCalibrationState !== 'undefined') {
            Object.keys(poseCalibrationState).forEach(function(key) {
                poseCalibrationState[key] = false;
                updateCalStepUI(key, false);
            });
        }
        updateCalStepUI('gy', false);
        updateCalStepUI('level', false);
        
        if (typeof log === 'function') {
            log('🔄 Kalibrasyon durumu sıfırlandı.', 'warning');
        }
    }

    // ============================================
    // KALİBRASYON KOMUT FONKSİYONLARI
    // ============================================

    /**
     * @brief İlgili pozisyon için kalibrasyon komutunu cihaza gönderir
     * @param {string} poseKey - Pozisyon anahtarı (zp, zn, xp, xn, yp, yn)
     */
    function sendPoseCommand(poseKey) {
        if (typeof isConnected !== 'undefined' && !isConnected) return;
        if (typeof isCalibrating !== 'undefined' && isCalibrating) return;

        setBusy(true);
        var n = 500; // Örneklem sayısı
        var command = 'CAL_ACCEL_POSE_' + poseKey.toUpperCase() + ' ' + n;

        if (typeof log === 'function') {
            log('📤 POZ KOMUTU: ' + command, 'command');
        }

        if (typeof sendCommand === 'function') {
            if (!sendCommand(command)) {
                if (typeof log === 'function') {
                    log('❌ Komut gönderilemedi', 'error');
                }
                setBusy(false);
            }
        }
    }

    /**
     * @brief 6 pozisyon tamamlandıysa, çözme (solve) ve kaydetme komutunu gönderir
     */
    function saveCalibration() {
        if (typeof poseCalibrationState === 'undefined') return;
        
        var completed = Object.values(poseCalibrationState).every(function(status) { return status; });

        if (!completed) {
            if (typeof showModal === 'function') {
                showModal('Uyarı', 'Lütfen önce tüm 6 pozisyonu tamamlayın.', 'warning');
            }
            var saveBtn = document.getElementById('globalSaveBtn');
            if (saveBtn) {
                saveBtn.innerHTML = '<i class="bi bi-save"></i> Kaydet';
                saveBtn.disabled = false;
            }
            return;
        }

        if (typeof log === 'function') {
            log('💾 Kalibrasyon çözülüyor ve kaydediliyor...', 'info');
        }
        setBusy(true);

        if (typeof sendCommand === 'function') {
            if (!sendCommand('CALIB_SOLVE')) {
                if (typeof log === 'function') {
                    log('❌ Kaydetme komutu gönderilemedi', 'error');
                }
                setBusy(false);
            }
        }
    }

    // ============================================
    // VERİ İŞLEME FONKSİYONLARI
    // ============================================

    /**
     * @brief Kalibrasyon sayfası verilerini işler
     * @param {Object} data - ESP32'den gelen kalibrasyon verileri
     */
    function handleCalibrationPageData(data) {
        console.log('Kalibrasyon sayfa verileri alındı:', data);

        // 1) Pose kutuları
        if (data.pose_state && typeof poseCalibrationState !== 'undefined') {
            poseCalibrationState = data.pose_state;

            Object.keys(poseCalibrationState).forEach(function(key) {
                var poseData = data.pose_data ? data.pose_data[key] : null;
                updateCalStepUI(key, poseCalibrationState[key], poseData);
            });

            if (typeof log === 'function') {
                log('✅ Kalibrasyon durumu UI güncellendi', 'success');
            }
        } else {
            if (typeof log === 'function') {
                log('⚠️ Kalibrasyon durumu bulunamadı, UI sıfırlanıyor', 'warning');
            }
            resetCalibrationUI();
        }

        // 2) Mevcut kalibrasyon değerleri paneli
        var off = data.offsets || (data.calibration && data.calibration.offsets) || null;
        if (!off) return;

        var $ = function(id) { return document.getElementById(id); };

        // ACC Bias
        if (Array.isArray(off.accel_bias) && $('cal_acc_bias')) {
            $('cal_acc_bias').textContent =
                'x: ' + off.accel_bias[0].toFixed(4) + '  y: ' + off.accel_bias[1].toFixed(4) + '  z: ' + off.accel_bias[2].toFixed(4);
        }

        // ACC Scale (accel_mat diagonal)
        if (Array.isArray(off.accel_mat) && off.accel_mat.length >= 9 && $('cal_acc_scale')) {
            var sx = off.accel_mat[0], sy = off.accel_mat[4], sz = off.accel_mat[8];
            $('cal_acc_scale').textContent =
                'x: ' + sx.toFixed(4) + '  y: ' + sy.toFixed(4) + '  z: ' + sz.toFixed(4);
        }

        // GYRO Bias
        if (Array.isArray(off.gyro_bias) && $('cal_gyro_bias')) {
            $('cal_gyro_bias').textContent =
                'x: ' + off.gyro_bias[0].toFixed(4) + '  y: ' + off.gyro_bias[1].toFixed(4) + '  z: ' + off.gyro_bias[2].toFixed(4);
        }

        // Level Trim
        var trim = off.level_trim || off.trim || null;
        var tp = (trim && typeof trim.pitch === 'number') ? trim.pitch : null;
        var tr = (trim && typeof trim.roll === 'number') ? trim.roll : null;
        
        // advancedConfig'den fallback
        if (tp === null && typeof advancedConfig !== 'undefined' && advancedConfig.calib_extra) {
            tp = advancedConfig.calib_extra.trim_pitch;
        }
        if (tr === null && typeof advancedConfig !== 'undefined' && advancedConfig.calib_extra) {
            tr = advancedConfig.calib_extra.trim_roll;
        }

        if ($('cal_level_trim')) {
            $('cal_level_trim').textContent =
                'pitch: ' + (tp === null ? '--' : tp.toFixed(2)) + '  roll: ' + (tr === null ? '--' : tr.toFixed(2));
        }
    }

    /**
     * @brief Pozisyon kalibrasyonu tamamlandığında çağrılır
     * @param {string} poseKey - Pozisyon anahtarı
     * @param {Object} poseData - Pozisyon verisi
     */
    function handlePoseCalibrationComplete(poseKey, poseData) {
        updateCalStepUI(poseKey, true, poseData);
        if (typeof poseCalibrationState !== 'undefined') {
            poseCalibrationState[poseKey] = true;
        }
        if (typeof log === 'function') {
            log('✅ ' + poseKey.toUpperCase() + ' pozisyonu tamamlandı', 'success');
        }
    }

    /**
     * @brief Kalibrasyon status response'larını işler (handleStatusResponse içinden çağrılır)
     * @param {string} command - Komut adı
     * @param {string} result - Sonuç
     * @param {Object} fullData - Tam veri
     * @returns {boolean} - İşlendi mi?
     */
    function handleCalibrationStatusResponse(command, result, fullData) {
        switch (command) {
            case 'CAL_GYRO':
                setBusy(false);
                if (result === 'completed') {
                    if (typeof log === 'function') log('✅ GYRO Kalibrasyon kaydedildi!', 'success');
                    if (typeof showModal === 'function') showModal('Başarılı', 'GYRO Kalibrasyon başarıyla tamamlandı.', 'success');
                    updateCalStepUI('gy', true);
                } else {
                    if (typeof log === 'function') log('❌ Kaydetme hatası: ' + result, 'error');
                    if (typeof showModal === 'function') showModal('Hata', 'Kayıt başarısız: ' + result, 'error');
                }
                return true;

            case 'CALIB_POSE':
                setBusy(false);
                var poseKey = fullData.status ? fullData.status.pose : null;
                var poseData = fullData.status ? fullData.status.data : null;

                if (result === 'completed' && poseKey) {
                    if (poseData && typeof poseData === 'object' && !Array.isArray(poseData)) {
                        if (typeof log === 'function') log('✅ Poz [' + poseKey.toUpperCase() + '] tamamlandı', 'success');
                        if (typeof poseCalibrationState !== 'undefined') {
                            poseCalibrationState[poseKey] = true;
                        }
                        updateCalStepUI(poseKey, true, poseData);
                    } else {
                        if (typeof log === 'function') log('⚠️ Poz [' + poseKey.toUpperCase() + '] tamamlandı ama data boş.', 'warning');
                        updateCalStepUI(poseKey, true, null);
                    }

                    if (typeof poseCalibrationState !== 'undefined') {
                        var allDone = Object.values(poseCalibrationState).every(function(s) { return s; });
                        if (allDone) {
                            if (typeof log === 'function') log('🎉 Tüm pozisyonlar tamamlandı! "Kaydet" butonuna basın.', 'success');
                            if (typeof showModal === 'function') {
                                showModal('Kalibrasyon Aşaması Bitti',
                                    '<p>Tüm 6 pozisyon başarıyla tamamlandı.</p><p class="mb-0">Ayarları cihaza kalıcı olarak yazmak için lütfen <strong>Kaydet</strong> butonuna basın.</p>',
                                    'success');
                            }
                        }
                    }
                } else if (result !== 'completed') {
                    if (typeof log === 'function') log('❌ Poz hatası (' + poseKey + '): ' + result, 'error');
                    if (typeof showModal === 'function') {
                        showModal('Kalibrasyon Hatası',
                            '<p>Poz <strong>' + (poseKey ? poseKey.toUpperCase() : '') + '</strong> kalibrasyonu sırasında bir hata oluştu.</p><p class="mb-0">Hata: ' + result + '</p>',
                            'error');
                    }
                }
                return true;

            case 'CALIB_SOLVE':
                setBusy(false);
                if (result === 'completed') {
                    if (typeof log === 'function') log('✅ 6-Pozisyon Kalibrasyonu kaydedildi!', 'success');
                    if (typeof showModal === 'function') showModal('Başarılı', 'Kalibrasyon başarıyla kaydedildi.', 'success');
                } else {
                    if (typeof log === 'function') log('❌ Kaydetme hatası: ' + result, 'error');
                    if (typeof showModal === 'function') showModal('Hata', 'Kayıt başarısız: ' + result, 'error');
                }
                var saveBtn = document.getElementById('globalSaveBtn');
                if (saveBtn) {
                    saveBtn.innerHTML = '<i class="bi bi-save"></i> Kaydet';
                    saveBtn.disabled = false;
                }
                return true;

            case 'zero_calibration_completed':
                setBusy(false);
                if (result === 'completed') {
                    if (typeof log === 'function') log('✅ İvmeölçer ince ayarı (Trim) kaydedildi!', 'success');
                    if (typeof showModal === 'function') showModal('Başarılı', 'Cihazın yeni "düz" konumu kaydedildi. HUD 0\'a eşitlenecek.', 'success');
                    updateCalStepUI('level', true);
                } else {
                    if (typeof log === 'function') log('❌ İnce ayar hatası: ' + result, 'error');
                    if (typeof showModal === 'function') showModal('Hata', 'İnce ayar kaydedilemedi: ' + result, 'error');
                }
                return true;

            default:
                return false; // Bu komut kalibrasyon ile ilgili değil
        }
    }

    // ============================================
    // SAYFA AKTİVASYON
    // ============================================

    /**
     * @brief Kalibrasyon sayfasını aktif eder
     */
    function activateCalibrationPage() {
        document.querySelectorAll('.nav-link').forEach(function(nav) { nav.classList.remove('active'); });
        document.querySelectorAll('.page').forEach(function(page) { page.classList.remove('active'); });
        
        var nav = document.querySelector('[data-page="calibration"]');
        if (nav) nav.classList.add('active');
        
        var pageEl = document.getElementById('calibration');
        if (pageEl) pageEl.classList.add('active');
        
        if (typeof window.currentPage !== 'undefined') {
            window.currentPage = 'calibration';
        } else if (typeof currentPage !== 'undefined') {
            currentPage = 'calibration';
        }
        
        if (typeof updateConnectionStatus === 'function') {
            updateConnectionStatus();
        }
    }

    // ============================================
    // EVENT LISTENER KURULUMU
    // ============================================

    /**
     * @brief Kalibrasyon sayfası event listener'larını kurar
     * Ana dosyadaki setupEventListeners() içinden çağrılabilir
     */
    function setupCalibrationEventListeners() {
        document.querySelectorAll('.cal-step[data-target^="#btn-pose-"]').forEach(function(stepBox) {
            var targetId = stepBox.getAttribute('data-target');
            var poseKey = targetId.replace('#btn-pose-', '');

            stepBox.addEventListener('click', function() {
                if (typeof isCalibrating !== 'undefined' && isCalibrating) return;
                if (stepBox.classList.contains('disabled')) return;

                document.querySelectorAll('.cal-step').forEach(function(s) { s.classList.remove('active'); });
                stepBox.classList.add('active');
                stepBox.classList.remove('inactive');

                if (poseKey === 'gy') {
                    if (typeof log === 'function') log('📤 Jiro Kalibrasyon komutu gönderiliyor...', 'command');
                    if (typeof window.sendQuickCommand === 'function') {
                        window.sendQuickCommand('CAL_GYRO');
                    }
                } else if (poseKey === 'level') {
                    if (typeof log === 'function') log('📤 İvmeölçer İnce Ayar (Trim) komutu gönderiliyor...', 'command');
                    if (typeof window.sendQuickCommand === 'function') {
                        window.sendQuickCommand('CAL_LEVEL');
                    }
                } else if (['zp', 'zn', 'xp', 'xn', 'yp', 'yn'].indexOf(poseKey) !== -1) {
                    // Eğer tüm kutular zaten yeşilse, yeni oturum başlat
                    if (typeof poseCalibrationState !== 'undefined') {
                        var isAllDone = Object.values(poseCalibrationState).every(function(s) { return s === true; });
                        if (isAllDone) {
                            if (typeof log === 'function') log('🔄 Yeni kalibrasyon oturumu başlatılıyor, eski durum temizlendi.', 'warning');
                            resetCalibrationUI();
                            stepBox.classList.add('active');
                            stepBox.classList.remove('inactive');
                        }
                    }
                    sendPoseCommand(poseKey);
                }
            });
        });
    }

    // ============================================
    // GLOBAL SCOPE'A AKTAR
    // ============================================

    window.setBusy = setBusy;
    window.updateCalStepUI = updateCalStepUI;
    window.resetCalibrationUI = resetCalibrationUI;
    window.sendPoseCommand = sendPoseCommand;
    window.saveCalibration = saveCalibration;
    window.handleCalibrationPageData = handleCalibrationPageData;
    window.handlePoseCalibrationComplete = handlePoseCalibrationComplete;
    window.handleCalibrationStatusResponse = handleCalibrationStatusResponse;
    window.activateCalibrationPage = activateCalibrationPage;
    window.setupCalibrationEventListeners = setupCalibrationEventListeners;

    // Modül objesi
    window.CalibrationModule = {
        setBusy: setBusy,
        updateCalStepUI: updateCalStepUI,
        resetCalibrationUI: resetCalibrationUI,
        sendPoseCommand: sendPoseCommand,
        saveCalibration: saveCalibration,
        handleCalibrationPageData: handleCalibrationPageData,
        handlePoseCalibrationComplete: handlePoseCalibrationComplete,
        handleCalibrationStatusResponse: handleCalibrationStatusResponse,
        activateCalibrationPage: activateCalibrationPage,
        setupCalibrationEventListeners: setupCalibrationEventListeners
    };

    console.log('✅ Calibration Module yüklendi');

})();
