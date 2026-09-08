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

// Kumanda her zaman canli surer — senaryo/betik girdisi yok (bkz. sohbet:
// "panel uzerinden ucus yonetmek mantikli olmuyor" tasarim degisikligi).
let sitlLiveChannels = null;   // son gelen 16 kanal
let sitlChannelPtr = 0;        // WASM heap'inde 16*int4 tampon
let sitlLastRxMs = 0;          // son alici paketinin zamani (tazelik gostergesi)

// Son gelen outputs_page_data (govde tipi + servo min/mid/max/reverse).
// param_list/modes_page_data'nin aksine bu alanlar hep bir varsayilanla dolu
// geldigi icin (orn. selectedAircraft='v-tail') "doldu mu" kontrolu global
// degiskeni sifirlayip poll etmekle guvenilir olmuyor — bunun yerine
// serial_communication.js'in 'outputs' page_data'sini yakaladigi anda
// dogrudan bu degiskene yazan bir hook (onOutputsPageDataForSitl) kullanilir.
let sitlOutputsData = null;

// Kalkis noktasi: kullanici haritada tiklayip secer (yoksa varsayilan kullanilir).
let sitlSelectedHome = { lat: 39.925, lon: 32.866 };

// Gorsellestirme
let sitlMap = null, sitlTrackLine = null, sitlPlaneMarker = null, sitlHomeMarker = null;
let sitlTrack = [];
let sitl3D = null;             // {scene, camera, renderer, model}
let sitlMapFollow = true;
let sitlMapExpanded = false;

// Motor sesi (throttle'a bagli, Web Audio API — dosya gerektirmez)
let sitlSoundEnabled = true;
let sitlAudioCtx = null;
let sitlAudioNodes = null;     // {osc1, osc2, osc2Gain, filter, gain}

const SITL_MODE_NAMES = ['MANUAL','ANGLE','HORIZON','ACRO','RTH','LAUNCH','FAILSAFE',
                         'CRUISE','ALTHOLD','LOITER','AUTOTUNE','WAYPOINT','LAND_ASSIST','GCS'];

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
            forceArm:    sitlModule.cwrap('sitl_force_arm', 'number', []),
            triggerThrow:sitlModule.cwrap('sitl_trigger_throw', 'number', []),
            stateJson:   sitlModule.cwrap('sitl_state_json', 'string', []),
            events:      sitlModule.cwrap('sitl_events', 'string', []),
            kml:         sitlModule.cwrap('sitl_kml', 'string', []),
            setParam:    sitlModule.cwrap('sitl_set_param', 'number', ['string', 'number']),
            setMode:     sitlModule.cwrap('sitl_set_mode', 'number', ['string', 'number', 'number', 'number']),
            setAircraftType: sitlModule.cwrap('sitl_set_aircraft_type', 'number', ['string']),
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
 * (bkz. GOREVLER.md B45) — bu yuzden "Baslat" arm'i kanal okuyarak degil,
 * dogrudan stick_force_arm()'i cagirarak yapiyor (bkz. sitlStart()).
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

        // --- 3) Gövde tipi ---
        // param_list'te YOK (string alan) — ayrı komutla (outputs_page_data)
        // çekilip setAircraftType() ile uygulanır. Bu aktarılmadan SITL her
        // zaman "v-tail" varsayılanıyla koşuyordu: karttaki gerçek gövde tipi
        // farklıysa (ör. flying-wing/conventional), mikser + fizik un-mix'i
        // farklı yüzeyleri karıştırıyordu.
        //
        // NOT: servo_values (min/mid/max/reverse) da buradan çekilip ayrı bir
        // setServo() ile aktarılıyordu — GERİ ALINDI (bkz. sohbet). Bu alanlar
        // src/pwm_output.cpp'de sadece SAKLANIYOR, hiçbir çıkışı etkilemiyor;
        // reverse'i SITL fiziğine de uygulamak (ayrıca denendi) yanlış bir
        // varsayıma dayanıyordu ve roll/pitch'i pozitif geri beslemeyle
        // sarmal sapmaya sokuyordu.
        sitlLog('Kart ayarları isteniyor: gövde tipi…', 'info');
        sitlOutputsData = null;
        sendCommand('outputs_page_data');
        const outputsOk = await sitlWaitFor(() => sitlOutputsData !== null, 5000, 150);

        let outputsApplied = false;
        if (outputsOk && sitlOutputsData && sitlOutputsData.aircraft_type) {
            outputsApplied = sitlApi.setAircraftType(sitlOutputsData.aircraft_type) === 1;
            sitlLog(outputsApplied
                    ? `Gövde tipi (${sitlOutputsData.aircraft_type}) aktarıldı.`
                    : 'Gövde tipi verisi geldi ama işlenemedi.', outputsApplied ? 'info' : 'warning');
        } else {
            sitlLog('Gövde tipi alınamadı (zaman aşımı) — varsayılan "v-tail" ile kalır.', 'warning');
        }

        sitlBoardConfigLoaded = (uygulanan > 0 || modAdedi > 0 || outputsApplied);
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

