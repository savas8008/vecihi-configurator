// SITL (Software-In-The-Loop) sayfasi — uçagi yerde, pil harcamadan ve
// kirmadan ucurmak icin.
//
// Mimari: firmware'in gercek ucus mantigi (control_loop, navigation,
// flight_modes, attitude_mahony, ...) `vecihi/sitl/build_wasm.sh` ile
// WebAssembly'ye derlenip `assets/sitl/sitl.js` olarak buraya geliyor. Yani
// bu sayfada kosan sey, uçaktakiyle AYNI kaynak koddur — taklit degil.
//
// Canli kumanda: uçus kartina bagli gercek alici, kartin USB seri akisiyla
// (start_receiver_stream -> {"stream_data":{"type":"receiver","data":[...16]}})
// 20 Hz'de 16 kanali gonderiyor; onReceiverStreamForSitl() bunu yakalayip
// simulasyona veriyor. Boylece CRSF/SBUS ayristirma, kanal haritasi, ters
// cevirme ve yumusatma GERCEK receiver.cpp uzerinden gecmis oluyor.
//
// !! GUVENLIK: kart kendi ucus mantigini da kosuyor. Arm switch'i acildiginda
// kartin motor/servo cikislari GERCEKTEN canlanir. PERVANEYI SOKUN.

// ==================== DURUM ====================

let sitlModule = null;         // WASM modulu (bir kez yuklenir)
let sitlApi = null;            // cwrap'lenmis fonksiyonlar
let sitlLoading = false;
let sitlRunning = false;       // simulasyon adimlaniyor mu
let sitlStarted = false;       // init edildi mi
let sitlSpeed = 1.0;           // duvar saati carpani (0 = sinirsiz)
let sitlRafId = null;
let sitlLastFrameMs = 0;
let sitlTickAccum = 0;         // artakalan simulasyon zamani (sn)
let sitlDt = 0.002;

// Kart ayarlari yuklendi mi? false ise simulasyon config_types.h'deki
// DERLEME-ZAMANI varsayilanlariyla kosar (kullanicinin PID/mod ayarlari degil).
let sitlBoardConfigLoaded = false;
let sitlConfigLoading = false;

let sitlLiveInput = false;     // gercek kumandadan surulsun mu
let sitlLiveChannels = null;   // son gelen 16 kanal
let sitlChannelPtr = 0;        // WASM heap'inde 16*int4 tampon
let sitlLastRxMs = 0;          // son alici paketinin zamani (tazelik gostergesi)

// Gorsellestirme
let sitlMap = null, sitlTrackLine = null, sitlPlaneMarker = null, sitlHomeMarker = null;
let sitlTrack = [];
let sitl3D = null;             // {scene, camera, renderer, model}
let sitlMapFollow = true;

const SITL_MODE_NAMES = ['MANUAL','ANGLE','HORIZON','ACRO','RTH','LAUNCH','FAILSAFE',
                         'CRUISE','ALTHOLD','LOITER','AUTOTUNE','WAYPOINT','LAND_ASSIST','GCS'];
const SITL_LA_NAMES = ['IDLE','ENROUTE','WIND_DETECT','DOWNWIND','BASE_LEG','FINAL','FLARE','BITTI'];

// ==================== WASM YUKLEME ====================

/**
 * @brief <script> etiketini dinamik ekler, yuklenmesini bekler.
 */
function sitlInjectScript(src) {
    return new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = src;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error(src + ' yuklenemedi'));
        document.head.appendChild(s);
    });
}

/**
 * @brief WASM modulunu (bir kez) yukler ve API'yi hazirlar.
 * @return {Promise<boolean>} basarili mi
 */
