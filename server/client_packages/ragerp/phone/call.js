(function () {
  const card = document.querySelector('.call-card');
  const label = document.getElementById('call-label');
  const title = document.getElementById('call-title');
  const name = document.getElementById('call-name');
  const status = document.getElementById('call-status');
  const actions = document.getElementById('call-actions');
  let state = null;
  let activeSince = 0;

  function send(eventName, ...args) {
    if (typeof mp === 'undefined' || !mp || typeof mp.trigger !== 'function') return;
    mp.trigger(eventName, ...args);
  }

  function render() {
    if (!state) return;
    card.dataset.state = state.state;
    name.textContent = state.partnerName || '';
    while (actions.firstChild) actions.removeChild(actions.firstChild);

    if (state.state === 'incoming') {
      label.textContent = 'RMRP · ВХОДЯЩИЙ ВЫЗОВ';
      title.textContent = 'Входящий звонок';
      status.textContent = 'Нажми «Ответить», чтобы соединиться';
      actions.append(
        createButton('Ответить', 'primary', function () {
          send('ragerp:phone:call:answer-request', state.callId, true);
        }),
        createButton('Отклонить', 'danger', function () {
          send('ragerp:phone:call:answer-request', state.callId, false);
        })
      );
      return;
    }

    if (state.state === 'ringing') {
      label.textContent = 'RMRP · ИСХОДЯЩИЙ ВЫЗОВ';
      title.textContent = 'Вызов абонента';
      status.textContent = 'Ожидаем ответа…';
      actions.append(createButton('Отменить', 'danger', endCall));
      return;
    }

    if (state.state === 'active') {
      if (!activeSince) activeSince = Date.now();
      label.textContent = 'RMRP · СОЕДИНЕНИЕ УСТАНОВЛЕНО';
      title.textContent = 'Разговор';
      status.textContent = '00:00 · Удерживай Z, чтобы говорить';
      actions.append(createButton('Завершить звонок', 'danger', endCall));
      return;
    }

    label.textContent = 'RMRP · ТЕЛЕФОН';
    title.textContent = 'Звонок завершён';
    status.textContent = state.message || '';
  }

  function createButton(text, className, handler) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = className;
    button.textContent = text;
    button.addEventListener('click', handler);
    return button;
  }

  function endCall() {
    if (state && state.callId) send('ragerp:phone:call:end-request');
  }

  window.setInterval(function () {
    if (state && state.state === 'active' && activeSince) {
      const elapsed = Math.floor((Date.now() - activeSince) / 1000);
      const minutes = String(Math.floor(elapsed / 60)).padStart(2, '0');
      const seconds = String(elapsed % 60).padStart(2, '0');
      status.textContent = `${minutes}:${seconds} · Удерживай Z, чтобы говорить`;
    }
  }, 1000);

  window.ragerpCall = {
    setState: function (payload) {
      const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!value || typeof value !== 'object' ||
          typeof value.callId !== 'string' || typeof value.state !== 'string') return;
      if (value.state !== 'active') activeSince = 0;
      state = value;
      render();
    },
    focus: function () {}
  };
})();
