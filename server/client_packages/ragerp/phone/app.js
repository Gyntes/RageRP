(function () {
  const shell = document.getElementById('phone-shell');
  const homeScreen = document.getElementById('home-screen');
  const appScreen = document.getElementById('app-screen');
  const appContent = document.getElementById('app-content');
  const toast = document.getElementById('toast');
  const phoneTitles = {
    contacts: 'Контакты',
    messages: 'Сообщения',
    gps: 'Навигация',
    bank: 'Банк',
    taxi: 'Такси',
    ads: 'Объявления',
    settings: 'Настройки',
    vehicle: 'Моя машина',
    numbers: 'Мои номера'
  };
  const state = {
    staticId: '',
    name: '',
    cash: 0,
    bank: 0,
    online: [],
    messages: [],
    ads: [],
    taxiCalls: [],
    starterVehicle: null,
    numbers: [],
    notices: [],
    activeApp: null,
    contacts: loadContacts()
  };
  let toastTimer = null;

  function loadContacts() {
    try {
      const saved = JSON.parse(localStorage.getItem('ragerp:phone:contacts') || '[]');
      return Array.isArray(saved)
        ? saved.filter(function (contact) {
          return contact && /^\d{3}-\d{3}$/.test(String(contact.id || ''));
        }).slice(0, 40)
        : [];
    } catch (error) {
      console.error('[RageRP phone] Could not load saved contacts:', error);
      return [];
    }
  }

  function saveContacts() {
    try {
      localStorage.setItem('ragerp:phone:contacts', JSON.stringify(state.contacts));
    } catch (error) {
      console.error('[RageRP phone] Could not save contacts:', error);
      showToast('Не удалось сохранить контакты на этом устройстве.');
    }
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatMoney(value) {
    return `${Math.max(0, Math.trunc(Number(value) || 0)).toLocaleString('ru-RU')} ₽`;
  }

  function formatTime(value) {
    const date = new Date(Number(value) || Date.now());
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }

  function sendAction(action, data) {
    if (typeof mp === 'undefined' || typeof mp.trigger !== 'function') {
      showToast('Телефон работает только при подключении к серверу.');
      return;
    }
    mp.trigger('ragerp:phone:action', action, JSON.stringify(data || {}));
  }

  function showToast(message) {
    toast.textContent = String(message || '');
    toast.classList.add('visible');
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = null;
      toast.classList.remove('visible');
    }, 2800);
  }

  function setPhoneOpen(open) {
    if (!open) {
      if (typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
        mp.trigger('ragerp:phone:close-request');
      }
      return;
    }
    homeScreen.hidden = false;
    appScreen.hidden = true;
    state.activeApp = null;
    sendAction('refresh', {});
  }

  function goHome() {
    state.activeApp = null;
    homeScreen.hidden = false;
    appScreen.hidden = true;
  }

  function openApp(app) {
    if (!phoneTitles[app]) return;
    state.activeApp = app;
    homeScreen.hidden = true;
    appScreen.hidden = false;
    document.getElementById('app-title').textContent = phoneTitles[app];
    renderApp();
  }

  function personName(person) {
    return person && person.name ? person.name : 'Неизвестный абонент';
  }

  function validStaticId(value) {
    const id = String(value || '');
    return /^\d{3}-\d{3}$/.test(id) ? id : '';
  }

  function numbersFromVehicle(vehicle) {
    if (!vehicle || typeof vehicle.plate !== 'string' || !vehicle.plate) return [];
    return [{
      plate: vehicle.plate,
      region: String(vehicle.region || '97'),
      vehicleName: String(vehicle.name || '')
    }];
  }

  function normalizeNumbers(numbers) {
    if (!Array.isArray(numbers)) return [];
    return numbers.filter(function (number) {
      return number && typeof number.plate === 'string' && number.plate.trim();
    }).slice(0, 100);
  }

  function getOnlineById(id) {
    return state.online.find(function (person) {
      return person.staticId === id;
    });
  }

  function contactListHtml() {
    const savedIds = new Set(state.contacts.map(function (contact) { return contact.id; }));
    const people = state.online.filter(function (person) {
      return person.staticId !== state.staticId && !savedIds.has(person.staticId);
    });
    const saved = state.contacts.map(function (contact) {
      const online = getOnlineById(contact.id);
      const name = online ? personName(online) : contact.name;
      return `<article class="card contact-card">
        <div class="avatar">${escapeHtml(name.slice(0, 1).toUpperCase())}</div>
        <div class="contact-copy"><div class="card-title">${escapeHtml(name)}</div>
          <div class="card-subtitle">ID ${escapeHtml(contact.id)}${online ? ' · в сети' : ' · не в сети'}</div></div>
        <button class="button small" data-action="open-chat" data-id="${escapeHtml(contact.id)}" type="button">SMS</button>
      </article>`;
    }).join('');
    const onlineHtml = people.map(function (person) {
      return `<article class="card contact-card">
        <div class="avatar">${escapeHtml(person.name.slice(0, 1).toUpperCase())}</div>
        <div class="contact-copy"><div class="card-title">${escapeHtml(personName(person))}</div>
          <div class="card-subtitle">ID ${escapeHtml(person.staticId)}</div></div>
        <button class="button small" data-action="add-contact" data-id="${escapeHtml(person.staticId)}" data-name="${escapeHtml(personName(person))}" type="button">Добавить</button>
      </article>`;
    }).join('');

    return `<p class="section-title">Сохранённые</p>
      <div class="contact-list">${saved || '<div class="empty-state">Контактов пока нет. Добавь игрока из списка ниже.</div>'}</div>
      <p class="section-title" style="margin-top:16px">Игроки онлайн</p>
      <div class="contact-list">${onlineHtml || '<div class="empty-state">Сейчас нет других игроков в сети.</div>'}</div>
      <div class="call-note">Голосовые звонки пока отключены на сервере. Сейчас можно написать SMS контакту.</div>`;
  }

  function getConversation(id) {
    return state.messages.filter(function (message) {
      return message.fromId === id || message.toId === id;
    }).sort(function (left, right) {
      return Number(left.at) - Number(right.at);
    });
  }

  function messagesHtml(selectedId) {
    const thread = selectedId ? getConversation(selectedId) : [];
    const conversation = thread.map(function (message) {
      const mine = message.fromId === state.staticId;
      return `<div class="message-bubble${mine ? ' mine' : ''}">
        ${escapeHtml(message.body)}
        <div class="message-meta">${mine ? 'Вы' : escapeHtml(message.fromName)} · ${formatTime(message.at)}</div>
      </div>`;
    }).join('');
    const options = state.contacts.map(function (contact) {
      const online = getOnlineById(contact.id);
      return `<option value="${escapeHtml(contact.id)}"${contact.id === selectedId ? ' selected' : ''}>${escapeHtml(online ? personName(online) : contact.name)} · ${escapeHtml(contact.id)}</option>`;
    }).join('');

    return `<p class="section-title">Переписка</p>
      <select class="select" id="message-contact"><option value="">Выбери контакт</option>${options}</select>
      <div class="message-list" style="margin-top:11px">${conversation || '<div class="empty-state">Выбери сохранённый контакт, чтобы открыть чат.</div>'}</div>
      <form class="form" data-form="message">
        <textarea class="textarea" name="body" maxlength="300" placeholder="Написать сообщение…" required></textarea>
        <button class="button primary" type="submit"${selectedId ? '' : ' disabled'}>Отправить SMS</button>
      </form>`;
  }

  function gpsHtml() {
    const locations = [
      { key: 'city_hall', name: 'Ратуша', description: 'Центр города' },
      { key: 'hospital', name: 'Больница', description: 'Медицинский центр' },
      { key: 'police', name: 'Полицейский участок', description: 'Центральный участок' },
      { key: 'bank', name: 'Банк', description: 'Банковское отделение' },
      { key: 'spawn', name: 'Центр Лос-Сантоса', description: 'Начальная точка города' }
    ];
    const destinationHtml = locations.map(function (place) {
      return `<article class="card card-row">
        <div><div class="card-title">${escapeHtml(place.name)}</div><div class="card-subtitle">${escapeHtml(place.description)}</div></div>
        <button class="button small" data-action="gps-location" data-key="${escapeHtml(place.key)}" type="button">Маршрут</button>
      </article>`;
    }).join('');
    const playerHtml = state.online.filter(function (person) {
      return person.staticId !== state.staticId;
    }).map(function (person) {
      return `<article class="card card-row">
        <div><div class="card-title">${escapeHtml(personName(person))}</div><div class="card-subtitle">ID ${escapeHtml(person.staticId)}</div></div>
        <button class="button small" data-action="gps-player" data-id="${escapeHtml(person.staticId)}" type="button">Найти</button>
      </article>`;
    }).join('');

    return `<p class="section-title">Точки города</p>${destinationHtml}
      <p class="section-title" style="margin-top:16px">Игроки онлайн</p>
      ${playerHtml || '<div class="empty-state">Нет игроков для поиска.</div>'}`;
  }

  function bankHtml() {
    return `<div class="balance-card">
        <span class="balance-label">Банковский счёт</span>
        <strong class="balance-value">${formatMoney(state.bank)}</strong>
        <div class="balance-secondary"><span>Наличные</span><strong>${formatMoney(state.cash)}</strong></div>
      </div>
      <p class="section-title">Операции</p>
      <form class="form" data-form="bank">
        <select class="select" name="operation">
          <option value="deposit">Положить наличные на счёт</option>
          <option value="withdraw">Снять со счёта</option>
          <option value="transfer">Перевести игроку по статик ID</option>
        </select>
        <input class="input" name="amount" type="number" min="1" max="1000000" placeholder="Сумма в ₽" required>
        <input class="input" name="targetId" maxlength="7" placeholder="Статик ID получателя (для перевода)">
        <button class="button primary" type="submit">Выполнить операцию</button>
      </form>
      <p class="muted">Операции проверяются и сохраняются сервером. Переводы доступны игрокам, уже зарегистрированным в городе.</p>`;
  }

  function vehicleHtml() {
    const vehicle = state.starterVehicle;
    if (!vehicle) {
      return '<div class="empty-state">Загружаем данные стартового автомобиля…</div>';
    }

    return `<p class="section-title">Твой стартовый автомобиль</p>
      <article class="card vehicle-card">
        <div class="vehicle-symbol">◈</div>
        <div class="card-title">${escapeHtml(vehicle.name || 'Компактный автомобиль')}</div>
        <div class="card-subtitle">${escapeHtml(vehicle.model || 'blista')} · ${vehicle.isOut ? 'уже в городе' : 'в гараже'}</div>
        <div class="vehicle-plate">${escapeHtml(`${vehicle.plate || '---'} ${vehicle.region || ''}`.trim())}</div>
        <button class="button primary vehicle-button" data-action="starter-vehicle" type="button">
          ${vehicle.isOut ? 'Отметить машину на GPS' : 'Вызвать машину'}
        </button>
      </article>
      <div class="notice">Автомобиль бесплатный и закреплён за персонажем. Если он уже вызван, кнопка отметит его положение на карте.</div>`;
  }

  function numbersHtml() {
    if (!state.numbers.length) {
      return `<p class="section-title">Регистрационные номера</p>
        <div class="empty-state">У тебя пока нет автомобильных номеров. Номер появится после получения автомобиля.</div>`;
    }

    return `<p class="section-title">Регистрационные номера</p>
      <div class="number-list">${state.numbers.map(function (number) {
        const status = number.vehicleName
          ? `Установлен на ${escapeHtml(number.vehicleName)}`
          : 'Номер свободен';
        return `<article class="card number-card">
          <div class="number-plate">
            <span class="number-plate-main">${escapeHtml(number.plate)}</span>
            <span class="number-region">
              <strong>${escapeHtml(number.region || '97')}</strong>
              <small>RUS</small>
              <span class="number-flag" aria-label="Флаг России"></span>
            </span>
          </div>
          <span class="number-status">${status}</span>
        </article>`;
      }).join('')}</div>`;
  }

  function taxiHtml() {
    const calls = state.taxiCalls.slice().reverse();
    const cards = calls.map(function (call) {
      const isMine = call.requesterId === state.staticId;
      const status = call.driverId
        ? `Водитель: ${call.driverName}`
        : 'Ожидает водителя';
      const actions = call.status === 'open' && !isMine
        ? `<button class="button small" data-action="taxi-accept" data-id="${escapeHtml(call.id)}" type="button">Принять</button>`
        : call.driverId && (isMine || call.driverId === state.staticId)
          ? `<button class="button small" data-action="taxi-route" data-id="${escapeHtml(call.id)}" type="button">Маршрут</button>`
          : '';
      return `<article class="card">
        <div class="card-row"><span class="card-title">${escapeHtml(call.requesterName)}</span>
          <span class="status-badge${call.driverId ? ' busy' : ''}">${call.driverId ? 'Назначено' : 'Новый вызов'}</span></div>
        <div class="card-subtitle">${escapeHtml(status)} · ${formatTime(call.createdAt)}</div>
        ${actions ? `<div style="margin-top:9px">${actions}</div>` : ''}
      </article>`;
    }).join('');
    const ownActive = calls.some(function (call) {
      return call.requesterId === state.staticId && call.status === 'open';
    });

    return `<p class="section-title">Поездки</p>
      <p class="muted">Оставь заявку, чтобы игроки рядом увидели вызов. Принявший водитель получит точку подачи.</p>
      <button class="button primary" data-action="taxi-request" type="button"${ownActive ? ' disabled' : ''}>${ownActive ? 'Заявка уже активна' : 'Вызвать такси'}</button>
      <p class="section-title" style="margin-top:16px">Диспетчерская</p>
      <div class="taxi-list">${cards || '<div class="empty-state">Активных заявок пока нет.</div>'}</div>`;
  }

  function adsHtml() {
    const cards = state.ads.slice().reverse().map(function (ad) {
      return `<article class="card">
        <div class="card-title">${escapeHtml(ad.authorName)} <span class="status-badge">ID ${escapeHtml(ad.authorId)}</span></div>
        <div class="card-subtitle" style="margin-top:7px">${escapeHtml(ad.text)}</div>
        <div class="card-meta">${formatTime(ad.createdAt)}</div>
      </article>`;
    }).join('');

    return `<p class="section-title">Городская доска</p>
      <form class="form" data-form="ad">
        <textarea class="textarea" name="text" maxlength="180" placeholder="Объявление для города…" required></textarea>
        <button class="button primary" type="submit">Опубликовать</button>
      </form>
      <div class="notice">Публикации видны всем игрокам онлайн. Не указывай личные данные.</div>
      <div class="ad-list" style="margin-top:12px">${cards || '<div class="empty-state">Объявлений пока нет.</div>'}</div>`;
  }

  function settingsHtml() {
    const wallpapers = ['night', 'ocean', 'sunset'];
    const names = { night: 'Ночь', ocean: 'Океан', sunset: 'Закат' };
    const options = wallpapers.map(function (wallpaper) {
      return `<button class="wallpaper-option${getWallpaper() === wallpaper ? ' selected' : ''}" data-action="wallpaper" data-wallpaper="${wallpaper}" type="button" aria-label="Обои: ${names[wallpaper]}"></button>`;
    }).join('');
    return `<p class="section-title">Оформление</p>
      <p class="muted">Выбери обои телефона. Настройка сохранится на этом компьютере.</p>
      <div class="wallpapers">${options}</div>
      <p class="section-title" style="margin-top:18px">Устройство</p>
      <article class="card">
        <div class="card-title">Владелец</div>
        <div class="card-subtitle">${escapeHtml(state.name || 'Персонаж')} · статик ID ${escapeHtml(state.staticId || '--- ---')}</div>
      </article>
      <article class="card">
        <div class="card-title">Управление</div>
        <div class="card-subtitle">Нажми P или кнопку закрытия, чтобы убрать телефон.</div>
      </article>
      <div class="call-note">Голосовая связь отключена конфигурацией сервера. SMS и остальные приложения работают независимо.</div>`;
  }

  function renderApp() {
    if (!state.activeApp) return;
    const renderers = {
      contacts: contactListHtml,
      messages: function () { return messagesHtml(state.selectedContact || ''); },
      gps: gpsHtml,
      bank: bankHtml,
      taxi: taxiHtml,
      ads: adsHtml,
      settings: settingsHtml,
      vehicle: vehicleHtml,
      numbers: numbersHtml
    };
    appContent.innerHTML = renderers[state.activeApp]();
  }

  function renderMessages(selectedId) {
    state.selectedContact = validStaticId(selectedId) || '';
    if (state.activeApp === 'messages') renderApp();
  }

  function updateClock() {
    const now = new Date();
    const time = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    document.getElementById('clock').textContent = time;
    document.getElementById('home-clock').textContent = time;
    document.getElementById('date-label').textContent =
      now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('ru-RU');
  }

  document.querySelectorAll('[data-open-app]').forEach(function (button) {
    button.addEventListener('click', function () {
      openApp(button.dataset.openApp);
    });
  });
  document.getElementById('back-button').addEventListener('click', goHome);
  document.querySelectorAll('[data-home]').forEach(function (button) {
    button.addEventListener('click', goHome);
  });
  document.querySelectorAll('[data-close]').forEach(function (button) {
    button.addEventListener('click', function () { setPhoneOpen(false); });
  });

  appContent.addEventListener('change', function (event) {
    if (event.target && event.target.id === 'message-contact') {
      renderMessages(event.target.value);
    }
  });

  appContent.addEventListener('click', function (event) {
    const button = event.target.closest('[data-action]');
    if (!button || button.disabled) return;
    const action = button.dataset.action;

    if (action === 'add-contact') {
      const id = validStaticId(button.dataset.id);
      const name = String(button.dataset.name || '').slice(0, 60);
      if (!id || id === state.staticId) return;
      if (!state.contacts.some(function (contact) { return contact.id === id; })) {
        state.contacts.push({ id: id, name: name });
        state.contacts = state.contacts.slice(0, 40);
        saveContacts();
        renderApp();
        showToast(`${name} добавлен в контакты.`);
      }
      return;
    }

    if (action === 'open-chat') {
      openApp('messages');
      state.selectedContact = validStaticId(button.dataset.id);
      renderApp();
      return;
    }

    if (action === 'gps-location') {
      sendAction('gps-location', { key: button.dataset.key });
      return;
    }

    if (action === 'gps-player') {
      sendAction('gps-player', { staticId: validStaticId(button.dataset.id) });
      return;
    }

    if (action === 'taxi-request') {
      sendAction('taxi-request', {});
      return;
    }

    if (action === 'starter-vehicle') {
      sendAction('starter-vehicle', {});
      return;
    }

    if (action === 'taxi-accept') {
      sendAction('taxi-accept', { id: button.dataset.id });
      return;
    }

    if (action === 'taxi-route') {
      const call = state.taxiCalls.find(function (item) { return item.id === button.dataset.id; });
      if (call && typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
        mp.trigger('ragerp:phone:set-waypoint', JSON.stringify({ x: call.x, y: call.y }));
      }
      return;
    }

    if (action === 'wallpaper') {
      setWallpaper(button.dataset.wallpaper);
      renderApp();
    }
  });

  appContent.addEventListener('submit', function (event) {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    const values = new FormData(form);

    if (form.dataset.form === 'message') {
      const targetId = validStaticId(state.selectedContact);
      const body = String(values.get('body') || '').trim();
      if (!targetId || !body) {
        showToast('Выбери контакт и введи сообщение.');
        return;
      }
      sendAction('message', { targetId: targetId, body: body });
      form.reset();
      return;
    }

    if (form.dataset.form === 'bank') {
      const operation = String(values.get('operation') || '');
      const amount = Number(values.get('amount'));
      const targetId = validStaticId(values.get('targetId'));
      if (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000000) {
        showToast('Укажи сумму от 1 до 1 000 000 ₽.');
        return;
      }
      if (operation === 'transfer' && (!targetId || targetId === state.staticId)) {
        showToast('Введи корректный статик ID получателя.');
        return;
      }
      sendAction('bank', { operation: operation, amount: amount, targetId: targetId });
      form.reset();
      return;
    }

    if (form.dataset.form === 'ad') {
      const text = String(values.get('text') || '').trim();
      if (!text) {
        showToast('Напиши текст объявления.');
        return;
      }
      sendAction('ad', { text: text });
      form.reset();
    }
  });

  window.ragerpPhone = {
    setBootstrap: function (payload) {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!data || typeof data !== 'object') return;
      state.staticId = validStaticId(data.staticId);
      state.name = String(data.name || '');
      state.cash = Number(data.cash) || 0;
      state.bank = Number(data.bank) || 0;
      state.online = Array.isArray(data.online) ? data.online : [];
      state.messages = Array.isArray(data.messages) ? data.messages : [];
      state.ads = Array.isArray(data.ads) ? data.ads : [];
      state.taxiCalls = Array.isArray(data.taxiCalls) ? data.taxiCalls : [];
      state.starterVehicle = data.starterVehicle || null;
      state.numbers = Array.isArray(data.numbers)
        ? normalizeNumbers(data.numbers)
        : numbersFromVehicle(state.starterVehicle);
      document.getElementById('home-name').textContent = state.name || 'Мобильная связь';
      renderApp();
    },
    update: function (payload) {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!data || typeof data !== 'object') return;
      if (data.cash !== undefined) state.cash = Number(data.cash) || 0;
      if (data.bank !== undefined) state.bank = Number(data.bank) || 0;
      if (Array.isArray(data.online)) state.online = data.online;
      if (Array.isArray(data.messages)) state.messages = data.messages;
      if (Array.isArray(data.ads)) state.ads = data.ads;
      if (Array.isArray(data.taxiCalls)) state.taxiCalls = data.taxiCalls;
      if (data.starterVehicle !== undefined) state.starterVehicle = data.starterVehicle;
      if (Array.isArray(data.numbers)) {
        state.numbers = normalizeNumbers(data.numbers);
      } else if (data.starterVehicle !== undefined) {
        state.numbers = numbersFromVehicle(state.starterVehicle);
      }
      if (data.notice) showToast(data.notice);
      renderApp();
    },
    setNotice: showToast,
    close: function () { setPhoneOpen(false); }
  };

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setPhoneOpen(false);
    }
  });

  function getWallpaper() {
    try {
      const saved = localStorage.getItem('ragerp:phone:wallpaper');
      return ['night', 'ocean', 'sunset'].includes(saved) ? saved : 'night';
    } catch (error) {
      console.error('[RageRP phone] Could not read wallpaper setting:', error);
      return 'night';
    }
  }

  function setWallpaper(wallpaper) {
    if (!['night', 'ocean', 'sunset'].includes(wallpaper)) return;
    shell.dataset.wallpaper = wallpaper;
    try {
      localStorage.setItem('ragerp:phone:wallpaper', wallpaper);
    } catch (error) {
      console.error('[RageRP phone] Could not save wallpaper setting:', error);
      showToast('Обои применены временно, сохранить их не удалось.');
    }
  }

  setWallpaper(getWallpaper());
  updateClock();
  window.setInterval(updateClock, 1000);
})();