async function sitlLoadModule() {
    if (sitlModule) return true;
    if (sitlLoading) return false;
    sitlLoading = true;
    sitlSetStatus('wasm_loading');

    try {
        // Motor (~180 KB, wasm ikilisi base64 gomulu) yalnizca bu sayfaya
        // girilince yuklenir — diger sayfalarin acilisini yavaslatmasin.
        if (typeof createSitlModule !== 'function') {
            await sitlInjectScript('assets/sitl/sitl.js');
        }
        if (typeof createSitlModule !== 'function') {
            throw new Error('assets/sitl/sitl.js bulunamadi (vecihi/sitl/build_wasm.sh ile uretilir)');
        }
        sitlModule = await createSitlModule();
        sitlApi = {
            init:        sitlModule.cwrap('sitl_init', 'number', ['string']),
            step:        sitlModule.cwrap('sitl_step', 'number', ['number']),
            stopReason:  sitlModule.cwrap('sitl_stop_reason', 'number', []),
            dt:          sitlModule.cwrap('sitl_dt', 'number', []),
            tick:        sitlModule.cwrap('sitl_tick', 'number', []),
            totalTicks:  sitlModule.cwrap('sitl_total_ticks', 'number', []),
            setChannels: sitlModule.cwrap('sitl_set_channels', null, ['number', 'number']),
            stateJson:   sitlModule.cwrap('sitl_state_json', 'string', []),
            events:      sitlModule.cwrap('sitl_events', 'string', []),
            kml:         sitlModule.cwrap('sitl_kml', 'string', []),
            setParam:    sitlModule.cwrap('sitl_set_param', 'number', ['string', 'number']),
            setMode:     sitlModule.cwrap('sitl_set_mode', 'number', ['string', 'number', 'number', 'number']),
            resetConfig: sitlModule.cwrap('sitl_reset_config', null, []),
            configJson:  sitlModule.cwrap('sitl_config_json', 'string', [])
        };
        // Kanal tamponu bir kez ayrilir (her karede malloc yapmamak icin).
        sitlChannelPtr = sitlModule._malloc(16 * 4);
        sitlLoading = false;
        sitlSetStatus('ready');
        sitlRenderConfigSummary();
        return true;
    } catch (e) {
        sitlLoading = false;
        sitlSetStatus('error', e.message);
        sitlLog('Simülasyon motoru yüklenemedi: ' + e.message, 'error');
        return false;
    }
}

// ==================== KART AYARLARINI AKTARMA ====================

/**
 * @brief Bir kosul saglanana kadar bekler (yoklama).
 */
function sitlWaitFor(kosul, timeoutMs, araMs) {
    return new Promise((resolve) => {
        const t0 = performance.now();
        const tik = () => {
            if (kosul()) return resolve(true);
            if (performance.now() - t0 > timeoutMs) return resolve(false);
            setTimeout(tik, araMs || 100);
        };
        tik();
    });
}

/**
 * @brief Kartin ayarlarini okuyup simulasyona aktarir.
 *
 * Iki ayri kaynak var, cunku firmware bunlari farkli sakliyor:
 *   1. param_list      -> param_table.cpp'deki 172 parametre (PID, rate, nav,
 *                         mikser, TECS, launch, land...). SITL ayni tabloyu
 *                         derliyor, yani ayri bir eslestirme listesi yok.
 *   2. modes_page_data -> ucus modu switch atamalari. Bunlar param tablosunda
 *                         DEGIL; NVS'e ayri bir JSON olarak yaziliyor.
 *
 * Arm kanali (config.rc.ch_arm) hicbir okuma komutuyla disari verilmiyor
 * (bkz. GOREVLER.md B45), o yuzden sayfadaki alandan elle giriliyor.
 */
