(function () {
  const shell = document.getElementById('phone-shell');
  const homeScreen = document.getElementById('home-screen');
  const appScreen = document.getElementById('app-screen');
  const appContent = document.getElementById('app-content');
  const phoneLockScreen = document.getElementById('phone-lock-screen');
  const militaryIdOverlay = document.getElementById('military-id-overlay');
  const militaryIdSheet = document.getElementById('military-id-sheet');
  const toast = document.getElementById('toast');
  const phoneTitles = {
    contacts: 'Контакты',
    messages: 'Сообщения',
    gps: 'Навигация',
    bank: 'Один Банк',
    taxi: 'Такси',
    ads: 'Объявления',
    settings: 'Настройки',
    vehicle: 'Моя машина',
    numbers: 'Мои номера',
    documents: 'Документы'
  };
  const state = {
    staticId: '',
    name: '',
    firstName: '',
    lastName: '',
    cash: 0,
    bank: 0,
    online: [],
    messages: [],
    ads: [],
    taxiCalls: [],
    starterVehicle: null,
    numbers: [],
    militaryTicket: null,
    notices: [],
    activeApp: null,
    navigationStack: [],
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
      closeMilitaryId();
      appScreen.classList.remove('is-bank-app');
      shell.classList.remove('is-bank-app');
      state.activeApp = null;
      state.navigationStack = [];
      phoneLockScreen.hidden = true;
      if (typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
        mp.trigger('ragerp:phone:close-request');
      }
      return;
    }
    phoneLockScreen.hidden = true;
    homeScreen.hidden = false;
    appScreen.hidden = true;
    state.activeApp = null;
    state.navigationStack = [];
    sendAction('refresh', {});
  }

  function goHome() {
    state.activeApp = null;
    state.navigationStack = [];
    appScreen.classList.remove('is-bank-app');
    shell.classList.remove('is-bank-app');
    homeScreen.hidden = false;
    appScreen.hidden = true;
  }

  function showApp(app) {
    state.activeApp = app;
    homeScreen.hidden = true;
    appScreen.hidden = false;
    appScreen.classList.toggle('is-bank-app', app === 'bank');
    shell.classList.toggle('is-bank-app', app === 'bank');
    document.getElementById('app-title').textContent = phoneTitles[app];
    renderApp();
  }

  function openApp(app) {
    if (!phoneTitles[app] || app === state.activeApp) return;
    state.navigationStack.push(state.activeApp);
    showApp(app);
  }

  function goBack() {
    const previousApp = state.navigationStack.pop();
    if (previousApp) {
      showApp(previousApp);
      return;
    }
    goHome();
  }

  function lockPhone() {
    closeMilitaryId();
    phoneLockScreen.hidden = false;
  }

  function unlockPhone() {
    phoneLockScreen.hidden = true;
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
    const accountName = String(state.name || 'Владелец счёта').trim();
    return `<div class="one-bank-app">
      <div class="one-bank-card">
        <div class="one-bank-brand">
          <span>Один Банк <small>Classic</small></span>
          <span class="one-bank-brand-mark">◉</span>
        </div>
        <span class="one-bank-owner">${escapeHtml(accountName)}</span>
        <strong class="one-bank-card-value">5455 3947 0502 2795</strong>
        <span class="one-bank-currency">₽</span>
      </div>
      <div class="one-bank-total">
        <strong>${formatMoney(state.bank)}</strong>
        <span>00:10:27</span>
      </div>
      <section class="one-bank-group one-bank-section">
        <div class="one-bank-grid">
          <button type="button" data-action="bank-mode" data-operation="withdraw">
            <span class="one-bank-icon">◈</span><b>Вклады</b>
          </button>
          <button type="button" data-action="bank-history">
            <span class="one-bank-icon">▤</span><b>История<br>операций</b>
          </button>
          <button type="button" data-action="bank-fines-history">
            <span class="one-bank-icon">₽</span><b>История<br>штрафов</b>
          </button>
        </div>
      </section>
      <section class="one-bank-group">
        <p class="one-bank-section-title">Платежи</p>
        <div class="one-bank-section one-bank-payments">
          <div class="one-bank-grid">
            <button type="button" data-action="bank-services">
              <span class="one-bank-icon">◆</span><b>Коммунальные<br>услуги</b>
            </button>
            <button type="button" data-action="bank-fines">
              <span class="one-bank-icon">P</span><b>Штрафы</b>
            </button>
            <button type="button" data-action="bank-atms">
              <span class="one-bank-icon">▣</span><b>Банкоматы</b>
            </button>
          </div>
        </div>
      </section>
      <section class="one-bank-group">
        <p class="one-bank-section-title">Переводы</p>
        <div class="one-bank-section">
          <div class="one-bank-grid one-bank-transfers">
            <button type="button" data-action="bank-mode" data-operation="transfer">
              <span class="one-bank-icon">▰</span><b>Перевод</b>
            </button>
            <button type="button" data-action="bank-mode" data-operation="deposit">
              <span class="one-bank-icon">♟</span><b>Пополнить</b>
            </button>
            <button type="button" data-action="bank-mode" data-operation="withdraw">
              <span class="one-bank-icon">♟♟</span><b>Снять</b>
            </button>
          </div>
        </div>
      </section>
      <div class="one-bank-operation" id="one-bank-operation" hidden>
        <div class="one-bank-operation-head">
          <b id="one-bank-operation-title">Операция</b>
          <button type="button" data-action="bank-operation-close" aria-label="Закрыть">×</button>
        </div>
        <form class="form" data-form="bank">
          <input type="hidden" name="operation" id="one-bank-operation-value" value="transfer">
          <input class="input" name="amount" type="number" min="1" max="1000000" placeholder="Сумма в ₽" required>
          <input class="input" id="one-bank-target" name="targetId" maxlength="7" placeholder="Статик ID получателя">
          <button class="button primary" type="submit">Выполнить</button>
        </form>
      </div>
    </div>`;
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

  function formatDocumentDate(value) {
    if (typeof value === 'string' && value.trim()) {
      const parsed = new Date(value);
      return Number.isNaN(parsed.getTime()) ? value.trim() : parsed.toLocaleDateString('ru-RU');
    }
    const timestamp = Number(value);
    if (!Number.isFinite(timestamp) || timestamp <= 0) return '—';
    const date = new Date(timestamp);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('ru-RU');
  }

  function documentsHtml() {
    const issued = Boolean(state.militaryTicket && typeof state.militaryTicket === 'object');
    return `<p class="section-title">Личные документы</p>
      <button class="military-document-entry card" data-action="open-military-id" type="button">
        <span class="military-document-entry-icon" aria-hidden="true">★</span>
        <span class="military-document-entry-copy">
          <strong>Военный билет</strong>
          <small>Именной документ персонажа</small>
        </span>
        <span class="status-badge${issued ? '' : ' busy'}">${issued ? 'Выдан' : 'Не получен'}</span>
      </button>
      <p class="muted">Нажми на документ, чтобы открыть его на весь экран.</p>`;
  }

  function militaryIdHtml() {
    const ticket = state.militaryTicket && typeof state.militaryTicket === 'object'
      ? state.militaryTicket
      : null;
    const issued = Boolean(ticket);
    const nameParts = String(state.name || '').trim().split(/\s+/);
    const firstName = state.firstName || nameParts[0] || '—';
    const lastName = state.lastName || nameParts.slice(1).join(' ') || '—';
    const issuer = ticket && ticket.issuerName != null
      ? String(ticket.issuerName).trim()
      : '';
    const issuerId = issuer && ticket && (ticket.issuerId || ticket.issuerStaticId)
      ? `(${ticket.issuerId || ticket.issuerStaticId})`
      : '';
    const rank = ticket ? String(ticket.rank || '—') : '—';
    const issueDate = ticket ? formatDocumentDate(ticket.issuedAt) : '—';
    const commissariat = ticket && ticket.commissariat
      ? String(ticket.commissariat)
      : issued ? 'Военный комиссариат' : '—';
    const office = ticket && ticket.commissariatOffice
      ? String(ticket.commissariatOffice).toLocaleLowerCase('ru-RU').startsWith('отделом')
        ? String(ticket.commissariatOffice)
        : `Отделом военного комиссариата ${String(ticket.commissariatOffice)}`
      : !ticket || !ticket.commissariat
        ? commissariat
        : commissariat.toLocaleLowerCase('ru-RU').startsWith('отделом')
          ? commissariat
          : `Отделом военного комиссариата ${commissariat}`;
    const recordTitle = issued
      ? ticket.method === 'service' ? 'ОКОНЧИЛ ВОЕННУЮ СЛУЖБУ' : 'ВОИНСКОЕ ЗВАНИЕ'
      : 'ВОЕННЫЙ БИЛЕТ НЕ ПОЛУЧЕН';
    const rankCaption = issued ? 'В ЗВАНИИ' : 'ЗВАНИЕ НЕ ПРИСВОЕНО';
    const registrationHeading = issued ? 'ПРИНЯТ' : 'НЕ ПРИНЯТ';
    const registrationDetails = issued
      ? `На воинский учет<br>${escapeHtml(office)}`
      : 'Военный билет ещё не выдан персонажу.';

    return `<button class="military-id-close-x" data-close-military-id type="button" aria-label="Закрыть военный билет">×</button>
      <section class="military-id-page military-id-page-left">
        <div class="military-id-crest" aria-hidden="true"><span>★</span></div>
        <h1>ВОЕННЫЙ БИЛЕТ</h1>
        <div class="military-id-fields">
          <div class="military-id-field"><span>Имя:</span><strong>${escapeHtml(firstName)}</strong></div>
          <div class="military-id-field"><span>Фамилия:</span><strong>${escapeHtml(lastName)}</strong></div>
          <div class="military-id-field"><span>ID:</span><strong>${escapeHtml(state.staticId || '--- ---')}</strong></div>
          <div class="military-id-field military-id-issuer"><span>Выдан военным комиссариатом</span><strong>${escapeHtml(commissariat)}</strong></div>
          <div class="military-id-field"><span>Дата:</span><strong>${escapeHtml(issueDate)}</strong></div>
        </div>
        <div class="military-id-signature${issuer ? ' is-issued' : ''}">
          <div class="military-id-seal" aria-hidden="true"><span>★</span><small>М.П.</small></div>
          <div class="military-id-issuer-info">
            <span>ВЫДАЛ:</span>
            <strong${issuer ? ' class="is-handwritten"' : ''}>${escapeHtml(issuer)}</strong>
            ${issuerId ? `<small>${escapeHtml(issuerId)}</small>` : ''}
          </div>
          <i aria-label="Подпись"><svg viewBox="0 0 100 34" aria-hidden="true">
            <path d="M3 27C10 18 13 7 18 8c5 1-7 15-1 16 6 1 11-13 16-13 6 0-5 15 1 15 8 0 10-18 15-19 5-1-2 14 4 14 6 0 12-8 22-9 9-1 13-4 22-10" />
            <path d="M26 30c16-5 35 0 61-9" />
          </svg></i>
        </div>
      </section>
      <section class="military-id-page military-id-page-right">
        <h2>Отметки о приеме на воинский учет и снятии с воинского учета</h2>
        <div class="military-id-acceptance${issued ? ' is-issued' : ''}">
          <strong>${registrationHeading}</strong>
          <span>${registrationDetails}</span>
        </div>
        <div class="military-id-rank${issued ? ' is-issued' : ''}">
          <strong>${recordTitle}</strong>
          <div class="military-id-rank-line">
            <span class="military-id-rank-medal" aria-hidden="true">★</span>
            <span class="military-id-rank-copy"><span>${rankCaption}</span><b>${escapeHtml(rank.toLocaleUpperCase('ru-RU'))}</b></span>
            <span class="military-id-rank-medal" aria-hidden="true">★</span>
          </div>
        </div>
        <div class="military-id-ruled" aria-hidden="true"></div>
      </section>`;
  }

  function openMilitaryId() {
    militaryIdSheet.innerHTML = militaryIdHtml();
    militaryIdOverlay.hidden = false;
    shell.classList.add('is-document-covered');
  }

  function closeMilitaryId() {
    if (militaryIdOverlay.hidden) return;
    militaryIdOverlay.hidden = true;
    shell.classList.remove('is-document-covered');
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
        <div class="card-subtitle">Нажми P или Esc, чтобы закрыть телефон. Кнопка блокировки блокирует экран.</div>
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
      numbers: numbersHtml,
      documents: documentsHtml
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
    document.getElementById('lock-clock').textContent = time;
    document.getElementById('lock-date').textContent =
      now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('ru-RU');
    document.getElementById('date-label').textContent =
      now.toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('ru-RU');
  }

  document.querySelectorAll('[data-open-app]').forEach(function (button) {
    button.addEventListener('click', function () {
      openApp(button.dataset.openApp);
    });
  });
  document.getElementById('back-button').addEventListener('click', goBack);
  document.querySelectorAll('[data-phone-back]').forEach(function (button) {
    button.addEventListener('click', goBack);
  });
  document.querySelectorAll('[data-home]').forEach(function (button) {
    button.addEventListener('click', goHome);
  });
  document.querySelectorAll('[data-lock]').forEach(function (button) {
    button.addEventListener('click', lockPhone);
  });
  document.getElementById('unlock-phone').addEventListener('click', unlockPhone);
  document.getElementById('military-id-close').addEventListener('click', closeMilitaryId);
  militaryIdOverlay.addEventListener('click', function (event) {
    if (event.target === militaryIdOverlay || event.target.closest('[data-close-military-id]')) {
      closeMilitaryId();
    }
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

    if (action === 'bank-mode') {
      const operation = button.dataset.operation || 'transfer';
      const panel = document.getElementById('one-bank-operation');
      const operationInput = document.getElementById('one-bank-operation-value');
      const title = document.getElementById('one-bank-operation-title');
      const target = document.getElementById('one-bank-target');
      if (!panel || !operationInput || !title || !target) return;
      const titles = {
        deposit: 'Пополнение счёта',
        withdraw: 'Снятие со счёта',
        transfer: 'Перевод другому игроку'
      };
      operationInput.value = operation;
      title.textContent = titles[operation] || 'Операция';
      target.hidden = operation !== 'transfer';
      panel.hidden = false;
      panel.scrollIntoView({ block: 'nearest' });
      const amount = panel.querySelector('input[name="amount"]');
      if (amount) amount.focus();
      return;
    }

    if (action === 'bank-operation-close') {
      const panel = document.getElementById('one-bank-operation');
      if (panel) panel.hidden = true;
      return;
    }

    if (action === 'bank-history') {
      showToast('История серверных операций обновляется после пополнения, снятия и перевода.');
      return;
    }

    if (action === 'bank-fines-history') {
      showToast('История штрафов пока не подключена.');
      return;
    }

    if (action === 'bank-services') {
      showToast('Коммунальные услуги доступны в городском отделении.');
      return;
    }

    if (action === 'bank-fines') {
      showToast('Проверка и оплата штрафов пока недоступны.');
      return;
    }

    if (action === 'bank-atms') {
      showToast('Банкоматы отмечены на карте сервера.');
      return;
    }

    if (action === 'open-military-id') {
      openMilitaryId();
      return;
    }

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
      state.firstName = String(data.firstName || '');
      state.lastName = String(data.lastName || '');
      state.cash = Number(data.cash) || 0;
      state.bank = Number(data.bank) || 0;
      state.online = Array.isArray(data.online) ? data.online : [];
      state.messages = Array.isArray(data.messages) ? data.messages : [];
      state.ads = Array.isArray(data.ads) ? data.ads : [];
      state.taxiCalls = Array.isArray(data.taxiCalls) ? data.taxiCalls : [];
      state.starterVehicle = data.starterVehicle || null;
      state.militaryTicket = data.militaryTicket || null;
      state.numbers = Array.isArray(data.numbers)
        ? normalizeNumbers(data.numbers)
        : numbersFromVehicle(state.starterVehicle);
      document.getElementById('home-name').textContent = state.name || 'Мобильная связь';
      renderApp();
      if (!militaryIdOverlay.hidden) militaryIdSheet.innerHTML = militaryIdHtml();
    },
    update: function (payload) {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!data || typeof data !== 'object') return;
      if (data.cash !== undefined) state.cash = Number(data.cash) || 0;
      if (data.bank !== undefined) state.bank = Number(data.bank) || 0;
      if (data.firstName !== undefined) state.firstName = String(data.firstName || '');
      if (data.lastName !== undefined) state.lastName = String(data.lastName || '');
      if (data.militaryTicket !== undefined) state.militaryTicket = data.militaryTicket || null;
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
      if (!militaryIdOverlay.hidden) militaryIdSheet.innerHTML = militaryIdHtml();
    },
    setNotice: showToast,
    close: function () { setPhoneOpen(false); }
  };

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      if (!militaryIdOverlay.hidden) {
        closeMilitaryId();
        return;
      }
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
