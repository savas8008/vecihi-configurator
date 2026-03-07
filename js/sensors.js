/**
 * ============================================
 * X-FLIGHT CONFIGURATOR - SENSORS PAGE MODULE
 * ============================================
 * Sensörler sayfasına ait tüm JavaScript kodları
 * 
 * Bağımlılıklar:
 * - Three.js (r128) - ÖNCELİKLE YÜKLENMELİ
 * - Three.js OrbitControls
 * - Leaflet.js
 * - Bootstrap Icons
 * 
 * NOT: Bu dosya Three.js'den SONRA yüklenmelidir!
 * 
 * HTML'de sıralama:
 * <script src="three.min.js"></script>
 * <script src="OrbitControls.js"></script>
 * <script src="leaflet.js"></script>
 * <script src="js/sensors.js"></script>  <!-- Buraya -->
 * <script> ... ana kod ... </script>
 * 
 * Ana HTML'den şu değişkenlerin KALDIRILMAMASI gerekir:
 * let scene, camera, renderer, airplaneModel, controls, gridHelper;
 * const targetQuaternion = new THREE.Quaternion();
 * let map, planeMarker, flightPath, pathCoordinates;
 * 
 * Ana HTML'den şu FONKSİYONLAR silinmelidir:
 * - init3DModel()
 * - animate3D()
 * - createWW2Airplane()
 * - initMap()
 * - handleQuaternionStream()
 * - handleSensorStream()
 * - activateSensorsPage()
 * - startSensorStream() / stopSensorStream()
 * - startQuaternionStream() / stopQuaternionStream()
 * - updateSensorsStreamForPage()
 */