async function sitlLoadBoardConfig() {
    if (sitlConfigLoading) return;
    if (typeof isConnected === 'undefined' || !isConnected) {
        sitlLog('Kart ayarlarını almak için önce üst menüden karta bağlanın.', 'warning');
        return;
    }
    if (!await sitlLoadModule()) return;

    sitlConfigLoading = true;
    sitlSetConfigStatus('loading');
    try {
        // Once temiz sayfa: onceki yukleme uzerine binmesin.
        sitlApi.resetConfig();

        // --- 1) Parametre tablosu ---
        sitlLog('Kart ayarları isteniyor: parametre tablosu…', 'info');
        if (typeof paramList === 'undefined') {
            throw new Error('parameters.js yüklenmemiş');
        }
        // Listeyi bosalt ki "doldu mu" kontrolu guvenilir olsun — kullanici
        // Parametreler sayfasini daha once ziyaret ettiyse liste zaten dolu
        // olur ve "arttı mı" kontrolu hicbir zaman saglanmazdi.
        paramList = [];
        sendCommand('param_list');
        const paramOk = await sitlWaitFor(() => paramList && paramList.length > 0, 8000, 150);

        let uygulanan = 0, taninmayan = 0;
        if (paramOk) {
            paramList.forEach(p => {
                if (!p || typeof p.n !== 'string') return;
                if (sitlApi.setParam(p.n, Number(p.v)) === 1) uygulanan++;
                else taninmayan++;
            });
            sitlLog(`${uygulanan} parametre aktarıldı` +
                    (taninmayan ? ` (${taninmayan} tanesi SITL'in tablosunda yok — firmware sürümü farklı olabilir)` : ''),
                    taninmayan ? 'warning' : 'info');
        } else {
            sitlLog('Parametre tablosu alınamadı (zaman aşımı).', 'error');
        }

        // --- 2) Ucus modu atamalari ---
        // Firmware tek current_command bayragi kullaniyor; param_list bitmeden
        // ikinci komutu gondermemek icin buraya kadar bekledik.
        sitlLog('Kart ayarları isteniyor: uçuş modları…', 'info');
        if (typeof activeFlightModes !== 'undefined') activeFlightModes = {};
        sendCommand('modes_page_data');
        const modeOk = await sitlWaitFor(
            () => typeof activeFlightModes !== 'undefined' && activeFlightModes &&
                  Object.keys(activeFlightModes).length > 0,
            5000, 150);

        let modAdedi = 0;
        if (modeOk) {
            Object.keys(activeFlightModes).forEach(key => {
                const m = activeFlightModes[key];
                if (!m || typeof m !== 'object') return;
                const ch = parseInt(m.channel, 10);
                if (!isFinite(ch) || ch < 1) return;         // atanmamis mod
                const mn = parseInt(m.min, 10), mx = parseInt(m.max, 10);
                if (sitlApi.setMode(key.toUpperCase(), ch, isFinite(mn) ? mn : 1300,
                                    isFinite(mx) ? mx : 1700) === 1) modAdedi++;
            });
            sitlLog(`${modAdedi} uçuş modu ataması aktarıldı.`, 'info');
        } else {
            sitlLog('Uçuş modu atamaları alınamadı (zaman aşımı).', 'error');
        }

        sitlBoardConfigLoaded = (uygulanan > 0 || modAdedi > 0);
        sitlSetConfigStatus(sitlBoardConfigLoaded ? 'board' : 'error');
        sitlRenderConfigSummary();

        if (sitlBoardConfigLoaded && modAdedi === 0) {
            sitlLog('Uyarı: karttan hiçbir mod ataması gelmedi. Uçuş Modları sayfasından ' +
                    'switch atamalarınızı yapıp kaydedin, yoksa uçak MANUAL\'de kalır.', 'warning');
        }
    } catch (e) {
        sitlLog('Ayar aktarımı başarısız: ' + e.message, 'error');
        sitlSetConfigStatus('error');
    } finally {
        sitlConfigLoading = false;
    }
}

/**
 * @brief Varsayılan (derleme-zamanı) ayarlara döner.
 */
function sitlUseDefaultConfig() {
    if (!sitlApi) return;
    sitlApi.resetConfig();
    sitlBoardConfigLoaded = false;
    sitlSetConfigStatus('default');
    sitlRenderConfigSummary();
    sitlLog('Varsayılan ayarlara dönüldü (config_types.h derleme-zamanı değerleri).', 'info');
}

function sitlSetConfigStatus(state) {
    const el = document.getElementById('sitlConfigStatus');
    if (!el) return;
    const map = {
        default: ['Varsayılan ayarlar', 'var(--color-warning)'],
        loading: ['Kart ayarları okunuyor…', 'var(--color-info)'],
        board:   ['Kart ayarları yüklü', 'var(--color-success)'],
        error:   ['Okunamadı — varsayılanlar geçerli', 'var(--color-danger)']
    };
    const m = map[state] || map.default;
    el.textContent = m[0];
    el.style.color = m[1];
}

/**
 * @brief Simülasyonun O AN kullandığı ayarların özetini gösterir.
 */
