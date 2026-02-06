
        // --- Kumanda Sayfası ---
// --- Kumanda Sayfası Veri İşleyicisi ---
function handleTransmitterPageData(data) {
    // Config geldiyse global değişkene al
    if(data.config) {
        transmitterConfig = data.config;
    }
    // Select ve Checkbox'ları güncelle
    updateTransmitterUI();

    const panel = document.getElementById('transmitterChannelValues');
    if (!panel) return;
    
    // HTML'i baştan oluştur
    panel.innerHTML = '';
    
    const channelNames = [
        "Roll (A)", "Pitch (E)", "Thr (T)", "Yaw (R)", 
        "CH 5", "CH 6", "CH 7", "CH 8", 
        "CH 9", "CH 10", "CH 11", "CH 12", 
        "CH 13", "CH 14", "CH 15", "CH 16"
    ];

    for (let i = 1; i <= 16; i++) {
        const name = channelNames[i-1] || `CH ${i}`;
        
        // CSS class 'channel-row' style.css dosyasında tanımlı olmalıdır
        panel.innerHTML += `
            <div class="channel-row">
                <div class="channel-label">${name}</div>
                <div class="channel-track">
                    <div class="channel-center-line"></div>
                    <div class="channel-bar" id="rx-bar-${i}" style="width: 50%"></div>
                </div>
                <div class="channel-value-text" id="rx-val-${i}">1500</div>
            </div>`;
    }
}
function updateTransmitterUI() {
    // 1. Protokolü ayarla
    const protocolEl = document.getElementById('protocolSelect');
    if (protocolEl && transmitterConfig.protocol !== undefined) {
        if (transmitterConfig.protocol === 0 || transmitterConfig.protocol === 'sbus') protocolEl.value = 'sbus';
        else if (transmitterConfig.protocol === 1 || transmitterConfig.protocol === 'elrs') protocolEl.value = 'elrs';
    }

    // 2. Kanal Haritasını Tespit Et (DÜZELTİLEN KISIM)
    const ch = transmitterConfig.channels || { roll:1, pitch:2, throttle:3, yaw:4 };
    let detectedMap = "AETR"; // Varsayılan

    // Mantıksal kontroller: Hangi kanal 1. sırada?
    
    // AETR: Roll=1, Pitch=2, Throttle=3, Yaw=4
    if (ch.roll===1 && ch.pitch===2 && ch.throttle===3 && ch.yaw===4) {
        detectedMap = "AETR";
    }
    // TAER: Throttle=1, Roll=2, Pitch=3, Yaw=4
    else if (ch.throttle===1 && ch.roll===2 && ch.pitch===3 && ch.yaw===4) {
        detectedMap = "TAER";
    }
    // RETA: Yaw=1, Pitch=2, Throttle=3, Roll=4 (LOGLARINIZDAKİ VERİ BU)
    else if (ch.yaw===1 && ch.pitch===2 && ch.throttle===3 && ch.roll===4) {
        detectedMap = "RETA";
    }
    // TEAR: Throttle=1, Pitch=2, Roll=3, Yaw=4
    else if (ch.throttle===1 && ch.pitch===2 && ch.roll===3 && ch.yaw===4) {
        detectedMap = "TEAR";
    }
    
    // Eğer özel bir sıralama varsa ve yukarıdakilere uymuyorsa, konsola yaz (Debug için)
    else {
        console.log("Bilinmeyen Kanal Sıralaması:", ch);
    }

    // Dropdown menüsünü güncelle
    const mapEl = document.getElementById('channelMapSelect');
    if (mapEl) {
        mapEl.value = detectedMap;
    }

    // 3. Reverse Durumlarını Ayarla
    const rev = transmitterConfig.reverse || {};
    const isTrue = (val) => val === true || val === "true";

    if(document.getElementById('revRoll')) document.getElementById('revRoll').checked = isTrue(rev.roll);
    if(document.getElementById('revPitch')) document.getElementById('revPitch').checked = isTrue(rev.pitch);
    if(document.getElementById('revYaw')) document.getElementById('revYaw').checked = isTrue(rev.yaw);
    if(document.getElementById('revThrottle')) document.getElementById('revThrottle').checked = isTrue(rev.throttle);
}
function saveTransmitterConfig() {
    // 1. Protokolü al
    const protocol = document.getElementById('protocolSelect').value;

    // 2. Kanal Haritasını (Map) Belirle
    const selectedMap = document.getElementById('channelMapSelect').value;
    let channels = {};

    // Seçilen haritaya göre kanalları ata
    switch (selectedMap) {
        case 'AETR': channels = { roll:1, pitch:2, throttle:3, yaw:4 }; break;
        case 'TAER': channels = { throttle:1, roll:2, pitch:3, yaw:4 }; break;
        case 'RETA': channels = { yaw:1, pitch:2, throttle:3, roll:4 }; break;
        case 'TEAR': channels = { throttle:1, pitch:2, roll:3, yaw:4 }; break;
        default:     channels = { roll:1, pitch:2, throttle:3, yaw:4 }; break;
    }

    // 3. Reverse (Tersleme) Ayarlarını Topla
    const reverse = {
        roll: document.getElementById('revRoll').checked,
        pitch: document.getElementById('revPitch').checked,
        yaw: document.getElementById('revYaw').checked,
        throttle: document.getElementById('revThrottle').checked
    };

    // 4. Veri Paketini Oluştur
    const payload = {
        protocol: protocol,
        channels: channels,
        reverse: reverse
    };

    // 5. Konsola Yaz ve ESP32'ye Gönder
    // log fonksiyonu yoksa console.log kullanın
    if(typeof log === 'function') log(`🎮 Kumanda ayarları gönderiliyor...`, 'info');
    
    // JSON verisini string'e çevirip komutla birleştir
    // ÖNEMLİ: Komut ismi C++ tarafındaki ile aynı olmalı (TRANSMITTER_SAVE)
    if(typeof sendCommand === 'function') {
        sendCommand(`TRANSMITTER_SAVE ${JSON.stringify(payload)}`);
    } else {
        alert("Bağlantı hatası: sendCommand fonksiyonu bulunamadı!");
    }
}
