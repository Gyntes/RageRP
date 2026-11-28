(function () {
  const root = document.getElementById('dashboard');
  const cluster = document.getElementById('cluster');
  const speed = document.getElementById('speed');
  const gear = document.getElementById('gear');
  const rpmBar = document.getElementById('rpm-bar');
  const rpmTrack = document.querySelector('.rpm-track');
  const rpmValue = document.getElementById('rpm-value');
  const engineState = document.getElementById('engine-state');
  const fuelValue = document.getElementById('fuel-value');
  const fuelMeter = document.querySelector('.fuel-readout');
  const fuelArc = document.getElementById('fuel-arc');
  const dirtValue = document.getElementById('dirt-value');
  const dirtMeter = document.querySelector('.vehicle-condition');
  const odometer = document.getElementById('odometer');
  const checkEngine = document.getElementById('check-engine');
  const leftSignal = document.getElementById('signal-left');
  const rightSignal = document.getElementById('signal-right');
  const leftSignalState = document.getElementById('signal-left-state');
  const rightSignalState = document.getElementById('signal-right-state');
  const hazardStatus = document.getElementById('hazard-status');

  function parsePayload(payload) {
    if (typeof payload !== 'string') return payload && typeof payload === 'object' ? payload : {};
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.error('[RageRP dashboard] Could not parse vehicle data:', error);
      return {};
    }
  }

  function boundedNumber(value, min, max, fallback) {
    const number = Number(value);
    return Number.isFinite(number) ? Math.min(max, Math.max(min, number)) : fallback;
  }

  function setIndicator(element, enabled) {
    element.classList.toggle('is-active', enabled === true);
  }

  function setFuel(value) {
    const fuel = Math.round(boundedNumber(value, 0, 100, 100));
    fuelValue.textContent = `${fuel}%`;
    fuelMeter.setAttribute('aria-valuenow', String(fuel));
    fuelMeter.setAttribute('aria-label', `Уровень топлива: ${fuel}%`);
    fuelArc.style.strokeDasharray = `${fuel} 100`;
    fuelArc.classList.toggle('is-low', fuel <= 15);
  }

  function setDirt(value) {
    const dirt = Math.round(boundedNumber(value, 0, 15, 0));
    dirtValue.textContent = String(dirt);
    dirtMeter.setAttribute('aria-valuenow', String(dirt));
    dirtMeter.setAttribute('aria-label', `Загрязнение автомобиля: ${dirt} из 15`);
  }

  function setOdometer(value) {
    odometer.textContent = window.ragerpDashboardLogic.formatOdometer(value);
  }

  function update(payload) {
    const data = parsePayload(payload);
    const speedValue = Math.round(boundedNumber(data.speed, 0, 500, 0));
    const rpm = boundedNumber(data.rpm, 0, 1, 0);
    const rpmNumber = Math.round(rpm * 8000);
    const engineHealth = boundedNumber(data.engineHealth, 0, 1000, 1000);
    const indicators = data.indicators && typeof data.indicators === 'object'
      ? data.indicators
      : {};

    cluster.setAttribute('aria-label', `Приборная панель: ${data.model === 'bmwm5g90' ? 'BMW M5' : 'Blista'}`);
    speed.textContent = String(speedValue).padStart(3, '0');
    gear.textContent = typeof data.gear === 'string' && data.gear.length <= 3 ? data.gear : '—';
    rpmBar.style.width = `${Math.round(rpm * 100)}%`;
    rpmTrack.setAttribute('aria-valuenow', String(rpmNumber));
    rpmValue.textContent = `${rpmNumber.toLocaleString('ru-RU')} об/мин`;
    engineState.textContent = data.engineOn === true ? 'ДВИГАТЕЛЬ ВКЛ.' : 'ДВИГАТЕЛЬ ВЫКЛ.';
    engineState.classList.toggle('is-running', data.engineOn === true);
    setFuel(data.fuel);
    setDirt(data.dirtLevel);
    setOdometer(data.odometerKm);

    const checkEngineRequired = window.ragerpDashboardLogic.isCheckEngineRequired(engineHealth);
    checkEngine.classList.toggle('is-active', checkEngineRequired);
    checkEngine.setAttribute('aria-label', checkEngineRequired
      ? 'Check Engine: горит, повреждение двигателя не менее 50%'
      : 'Check Engine: не горит');
    const leftEnabled = indicators.left === true || indicators.hazards === true;
    const rightEnabled = indicators.right === true || indicators.hazards === true;
    setIndicator(leftSignal, leftEnabled);
    setIndicator(rightSignal, rightEnabled);
    setIndicator(leftSignalState, leftEnabled);
    setIndicator(rightSignalState, rightEnabled);
    hazardStatus.classList.toggle('is-active', indicators.hazards === true);
    leftSignal.setAttribute('aria-pressed', String(leftEnabled));
    rightSignal.setAttribute('aria-pressed', String(rightEnabled));
    hazardStatus.setAttribute('aria-pressed', String(indicators.hazards === true));
    leftSignal.setAttribute('aria-label', leftEnabled
      ? 'Выключить левый указатель поворота'
      : 'Включить левый указатель поворота');
    rightSignal.setAttribute('aria-label', rightEnabled
      ? 'Выключить правый указатель поворота'
      : 'Включить правый указатель поворота');
    hazardStatus.setAttribute('aria-label', indicators.hazards === true
      ? 'Выключить аварийную сигнализацию'
      : 'Включить аварийную сигнализацию');
  }

  function triggerSignal(signal) {
    if (typeof mp !== 'undefined' && mp && typeof mp.trigger === 'function') {
      mp.trigger('ragerp:dashboard:signal', signal);
    }
  }

  leftSignal.addEventListener('click', function () { triggerSignal('left'); });
  rightSignal.addEventListener('click', function () { triggerSignal('right'); });
  hazardStatus.addEventListener('click', function () { triggerSignal('hazards'); });

  window.ragerpDashboard = {
    setVisible: function (visible) {
      root.hidden = visible !== true;
    },
    update: update
  };
})();
