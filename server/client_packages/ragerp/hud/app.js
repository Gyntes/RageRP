(function () {
  const root = document.getElementById('hud-root');
  const taskPanel = document.getElementById('task-panel');
  const taskReopen = document.getElementById('show-tasks');
  const notificationPanel = document.getElementById('notification');
  const notificationMessage = document.getElementById('notification-message');
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

  function renderState() {
    setText('hud-static-id', state.staticId || '---');
    setText('hud-cash', formatMoney(state.cash));
    setText('hud-bank', formatMoney(state.bank));
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
    setVisible: function (visible) {
      root.classList.toggle('is-hidden', !visible);
    }
  };
})();