function sitlRenderConfigSummary() {
    const box = document.getElementById('sitlConfigSummary');
    if (!box || !sitlApi) return;
    let c;
    try { c = JSON.parse(sitlApi.configJson()); } catch (e) { return; }

    const modes = Object.keys(c.modes || {});
    const modeText = modes.length
        ? modes.map(k => `${k}: k${c.modes[k].ch} (${c.modes[k].min}-${c.modes[k].max})`).join(' · ')
        : 'Hiçbir moda switch atanmamış — uçak MANUAL\'de kalır';

    box.innerHTML =
        `<div class="sitl-cfg-row"><span>PID roll</span><b>P ${c.pid.roll_p} / I ${c.pid.roll_i} / D ${c.pid.roll_d} / FF ${c.pid.roll_ff}</b></div>` +
        `<div class="sitl-cfg-row"><span>PID pitch</span><b>P ${c.pid.pitch_p} / I ${c.pid.pitch_i} / D ${c.pid.pitch_d} / FF ${c.pid.pitch_ff}</b></div>` +
        `<div class="sitl-cfg-row"><span>Level P</span><b>${c.pid.level_p}</b></div>` +
        `<div class="sitl-cfg-row"><span>Maks. hız (°/s)</span><b>R ${c.rates.roll} / P ${c.rates.pitch} / Y ${c.rates.yaw}</b></div>` +
        `<div class="sitl-cfg-row"><span>Gövde / stall</span><b>${c.airframe} · ${c.stall_kmh} km/h</b></div>` +
        `<div class="sitl-cfg-modes"><span>Mod atamaları</span><b>${modeText}</b></div>`;
    box.style.display = '';
}

// ==================== SENARYO ====================

/**
 * @brief Formdaki alanlardan senaryo JSON'u uretir (sitl/scenarios/*.json semasi).
 */
function sitlBuildScenario() {
    const num = (id, def) => {
        const el = document.getElementById(id);
        const v = el ? parseFloat(el.value) : NaN;
        return isFinite(v) ? v : def;
    };
    const chk = (id, def) => {
        const el = document.getElementById(id);
        return el ? el.checked : def;
    };
    const str = (id, def) => {
        const el = document.getElementById(id);
        return el && el.value ? el.value : def;
    };

    const sc = {
        home: {
            lat: num('sitlHomeLat', 39.925),
            lon: num('sitlHomeLon', 32.866),
            alt: num('sitlHomeAlt', 100),
            heading: num('sitlHeading', 90),
            start_alt_offset_m: num('sitlStartAlt', 0)
        },
        wind: {
            speed_ms: num('sitlWindSpeed', 0),
            from_deg: num('sitlWindDir', 0)
        },
        mode: str('sitlMode', 'ANGLE'),
        duration_s: num('sitlDuration', 300),
        dt_s: 0.002,
        arm: chk('sitlArm', true),
        auto_launch: chk('sitlAutoLaunch', false),
        climb_phase_s: num('sitlClimbPhase', 150),
        input: {
            live: sitlLiveInput,
            // Kart ayarlari yuklendiyse senaryonun "mode" alanini bir kanala
            // BAGLAMA — kullanicinin kendi switch atamalari gecerli olsun.
            board_modes: sitlBoardConfigLoaded,
            arm_channel: Math.round(num('sitlArmChannel', 5)),
            mode_channel: Math.round(num('sitlModeChannel', 6))
        }
    };

    // Waypoint modunda haritadan/waypoint sayfasindan gelen noktalar
    if (sc.mode === 'WAYPOINT' && typeof waypoints !== 'undefined' && Array.isArray(waypoints) && waypoints.length) {
        sc.waypoints = waypoints.map(w => ({
            lat: w.lat, lon: w.lon, alt: w.alt || 50, task: w.task || 'CRUISE'
        }));
    }
    return sc;
}

// ==================== CALISTIRMA ====================

async function sitlStart() {
    if (!await sitlLoadModule()) return;

    const sc = sitlBuildScenario();

    if (!sitlBoardConfigLoaded) {
        sitlLog('Dikkat: kart ayarları yüklü değil — simülasyon varsayılan PID/mod ' +
                'değerleriyle koşuyor, sizin ayarlarınızla değil.', 'warning');
    }
    if (sitlLiveInput && !sitlLiveChannels) {
        sitlLog('Canlı kumanda seçili ama karttan alıcı verisi gelmiyor. ' +
                'Kartı bağlayın; sayfa açıkken alıcı akışı otomatik başlar.', 'warning');
    }

    sitlApi.init(JSON.stringify(sc));
    sitlDt = sitlApi.dt() || 0.002;
    sitlStarted = true;
    sitlRunning = true;
    sitlTickAccum = 0;
    sitlLastFrameMs = performance.now();

    // Iz ve harita sifirla
    sitlTrack = [];
    if (sitlTrackLine) sitlTrackLine.setLatLngs([]);
    sitlInitMap(sc.home.lat, sc.home.lon);
    if (sitlHomeMarker) sitlHomeMarker.setLatLng([sc.home.lat, sc.home.lon]);

    sitlClearEvents();
    sitlDrainEvents();
    sitlLog(`Senaryo başlatıldı: ${sc.mode}, rüzgâr ${sc.wind.speed_ms} m/s@${sc.wind.from_deg}°` +
            (sitlLiveInput ? ' — CANLI KUMANDA' : ''), 'info');
    sitlSetStatus('running');
    sitlUpdateButtons();

    if (!sitlRafId) sitlRafId = requestAnimationFrame(sitlFrame);
}

