/**
 * i18n.js — Vecihi Configurator Dil Desteği
 * HTML'i değiştirmeden JS-tabanlı eşleştirme tablosuyla çeviri uygular.
 * Kullanım: data-i18n="key" attribute'u VEYA aşağıdaki PAGE_MAP tablosu.
 */

const I18N = (() => {
    let _locale = {};
    let _lang = localStorage.getItem('vc_lang') || 'tr';

    // "nav.sensors" → locale["nav"]["sensors"]
    function t(key) {
        const parts = key.split('.');
        let cur = _locale;
        for (const p of parts) {
            if (cur == null || typeof cur !== 'object') return key;
            cur = cur[p];
        }
        return (typeof cur === 'string') ? cur : key;
    }

    // Element'in icon'unu (bi icon) koruyarak sadece metin node'unu günceller
    function setTextKeepIcon(el, text) {
        if (!el) return;
        // text node'larını güncelle, icon <i> elemanlarına dokunma
        let found = false;
        for (const node of el.childNodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                node.textContent = ' ' + text;
                found = true;
                break;
            }
        }
        if (!found) {
            // text node yoksa ekle (veya icon yoksa direkt yaz)
            const icon = el.querySelector('i.bi');
            if (icon) {
                el.appendChild(document.createTextNode(' ' + text));
            } else {
                el.textContent = text;
            }
        }
    }

    // -------------------------------------------------------------------------
    // data-i18n attribute'u olan elementleri uygula
    // -------------------------------------------------------------------------
    function applyDataAttrs() {
        document.querySelectorAll('[data-i18n]').forEach(el => {
            const val = t(el.getAttribute('data-i18n'));
            if (val !== el.getAttribute('data-i18n')) setTextKeepIcon(el, val);
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
            const val = t(el.getAttribute('data-i18n-placeholder'));
            if (val !== el.getAttribute('data-i18n-placeholder')) el.placeholder = val;
        });
        document.querySelectorAll('[data-i18n-title]').forEach(el => {
            const val = t(el.getAttribute('data-i18n-title'));
            if (val !== el.getAttribute('data-i18n-title')) el.title = val;
        });
    }

    // -------------------------------------------------------------------------
    // Nav linkleri: data-page attribute'ına göre eşleştir
    // -------------------------------------------------------------------------
    const NAV_PAGE_MAP = {
        'sensors':     'nav.sensors',
        'calibration': 'nav.calibration',
        'mixer':       'nav.mixer',
        'gps':         'nav.gps',
        'transmitter': 'nav.transmitter',
        'modes':       'nav.modes',
        'pid':         'nav.pid',
        'advanced':    'nav.advanced',
        'osd':         'nav.osd',
        'waypoint':    'nav.waypoint',
        'logs':        'nav.logs',
        'home':        'nav.home',
        'firmware':    'nav.firmware',
        'kml':         'nav.kml',
        'docs':        'nav.docs',
    };

    function applyNavLinks() {
        document.querySelectorAll('[data-page]').forEach(link => {
            const page = link.getAttribute('data-page');
            const key  = NAV_PAGE_MAP[page];
            if (!key) return;
            const val = t(key);
            if (val === key) return;
            // Son text node'unu bul ve güncelle (icon'u korur)
            const nodes = Array.from(link.childNodes).reverse();
            for (const node of nodes) {
                if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                    node.textContent = ' ' + val;
                    return;
                }
            }
        });
    }

    function applyGroundControlLink() {
        const el = document.getElementById('btnGroundControlOffline');
        if (!el) return;
        const nodes = Array.from(el.childNodes).reverse();
        for (const node of nodes) {
            if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
                node.textContent = ' ' + t('nav.ground_control');
                return;
            }
        }
    }

    // -------------------------------------------------------------------------
    // Bağlantı kartı açıklaması — <b> içeren karmaşık yapı
    // -------------------------------------------------------------------------
    function applyConnectionPrompt() {
        // h2 (connection.title), .prompt-description içindeki span/b'ler
        // (connection.description/_bold/_end) zaten kendi data-i18n
        // attribute'larıyla applyDataAttrs() tarafından doğru çevriliyor.
        const btn = document.getElementById('btnConnectPrompt');
        if (btn) setTextKeepIcon(btn, t('connection.connect_btn'));
    }

    // -------------------------------------------------------------------------
    // Pin reboot uyarıları (tekrarlanan yapı)
    // -------------------------------------------------------------------------
    function applyPinRebootWarnings() {
        document.querySelectorAll('.pin-reboot-warning').forEach(el => {
            const strong = el.querySelector('strong');
            if (strong) strong.textContent = t('pin_common.reboot_warning_bold');
            const texts = Array.from(el.childNodes).filter(n => n.nodeType === Node.TEXT_NODE);
            if (texts[0]) texts[0].textContent = '\n        ' + t('pin_common.reboot_warning') + ' ';
            if (texts[1]) texts[1].textContent = ' ' + t('pin_common.reboot_warning_end');
        });
    }

    // -------------------------------------------------------------------------
    // Sayfa eleman tablosu: [css_selector, i18n_key]
    // querySelector ile ilk eşleşen elementin metni güncellenir.
    // -------------------------------------------------------------------------
    const PAGE_MAP = [
        // HEADER — btnDisconnect artık icon-only, title data-i18n-title ile çevrilir

        // BAĞLANTI KARTI
        ['#btnConnectPrompt',                                 'connection.connect_btn'],

        // FİRMWARE
        ['#firmwarePage h2',                                  'firmware.title'],
        ['#firmwarePage p.text-muted',                        'firmware.subtitle'],
        ['#firmwarePage [slot="activate"]',                   'firmware.flash_btn'],

        // KML
        ['#kmlPage .prompt-links-title',                      'kml.title'],
        ['#kmlPage .prompt-links-subtitle',                   'kml.subtitle'],
        ['#kmlPage .kml-drop-text',                           'kml.drop_text'],
        ['#kmlPage .kml-drop-hint',                           'kml.drop_hint'],
        ['#btnKmlDownload',                                   'kml.btn_download'],
        ['#btnKmlGoogleEarth',                                'kml.btn_earth'],
        ['#btnKmlReset',                                      'kml.btn_reset'],

        // DOCS
        ['#docsPage .prompt-links-title',                     'docs.title'],
        ['#docsPage .prompt-links-subtitle',                  'docs.subtitle'],

        // SENSÖRLER
        ['#sensors .baslik .fw-semibold',                     'sensors.cal_view'],
        ['#sensors .mode-label',                              'sensors.flight_mode'],
        ['#map-container',                                    null], // sadece başlık

        // KALİBRASYON
        ['#calibration .panel-title',                         'calibration.page_title'],
        ['#calibration .pin-acc-title',                       'calibration.pin_title'],
        ['#btnSaveCalibration',                               'calibration.btn_save'],
        ['#calibration .t-baslik',                            'calibration.pose_title'],

        // GPS
        ['#gps .panel-title',                                 'gps.page_title'],
        ['#gps .pin-acc-title',                               'gps.pin_title'],
        ['#btnSaveGps',                                       'gps.btn_save'],

        // MİKSER
        ['#mixer .panel-title',                               'mixer.aircraft_title'],
        ['#btnSaveMixer',                                     'mixer.btn_save'],

        // KUMANDA
        ['#transmitter .panel-title',                         'transmitter.page_title'],
        ['#transmitter .pin-acc-title',                       'transmitter.pin_title'],
        ['#btnSaveTransmitter',                               'transmitter.btn_save'],
        ['#stickCmdsModal .modal-title',                      'transmitter.stick_modal_title'],

        // MODLAR
        ['#modes .panel-title',                               'modes.page_title'],
        ['#btnSaveModes',                                     'modes.btn_save'],

        // PID
        ['#pid .panel-title',                                 'pid.page_title'],
        ['#btnSavePID',                                       'pid.btn_save'],

        // GELİŞMİŞ/TERCİHLER
        ['#advanced .panel-title',                            'advanced.page_title'],
        ['#advanced .pin-acc-title',                          'advanced.bat_pin_title'],
        ['#btnSaveAdvanced',                                  'advanced.btn_save'],

        // OSD
        ['#osd .panel-title',                                 'osd.page_title'],
        ['#osd .pin-acc-title',                               'osd.pin_title'],
        ['#btnSaveOSD',                                       'osd.btn_save'],
        ['label[for="osd_enabled"]',                          'osd.osd_active'],

        // LOGLAR
        ['#logs .panel-title',                                'logs.page_title'],
        ['#logs .h5:not(.panel-title)',                       'logs.shortcuts_title'],

        // WAYPOINT
        ['#waypoint .panel-title',                            'waypoint.page_title'],
        ['#btnUploadWaypoints',                               'waypoint.btn_upload'],

        // MODALLER
        ['#confirmModalLabel',                                'modal.confirm_title'],
        ['#saveModalLabel',                                   'modal.save_title'],
        ['#recommendedPinsModalLabel',                        'modal.pins_title'],
        ['#confirmModal .btn-danger',                         'modal.btn_confirm'],
        ['#recommendedPinsModal .modal-footer .btn-secondary','modal.btn_close'],
        ['#saveModal .modal-footer .btn-secondary',           'modal.btn_close'],
        ['#confirmModal .btn-secondary',                      'modal.btn_cancel'],
    ];

    function applyPageMap() {
        for (const [sel, key] of PAGE_MAP) {
            if (!key || !sel) continue;
            try {
                const el = document.querySelector(sel);
                if (!el) continue;
                const val = t(key);
                if (val === key) continue;
                setTextKeepIcon(el, val);
            } catch (_) { /* geçersiz selector yoksay */ }
        }
    }

    // -------------------------------------------------------------------------
    // Locale JSON yükle ve tüm çevirileri uygula
    // -------------------------------------------------------------------------
    function loadAndApply(lang) {
        _lang = lang;
        localStorage.setItem('vc_lang', lang);
        const globe = lang === 'tr' ? window.VECIHI_LOCALE_TR : window.VECIHI_LOCALE_EN;
        if (!globe) {
            console.warn('[i18n] locale global bulunamadı:', lang);
            return;
        }
        _locale = globe;
        applyDataAttrs();
        applyNavLinks();
        applyGroundControlLink();
        applyConnectionPrompt();
        applyPinRebootWarnings();
        applyPageMap();
        updateToggleBtn();
        document.documentElement.setAttribute('lang', lang === 'tr' ? 'tr' : 'en');
    }

    // -------------------------------------------------------------------------
    // Dil toggle butonu
    // -------------------------------------------------------------------------
    function updateToggleBtn() {
        const btn = document.getElementById('langToggleBtn');
        if (!btn) return;
        btn.textContent = _lang === 'tr' ? 'EN' : 'TR';
        btn.title       = _lang === 'tr' ? 'Switch to English' : "Türkçe'ye geç";
    }

    function createToggleBtn() {
        const btn = document.createElement('button');
        btn.id          = 'langToggleBtn';
        btn.className   = 'btn btn-sm';
        btn.style.cssText = [
            'font-size:0.72rem',
            'padding:2px 9px',
            'border:1px solid #444',
            'color:#aaa',
            'background:transparent',
            'min-width:34px',
            'letter-spacing:0.03em',
            'flex-shrink:0',
            'cursor:pointer',
            'z-index:9999',
        ].join(';');
        btn.textContent = _lang === 'tr' ? 'EN' : 'TR';
        btn.title       = _lang === 'tr' ? 'Switch to English' : "Türkçe'ye geç";
        btn.addEventListener('click', () => loadAndApply(_lang === 'tr' ? 'en' : 'tr'));
        return btn;
    }

    // -------------------------------------------------------------------------
    // Başlatma: toggle butonunu header'a ekle, varsayılan locale'i yükle
    // -------------------------------------------------------------------------
    function init() {
        const btn = createToggleBtn();
        // btnDisconnect'in parent'ı = header'ın sağ flex container'ı
        const headerRight = document.getElementById('btnDisconnect')?.parentElement
                         || document.getElementById('connectionStatusBox')?.parentElement;
        if (headerRight) headerRight.prepend(btn);
        else document.body.prepend(btn);

        loadAndApply(_lang);
    }

    return { init, t, setLang: loadAndApply };
})();

document.addEventListener('DOMContentLoaded', I18N.init);
