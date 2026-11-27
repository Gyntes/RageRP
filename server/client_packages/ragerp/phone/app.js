(function () {
  const shell = document.getElementById('phone-shell');
  const homeScreen = document.getElementById('home-screen');
  const appScreen = document.getElementById('app-screen');
  const appContent = document.getElementById('app-content');
  const phoneLockScreen = document.getElementById('phone-lock-screen');
  const militaryIdOverlay = document.getElementById('military-id-overlay');
  const militaryIdSheet = document.getElementById('military-id-sheet');
  const driverLicenseOverlay = document.getElementById('driver-license-overlay');
  const driverLicenseSheet = document.getElementById('driver-license-sheet');
  const prisonerFileOverlay = document.getElementById('prisoner-file-overlay');
  const prisonerFileSheet = document.getElementById('prisoner-file-sheet');
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
    criminalRecords: [],
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
  let prisonerFileExpiryTimer = null;
  let selectedPrisonerFile = null;

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
      closeDriverLicense();
      closePrisonerFile();
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
    closeDriverLicense();
    closePrisonerFile();
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

  function formatSentenceTerm(value) {
    const months = Number(value);
    if (!Number.isSafeInteger(months) || months < 1) return '—';
    function quantity(value, one, few, many) {
      const mod10 = value % 10;
      const mod100 = value % 100;
      if (mod10 === 1 && mod100 !== 11) return one;
      if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
      return many;
    }

    const years = Math.floor(months / 12);
    const remainingMonths = months % 12;
    const parts = [];
    if (years) parts.push(`${years} ${quantity(years, 'год', 'года', 'лет')}`);
    if (remainingMonths) {
      parts.push(`${remainingMonths} ${quantity(remainingMonths, 'месяц', 'месяца', 'месяцев')}`);
    }
    return parts.join(' ');
  }

  function documentsHtml() {
    const issued = Boolean(state.militaryTicket && typeof state.militaryTicket === 'object');
    const publicFiles = state.online.filter(function (person) {
      return person && validStaticId(person.staticId) && person.staticId !== state.staticId;
    }).map(function (person) {
      return `<button class="military-document-entry card prisoner-record-entry" data-action="open-prisoner-file" data-id="${escapeHtml(person.staticId)}" type="button">
        <span class="military-document-entry-icon prisoner-document-icon" aria-hidden="true">§</span>
        <span class="military-document-entry-copy">
          <strong>${escapeHtml(personName(person))}</strong>
          <small>Публичное личное дело · ID ${escapeHtml(person.staticId)}</small>
        </span>
        <span class="status-badge">Открыть</span>
      </button>`;
    }).join('');

    return `<p class="section-title">Личные документы</p>
      <button class="military-document-entry card" data-action="open-military-id" type="button">
        <span class="military-document-entry-icon" aria-hidden="true">★</span>
        <span class="military-document-entry-copy">
          <strong>Военный билет</strong>
          <small>Именной документ персонажа</small>
        </span>
        <span class="status-badge${issued ? '' : ' busy'}">${issued ? 'Выдан' : 'Не получен'}</span>
      </button>
      <button class="military-document-entry card driver-license-entry" data-action="open-driver-license" type="button">
        <span class="military-document-entry-icon driver-license-entry-icon" aria-hidden="true">▰</span>
        <span class="military-document-entry-copy">
          <strong>Водительское удостоверение</strong>
          <small>Категории A, B, C, D, M</small>
        </span>
        <span class="status-badge">Выдано</span>
      </button>
      <button class="military-document-entry card prisoner-document-entry" data-action="open-prisoner-file" type="button">
        <span class="military-document-entry-icon prisoner-document-icon" aria-hidden="true">§</span>
        <span class="military-document-entry-copy">
          <strong>Моё личное дело</strong>
          <small>Публичная карточка персонажа</small>
        </span>
        <span class="status-badge">Открыто</span>
      </button>
      <p class="section-title" style="margin-top:16px">Публичные дела жителей онлайн</p>
      <div class="prisoner-record-list">${publicFiles || '<div class="empty-state">Других жителей онлайн нет.</div>'}</div>
      <p class="muted">Нажми на документ, чтобы открыть его на весь экран.</p>`;
  }

  function prisonerFileHtml() {
    const person = selectedPrisonerFile || state;
    const nameParts = String(person.name || '').trim().split(/\s+/);
    const firstName = person.firstName || nameParts[0] || '—';
    const lastName = person.lastName || nameParts.slice(1).join(' ') || '—';
    const staticId = validStaticId(person.staticId) || '--- ---';
    const records = Array.isArray(person.criminalRecords)
      ? person.criminalRecords.filter(function (record) {
        return record && Number.isFinite(Number(record.expiresAt));
      })
      : [];
    const allRecordsExpired = records.length > 0 && records.every(function (record) {
      return Number(record.expiresAt) <= Date.now();
    });
    const status = !records.length
      ? 'Нет записей о судимостях'
      : allRecordsExpired
        ? records.length === 1 ? 'Судимость погашена' : 'Все судимости погашены'
        : 'Есть непогашенная судимость';
    const recordsHtml = records.length
      ? records.slice().reverse().map(function (record, index) {
        const convictionNumber = records.length - index;
        const reason = String(record.reason || '—');
        const issuerName = String(record.issuerName || '—');
        const issuerId = validStaticId(record.issuerStaticId);
        return `<article class="prisoner-file-record">
          <h3>Судимость № ${convictionNumber}</h3>
          <div class="prisoner-file-record-line">
            <span>Дата: <strong>${escapeHtml(formatDocumentDate(record.issuedAt))}</strong></span>
            <span>Срок: <strong>${escapeHtml(formatSentenceTerm(record.termMonths))}</strong></span>
          </div>
          <div class="prisoner-file-record-line"><span>Причина:</span><strong>${escapeHtml(reason)}</strong></div>
          <div class="prisoner-file-record-line"><span>Обвинитель:</span><strong>${escapeHtml(issuerName)}${issuerId ? ` (${escapeHtml(issuerId)})` : ''}</strong></div>
          <div class="prisoner-file-record-line"><span>Дата освобождения:</span><strong>${escapeHtml(formatDocumentDate(record.expiresAt))}</strong></div>
        </article>`;
      }).join('')
      : '<div class="prisoner-file-no-records">Сведений о приговорах пока нет</div>';
    const stamp = allRecordsExpired
      ? `<div class="prisoner-file-empty-stamp" aria-label="Судимость погашена">${records.length === 1 ? 'ПОГАШЕНА' : 'ПОГАШЕНЫ'}</div>`
      : '';

    return `<button class="prisoner-file-close" data-close-prisoner-file type="button" aria-label="Закрыть личное дело">×</button>
      <section class="prisoner-file-page prisoner-file-profile">
        <header class="prisoner-file-topline">
          <div class="prisoner-file-meta">
            <div><span>Орган:</span><strong>—</strong></div>
            <div><span>ФСИН / МВД:</span><strong>—</strong></div>
            <div><span>Место заключения:</span><strong>—</strong></div>
            <div><span>УК №:</span><strong>—</strong></div>
          </div>
          <div class="prisoner-file-portrait" aria-label="Фото персонажа не загружено">
            <svg viewBox="0 0 64 72" aria-hidden="true"><circle cx="32" cy="22" r="13"></circle><path d="M8 68c1-17 10-26 24-26s23 9 24 26z"></path></svg>
            <span>ФОТО</span>
            <i class="prisoner-file-seal" aria-hidden="true">§</i>
          </div>
        </header>
        <h1 class="prisoner-file-title">ЛИЧНОЕ ДЕЛО<small>ЗАКЛЮЧЁННОГО</small></h1>
        <div class="prisoner-file-fields">
          <div><span>Имя:</span><strong>${escapeHtml(firstName)}</strong></div>
          <div><span>Фамилия:</span><strong>${escapeHtml(lastName)}</strong></div>
          <div><span>ID:</span><strong>${escapeHtml(staticId)}</strong></div>
        </div>
        <div class="prisoner-file-status">
          <span>Статус:</span><strong>${escapeHtml(status)}</strong>
        </div>
        <footer class="prisoner-file-count">
          <span>Всего судимостей:</span><strong>${records.length}</strong>
          <div class="prisoner-file-count-track"><i style="width:${Math.min(records.length * 14, 100)}%"></i></div>
        </footer>
      </section>
      <section class="prisoner-file-page prisoner-file-records">
        <header class="prisoner-file-records-heading">
          <h2>Судимость № <span>${records.length || '—'}</span></h2>
        </header>
        <div class="prisoner-file-record-list">${recordsHtml}</div>
        ${stamp}
        <footer class="prisoner-file-footer">
          <span>${escapeHtml(status)}</span>
          <span class="prisoner-file-footer-seal" aria-hidden="true">✳</span>
        </footer>
      </section>`;
  }

  function openPrisonerFile(person) {
    selectedPrisonerFile = person || state;
    prisonerFileSheet.innerHTML = prisonerFileHtml();
    prisonerFileOverlay.hidden = false;
    shell.classList.add('is-document-covered');
    schedulePrisonerFileExpiry();
  }

  function closePrisonerFile() {
    if (prisonerFileOverlay.hidden) return;
    prisonerFileOverlay.hidden = true;
    shell.classList.remove('is-document-covered');
    selectedPrisonerFile = null;
    if (prisonerFileExpiryTimer) clearTimeout(prisonerFileExpiryTimer);
    prisonerFileExpiryTimer = null;
  }

  function schedulePrisonerFileExpiry() {
    if (prisonerFileExpiryTimer) clearTimeout(prisonerFileExpiryTimer);
    prisonerFileExpiryTimer = null;
    if (prisonerFileOverlay.hidden || !selectedPrisonerFile) return;
    const records = Array.isArray(selectedPrisonerFile.criminalRecords)
      ? selectedPrisonerFile.criminalRecords
      : [];
    const latestExpiry = records.reduce(function (latest, record) {
      const expiry = Number(record && record.expiresAt);
      return Number.isFinite(expiry) ? Math.max(latest, expiry) : latest;
    }, 0);
    const remaining = latestExpiry - Date.now();
    if (remaining <= 0) return;
    prisonerFileExpiryTimer = setTimeout(function () {
      prisonerFileExpiryTimer = null;
      refreshOpenPrisonerFile();
    }, Math.min(remaining + 25, 2147483647));
  }

  function refreshOpenPrisonerFile() {
    if (prisonerFileOverlay.hidden || !selectedPrisonerFile) return;
    const staticId = validStaticId(selectedPrisonerFile.staticId);
    const person = staticId === state.staticId
      ? state
      : state.online.find(function (entry) {
        return entry.staticId === staticId;
      });
    if (person) selectedPrisonerFile = person;
    prisonerFileSheet.innerHTML = prisonerFileHtml();
    schedulePrisonerFileExpiry();
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

  function driverLicenseHtml() {
    const nameParts = String(state.name || '').trim().split(/\s+/);
    const firstName = state.firstName || nameParts[0] || '—';
    const lastName = state.lastName || nameParts.slice(1).join(' ') || '—';
    const staticId = validStaticId(state.staticId) || '--- ---';

    return `<button class="driver-license-close" data-close-driver-license type="button" aria-label="Закрыть водительское удостоверение">×</button>
      <article class="driver-license-card">
        <header class="driver-license-header">
          <span class="driver-license-region-mark">TUL</span>
          <h1>ВОДИТЕЛЬСКОЕ УДОСТОВЕРЕНИЕ</h1>
        </header>
        <div class="driver-license-content">
          <div class="driver-license-left">
            <div class="driver-license-photo" aria-label="Фото персонажа не загружено">
              <svg viewBox="0 0 100 130" aria-hidden="true"><circle cx="50" cy="38" r="23"></circle><path d="M10 128c2-35 16-53 40-53s38 18 40 53z"></path></svg>
            </div>
            <div class="driver-license-signature">
              <span>6.</span>
              <svg viewBox="0 0 180 56" aria-label="Подпись владельца">
                <path d="M6 42c17-17 20-34 25-32 8 3-13 30-7 32 7 3 19-28 25-25 5 2-8 22-1 24 7 2 17-28 24-28 9 0-5 24 4 25 8 1 11-11 20-14 11-4 18 0 28-8 12-10 15-12 25-10-12 6-14 14-7 16 7 2 20-12 30-17" />
                <path d="M36 50c28-6 69-1 120-18" />
              </svg>
            </div>
          </div>
          <div class="driver-license-fields">
            <div class="driver-license-field"><b>1.</b><strong>${escapeHtml(firstName)}</strong><small>Имя</small></div>
            <div class="driver-license-field"><b>2.</b><strong>${escapeHtml(lastName)}</strong><small>Фамилия</small></div>
            <div class="driver-license-field driver-license-city"><b>3.</b><strong>г. Тула и ТО</strong></div>
            <div class="driver-license-date-row">
              <div><b>4а)</b><strong>04.11.2026</strong></div>
              <div><b>4b)</b><strong>04.02.2027</strong></div>
            </div>
            <div class="driver-license-field driver-license-issued-by">
              <b>4c)</b>
              <strong>Кирилл Матвеев (379-079)</strong>
              <small>Кем выдано</small>
            </div>
            <div class="driver-license-field driver-license-static-id"><b>5.</b><strong>${escapeHtml(staticId)}</strong><small>ID</small></div>
            <div class="driver-license-field driver-license-city"><b>8.</b><strong>г. Тула и ТО</strong></div>
            <div class="driver-license-categories"><b>9.</b>${['A', 'B', 'C', 'D', 'M'].map(function (category) {
              return `<span>${category}</span>`;
            }).join('')}</div>
          </div>
        </div>
      </article>`;
  }

  function openDriverLicense() {
    driverLicenseSheet.innerHTML = driverLicenseHtml();
    driverLicenseOverlay.hidden = false;
    shell.classList.add('is-document-covered');
  }

  function closeDriverLicense() {
    if (driverLicenseOverlay.hidden) return;
    driverLicenseOverlay.hidden = true;
    shell.classList.remove('is-document-covered');
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
  driverLicenseOverlay.addEventListener('click', function (event) {
    if (event.target === driverLicenseOverlay || event.target.closest('[data-close-driver-license]')) {
      closeDriverLicense();
    }
  });
  prisonerFileOverlay.addEventListener('click', function (event) {
    if (event.target === prisonerFileOverlay || event.target.closest('[data-close-prisoner-file]')) {
      closePrisonerFile();
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

    if (action === 'open-driver-license') {
      openDriverLicense();
      return;
    }

    if (action === 'open-prisoner-file') {
      const staticId = validStaticId(button.dataset.id) || state.staticId;
      const person = staticId === state.staticId
        ? state
        : state.online.find(function (entry) {
          return entry.staticId === staticId;
        });
      if (!person) {
        showToast('Этот житель больше не в сети.');
        return;
      }
      openPrisonerFile(person);
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
      state.criminalRecords = Array.isArray(data.criminalRecords) ? data.criminalRecords : [];
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
      if (!driverLicenseOverlay.hidden) driverLicenseSheet.innerHTML = driverLicenseHtml();
      refreshOpenPrisonerFile();
    },
    update: function (payload) {
      const data = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!data || typeof data !== 'object') return;
      if (data.cash !== undefined) state.cash = Number(data.cash) || 0;
      if (data.bank !== undefined) state.bank = Number(data.bank) || 0;
      if (data.firstName !== undefined) state.firstName = String(data.firstName || '');
      if (data.lastName !== undefined) state.lastName = String(data.lastName || '');
      if (Array.isArray(data.criminalRecords)) state.criminalRecords = data.criminalRecords;
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
      if (!driverLicenseOverlay.hidden) driverLicenseSheet.innerHTML = driverLicenseHtml();
      refreshOpenPrisonerFile();
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
      if (!driverLicenseOverlay.hidden) {
        closeDriverLicense();
        return;
      }
      if (!prisonerFileOverlay.hidden) {
        closePrisonerFile();
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
