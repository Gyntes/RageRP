(function () {
  const root = document.getElementById('hud-root');
  const taskPanel = document.getElementById('task-panel');
  const taskReopen = document.getElementById('show-tasks');
  const notificationPanel = document.getElementById('notification');
  const notificationMessage = document.getElementById('notification-message');
  const customCrosshair = document.getElementById('custom-crosshair');
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

  function updateDateTime() {
    const now = new Date();
    const date = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    setText('hud-date-time', `${date} ${time}`);
  }

  function renderState() {
    setText('hud-static-id', state.staticId || '---');
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
    setVisible: function (visible) {
      root.classList.toggle('is-hidden', !visible);
    },
    focus: function () {}
  };
})();