function sitlPause() {
    if (!sitlStarted) return;
    sitlRunning = !sitlRunning;
    if (sitlRunning) {
        sitlLastFrameMs = performance.now();
        sitlTickAccum = 0;
        if (!sitlRafId) sitlRafId = requestAnimationFrame(sitlFrame);
        sitlSetStatus('running');
    } else {
        sitlSetStatus('paused');
    }
    sitlUpdateButtons();
}

function sitlStop() {
    sitlRunning = false;
    sitlStarted = false;
    if (sitlRafId) { cancelAnimationFrame(sitlRafId); sitlRafId = null; }
    sitlSetStatus('ready');
    sitlUpdateButtons();
}

/**
 * @brief Her animasyon karesinde cagrilir: gecen duvar saati kadar tick kosar.
 *
 * Sekme arka plana alininca requestAnimationFrame durur ve simulasyon da
 * duraklar — bir simulator icin dogru davranis (gercek uçaga komut GITMIYOR,
 * bu yuzden elrs_backpack.html'deki Web Worker geregi burada yok).
 */
function sitlFrame(nowMs) {
    sitlRafId = requestAnimationFrame(sitlFrame);
    if (!sitlRunning || !sitlStarted) return;

    const wallDt = Math.min((nowMs - sitlLastFrameMs) / 1000, 0.25); // uzun donmalarda sicrama yapma
    sitlLastFrameMs = nowMs;

    // Canli RC: son gelen kanallari simulasyona yaz.
    if (sitlLiveInput && sitlLiveChannels) {
        const heap = sitlModule.HEAP32;
        const base = sitlChannelPtr >> 2;
        for (let i = 0; i < 16; i++) heap[base + i] = sitlLiveChannels[i] | 0;
        sitlApi.setChannels(sitlChannelPtr, 16);
    }

    let ticks;
    if (sitlSpeed <= 0) {
        ticks = 20000;   // "sinirsiz": kare basina buyuk bir blok
    } else {
        sitlTickAccum += wallDt * sitlSpeed;
        ticks = Math.floor(sitlTickAccum / sitlDt);
        sitlTickAccum -= ticks * sitlDt;
        if (ticks > 20000) ticks = 20000;  // olum sarmalini onle
    }

    if (ticks > 0) {
        // Tick'leri ~0.2 sn'lik dilimler halinde kos ve her dilim sonunda
        // konumu ize ekle. Tek hamlede kosulursa (ozellikle "Sinirsiz" hizda)
        // butun ucus birkac karede biter ve harita izi birkac noktaya duser;
        // dilimleme, izin cekirdegin KML ornekleme hiziyla (5 Hz) ayni
        // cozunurlukte kalmasini saglar. Simulasyonun kendisi etkilenmez —
        // step(n) ile step(a)+step(b) birebir ayni tick dizisidir.
        const chunk = Math.max(1, Math.round(0.2 / sitlDt));
        let ran = 0, left = ticks;
        while (left > 0) {
            const n = Math.min(chunk, left);
            const got = sitlApi.step(n);
            ran += got;
            left -= n;
            if (got < n) break;              // simulasyon bitti
            if (left > 0) sitlSampleTrack();  // son dilimi asagidaki render zaten isler
        }
        if (ran === 0) {
            sitlRunning = false;
            sitlStarted = false;
            const reason = sitlApi.stopReason();
            sitlDrainEvents();
            sitlLog(reason === 2 ? 'Simülasyon bitti: ZEMİN teması.'
                                 : 'Simülasyon bitti: senaryo süresi doldu.',
                    reason === 2 ? 'warning' : 'info');
            sitlSetStatus('finished');
            sitlUpdateButtons();
        }
    }

    sitlDrainEvents();
    sitlRender();
}

