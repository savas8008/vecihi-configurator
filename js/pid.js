function handlePIDPageData(data) {
  try {
    // Sayfadan gelen ham obje: {roll,pitch,yaw,level_p,tpa_factor}
    if (data.roll)  pidValues.roll  = data.roll;
    if (data.pitch) pidValues.pitch = data.pitch;
    if (data.yaw)   pidValues.yaw   = data.yaw;

    // level_p -> pidValues.level.p
    if (data.level_p !== undefined) {
      if (!pidValues.level) pidValues.level = {};
      pidValues.level.p = parseFloat(data.level_p);
    }

    // tpa_factor (0..1)
    if (data.tpa_factor !== undefined) {
      pidValues.tpa_factor = parseFloat(data.tpa_factor);
    }

    // ✅ LEVEL + TPA slider listener’larını bir kere bağla
    bindPIDExtraSlidersOnce();

    // UI’yı güncelle
    updatePIDUI();

  } catch (error) {
    log(`❌ PID verileri yüklenirken hata: ${error.message}`, 'error');
  }
}

function updatePIDUI() {
  try {
    // --- ROLL ---
    if ($('rollPSlider')) $('rollPSlider').value = pidValues.roll.p;
    if ($('rollPValue'))  $('rollPValue').textContent = formatNumber(pidValues.roll.p, 2);

    if ($('rollISlider')) $('rollISlider').value = pidValues.roll.i;
    if ($('rollIValue'))  $('rollIValue').textContent = formatNumber(pidValues.roll.i, 2);

    if ($('rollILimitSlider')) $('rollILimitSlider').value = pidValues.roll.i_limit;
    if ($('rollILimitValue'))  $('rollILimitValue').textContent = formatNumber(pidValues.roll.i_limit, 0);

    if ($('rollFFSlider')) $('rollFFSlider').value = pidValues.roll.ff;
    if ($('rollFFValue'))  $('rollFFValue').textContent = formatNumber(pidValues.roll.ff, 2);

    // --- PITCH ---
    if ($('pitchPSlider')) $('pitchPSlider').value = pidValues.pitch.p;
    if ($('pitchPValue'))  $('pitchPValue').textContent = formatNumber(pidValues.pitch.p, 2);

    if ($('pitchISlider')) $('pitchISlider').value = pidValues.pitch.i;
    if ($('pitchIValue'))  $('pitchIValue').textContent = formatNumber(pidValues.pitch.i, 2);

    if ($('pitchILimitSlider')) $('pitchILimitSlider').value = pidValues.pitch.i_limit;
    if ($('pitchILimitValue'))  $('pitchILimitValue').textContent = formatNumber(pidValues.pitch.i_limit, 0);

    if ($('pitchFFSlider')) $('pitchFFSlider').value = pidValues.pitch.ff;
    if ($('pitchFFValue'))  $('pitchFFValue').textContent = formatNumber(pidValues.pitch.ff, 2);

    // --- YAW ---
    if ($('yawPSlider')) $('yawPSlider').value = pidValues.yaw.p;
    if ($('yawPValue'))  $('yawPValue').textContent = formatNumber(pidValues.yaw.p, 2);

    if ($('yawISlider')) $('yawISlider').value = pidValues.yaw.i;
    if ($('yawIValue'))  $('yawIValue').textContent = formatNumber(pidValues.yaw.i, 2);

    if ($('yawILimitSlider')) $('yawILimitSlider').value = pidValues.yaw.i_limit;
    if ($('yawILimitValue'))  $('yawILimitValue').textContent = formatNumber(pidValues.yaw.i_limit, 0);

    if ($('yawFFSlider')) $('yawFFSlider').value = pidValues.yaw.ff;
    if ($('yawFFValue'))  $('yawFFValue').textContent = formatNumber(pidValues.yaw.ff, 2);

    // --- LEVEL (ANGLE MODE) ---
    if (pidValues.level && pidValues.level.p !== undefined) {
      const lvlSlider = $('levelPSlider');
      const lvlText   = $('levelPValue');
      if (lvlSlider) lvlSlider.value = pidValues.level.p;
      if (lvlText)   lvlText.textContent = formatNumber(pidValues.level.p, 1);
    }

    // --- TPA (0..1) -> UI yüzde 0..100 ---
    if (pidValues.tpa_factor !== undefined) {
      const pct = Math.round(pidValues.tpa_factor * 100);
      const tpaSlider = $('tpaPSlider');
      const tpaText   = $('tpaValue');
      if (tpaSlider) tpaSlider.value = pct;
      if (tpaText)   tpaText.textContent = `${pct}%`;
    }

  } catch (e) {
    console.error("PID UI Güncelleme Hatası: ", e);
  }
}

// ✅ Listener'lar tek sefer bağlanır
function bindPIDExtraSlidersOnce() {
  if (bindPIDExtraSlidersOnce._done) return;
  bindPIDExtraSlidersOnce._done = true;

  // LEVEL slider
  const levelEl = document.getElementById('levelPSlider');
  if (levelEl) {
    levelEl.addEventListener('input', () => {
      const v = parseFloat(levelEl.value);
      if (!pidValues.level) pidValues.level = {};
      pidValues.level.p = v;
      const t = document.getElementById('levelPValue');
      if (t) t.textContent = formatNumber(v, 1);
    });
  }

  // TPA slider (0..100 UI) => pidValues.tpa_factor (0..1)
  const tpaEl = document.getElementById('tpaPSlider');
  if (tpaEl) {
    tpaEl.addEventListener('input', () => {
      const pct = parseInt(tpaEl.value, 10);
      pidValues.tpa_factor = pct / 100.0;
      const t = document.getElementById('tpaValue');
      if (t) t.textContent = `${pct}%`;
    });
  }
}


        function savePIDConfig() {
            try {
                log(`📊 PID ayarları kaydediliyor...`, 'info');
                const jsonCommand = `PID_SAVE ${JSON.stringify(pidValues)}`;
				alert(jsonCommand);
                sendCommand(jsonCommand);
            } catch (error) {
                console.error('PID ayarları kaydetme hatası:', error);
                log(`❌ PID ayarları kaydedilemedi: ${error.message}`, 'error');
            }
        }



           document.querySelectorAll('#pid .pid-slider').forEach(slider => {
  slider.addEventListener('input', function () {
    const mAxis = this.id.match(/^(roll|pitch|yaw|level)/);
    if (!mAxis) return;
    const axis = mAxis[0];

    const mType = this.id.match(/(P|I|ILimit|FF)Slider$/);
    if (!mType) return;
    const typeRaw = mType[1];

    const type = typeRaw.toLowerCase().replace('ilimit', 'i_limit');
    const value = (type === 'i_limit') ? parseInt(this.value, 10) : parseFloat(this.value);

    if (!pidValues[axis]) pidValues[axis] = {};        // level için garanti
    pidValues[axis][type] = value;

    const valueLabel = document.getElementById(`${axis}${typeRaw}Value`);
    if (valueLabel) {
      const decimals = (axis === 'level' && type === 'p') ? 1 : 2;
      valueLabel.textContent = (type === 'i_limit') ? String(value) : value.toFixed(decimals);
    }
  });
});
