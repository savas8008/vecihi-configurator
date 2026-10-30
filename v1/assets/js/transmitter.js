// Copyright (c) 2024-2026 savas8008 - All Rights Reserved
// Bu dosyanın izinsiz kopyalanması, değiştirilmesi veya dağıtılması yasaktır.


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
        else if (transmitterConfig.protocol === 2 || transmitterConfig.protocol === 'mavlink_elrs') protocolEl.value = 'mavlink_elrs';
    }

    // 2. Kanal Atamalarını Doğrudan Seçicilere Yaz
    const ch = transmitterConfig.channels || { roll:1, pitch:2, throttle:3, yaw:4 };

    const chRollEl = document.getElementById('chRoll');
    const chPitchEl = document.getElementById('chPitch');
    const chThrottleEl = document.getElementById('chThrottle');
    const chYawEl = document.getElementById('chYaw');

    if (chRollEl) chRollEl.value = ch.roll || 1;
    if (chPitchEl) chPitchEl.value = ch.pitch || 2;
    if (chThrottleEl) chThrottleEl.value = ch.throttle || 3;
    if (chYawEl) chYawEl.value = ch.yaw || 4;

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

    // 2. Kanal Atamalarını Manuel Seçicilerden Oku
    const channels = {
        roll:     parseInt(document.getElementById('chRoll').value)     || 1,
        pitch:    parseInt(document.getElementById('chPitch').value)    || 2,
        throttle: parseInt(document.getElementById('chThrottle').value) || 3,
        yaw:      parseInt(document.getElementById('chYaw').value)      || 4
    };

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