// ==================== CANLI KUMANDA GIRDISI ====================

/**
 * @brief Karttan gelen alici akisini yakalar (serial_communication.js cagirir).
 * @param {Array<number>} data 16 kanal PWM degeri
 */
function onReceiverStreamForSitl(data) {
    if (!Array.isArray(data) || data.length < 4) return;
    sitlLiveChannels = data;
    sitlLastRxMs = performance.now();
    sitlRenderChannels(data);
}

function sitlToggleLiveInput(on) {
    sitlLiveInput = !!on;
    const warn = document.getElementById('sitlPropWarning');
    if (warn) warn.style.display = sitlLiveInput ? '' : 'none';
    const box = document.getElementById('sitlLiveChannelBox');
    if (box) box.style.display = sitlLiveInput ? '' : 'none';

    if (sitlLiveInput) {
        if (typeof isConnected !== 'undefined' && isConnected) {
            // Alici akisini baslat — kart USB modundayken de alicisini okumaya
            // devam eder (main.cpp: receiver_read() kosulsuz cagrilir).
            if (typeof sendCommand === 'function') sendCommand('start_receiver_stream');
            sitlLog('Canlı kumanda açık. PERVANEYİ SÖKTÜĞÜNÜZDEN EMİN OLUN — ' +
                    'arm switch\'i açınca kartın çıkışları gerçekten canlanır.', 'warning');
        } else {
            sitlLog('Canlı kumanda için önce üst menüden karta bağlanın.', 'warning');
        }
    }
}

// ==================== GORSELLESTIRME ====================

function sitlInitMap(lat, lon) {
    const el = document.getElementById('sitlMap');
    if (!el || typeof L === 'undefined') return;

    if (!sitlMap) {
        sitlMap = L.map('sitlMap').setView([lat, lon], 16);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19, attribution: '© OpenStreetMap'
        }).addTo(sitlMap);
        sitlTrackLine = L.polyline([], { color: '#4ade80', weight: 3 }).addTo(sitlMap);
        sitlHomeMarker = L.circleMarker([lat, lon], {
            radius: 6, color: '#fb923c', fillColor: '#fb923c', fillOpacity: 0.9
        }).addTo(sitlMap).bindTooltip('EV');
        sitlPlaneMarker = L.circleMarker([lat, lon], {
            radius: 7, color: '#818cf8', fillColor: '#818cf8', fillOpacity: 1
        }).addTo(sitlMap);
    } else {
        sitlMap.setView([lat, lon], 16);
    }
    setTimeout(() => sitlMap && sitlMap.invalidateSize(), 150);
}

function sitlInit3D() {
    const el = document.getElementById('sitl3D');
    if (!el || typeof THREE === 'undefined' || sitl3D) return;
    if (typeof createAircraftModel !== 'function') return;

    const w = el.clientWidth || 320, h = el.clientHeight || 220;
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, w / h, 0.1, 100);
    camera.position.set(0, 2.2, -6.5);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(w, h);
    renderer.setPixelRatio(window.devicePixelRatio || 1);
    el.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.75));
    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(4, 8, 4);
    scene.add(dir);
    scene.add(new THREE.GridHelper(20, 20, 0x334155, 0x1e293b));

    const model = createAircraftModel();
    scene.add(model);

    sitl3D = { scene, camera, renderer, model };
}

/**
 * @brief Ucagi tutum acilariyla dondurur.
 *
 * Model konvansiyonu (bkz. aircraft_model.js): burun +Z, kanatlar ±X, ust +Y.
 * Bu yuzden yaw -> Y ekseni, pitch -> X, roll -> Z; isaretler ekrandaki
 * hareket sag-el kuraliyla ucagin gercek hareketini izleyecek sekilde secildi.
 */
function sitlRender3D(s) {
    if (!sitl3D) return;
    const d2r = Math.PI / 180;
    sitl3D.model.rotation.set(0, 0, 0);
    sitl3D.model.rotation.order = 'YXZ';
    sitl3D.model.rotation.y = -s.yaw * d2r;
    sitl3D.model.rotation.x =  s.pitch * d2r;
    sitl3D.model.rotation.z = -s.roll * d2r;
    sitl3D.renderer.render(sitl3D.scene, sitl3D.camera);
}

