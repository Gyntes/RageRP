(function () {
  const root = document.getElementById('hud-root');
  const taskPanel = document.getElementById('task-panel');
  const taskReopen = document.getElementById('show-tasks');
  const notificationPanel = document.getElementById('notification');
  const notificationMessage = document.getElementById('notification-message');
  const customCrosshair = document.getElementById('custom-crosshair');
  const voiceCard = document.getElementById('voice-card');
  const voiceStatus = document.getElementById('hud-voice-status');
  let state = {};
  let activeNotification = null;

  function parsePayload(payload) {
    if (typeof payload !== 'string') return payload || {};
    try {
      return JSON.parse(payload);
    } catch (error) {
      console.error('[RageRP HUD] Could not parse server data:', error);
      return {};
    }
  }

  function formatMoney(value) {
    const amount = Number(value);
    return `${Math.max(0, Math.trunc(Number.isFinite(amount) ? amount : 0)).toLocaleString('ru-RU')} ₽`;
  }

  function setText(id, value) {
    document.getElementById(id).textContent = String(value == null ? '' : value);
  }

  function keyLabel(code) {
    const number = Number(code);
    if (number === 9) return 'TAB';
    if (number === 13) return 'ENTER';
    if (number === 32) return 'SPACE';
    if (number === 37) return '←';
    if (number === 38) return '↑';
    if (number === 39) return '→';
    if (number === 40) return '↓';
    if (number === 33) return 'PAGE UP';
    if (number === 34) return 'PAGE DOWN';
    if (number === 35) return 'END';
    if (number === 36) return 'HOME';
    if (number >= 48 && number <= 57) return String.fromCharCode(number);
    if (number >= 65 && number <= 90) return String.fromCharCode(number);
    if (number >= 112 && number <= 123) return `F${number - 111}`;
    if (number === 186) return ';';
    if (number === 187) return '=';
    if (number === 188) return ',';
    if (number === 189) return '-';
    if (number === 190) return '.';
    if (number === 191) return '/';
    if (number === 192) return '`';
    if (number === 219) return '[';
    if (number === 220) return '\\';
    if (number === 221) return ']';
    if (number === 222) return "'";
    return `KEY ${number}`;
  }

  function keyBindingLabel(primary, alternate) {
    return [primary, alternate]
      .filter((code) => code !== null && code !== undefined && Number.isInteger(Number(code)))
      .map(keyLabel)
      .join(' / ');
  }

  function roleLabel(data) {
    if (data.job === 'courier') return 'Курьер';
    if (data.faction === 'Mechanic') return 'Механик';
    if (data.faction === 'Civilian') return 'Гражданин';
    return String(data.faction || 'Гражданин');
  }

  function updateDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setText('hud-date-time', `${date} ${time}`);
  }

  function renderState() {
    setText('hud-static-id', state.staticId || '---');
    setText('hud-character-name', state.name || 'Персонаж');
    setText('hud-character-role', roleLabel(state));
    setText('hud-cash', formatMoney(state.cash));
    setText('hud-bank', formatMoney(state.bank));
    const onlineCount = Number(state.onlineCount);
    setText('hud-online-count', Number.isFinite(onlineCount) ? Math.max(0, Math.trunc(onlineCount)) : 0);
  }

  function sendAnswer(answer) {
    if (!activeNotification) return;
    activeNotification = null;
    notificationPanel.hidden = true;
    if (typeof mp !== 'undefined' && mp && typeof mp.trigger === 'function') {
      mp.trigger('ragerp:hud:answer', answer);
    }
  }

  function showNotification(notification) {
    const data = parsePayload(notification);
    if (!data || typeof data.id !== 'string' || typeof data.message !== 'string') return;

    activeNotification = data;
    setText('notification-title', data.title || 'Уведомление');
    notificationMessage.textContent = data.message;
    setText('accept-label', data.acceptLabel || 'Принять');
    setText('decline-label', data.declineLabel || 'Отказаться');
    notificationPanel.hidden = false;
  }

  document.getElementById('accept-button').addEventListener('click', function () {
    sendAnswer('accept');
  });
  document.getElementById('decline-button').addEventListener('click', function () {
    sendAnswer('decline');
  });
  document.getElementById('hide-tasks').addEventListener('click', function () {
    taskPanel.hidden = true;
    taskReopen.hidden = false;
  });
  taskReopen.addEventListener('click', function () {
    taskPanel.hidden = false;
    taskReopen.hidden = true;
  });

  updateDateTime();
  window.setInterval(updateDateTime, 15000);

  window.ragerpHud = {
    setBootstrap: function (payload) {
      state = parsePayload(payload);
      renderState();
    },
    update: function (payload) {
      state = Object.assign({}, state, parsePayload(payload));
      renderState();
    },
    showNotification: showNotification,
    closeNotification: function () {
      activeNotification = null;
      notificationPanel.hidden = true;
    },
    setOpacity: function (opacity) {
      const value = Number(opacity);
      if (!Number.isFinite(value)) return;
      root.style.setProperty('--hud-opacity', String(Math.max(.2, Math.min(1, value))));
    },
    setCombatOptions: function (options) {
      if (!options || typeof options !== 'object') return;
      customCrosshair.hidden = options.showCrosshair !== true;
      const scale = Number(options.crosshairScale);
      if (Number.isFinite(scale)) {
        customCrosshair.style.setProperty(
          '--crosshair-scale',
          String(Math.max(.6, Math.min(1.5, scale / 100)))
        );
      }
      if (typeof options.crosshairColor === 'string' &&
          /^#[0-9a-f]{6}$/i.test(options.crosshairColor)) {
        customCrosshair.style.setProperty('--crosshair-color', options.crosshairColor);
      }
    },
    setNotificationKeys: function (bindings) {
      if (!bindings || typeof bindings !== 'object') return;
      setText('accept-key', keyBindingLabel(bindings.accept, bindings.acceptAlternate));
      setText('decline-key', keyBindingLabel(bindings.decline, bindings.declineAlternate));
    },
    setVoiceTransmit: function (active) {
      const transmitting = active === true;
      voiceCard.classList.toggle('is-transmitting', transmitting);
      voiceCard.setAttribute(
        'aria-label',
        transmitting ? 'Микрофон передаёт голос' : 'Микрофон не активен'
      );
      voiceStatus.hidden = !transmitting;
    },
    setVisible: function (visible) {
      root.classList.toggle('is-hidden', !visible);
    },
    focus: function () {}
  };
})();
