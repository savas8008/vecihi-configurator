// ============ OUTPUTS PAGE FUNCTIONS ============

const servoControls = {
servo1: { value: 1500, element: null },
servo2: { value: 1500, element: null },
servo3: { value: 1500, element: null },
servo4: { value: 1500, element: null }
};

const esp32Pins = [-1, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 21, 22, 23, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39];

// Servo okları kontrol et
document.addEventListener('DOMContentLoaded', function() {
const arrowControls = {
'servo1-up': { servo: 'servo1', step: 10 },
'servo1-down': { servo: 'servo1', step: -10 },
'servo2-up': { servo: 'servo2', step: 10 },
'servo2-down': { servo: 'servo2', step: -10 },
'servo3-up': { servo: 'servo3', step: 10 },
'servo3-down': { servo: 'servo3', step: -10 },
'servo4-up': { servo: 'servo4', step: 10 },
'servo4-down': { servo: 'servo4', step: -10 }
};

for (const [btnId, config] of Object.entries(arrowControls)) {
const btn = document.getElementById(btnId);
if (!btn) continue;

btn.addEventListener('click', function(e) {
e.preventDefault();
const servo = servoControls[config.servo];
servo.value = Math.max(1000, Math.min(2000, servo.value + config.step));
if (servo.element) servo.element.textContent = servo.value;
sendCommand('SERVO_' + config.servo.toUpperCase() + ' ' + servo.value);
});
}

// Throttle slider
const throttleSlider = document.getElementById('throttleSlider');
if (throttleSlider) {
throttleSlider.addEventListener('input', function() {
const v = parseInt(this.value, 10);
const label = document.getElementById('throttleValue');
if (label) label.textContent = v;
if (this.dataset.holdTime === undefined || Date.now() - this.dataset.holdTime > 100) {
this.dataset.holdTime = Date.now();
sendThrottleNow(v);
}
});

throttleSlider.addEventListener('change', function() {
const v = parseInt(this.value, 10);
sendThrottleNow(v);
});
}
});

/**
 * @brief Select dropdown'larını GPIO pinleri ile doldurur
 */
function populatePinSelectors() {
const pinOptions = esp32Pins.map(pin => {
if (pin === -1) return `<option value="-1">Devre Dışı</option>`;

// ADC Pinleri için uyarı (Sadece INPUT)
if (pin >= 34 && pin <= 39) {
return `<option value="${pin}">GPIO ${pin} (Sadece INPUT/ADC)</option>`;
}

// Boot/Flash pinleri için uyarı
if (pin === 0 || pin === 2) {
return `<option value="${pin}">GPIO ${pin} (Boot Pin)</option>`;
}

return `<option value="${pin}">GPIO ${pin}</option>`;
}).join('');

// TÜM PIN SELECT'LERİNİ BUL VE DOLDUR
const pinSelectors = [
'motorPin1', 'motorPin2', 'motorPin3', 'motorPin4',
'servo1Pin', 'servo2Pin', 'servo3Pin', 'servo4Pin',
'rxPin', 'gpsPin', 'osdPin', 'i2cSdaPin', 'i2cSclPin'
];

pinSelectors.forEach(id => {
const select = document.getElementById(id);
if (select) {
select.innerHTML = pinOptions;
select.addEventListener('change', function() {
const configName = this.id;
const pinValue = this.value;
sendCommand('SET_PIN ' + configName + ' ' + pinValue);
});
}
});
}

/**
 * @brief RC channel seçicilerini (1-16) doldurur
 */
function populateChannelSelectors() {
const channelOptions = Array.from({length: 16}, (_, i) => 
`<option value="${i+1}">Kanal ${i+1}</option>`
).join('');

const channelSelectors = ['rollChannel', 'pitchChannel', 'yawChannel', 'throttleChannel', 'modeChannel'];

channelSelectors.forEach(id => {
const select = document.getElementById(id);
if (select) {
select.innerHTML = channelOptions;
select.addEventListener('change', function() {
const configName = this.id;
const channelValue = this.value;
sendCommand('SET_CHANNEL ' + configName + ' ' + channelValue);
});
}
});
}