/**
 * @brief Ucagin o anki konumunu harita izine ekler (UI'in geri kalanina dokunmaz).
 */
function sitlSampleTrack() {
    if (!sitlApi || !sitlTrackLine) return;
    let s;
    try { s = JSON.parse(sitlApi.stateJson()); } catch (e) { return; }
    sitlPushTrackPoint(s.lat, s.lon);
}

function sitlPushTrackPoint(lat, lon) {
    if (!sitlTrackLine || !isFinite(lat) || !isFinite(lon)) return;
    const last = sitlTrack[sitlTrack.length - 1];
    if (last && Math.abs(last[0] - lat) < 1e-7 && Math.abs(last[1] - lon) < 1e-7) return;
    sitlTrack.push([lat, lon]);
    if (sitlTrack.length > 20000) sitlTrack.shift();
    sitlTrackLine.setLatLngs(sitlTrack);
}

function sitlRender() {
    if (!sitlApi) return;
    let s;
    try { s = JSON.parse(sitlApi.stateJson()); } catch (e) { return; }

    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    const f = (v, d) => (typeof v === 'number' ? v.toFixed(d) : '—');

    set('sitlT', f(s.t, 1) + ' s');
    set('sitlMode2', SITL_MODE_NAMES[s.mode] || s.mode);
    set('sitlLaState', SITL_LA_NAMES[s.la] || s.la);
    set('sitlAlt', f(s.ealt, 1) + ' m');
    set('sitlAltTrue', f(s.alt, 1) + ' m');
    set('sitlAirspeed', f(s.as, 1) + ' m/s');
    set('sitlDist', f(s.dist, 0) + ' m');
    set('sitlThrottle', s.m1);
    set('sitlWind', f(s.wind, 1) + ' m/s' + (s.windValid ? '' : ' (gecersiz)'));
    set('sitlWindTrue', f(s.windTrue, 1) + ' m/s');
    set('sitlRoll', f(s.roll, 1) + '°');
    set('sitlPitch', f(s.pitch, 1) + '°');
    set('sitlYaw', f(s.yaw, 1) + '°');
    set('sitlERoll', f(s.eroll, 1) + '°');
    set('sitlEPitch', f(s.epitch, 1) + '°');

    // Tutum kestirimi ile gercek arasindaki fark — SITL'de en onemli saglik
    // gostergesi (bkz. sitl/KULLANIM.md "TRUE ile EST").
    const attErr = Math.max(Math.abs(s.roll - s.eroll), Math.abs(s.pitch - s.epitch));
    const errEl = document.getElementById('sitlAttErr');
    if (errEl) {
        errEl.textContent = f(attErr, 1) + '°';
        errEl.style.color = attErr > 10 ? 'var(--color-danger)'
                          : attErr > 4  ? 'var(--color-warning)'
                          : 'var(--color-success)';
    }

    const armEl = document.getElementById('sitlArmed');
    if (armEl) {
        armEl.textContent = s.armed ? 'ARMED' : 'DISARMED';
        armEl.style.color = s.armed ? 'var(--color-danger)' : 'var(--color-secondary)';
    }
    const stallEl = document.getElementById('sitlStall');
    if (stallEl) stallEl.style.display = s.stall ? '' : 'none';

    // Harita izi
    if (sitlMap && isFinite(s.lat) && isFinite(s.lon)) {
        sitlPushTrackPoint(s.lat, s.lon);
        if (sitlPlaneMarker) sitlPlaneMarker.setLatLng([s.lat, s.lon]);
        if (sitlMapFollow) sitlMap.panTo([s.lat, s.lon], { animate: false });
    }

    sitlRender3D(s);

    // Canli kumanda tazeligi
    if (sitlLiveInput) {
        const age = performance.now() - sitlLastRxMs;
        const rxEl = document.getElementById('sitlRxStatus');
        if (rxEl) {
            if (!sitlLiveChannels) { rxEl.textContent = 'veri yok'; rxEl.style.color = 'var(--color-danger)'; }
            else if (age > 1000)   { rxEl.textContent = `bayat (${(age/1000).toFixed(1)} s)`; rxEl.style.color = 'var(--color-warning)'; }
            else                   { rxEl.textContent = 'canli'; rxEl.style.color = 'var(--color-success)'; }
        }
    }
}