function sitlSetConfigStatus(state) {
    const el = document.getElementById('sitlConfigStatus');
    if (!el) return;
    const map = {
        default: ['Bağlı değil', 'var(--color-secondary)'],
        loading: ['Kart ayarları okunuyor…', 'var(--color-info)'],
        board:   ['Kart ayarları yüklü', 'var(--color-success)'],
        error:   ['Okunamadı — tekrar deneyin', 'var(--color-danger)']
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
 * @brief Sabit/canli senaryo JSON'u uretir (sitl/scenarios/*.json semasi).
 *
 * Artik bir "senaryo formu" yok — mod, ruzgar, sure, tirmanis fazi gibi
 * SITL-ozel kavramlar kaldirildi. Ucus TAMAMEN gercek kumandanizdan (mod
 * switch'leri dahil) ve karttan yuklenen gercek ayarlardan yonetiliyor.
 * Tek kullanici girdisi: haritada tiklanan kalkis noktasi (sitlSelectedHome).
 */
function sitlBuildScenario() {
    return {
        home: {
            lat: sitlSelectedHome.lat,
            lon: sitlSelectedHome.lon,
            alt: 100,
            heading: 90,
            start_alt_offset_m: 0
        },
        wind: { speed_ms: 0, from_deg: 0 },
        mode: 'MANUAL',       // gercek kumanda + kart config'i mod secimini yapiyor
        duration_s: 3600,     // pratikte sinirsiz — Durdur'a basana/zemin temasina kadar
        dt_s: 0.002,
        arm: false,           // arm artik sitlStart()'ta forceArm() ile (salla-birak)
        // auto_launch KASITLI OLARAK YOK: alan hic gecmezse SitlCore, kartin
        // kendi LNCH_AUTO_ARM ayarina (yuklenmisse) dokunmuyor (bkz. scenario.h
        // -1 sentinel'i). Eskiden burada sabit "true" vardi — kartin gercek
        // ayarindan bagimsiz HER canli SITL ucusunu LAUNCH moduna zorluyordu;
        // LAUNCH gercek bir el firlatmasi (ivme darbesi) gerektirdiginden
        // ucak throttle=1000'de sonsuza dek L_READY'de kilitleniyordu (bkz.
        // sohbet — ayrica SitlCore'a sentetik firlatma darbesi de eklendi).
        input: {
            live: true,
            // Kart ayarlari yuklendiyse (her zaman hedeflenen durum) mod
            // switch atamalarina DOKUNMA — kullanicinin kendi switch'leri gecerli.
            board_modes: sitlBoardConfigLoaded,
            arm_channel: 5,   // kullanilmiyor (forceArm kanal bilmeden calisir), alan gerekli
            mode_channel: 6   // kullanilmiyor (mode='MANUAL' -> hicbir kanala baglanmaz)
        }
    };
}

// ==================== CALISTIRMA ====================

async function sitlStart() {
    if (!await sitlLoadModule()) return;

    if (typeof isConnected === 'undefined' || !isConnected) {
        sitlLog('Önce üst menüden karta bağlanın.', 'warning');
        return;
    }
    if (!sitlBoardConfigLoaded) {
        sitlLog('Kart ayarları henüz yüklü değil — önce yükleniyor…', 'info');
        await sitlLoadBoardConfig();
        if (!sitlBoardConfigLoaded) {
            sitlLog('Kart ayarları yüklenemedi — Başlat iptal edildi.', 'error');
            return;
        }
    }

    const sc = sitlBuildScenario();
    sitlApi.init(JSON.stringify(sc));
    sitlDt = sitlApi.dt() || 0.002;

    // GPS/irtifa kestiricisinin ilk gercek orneği alması için tek tick ilerlet
    // — force-arm'in kullandigi setHomePositionToCurrent() bundan once
    // anlamli bir konum bulamaz (bkz. sohbet: SitlCore::step() ilk tick'te
    // her zaman "GPS taze" kabul eder).
    sitlApi.step(1);

    // En guncel canli kanallari HEMEN uygula — force-arm'in throttle
    // kontrolu (rolantide mi?) gercek kumandanin O ANKI durumuna baksin,
    // sitlFrame()'in bir sonraki karesini beklemesin.
    if (sitlLiveChannels) {
        const heap = sitlModule.HEAP32;
        const base = sitlChannelPtr >> 2;
        for (let i = 0; i < 16; i++) heap[base + i] = sitlLiveChannels[i] | 0;
        sitlApi.setChannels(sitlChannelPtr, 16);
    } else {
        sitlLog('Karttan alıcı verisi gelmiyor — kumandanız açık ve karta bağlı mı?', 'warning');
    }

    // "Başlat" = salla-bırak: throttle rölantideyse zorla arm eder, LAUNCH
    // sekansını tetikler. Kanal bilmesi gerekmez (bkz. GOREVLER.md B45).
    const armed = sitlApi.forceArm();
    if (!armed) {
        sitlLog('Arm edilemedi: kumandanın gaz kolu rölantide olmalı (gerçek salla-bırak güvenliği).', 'warning');
        return;
    }

    sitlStarted = true;
    sitlRunning = true;
    sitlTickAccum = 0;
    sitlLastFrameMs = performance.now();

    // Ses baglamini kullanici jesti (bu tiklama) icinde kur/uyandir —
    // tarayicilarin otomatik oynatma kisitlamasi boyle en guvenilir asilir.
    sitlEnsureAudio();

    // Iz ve harita sifirla
    sitlTrack = [];
    if (sitlTrackLine) sitlTrackLine.setLatLngs([]);
    sitlInitMap(sc.home.lat, sc.home.lon);
    if (sitlHomeMarker) sitlHomeMarker.setLatLng([sc.home.lat, sc.home.lon]);

    sitlClearEvents();
    sitlDrainEvents();
    sitlLog('Arm edildi. Kumandada gazı yarım gaza alın, hazır olduğunuzda "Salla"ya basın.', 'info');
    sitlSetStatus('running');
    sitlUpdateButtons();

    if (!sitlRafId) sitlRafId = requestAnimationFrame(sitlFrame);
}

/**
 * @brief "Salla" düğmesi: pilot yarım gaza aldıktan SONRA, istediği anda
 *        fırlatma darbesini tetikler (bkz. sohbet — eskiden bu, throttle'ın
 *        1100'ü geçtiği anla kenetliydi, kullanıcının kontrolünde değildi).
 */
function sitlTriggerThrow() {
    if (!sitlApi || !sitlStarted) return;
    const ok = sitlApi.triggerThrow();
    if (!ok) {
        sitlLog('Şimdi anlamsız — önce gazı yarım gaza alıp LAUNCH: HAZIR durumuna gelmeli.', 'warning');
    }
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
        sitlStopEngineSound();
    }
    sitlUpdateButtons();
}

function sitlStop() {
    sitlRunning = false;
    sitlStarted = false;
    if (sitlRafId) { cancelAnimationFrame(sitlRafId); sitlRafId = null; }
    sitlSetStatus('ready');
    sitlUpdateButtons();
    sitlStopEngineSound();
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
    if (sitlLiveChannels) {
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

/**
 * @brief serial_communication.js'in 'outputs' page_data'sını yakaladığı anda
 *        çağrılır (bkz. handlePageData 'outputs' case'i). sitlLoadBoardConfig()
 *        bunu sendCommand('outputs_page_data') sonrası poll eder.
 * @param {Object} data outputs_page_data JSON'u (aircraft_type, servo_values, ...)
 */
function onOutputsPageDataForSitl(data) {
    sitlOutputsData = data;
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
        }).addTo(sitlMap).bindTooltip('KALKIŞ');
        sitlPlaneMarker = L.circleMarker([lat, lon], {
            radius: 7, color: '#818cf8', fillColor: '#818cf8', fillOpacity: 1
        }).addTo(sitlMap);
        // Kalkis noktasini haritadan sec: tiklanan yere kalkis isaretcisi
        // tasinir, sitlStart() bir sonraki calistirmada bu noktayi kullanir.
        sitlMap.on('click', sitlOnMapClick);
    } else {
        sitlMap.setView([lat, lon], 16);
    }
    setTimeout(() => sitlMap && sitlMap.invalidateSize(), 150);
}

/**
 * @brief Haritaya tiklandiginda kalkis noktasini gunceller (simulasyon
 *        kosarken degil — o an ucan ucagi yeniden konumlandirmak anlamsiz).
 */
function sitlOnMapClick(e) {
    if (sitlRunning) return;
    sitlSelectedHome = { lat: e.latlng.lat, lon: e.latlng.lng };
    if (sitlHomeMarker) sitlHomeMarker.setLatLng(e.latlng);
    const latEl = document.getElementById('sitlLaunchLat');
    const lonEl = document.getElementById('sitlLaunchLon');
    if (latEl) latEl.textContent = e.latlng.lat.toFixed(6);
    if (lonEl) lonEl.textContent = e.latlng.lng.toFixed(6);
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
 * Kamera `sitlInit3D()`'de position=(0,2.2,-6.5) + lookAt(0,0,0) — bu kurulumda
 * THREE'nin lookAt taban vektörleri world +X'i EKRAN SOLUNA, world -X'i EKRAN
 * SAĞINA haritalıyor (bkz. sohbet: three.js r128 ile ampirik doğrulandı,
 * Object3D.applyMatrix4 + Vector3.project). Önceki `-s.roll` işareti bunu
 * hesaba katmıyordu: gerçek bir sağ bankada (roll>0) ekranda SOL taraf aşağı
 * gidiyor, kullanıcıya sol banka gibi görünüyordu (haritadaki sağa dönüşle
 * çelişiyordu). İşaret ters çevrildi.
 *
 * `rotation.x = -s.pitch` (bkz. sohbet, roll'dan AYRI bir hata): bu, kamera
 * kurulumundan bağımsız, saf 'YXZ' Euler/rotasyon matrisi matematiğinden
 * çıkan bir işaret hatasıydı — kamera açısıyla ilgisi yok (roll'un aksine,
 * dikey eksen kameranın hangi yönden baktığından etkilenmez). Rx(θ), model
 * burnu (0,0,1)'i (0,-sinθ,cosθ)'ya taşır: `rotation.x = +pitch` ile pozitif
 * pitch (fizikte "burun yukarı", tırmanış) burnun Y bileşenini NEGATİF yapıp
 * görsel olarak burnu AŞAĞI gösteriyordu — pilot burun kaldırdığını görürken
 * uçak aslında (görselde) burun eğiyormuş gibi çiziliyordu. İşaret ters
 * çevrildi; artık pozitif pitch modelin burnunu gerçekten yukarı kaldırıyor.
 */
function sitlRender3D(s) {
    if (!sitl3D) return;
    const d2r = Math.PI / 180;
    sitl3D.model.rotation.set(0, 0, 0);
    sitl3D.model.rotation.order = 'YXZ';
    sitl3D.model.rotation.y = -s.yaw * d2r;
    sitl3D.model.rotation.x = -s.pitch * d2r;
    sitl3D.model.rotation.z =  s.roll * d2r;
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
    set('sitlAlt', f(s.ealt, 1) + ' m');
    set('sitlAirspeed', f(s.as, 1) + ' m/s');
    set('sitlDist', f(s.dist, 0) + ' m');
    set('sitlThrottle', s.m1);
    set('sitlWind', f(s.wind, 1) + ' m/s' + (s.windValid ? '' : ' (geçersiz)'));
    // Kestirim (gercek telemetride goreceginiz deger) — TRUE/fizik ground-truth
    // degerleri (SITL'e ozel debug bilgisi) artik gosterilmiyor.
    set('sitlERoll', f(s.eroll, 1) + '°');
    set('sitlEPitch', f(s.epitch, 1) + '°');
    set('sitlEYaw', f(s.eyaw < 0 ? s.eyaw + 360 : s.eyaw, 1) + '°');

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

    sitlUpdateEngineSound(s.m1, !!s.armed);

    // Canli kumanda tazeligi
    const age = performance.now() - sitlLastRxMs;
    const rxEl = document.getElementById('sitlRxStatus');
    if (rxEl) {
        if (!sitlLiveChannels) { rxEl.textContent = 'veri yok'; rxEl.style.color = 'var(--color-danger)'; }
        else if (age > 1000)   { rxEl.textContent = `bayat (${(age/1000).toFixed(1)} s)`; rxEl.style.color = 'var(--color-warning)'; }
        else                   { rxEl.textContent = 'canlı'; rxEl.style.color = 'var(--color-success)'; }
    }
}

// ==================== MOTOR SESİ ====================
// Gaza (motor1 PWM) bağlı, dosya gerektirmeyen basit bir "drone" — iki
// detune edilmiş osilatör (temel + 1.5 harmonik) + alçak geçiren filtre.
// Gerçek bir motor örneklemesi değil, ama boşta/tam gazda perde ve tını
// belirgin şekilde değişiyor.

function sitlEnsureAudio() {
    if (sitlAudioCtx || !sitlSoundEnabled) return;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    try {
        sitlAudioCtx = new Ctx();

        const gain = sitlAudioCtx.createGain();
        gain.gain.value = 0;

        const filter = sitlAudioCtx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 400;
        filter.Q.value = 0.7;

        const osc1 = sitlAudioCtx.createOscillator();
        osc1.type = 'sawtooth';
        osc1.frequency.value = 55;

        const osc2 = sitlAudioCtx.createOscillator();
        osc2.type = 'square';
        osc2.frequency.value = 55 * 1.5;
        const osc2Gain = sitlAudioCtx.createGain();
        osc2Gain.gain.value = 0.3;

        osc1.connect(filter);
        osc2.connect(osc2Gain).connect(filter);
        filter.connect(gain).connect(sitlAudioCtx.destination);

        osc1.start();
        osc2.start();

        sitlAudioNodes = { osc1, osc2, osc2Gain, filter, gain };
    } catch (e) {
        sitlAudioCtx = null;
        sitlAudioNodes = null;
    }
    if (sitlAudioCtx && sitlAudioCtx.state === 'suspended') {
        sitlAudioCtx.resume().catch(() => {});
    }
}

/**
 * @brief Motor PWM'ine (1000-2000) göre motor sesinin perdesini/sesini günceller.
 * @param {number} motor1_us Motor1 PWM değeri (sitlApi.stateJson()'daki "m1")
 * @param {boolean} armed Kilitli değilse ses kısılır (motor gerçekte dönmüyor)
 */
function sitlUpdateEngineSound(motor1_us, armed) {
    if (!sitlSoundEnabled || !sitlAudioCtx || !sitlAudioNodes) return;
    const thr = Math.max(0, Math.min(1, ((motor1_us || 1000) - 1000) / 1000));
    const now = sitlAudioCtx.currentTime;
    const targetGain = armed ? (0.025 + thr * 0.09) : 0;
    const baseFreq = 50 + thr * 130;   // 50..180 Hz temel ton

    sitlAudioNodes.gain.gain.setTargetAtTime(targetGain, now, 0.08);
    sitlAudioNodes.osc1.frequency.setTargetAtTime(baseFreq, now, 0.08);
    sitlAudioNodes.osc2.frequency.setTargetAtTime(baseFreq * 1.5, now, 0.08);
    sitlAudioNodes.filter.frequency.setTargetAtTime(350 + thr * 1600, now, 0.08);
}

function sitlStopEngineSound() {
    if (sitlAudioCtx && sitlAudioNodes) {
        sitlAudioNodes.gain.gain.setTargetAtTime(0, sitlAudioCtx.currentTime, 0.05);
    }
}

function sitlToggleSound(on) {
    sitlSoundEnabled = !!on;
    if (sitlSoundEnabled) sitlEnsureAudio();
    else sitlStopEngineSound();
}

// ==================== HARİTA BÜYÜT ====================

function sitlToggleMapExpand() {
    sitlMapExpanded = !sitlMapExpanded;
    const el = document.getElementById('sitlMap');
    const btn = document.getElementById('sitlBtnMapFull');
    if (el) el.classList.toggle('sitl-map-expanded', sitlMapExpanded);
    if (btn) {
        btn.innerHTML = sitlMapExpanded
            ? '<i class="bi bi-fullscreen-exit"></i>'
            : '<i class="bi bi-arrows-fullscreen"></i>';
        btn.title = sitlMapExpanded ? 'Haritayı küçült' : 'Haritayı büyüt';
    }
    // CSS gecis suresi (0.25s) bitmeden invalidateSize cagirilirsa Leaflet
    // eski boyuta gore hesaplar ve karolar yanlis hizalanir/gri kalir.
    setTimeout(() => sitlMap && sitlMap.invalidateSize(), 260);
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
    const shake = document.getElementById('sitlBtnShake');
    if (start) start.disabled = sitlStarted && sitlRunning;
    if (pause) {
        pause.disabled = !sitlStarted;
        pause.innerHTML = sitlRunning
            ? '<i class="bi bi-pause-fill me-1"></i> Duraklat'
            : '<i class="bi bi-play-fill me-1"></i> Devam';
    }
    if (stop) stop.disabled = !sitlStarted;
    // Ne zaman anlamli oldugunu (LAUNCH: HAZIR) WASM zaten triggerThrow()
    // icinde kontrol ediyor (bkz. sitlTriggerThrow) — burada sadece
    // simulasyon kosarken tiklanabilir olmasi yeterli.
    if (shake) shake.disabled = !(sitlStarted && sitlRunning);
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

    // Harita önceden yalnızca sitlStart() içinde kuruluyordu — "Başlat"a
    // basılmadan sayfaya girildiğinde #sitlMap boş bir kutu olarak kalıyor,
    // bu da "harita yüklenmiyor" izlenimi veriyordu. Seçili (veya varsayılan)
    // kalkış noktasıyla temel haritayı hemen göster.
    sitlInitMap(sitlSelectedHome.lat, sitlSelectedHome.lon);

    // Karta bağlıysa ayarları otomatik yükle — kullanıcının artık ayrı bir
    // "yükle" adımı atmasına gerek yok. Zaten yüklüyse tekrar sormaz.
    if (typeof isConnected !== 'undefined' && isConnected && !sitlBoardConfigLoaded && !sitlConfigLoading) {
        sitlLoadBoardConfig();
    }

    // NOT: alici akisini burada baslatmiyoruz. page_management.js sayfa
    // degisiminde once tum stream'leri durduruyor, sonra 600 ms gecikmeyle
    // startPageSpecificStream('sitl') icinde start_receiver_stream gonderiyor.
    // Burada da gondermek, firmware'in tek current_command bayragina ayni
    // anda iki komut yollamak olurdu.

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
    const soundChk = document.getElementById('sitlSound');
    if (soundChk && !soundChk._sitlBound) {
        soundChk._sitlBound = true;
        sitlSoundEnabled = soundChk.checked;
        soundChk.addEventListener('change', () => sitlToggleSound(soundChk.checked));
    }
}
