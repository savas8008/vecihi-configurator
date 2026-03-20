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

            // Kamera - global 'camera' değişkenini kullan
            const fov = 75;
            const aspect = container.clientWidth / container.clientHeight;
            const near = 0.1;
            const far = 1000;
            camera = new THREE.PerspectiveCamera(fov, aspect, near, far);
            camera.position.set(0, 3, 6);

            // Renderer - global 'renderer' değişkenini kullan
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
            renderer.setSize(container.clientWidth, container.clientHeight);
            renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
            renderer.physicallyCorrectLights = true;
            renderer.toneMapping = THREE.ACESFilmicToneMapping;
            renderer.toneMappingExposure = 1.2;
            renderer.outputEncoding = THREE.sRGBEncoding;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFSoftShadowMap;
            renderer.setAnimationLoop(animate3D);
            container.appendChild(renderer.domElement);

            // Gökyüzü arka planı (gradient effect)
            scene.background = new THREE.Color(0x87CEEB);
            scene.fog = new THREE.FogExp2(0xc9e8f5, 0.022);

            // Işıklar — PBR kaliteli aydınlatma
            const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x5c7a3e, 0.7);
            scene.add(hemiLight);

            const sunLight = new THREE.DirectionalLight(0xfff5e0, 2.0);
            sunLight.position.set(8, 12, 6);
            sunLight.castShadow = true;
            sunLight.shadow.mapSize.width  = 1024;
            sunLight.shadow.mapSize.height = 1024;
            sunLight.shadow.camera.near = 0.5;
            sunLight.shadow.camera.far  = 50;
            sunLight.shadow.camera.left   = -10;
            sunLight.shadow.camera.right  =  10;
            sunLight.shadow.camera.top    =  10;
            sunLight.shadow.camera.bottom = -10;
            scene.add(sunLight);

            const fillLight = new THREE.DirectionalLight(0xadd8e6, 0.4);
            fillLight.position.set(-5, 3, -5);
            scene.add(fillLight);

            // Grid - global 'gridHelper' değişkenini kullan
            gridHelper = new THREE.GridHelper(60, 30, 0x4a7a4a, 0x6aaa6a);
            gridHelper.position.y = -1.5;
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

            // Pivot: quaternion bu gruba uygulanır, model içinde (0,0,0)'da ortalı durur
            const pivot = new THREE.Group();
            pivot.position.y = 1.0;
            scene.add(pivot);
            airplaneModel = pivot;

            if (controls) {
                controls.target.set(0, 1.5, 0);
                controls.update();
            }

            // GLB modeli yükle
            const loader = new THREE.GLTFLoader();
            loader.load('models/Old Toy Plane.glb', function(gltf) {
                const model = gltf.scene;

                // Ölçekle
                const box = new THREE.Box3().setFromObject(model);
                const maxDim = Math.max(box.max.x - box.min.x, box.max.y - box.min.y, box.max.z - box.min.z);
                model.scale.setScalar(5.0 / maxDim);

                // Merkezi pivot'a getir
                const box2 = new THREE.Box3().setFromObject(model);
                const center = box2.getCenter(new THREE.Vector3());
                model.position.sub(center);

                pivot.add(model);
            }, undefined, function(err) {
                console.error('GLB yüklenemedi:', err);
            });

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

        // Pervane dönüşü
        if (typeof airplaneModel !== 'undefined' && airplaneModel &&
            airplaneModel.userData && airplaneModel.userData.propeller) {
            airplaneModel.userData.propeller.rotation.z += 0.18;
        }

        renderer.render(scene, camera);
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