(function() {
    'use strict';

    // autoFollowPlane değişkeni yoksa tanımla
    if (typeof window.autoFollowPlane === 'undefined') {
        window.autoFollowPlane = true;
    }

    // ============================================
    // 3D MODEL FONKSİYONLARI
    // ============================================

    /**
     * @brief 3D Sahneyi (Three.js) başlatır
     */
    function init3DModel() {
        // THREE kütüphanesinin yüklendiğinden emin ol
        if (typeof THREE === 'undefined') {
            console.error('THREE.js yüklenmemiş! Lütfen sensors.js\'den önce three.min.js\'i yükleyin.');
            return;
        }

        try {
            const container = document.getElementById('3d-canvas-container');
            if (!container) {
                console.error("3D model container (#3d-canvas-container) bulunamadı.");
                return;
            }
            container.innerHTML = '';

            // Sahne oluştur - global 'scene' değişkenini kullan
            scene = new THREE.Scene();
            scene.fog = new THREE.Fog(0xbbeeff, 10, 35);

            // Kamera - global 'camera' değişkenini kullan
            const fov = 75;
            const aspect = container.clientWidth / container.clientHeight;
            const near = 0.1;
            const far = 1000;
            camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
            camera.position.set(0, 3.0, 6);

            // Renderer - global 'renderer' değişkenini kullan
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(window.devicePixelRatio);
            renderer.physicallyCorrectLights = true;
            renderer.setAnimationLoop(animate3D);
            container.appendChild(renderer.domElement);

            // Işıklar
            const ambientLight = new THREE.AmbientLight(0xffffff, 0.8);
            scene.add(ambientLight);

            const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
            directionalLight.position.set(5, 10, 7.5);
            scene.add(directionalLight);

            // Grid - global 'gridHelper' değişkenini kullan
            gridHelper = new THREE.GridHelper(50, 50, 0x999999, 0xcccccc);
            gridHelper.position.y = 0;
            scene.add(gridHelper);

            // Orbit Controls - global 'controls' değişkenini kullan
            if (typeof THREE.OrbitControls !== 'undefined') {
                controls = new THREE.OrbitControls(camera, renderer.domElement);
                controls.enableDamping = true;
                controls.dampingFactor = 0.05;
                controls.minDistance = 3;
                controls.maxDistance = 20;
            } else {
                console.warn('OrbitControls yüklenmemiş, kamera kontrolü devre dışı.');
            }

            // Uçak Modeli - global 'airplaneModel' değişkenini kullan
            airplaneModel = createWW2Airplane();
            airplaneModel.position.y = 1.0;
            scene.add(airplaneModel);

            if (controls) {
                controls.target.copy(airplaneModel.position);
            }

            // Resize Observer
            const onResize = () => {
                if (!container.clientWidth || !container.clientHeight) return;
                camera.aspect = container.clientWidth / container.clientHeight;
                camera.updateProjectionMatrix();
                renderer.setSize(container.clientWidth, container.clientHeight);
            };
            new ResizeObserver(onResize).observe(container);
            onResize();

        } catch (e) {
            console.error("3D Model başlatılamadı:", e);
            if (typeof log === 'function') {
                log('❌ 3D Model başlatılamadı: ' + e.message, 'error');
            }
            const container = document.getElementById('3d-canvas-container');
            if (container) {
                container.innerHTML = '<div class="alert alert-danger">3D Model yüklenemedi. WebGL desteklenmiyor olabilir.</div>';
            }
        }
    }

    /**
     * @brief 3D animasyon döngüsü
     */
    function animate3D() {
        if (typeof renderer === 'undefined' || !renderer) return;
        if (typeof scene === 'undefined' || !scene) return;
        if (typeof camera === 'undefined' || !camera) return;

        if (typeof controls !== 'undefined' && controls) {
            controls.update();
        }

        if (typeof airplaneModel !== 'undefined' && airplaneModel &&
            typeof targetQuaternion !== 'undefined' && targetQuaternion) {
            airplaneModel.quaternion.slerp(targetQuaternion, 0.1);
        }
        renderer.render(scene, camera);
    }

    /**
     * @brief Basit bir 3D WW2 tarzı uçak modeli oluşturur
     * @returns {THREE.Group} Uçak modeli grubu
     */
    function createWW2Airplane() {
        if (typeof THREE === 'undefined') {
            console.error('THREE.js yüklenmemiş!');
            return null;
        }

        const planeGroup = new THREE.Group();

        // Malzemeler
        const bodyMat = new THREE.MeshPhongMaterial({ color: 0xcacfd2, shininess: 30 });
        const wingMat = new THREE.MeshPhongMaterial({ color: 0xcccccc, shininess: 20 });
        const cockpitMat = new THREE.MeshPhongMaterial({ color: 0x92badd, transparent: true, opacity: 0.8 });
        const propMat = new THREE.MeshPhongMaterial({ color: 0x8b4513, shininess: 10 });
        const noseMat = new THREE.MeshPhongMaterial({ color: 0xfdd835, shininess: 50 });

        // Gövde
        const bodyGeom = new THREE.CylinderGeometry(0.5, 0.7, 4.0, 16);
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.rotation.x = Math.PI / 2;
        planeGroup.add(body);

        // Kokpit
        const cockpitGeom = new THREE.SphereGeometry(0.4, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2);
        const cockpit = new THREE.Mesh(cockpitGeom, cockpitMat);
        cockpit.position.set(0, 0.35, 0.5);
        planeGroup.add(cockpit);

        // Ana Kanat
        const wingGeom = new THREE.BoxGeometry(4.5, 0.15, 1.5);
        const mainWing = new THREE.Mesh(wingGeom, wingMat);
        mainWing.position.set(0, 0, -0.5);
        planeGroup.add(mainWing);

        // Yatay Kuyruk
        const hTailGeom = new THREE.BoxGeometry(2.5, 0.1, 0.8);
        const hTail = new THREE.Mesh(hTailGeom, wingMat);
        hTail.position.set(0, 0.2, 1.8);
        planeGroup.add(hTail);

        // Dikey Kuyruk
        const vTailGeom = new THREE.BoxGeometry(0.1, 0.9, 0.8);
        const vTail = new THREE.Mesh(vTailGeom, bodyMat);
        vTail.position.set(0, 0.65, 1.8);
        planeGroup.add(vTail);

        // Burun
        const noseGeom = new THREE.ConeGeometry(0.6, 0.8, 16);
        const nose = new THREE.Mesh(noseGeom, noseMat);
        nose.rotation.x = Math.PI / 2;
        nose.position.z = -2.3;
        planeGroup.add(nose);

        // Pervane Kanatları
        const bladeGeom = new THREE.BoxGeometry(0.1, 0.05, 1.5);
        const blade1 = new THREE.Mesh(bladeGeom, propMat);
        blade1.rotation.y = Math.PI / 2;
        blade1.position.z = -2.7;
        planeGroup.add(blade1);

        const blade2 = new THREE.Mesh(bladeGeom, propMat);
        blade2.rotation.y = Math.PI / 2;
        blade2.rotation.z = Math.PI / 2;
        blade2.position.z = -2.7;
        planeGroup.add(blade2);

        // Pervane Göbeği
        const hubGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.1, 8);
        const hub = new THREE.Mesh(hubGeom, propMat);
        hub.rotation.x = Math.PI / 2;
        hub.position.z = -2.7;
        planeGroup.add(hub);

        planeGroup.quaternion.set(0, 0, 0, 1);
        return planeGroup;
    }

    // ============================================
    // HARİTA FONKSİYONLARI
    // ============================================

    /**
     * @brief Leaflet haritasını başlatır
     */
    function initMap() {
        // Global 'map' değişkeni zaten varsa çık
        if (typeof map !== 'undefined' && map) return;
        
        if (typeof L === 'undefined') {
            console.error('Leaflet.js yüklenmemiş!');
            return;
        }

        const container = document.getElementById('map-container');
        if (!container) {
            console.error('map-container bulunamadı!');
            return;
        }

        // Haritayı oluştur - global 'map' değişkenini kullan
        map = L.map('map-container').setView([39.92, 32.85], 13);

        // OpenStreetMap tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        // Uçak ikonu
        const planeIcon = L.divIcon({
            className: 'plane-marker-icon',
            html: '<div class="plane-icon-inner" id="map-plane-icon"><i class="bi bi-airplane-fill"></i></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
        });

        // Marker ve path - global değişkenleri kullan
        planeMarker = L.marker([39.92, 32.85], { icon: planeIcon }).addTo(map);
        flightPath = L.polyline([], { color: 'yellow', weight: 3 }).addTo(map);

        // Kullanıcı haritayı çekince otomatik takibi durdur
        map.on('dragstart', function() {
            window.autoFollowPlane = false;
        });

        // Uçak ikonuna tıklayınca tekrar takip et
        planeMarker.on('click', function() {
            window.autoFollowPlane = true;
            if (planeMarker) map.setView(planeMarker.getLatLng(), 15, { animate: true });
        });

        setTimeout(function() { map.invalidateSize(); }, 500);
    }

    /**
     * @brief Haritadaki uçak konumunu günceller
     */
    function updateMapPosition(lat, lon, heading) {
        if (typeof map === 'undefined' || !map) initMap();
        if (typeof planeMarker === 'undefined' || !planeMarker || lat === 0 || lon === 0) return;

        var newLatLng = [lat, lon];

        planeMarker.setLatLng(newLatLng);

        if (window.autoFollowPlane) {
            map.panTo(newLatLng);
        }

        if (heading !== undefined) {
            var iconElement = document.getElementById('map-plane-icon');
            if (iconElement) {
                iconElement.style.transform = 'rotate(' + heading + 'deg)';
            }
        }

        if (typeof pathCoordinates !== 'undefined') {
            var lastPoint = pathCoordinates.length > 0 ? pathCoordinates[pathCoordinates.length - 1] : null;
            if (!lastPoint || lastPoint[0] !== lat || lastPoint[1] !== lon) {
                pathCoordinates.push(newLatLng);
                if (typeof flightPath !== 'undefined' && flightPath) {
                    flightPath.setLatLngs(pathCoordinates);
                }
            }
        }
    }

    /**
     * @brief Uçuş izini temizler
     */
    function clearFlightPath() {
        if (typeof pathCoordinates !== 'undefined') {
            pathCoordinates.length = 0;
        }
        if (typeof flightPath !== 'undefined' && flightPath) {
            flightPath.setLatLngs([]);
        }
    }

    // ============================================
    // SENSÖR STREAM HANDLER
    // ============================================

    /**
     * @brief Quaternion (3D), Euler ve Uçuş Modu verisini işler
     */
    function handleQuaternionStream(data) {
        try {
            // 1. 3D Modeli GÜNCELLE
            if (data && data.q && Array.isArray(data.q) && data.q.length === 4) {
                var w = data.q[0], x = data.q[1], y = data.q[2], z = data.q[3];
                if (typeof targetQuaternion !== 'undefined' && targetQuaternion) {
                    targetQuaternion.set(y, -z, -x, w);
                }
            }

            // 2. Euler Açılarını GÜNCELLE
            if (data && data.euler && Array.isArray(data.euler) && data.euler.length === 3) {
                var espRoll = data.euler[0], espPitch = data.euler[1], espYaw = data.euler[2];
                var rollEl = document.getElementById('euler-roll');
                var pitchEl = document.getElementById('euler-pitch');
                var yawEl = document.getElementById('euler-yaw');

                if (rollEl) rollEl.textContent = espRoll.toFixed(1) + '°';
                if (pitchEl) pitchEl.textContent = espPitch.toFixed(1) + '°';
                if (yawEl) yawEl.textContent = espYaw.toFixed(1) + '°';
            }

            // 3. Uçuş Modu İsmi ve Renklendirme
            var currentMode = data.mode || data.flight_mode;
            if (currentMode) {
                var modeEl = document.getElementById('flight-mode-display');
                if (modeEl) {
                    modeEl.textContent = currentMode.toUpperCase();

                    var colorMap = {
                        'MANUAL': '#adb5bd',
                        'ANGLE': '#198754',
                        'HORIZON': '#20c997',
                        'RTH': '#dc3545',
                        'FAILSAFE': '#dc3545',
                        'LAUNCH': '#ffc107',
                        'CRUISE': '#0d6efd',
                        'ALT HOLD': '#6610f2'
                    };
                    var colorClass = colorMap[currentMode.toUpperCase()] || '#0dcaf0';

                    modeEl.style.color = colorClass;
                    modeEl.style.textShadow = '0 0 10px ' + colorClass + '80';

                    var modeBox = modeEl.closest('.mode-section');
                    if (modeBox) modeBox.style.borderColor = colorClass + '40';
                }
            }

            // 4. Arm Durumu
            if (data.armed !== undefined) {
                var armText = document.getElementById('arm-status-text');
                if (armText) {
                    if (data.armed === true) {
                        armText.textContent = "ARMED";
                        armText.className = "arm-status status-armed";
                    } else {
                        armText.textContent = "DISARMED";
                        armText.className = "arm-status status-disarmed";
                    }
                }
            }
        } catch (error) {
            console.error('Quaternion stream güncelleme hatası:', error);
        }
    }

    /**
     * @brief Sensör stream verisini işler (GPS, Baro, Sistem)
     */
    function handleSensorStream(data) {
        if (!data) return;

        // --- GPS Verileri ---
        var gpsLat = document.getElementById('gps-lat');
        var gpsLon = document.getElementById('gps-lon');
        var gpsSats = document.getElementById('gps-sats');
        var gpsSpeed = document.getElementById('gps-speed');
        var gpsFixBadge = document.getElementById('gps-fix-badge');

        if (gpsLat) gpsLat.value = data.lat !== undefined ? data.lat.toFixed(6) : '--';
        if (gpsLon) gpsLon.value = data.lon !== undefined ? data.lon.toFixed(6) : '--';
        if (gpsSats) gpsSats.textContent = data.sats || 0;

        if (gpsSpeed) {
            var speedKmh = (data.speed || 0) * 3.6;
            gpsSpeed.textContent = speedKmh.toFixed(1);
        }

        if (gpsFixBadge) {
            if (data.fix) {
                gpsFixBadge.textContent = "3D FIX";
                gpsFixBadge.className = "badge bg-success";
            } else {
                gpsFixBadge.textContent = "NO FIX";
                gpsFixBadge.className = "badge bg-danger";
            }
        }

        // --- Baro Verileri ---
        var sensAlt = document.getElementById('sens-alt');
        var sensVario = document.getElementById('sens-vario');

        if (sensAlt) sensAlt.textContent = data.alt !== undefined ? data.alt.toFixed(1) : '0.0';
        if (sensVario) sensVario.textContent = data.vario !== undefined ? data.vario.toFixed(1) : '0.0';

        // --- Harita Güncelleme ---
        if (data.lat && data.lon && data.lat !== 0 && data.lon !== 0) {
            updateMapPosition(data.lat, data.lon, data.heading);
        }

        // --- Rüzgar Verileri ---
        if (data.wind_speed !== undefined || data.wind_dir !== undefined) {
            var windSpeedEl = document.getElementById('wind-speed');
            var windDirEl = document.getElementById('wind-dir');
            var windArrowEl = document.getElementById('wind-dir-arrow');
            var windLabelEl = document.getElementById('wind-dir-label');

            if (windSpeedEl && data.wind_speed !== undefined) {
                var windKmh = (data.wind_speed * 3.6).toFixed(1);
                windSpeedEl.textContent = windKmh;
            }

            if (windDirEl && data.wind_dir !== undefined) {
                windDirEl.textContent = data.wind_dir.toFixed(0);
            }

            if (windArrowEl && data.wind_dir !== undefined) {
                windArrowEl.style.transform = 'rotate(' + data.wind_dir + 'deg)';
            }

            if (windLabelEl && data.wind_dir !== undefined) {
                var dir = data.wind_dir;
                var cardinals = ['K', 'KKD', 'KD', 'DKD', 'D', 'DGD', 'GD', 'GGD', 'G', 'GGB', 'GB', 'BGB', 'B', 'BKB', 'KB', 'KKB'];
                var idx = Math.round(dir / 22.5) % 16;
                windLabelEl.textContent = cardinals[idx];
            }

            // OSD wind elementini de güncelle
            var osdWindEl = document.getElementById('prev_wind');
            if (osdWindEl && data.wind_speed !== undefined && data.wind_dir !== undefined) {
                var osdKmh = (data.wind_speed * 3.6).toFixed(0);
                osdWindEl.innerHTML = '<i class="bi bi-arrow-up-right" style="transform:rotate(' + data.wind_dir + 'deg);display:inline-block;"></i> ' + osdKmh + 'km/h';
            }
        }

        // --- Sistem (MCU) Verileri ---
        if (data.sys) {
            var sysHz = document.getElementById('sys-hz');
            var sysHz0 = document.getElementById('sys-hz0');
            var sysTemp = document.getElementById('sys-temp');
            var sysRam = document.getElementById('sys-ram');

            if (sysHz) sysHz.textContent = data.sys.hz;

            if (sysHz0) {
                var hz0 = data.sys.hz0 || 0;
                sysHz0.textContent = hz0;
                sysHz0.className = hz0 > 0 ? "fs-4 fw-bold text-info" : "fs-4 fw-bold text-secondary";
            }

            if (sysTemp) {
                var temp = data.sys.temp.toFixed(1);
                sysTemp.textContent = temp;
                sysTemp.className = data.sys.temp > 65 ? "fs-4 fw-bold text-danger" : "fs-4 fw-bold text-warning";
            }

            if (sysRam) {
                var ramKB = (data.sys.ram / 1024).toFixed(1);
                sysRam.textContent = ramKB;
            }
        }
    }

    // ============================================
    // SAYFA AKTİVASYON VE STREAM YÖNETİMİ
    // ============================================

    /**
     * @brief Sensörler sayfasını aktif eder
     */
    function activateSensorsPage() {
        document.querySelectorAll('.nav-link').forEach(function(nav) { nav.classList.remove('active'); });
        document.querySelectorAll('.page').forEach(function(page) { page.classList.remove('active'); });

        var nav = document.querySelector('[data-page="sensors"]');
        if (nav) nav.classList.add('active');

        var pageEl = document.getElementById('sensors');
        if (pageEl) pageEl.classList.add('active');

        if (typeof window.currentPage !== 'undefined') {
            window.currentPage = 'sensors';
        } else {
            currentPage = 'sensors';
        }

        if (typeof updateConnectionStatus === 'function') {
            updateConnectionStatus();
        }

        setTimeout(function() {
            if (typeof map === 'undefined' || !map) initMap();
            if (typeof map !== 'undefined' && map) map.invalidateSize();
        }, 100);
    }

    function startSensorStream() {
        if (typeof isConnected !== 'undefined' && isConnected && typeof sendCommand === 'function') {
            sendCommand('start_sensor_stream');
        }
    }

    function stopSensorStream() {
        if (typeof isConnected !== 'undefined' && isConnected && typeof sendCommand === 'function') {
            sendCommand('stop_sensor_stream');
        }
    }

    function startQuaternionStream() {
        if (typeof isConnected !== 'undefined' && isConnected && typeof sendCommand === 'function') {
            sendCommand('start_sensor_stream');
        }
    }

    function stopQuaternionStream() {
        if (typeof isConnected !== 'undefined' && isConnected && typeof sendCommand === 'function') {
            sendCommand('stop_quaternion_stream');
        }
    }

    function updateSensorsStreamForPage() {
        if (typeof isConnected === 'undefined' || !isConnected) return;

        if (typeof currentPage !== 'undefined' && currentPage === 'sensors') {
            startSensorStream();
        } else {
            stopSensorStream();
        }
    }

    // ============================================
    // GLOBAL SCOPE'A AKTAR
    // ============================================

    window.init3DModel = init3DModel;
    window.animate3D = animate3D;
    window.createWW2Airplane = createWW2Airplane;
    window.initMap = initMap;
    window.updateMapPosition = updateMapPosition;
    window.clearFlightPath = clearFlightPath;
    window.handleQuaternionStream = handleQuaternionStream;
    window.handleSensorStream = handleSensorStream;
    window.activateSensorsPage = activateSensorsPage;
    window.startSensorStream = startSensorStream;
    window.stopSensorStream = stopSensorStream;
    window.startQuaternionStream = startQuaternionStream;
    window.stopQuaternionStream = stopQuaternionStream;
    window.updateSensorsStreamForPage = updateSensorsStreamForPage;

    window.SensorsModule = {
        init3DModel: init3DModel,
        animate3D: animate3D,
        createWW2Airplane: createWW2Airplane,
        initMap: initMap,
        updateMapPosition: updateMapPosition,
        clearFlightPath: clearFlightPath,
        handleQuaternionStream: handleQuaternionStream,
        handleSensorStream: handleSensorStream,
        activateSensorsPage: activateSensorsPage,
        startSensorStream: startSensorStream,
        stopSensorStream: stopSensorStream,
        startQuaternionStream: startQuaternionStream,
        stopQuaternionStream: stopQuaternionStream,
        updateSensorsStreamForPage: updateSensorsStreamForPage
    };

    console.log('✅ Sensors Module yüklendi');

})();