function sitlRenderChannels(data) {
    for (let i = 0; i < 8; i++) {
        const bar = document.getElementById(`sitlRxBar${i + 1}`);
        const val = document.getElementById(`sitlRxVal${i + 1}`);
        if (!bar || !val) continue;
        const v = data[i] || 1000;
        const pct = Math.max(0, Math.min(100, ((v - 1000) / 1000) * 100));
        bar.style.width = pct + '%';
        val.textContent = v;
    }
}

// ==================== OLAY / LOG ====================

function sitlDrainEvents() {
    if (!sitlApi) return;
    const txt = sitlApi.events();
    if (!txt) return;
    txt.split('\n').forEach(line => { if (line.trim()) sitlLog(line, 'info'); });
}

function sitlClearEvents() {
    const box = document.getElementById('sitlEventLog');
    if (box) box.innerHTML = '';
}

function sitlLog(msg, level) {
    const box = document.getElementById('sitlEventLog');
    if (!box) return;
    const div = document.createElement('div');
    div.className = 'sitl-log-line sitl-log-' + (level || 'info');
    div.textContent = msg;
    box.appendChild(div);
    while (box.childElementCount > 300) box.removeChild(box.firstChild);
    box.scrollTop = box.scrollHeight;
}

function sitlSetStatus(state, detail) {
    const el = document.getElementById('sitlStatus');
    if (!el) return;
    const map = {
        idle:         ['Hazır değil', 'var(--color-secondary)'],
        wasm_loading: ['Motor yükleniyor…', 'var(--color-warning)'],
        ready:        ['Hazır', 'var(--color-success)'],
        running:      ['Koşuyor', 'var(--color-success)'],
        paused:       ['Duraklatıldı', 'var(--color-warning)'],
        finished:     ['Bitti', 'var(--color-info)'],
        error:        ['Hata: ' + (detail || ''), 'var(--color-danger)']
    };
    const m = map[state] || map.idle;
    el.textContent = m[0];
    el.style.color = m[1];
}

function sitlUpdateButtons() {
    const start = document.getElementById('sitlBtnStart');
    const pause = document.getElementById('sitlBtnPause');
    const stop  = document.getElementById('sitlBtnStop');
    if (start) start.disabled = sitlStarted && sitlRunning;
    if (pause) {
        pause.disabled = !sitlStarted;
        pause.innerHTML = sitlRunning
            ? '<i class="bi bi-pause-fill me-1"></i> Duraklat'
            : '<i class="bi bi-play-fill me-1"></i> Devam';
    }
    if (stop) stop.disabled = !sitlStarted;
}

// ==================== KML ====================

function sitlDownloadKml() {
    if (!sitlApi) return;
    const kml = sitlApi.kml();
    if (!kml || kml.length < 100) { sitlLog('İndirilecek iz yok.', 'warning'); return; }
    const blob = new Blob([kml], { type: 'application/vnd.google-earth.kml+xml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'sitl_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.kml';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

// ==================== SAYFA GIRISI ====================

/**
 * @brief SITL sayfasina girildiginde cagrilir (page_management.js).
 */
function initSitlPage() {
    sitlInit3D();
    sitlUpdateButtons();
    sitlSetConfigStatus(sitlBoardConfigLoaded ? 'board' : 'default');
    if (!sitlModule && !sitlLoading) {
        sitlLoadModule();
    }
    if (sitlMap) setTimeout(() => sitlMap.invalidateSize(), 150);

    // NOT: alici akisini burada baslatmiyoruz. page_management.js sayfa
    // degisiminde once tum stream'leri durduruyor, sonra 600 ms gecikmeyle
    // startPageSpecificStream('sitl') icinde canli kumanda acikken
    // start_receiver_stream gonderiyor. Burada da gondermek, firmware'in tek
    // current_command bayragina ayni anda iki komut yollamak olurdu.

    const speedSel = document.getElementById('sitlSpeed');
    if (speedSel && !speedSel._sitlBound) {
        speedSel._sitlBound = true;
        speedSel.addEventListener('change', () => {
            sitlSpeed = parseFloat(speedSel.value);
            sitlTickAccum = 0;
            sitlLastFrameMs = performance.now();
        });
    }
    const followChk = document.getElementById('sitlFollow');
    if (followChk && !followChk._sitlBound) {
        followChk._sitlBound = true;
        followChk.addEventListener('change', () => { sitlMapFollow = followChk.checked; });
    }
}
