(function () {
  const shell = document.getElementById('phone-shell');
  const homeScreen = document.getElementById('home-screen');
  const homeAppsViewport = document.getElementById('home-apps-viewport');
  const homeAppsRail = document.getElementById('home-apps-rail');
  const homePages = Array.from(document.querySelectorAll('[data-app-page]'));
  const homePageIndicator = document.getElementById('home-page-indicator');
  const homeDock = document.getElementById('home-dock');
  const appScreen = document.getElementById('app-screen');
  const bottomNav = document.getElementById('bottom-nav');
  const quickActionsOverlay = document.getElementById('quick-actions-overlay');
  const appContent = document.getElementById('app-content');
  const phoneLockScreen = document.getElementById('phone-lock-screen');
  const militaryIdOverlay = document.getElementById('military-id-overlay');
  const militaryIdSheet = document.getElementById('military-id-sheet');
  const driverLicenseOverlay = document.getElementById('driver-license-overlay');
  const driverLicenseSheet = document.getElementById('driver-license-sheet');
  const medicalBookOverlay = document.getElementById('medical-book-overlay');
  const medicalBookSheet = document.getElementById('medical-book-sheet');
  const policeIdOverlay = document.getElementById('police-id-overlay');
  const policeIdSheet = document.getElementById('police-id-sheet');
  const officialDocumentOverlay = document.getElementById('official-document-overlay');
  const officialDocumentSheet = document.getElementById('official-document-sheet');
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
  let selectedOfficialDocument = '';
  let activeHomePage = 0;
  let homeSwipeStartX = null;
  let suppressHomeClick = false;

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
      closeMedicalBook();
      closePoliceId();
      closeOfficialDocument();
      closePrisonerFile();
      closeQuickActions();
      appScreen.classList.remove('is-bank-app');
      shell.classList.remove('is-bank-app');
      state.activeApp = null;
      state.navigationStack = [];
      bottomNav.hidden = true;
      setHomePage(0);
      phoneLockScreen.hidden = true;
      if (typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
        mp.trigger('ragerp:phone:close-request');
      }
      return;
    }
    phoneLockScreen.hidden = true;
    homeScreen.hidden = false;
    appScreen.hidden = true;
    bottomNav.hidden = true;
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
    bottomNav.hidden = true;
  }

  function showApp(app) {
    state.activeApp = app;
    homeScreen.hidden = true;
    appScreen.hidden = false;
    bottomNav.hidden = false;
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
    closeMedicalBook();
    closePoliceId();
    closeOfficialDocument();
    closePrisonerFile();
    closeQuickActions();
    phoneLockScreen.hidden = false;
  }

  function setHomePage(pageIndex) {
    const nextPage = Math.max(0, Math.min(homePages.length - 1, Number(pageIndex) || 0));
    const focusedPage = document.activeElement.closest('[data-app-page]');
    activeHomePage = nextPage;
    homeAppsRail.style.transform = `translateX(-${nextPage * 50}%)`;
    homePages.forEach(function (page, index) {
      const active = index === nextPage;
      page.classList.toggle('is-active', active);
      page.setAttribute('aria-hidden', String(!active));
      page.querySelectorAll('button').forEach(function (button) {
        button.tabIndex = active ? 0 : -1;
      });
    });
    homePageIndicator.querySelectorAll('[data-home-page]').forEach(function (dot, index) {
      const active = index === nextPage;
      dot.classList.toggle('is-active', active);
      if (active) dot.setAttribute('aria-current', 'page');
      else dot.removeAttribute('aria-current');
    });
    if (focusedPage && Number(focusedPage.dataset.appPage) !== nextPage) {
      const activeDot = homePageIndicator.querySelector(`[data-home-page="${nextPage}"]`);
      if (activeDot) activeDot.focus();
    }
  }

  function openQuickActions() {
    quickActionsOverlay.hidden = false;
  }

  function closeQuickActions() {
    if (quickActionsOverlay.hidden) return;
    quickActionsOverlay.hidden = true;
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
        <div class="contact-actions">
          ${online ? `<button class="button small" data-action="phone-call" data-id="${escapeHtml(contact.id)}" type="button">Звонок</button>` : ''}
          <button class="button small" data-action="open-chat" data-id="${escapeHtml(contact.id)}" type="button">SMS</button>
        </div>
      </article>`;
    }).join('');
    const onlineHtml = people.map(function (person) {
      return `<article class="card contact-card">
        <div class="avatar">${escapeHtml(person.name.slice(0, 1).toUpperCase())}</div>
        <div class="contact-copy"><div class="card-title">${escapeHtml(personName(person))}</div>
          <div class="card-subtitle">ID ${escapeHtml(person.staticId)}</div></div>
        <div class="contact-actions">
          <button class="button small" data-action="phone-call" data-id="${escapeHtml(person.staticId)}" type="button">Звонок</button>
          <button class="button small" data-action="add-contact" data-id="${escapeHtml(person.staticId)}" data-name="${escapeHtml(personName(person))}" type="button">Добавить</button>
        </div>
      </article>`;
    }).join('');

    return `<p class="section-title">Сохранённые</p>
      <div class="contact-list">${saved || '<div class="empty-state">Контактов пока нет. Добавь игрока из списка ниже.</div>'}</div>
      <p class="section-title" style="margin-top:16px">Игроки онлайн</p>
      <div class="contact-list">${onlineHtml || '<div class="empty-state">Сейчас нет других игроков в сети.</div>'}</div>
      <div class="call-note">Позвони игроку из списка. Удерживай Z для передачи голоса; звонок работает на любом расстоянии.</div>`;
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

  function documentIconSvg(kind) {
    const icons = {
      record: '<path d="M5 3.8h14v16.4H5z"/><circle cx="10" cy="9" r="2"/><path d="M7.2 15c.7-1.6 1.6-2.4 2.8-2.4s2.1.8 2.8 2.4M15 8h2M15 11h2M14.8 15H17"/>',
      military: '<circle cx="12" cy="12" r="9"/><path d="m12 6.5 1.7 3.6 3.9.5-2.8 2.7.7 3.9-3.5-1.9-3.5 1.9.7-3.9-2.8-2.7 3.9-.5z"/>',
      driver: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M6.5 16c.5-1.7 1.3-2.5 2.5-2.5s2 .8 2.5 2.5M14 9h4M14 12h4M14 15h4"/>',
      medical: '<path d="M6 3.5h8l4 4v13H6zM14 3.8v4h4"/><path d="M12 10v7M8.5 13.5h7"/>',
      police: '<path d="m12 3 7 3v5.2c0 4.3-2.7 7.5-7 9.8-4.3-2.3-7-5.5-7-9.8V6z"/><circle cx="12" cy="11.5" r="2.4"/><path d="M12 8v-2M12 17v-2M8.5 11.5h-2M17.5 11.5h-2"/>',
      fsin: '<path d="M5 4h14v16H5zM8 8h8M8 11h8M8 14h5"/><path d="m15 17 1.5 1.5L19 16"/>',
      fsb: '<path d="m12 3 7 3v5.2c0 4.3-2.7 7.5-7 9.8-4.3-2.3-7-5.5-7-9.8V6z"/><path d="M9 10h6M9 13h6M12 7v9"/>',
      health: '<path d="M20 8.5c0 4.2-8 10-8 10s-8-5.8-8-10a4 4 0 0 1 7.2-2.4A4 4 0 0 1 20 8.5Z"/><path d="M8.5 11.5h2l1-2.5 1.5 5 1-2.5h1.5"/>',
      government: '<path d="m3 9 9-5 9 5zM5 19h14M4 21h16M6.5 10v8M10.2 10v8M13.8 10v8M17.5 10v8"/>',
      weapon: '<rect x="4" y="3.5" width="16" height="17" rx="1.5"/><path d="M8 8h8M8 11h8M8 14h3M13 16l1.5 1.5L18 14"/>',
      registration: '<path d="M5 3.5h14v17H5z"/><path d="M8 7h8M8 10h8M8 13h5"/><path d="m15 15 2 2-2 2M17 17h-4"/>'
    };
    return `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[kind] || icons.record}</svg>`;
  }

  function documentsHtml() {
    const issued = Boolean(state.militaryTicket && typeof state.militaryTicket === 'object');
    const publicFiles = state.online.filter(function (person) {
      return person && validStaticId(person.staticId) && person.staticId !== state.staticId;
    }).map(function (person) {
      return `<button class="military-document-entry card prisoner-record-entry" data-action="open-prisoner-file" data-id="${escapeHtml(person.staticId)}" type="button">
        <span class="military-document-entry-icon prisoner-document-icon">${documentIconSvg('record')}</span>
        <span class="military-document-entry-copy">
          <strong>${escapeHtml(personName(person))}</strong>
          <small>Публичное личное дело · ID ${escapeHtml(person.staticId)}</small>
        </span>
        <span class="status-badge">Открыть</span>
      </button>`;
    }).join('');

    return `<p class="section-title">Личные документы</p>
      <button class="military-document-entry card" data-action="open-military-id" type="button">
        <span class="military-document-entry-icon military-ticket-icon">${documentIconSvg('military')}</span>
        <span class="military-document-entry-copy">
          <strong>Военный билет</strong>
          <small>Именной документ персонажа</small>
        </span>
        <span class="status-badge${issued ? '' : ' busy'}">${issued ? 'Выдан' : 'Не получен'}</span>
      </button>
      <button class="military-document-entry card driver-license-entry" data-action="open-driver-license" type="button">
        <span class="military-document-entry-icon driver-license-entry-icon">${documentIconSvg('driver')}</span>
        <span class="military-document-entry-copy">
          <strong>Водительское удостоверение</strong>
          <small>Категории A, B, C, D, M</small>
        </span>
        <span class="status-badge">Выдано</span>
      </button>
      <button class="military-document-entry card medical-book-entry" data-action="open-medical-book" type="button">
        <span class="military-document-entry-icon medical-book-entry-icon">${documentIconSvg('medical')}</span>
        <span class="military-document-entry-copy">
          <strong>Медицинская книжка</strong>
          <small>Личный документ · осмотр пройден</small>
        </span>
        <span class="status-badge">Действительна</span>
      </button>
      <button class="military-document-entry card police-id-entry" data-action="open-police-id" type="button">
        <span class="military-document-entry-icon police-id-entry-icon">${documentIconSvg('police')}</span>
        <span class="military-document-entry-copy">
          <strong>Служебное удостоверение МВД</strong>
          <small>Старший сержант полиции</small>
        </span>
        <span class="status-badge">Выдано</span>
      </button>
      <button class="military-document-entry card official-document-entry official-document-fsin-entry" data-action="open-official-document" data-document="fsin" type="button">
        <span class="military-document-entry-icon">${documentIconSvg('fsin')}</span>
        <span class="military-document-entry-copy">
          <strong>Удостоверение ФСИН</strong>
          <small>Старший прапорщик внутренней службы</small>
        </span>
        <span class="status-badge">Выдано</span>
      </button>
      <button class="military-document-entry card official-document-entry official-document-fsb-entry" data-action="open-official-document" data-document="fsb" type="button">
        <span class="military-document-entry-icon">${documentIconSvg('fsb')}</span>
        <span class="military-document-entry-copy">
          <strong>Удостоверение ФСБ</strong>
          <small>Старшина</small>
        </span>
        <span class="status-badge">Выдано</span>
      </button>
      <button class="military-document-entry card official-document-entry official-document-health-entry" data-action="open-official-document" data-document="health" type="button">
        <span class="military-document-entry-icon">${documentIconSvg('health')}</span>
        <span class="military-document-entry-copy">
          <strong>Удостоверение медработника</strong>
          <small>Фельдшер · Городская больница № 3</small>
        </span>
        <span class="status-badge">Выдано</span>
      </button>
      <button class="military-document-entry card official-document-entry official-document-government-entry" data-action="open-official-document" data-document="government" type="button">
        <span class="military-document-entry-icon">${documentIconSvg('government')}</span>
        <span class="military-document-entry-copy">
          <strong>Удостоверение правительства</strong>
          <small>Заместитель председателя правительства</small>
        </span>
        <span class="status-badge">Выдано</span>
      </button>
      <button class="military-document-entry card official-document-entry official-document-weapon-entry" data-action="open-official-document" data-document="weapon" type="button">
        <span class="military-document-entry-icon">${documentIconSvg('weapon')}</span>
        <span class="military-document-entry-copy">
          <strong>Разрешение на оружие</strong>
          <small>Хранение и ношение · Тульская область</small>
        </span>
        <span class="status-badge">Действует</span>
      </button>
      <button class="military-document-entry card official-document-entry official-document-registration-entry" data-action="open-official-document" data-document="registration" type="button">
        <span class="military-document-entry-icon">${documentIconSvg('registration')}</span>
        <span class="military-document-entry-copy">
          <strong>Регистрация по месту пребывания</strong>
          <small>Город Тула · данные персонажа</small>
        </span>
        <span class="status-badge">Действует</span>
      </button>
      <button class="military-document-entry card prisoner-document-entry" data-action="open-prisoner-file" type="button">
        <span class="military-document-entry-icon prisoner-document-icon">${documentIconSvg('record')}</span>
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

  function medicalBookHtml() {
    const nameParts = String(state.name || '').trim().split(/\s+/);
    const firstName = state.firstName || nameParts[0] || '—';
    const lastName = state.lastName || nameParts.slice(1).join(' ') || '—';
    const staticId = validStaticId(state.staticId) || '--- ---';

    return `<button class="medical-book-close" data-close-medical-book type="button" aria-label="Закрыть медицинскую книжку">×</button>
      <div class="medical-book-spread">
        <section class="medical-book-page medical-book-page-owner">
          <h1>ЛИЧНАЯ МЕДИЦИНСКАЯ<br>КНИЖКА</h1>
          <p class="medical-book-caption">Сведения о владельце медицинской книжки:</p>
          <div class="medical-book-owner-fields">
            <div><span>Имя:</span><strong>${escapeHtml(firstName)}</strong></div>
            <div><span>Фамилия:</span><strong>${escapeHtml(lastName)}</strong></div>
            <div><span>ID:</span><strong>${escapeHtml(staticId)}</strong></div>
          </div>
          <section class="medical-book-examination">
            <div class="medical-book-oms"><span aria-hidden="true">✚</span>ОМС по г. Туле и ТО</div>
            <div class="medical-book-exam-field"><span>Врач:</span><strong>Лина</strong></div>
            <div class="medical-book-exam-field"><span></span><strong>Килис (887-282)</strong></div>
            <div class="medical-book-exam-field"><span>Дата выдачи:</span><strong>04.11.2026</strong></div>
            <div class="medical-book-exam-field"><span>Действительна до:</span><strong>04.12.2026</strong></div>
            <strong class="medical-book-status">ОСМОТР ПРОЙДЕН</strong>
          </section>
        </section>
        <section class="medical-book-page medical-book-page-details">
          <div class="medical-book-code" aria-label="Код и номер медицинской книжки">
            <svg class="medical-book-qr" viewBox="0 0 21 21" role="img" aria-label="Декоративный QR-код">
              <rect width="21" height="21" fill="#fff"></rect>
              <path fill="#17212b" d="M1 1h7v7H1zM13 1h7v7h-7zM1 13h7v7H1zM9 1h1v2H9zM11 3h1v2h-1zM9 5h2v1H9zM8 8h2v2H8zM11 8h1v2h-1zM13 9h2v2h-2zM17 9h1v2h-1zM9 12h2v2H9zM12 12h1v2h-1zM14 12h2v1h-2zM18 12h2v2h-2zM9 15h1v2H9zM11 15h2v1h-2zM14 15h1v2h-1zM16 15h2v1h-2zM10 18h2v2h-2zM13 18h2v1h-2zM17 17h1v3h-1z"></path>
              <path fill="#fff" d="M2 2h5v5H2zM14 2h5v5h-5zM2 14h5v5H2z"></path>
              <path fill="#17212b" d="M3 3h3v3H3zM15 3h3v3h-3zM3 15h3v3H3z"></path>
            </svg>
            <svg class="medical-book-barcode" viewBox="0 0 38 72" aria-hidden="true">
              <rect width="38" height="72" fill="#fff"></rect>
              <path fill="#17212b" d="M3 3h2v49H3zM7 3h1v49H7zM10 3h3v49h-3zM15 3h1v49h-1zM18 3h2v49h-2zM22 3h1v49h-1zM25 3h3v49h-3zM30 3h1v49h-1zM33 3h2v49h-2zM3 56h32v1H3zM5 59h28v1H5zM3 62h32v1H3zM7 65h24v1H7z"></path>
            </svg>
            <strong class="medical-book-serial">№ 4696147</strong>
          </div>
          <div class="medical-book-seal" aria-label="Печать медицинского надзора">
            <span>МЕДИЦИНСКИЙ НАДЗОР</span>
            <strong>✓</strong>
          </div>
          <p class="medical-book-agency">Служба надзора за здоровьем<br>и благополучием человека</p>
        </section>
      </div>`;
  }

  function openMedicalBook() {
    medicalBookSheet.innerHTML = medicalBookHtml();
    medicalBookOverlay.hidden = false;
    shell.classList.add('is-document-covered');
  }

  function closeMedicalBook() {
    if (medicalBookOverlay.hidden) return;
    medicalBookOverlay.hidden = true;
    shell.classList.remove('is-document-covered');
  }

  function policeIdHtml() {
    const nameParts = String(state.name || '').trim().split(/\s+/);
    const firstName = state.firstName || nameParts[0] || '';
    const lastName = state.lastName || nameParts.slice(1).join(' ');
    const fullName = String([firstName, lastName].filter(Boolean).join(' ') || state.name || '—')
      .toLocaleUpperCase('ru-RU');
    const staticId = validStaticId(state.staticId);
    const personalNumber = `МВД-${staticId || '—'}`;

    return `<button class="police-id-close" data-close-police-id type="button" aria-label="Закрыть служебное удостоверение">×</button>
      <div class="police-id-spread">
        <section class="police-id-page police-id-front">
          <div class="police-id-photo" aria-label="Фото персонажа не загружено">
            <svg viewBox="0 0 100 120" aria-hidden="true"><circle cx="50" cy="33" r="20"></circle><path d="M11 118c2-34 15-52 39-52s37 18 39 52z"></path></svg>
            <span>ФОТО</span>
          </div>
          <div class="police-id-emblem" aria-hidden="true">
            <svg viewBox="0 0 100 64"><path d="M50 6 57 23 76 16 69 31 94 32 72 41 80 54 57 47 50 61 43 47 20 54 28 41 6 32 31 31 24 16 43 23z"></path><circle cx="50" cy="34" r="11"></circle></svg>
          </div>
          <div class="police-id-front-title">
            <h2>МВД РОССИИ</h2>
            <span>Личный №:</span>
            <strong>${escapeHtml(personalNumber)}</strong>
          </div>
          <div class="police-id-issued"><span>Выдано:</span><strong>${formatDocumentDate(Date.now())}</strong></div>
        </section>
        <section class="police-id-page police-id-back">
          <header>ГЛАВНОЕ УПРАВЛЕНИЕ МВД РОССИИ<br>ПО ГОРОДУ ТУЛЕ И ТУЛЬСКОЙ ОБЛАСТИ</header>
          <p>УПРАВЛЕНИЕ ВНУТРЕННИХ ДЕЛ ПО Г. ТУЛЕ</p>
          <div class="police-id-document-number">СЛУЖЕБНОЕ УДОСТОВЕРЕНИЕ № ${escapeHtml(personalNumber)}</div>
          <span class="police-id-rank">Старший сержант полиции</span>
          <strong class="police-id-name">${escapeHtml(fullName)}</strong>
          <div class="police-id-position"><span>Должность:</span><strong>Старший сержант полиции</strong></div>
          <small class="police-id-note">Удостоверение действительно при предъявлении<br>документа, удостоверяющего личность</small>
          <svg class="police-id-barcode" viewBox="0 0 34 86" aria-hidden="true">
            <path d="M2 2h2v68H2zM6 2h1v68H6zM9 2h3v68H9zM14 2h1v68h-1zM17 2h2v68h-2zM21 2h1v68h-1zM24 2h3v68h-3zM29 2h1v68h-1zM32 2h1v68h-1z"></path>
          </svg>
          <div class="police-id-seal" aria-label="Печать МВД России">
            <span>МВД РОССИИ</span>
            <strong>★</strong>
            <small>ТУЛА</small>
          </div>
        </section>
      </div>`;
  }

  function openPoliceId() {
    policeIdSheet.innerHTML = policeIdHtml();
    policeIdOverlay.hidden = false;
    shell.classList.add('is-document-covered');
  }

  function closePoliceId() {
    if (policeIdOverlay.hidden) return;
    policeIdOverlay.hidden = true;
    shell.classList.remove('is-document-covered');
  }

  function documentDateOffset(months) {
    const date = new Date();
    const day = date.getDate();
    date.setDate(1);
    date.setMonth(date.getMonth() + months);
    const lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    date.setDate(Math.min(day, lastDay));
    return formatDocumentDate(date.getTime());
  }

  function officialDocumentHtml(kind) {
    const firstName = state.firstName || String(state.name || '').trim().split(/\s+/)[0] || '—';
    const lastName = state.lastName || String(state.name || '').trim().split(/\s+/).slice(1).join(' ') || '—';
    const fullName = `${firstName} ${lastName}`.trim().toLocaleUpperCase('ru-RU');
    const staticId = validStaticId(state.staticId) || '--- ---';
    const issued = formatDocumentDate(Date.now());
    const expiry = documentDateOffset(kind === 'weapon' ? 3 : 12);
    const details = {
      fsin: {
        agency: 'ФЕДЕРАЛЬНАЯ СЛУЖБА ИСПОЛНЕНИЯ НАКАЗАНИЙ',
        office: 'УФСИН России по Тульской области',
        title: 'УДОСТОВЕРЕНИЕ ФСИН',
        rank: 'Старший прапорщик внутренней службы',
        theme: 'fsin'
      },
      fsb: {
        agency: 'ФЕДЕРАЛЬНАЯ СЛУЖБА БЕЗОПАСНОСТИ РОССИЙСКОЙ ФЕДЕРАЦИИ',
        office: 'УФСБ России по Тульской области',
        title: 'УДОСТОВЕРЕНИЕ ФСБ',
        rank: 'Старшина',
        theme: 'fsb'
      },
      health: {
        agency: 'ДЕПАРТАМЕНТ ЗДРАВООХРАНЕНИЯ ТУЛЬСКОЙ ОБЛАСТИ',
        office: 'Городская больница № 3',
        title: 'УДОСТОВЕРЕНИЕ МЕДРАБОТНИКА',
        rank: 'Фельдшер',
        theme: 'health'
      },
      government: {
        agency: 'ПРАВИТЕЛЬСТВО ТУЛЬСКОЙ ОБЛАСТИ',
        office: 'Аппарат правительства Тульской области',
        title: 'СЛУЖЕБНОЕ УДОСТОВЕРЕНИЕ',
        rank: 'Заместитель председателя правительства',
        theme: 'government'
      }
    }[kind];

    if (kind === 'weapon') {
      return `<button class="official-document-close" data-close-official-document type="button" aria-label="Закрыть разрешение на оружие">×</button>
        <article class="official-document-sheet official-document-weapon">
          <section class="weapon-permit-page">
            <header>РАЗРЕШЕНИЕ НА ХРАНЕНИЕ<br>И НОШЕНИЕ ОГНЕСТРЕЛЬНОГО ОРУЖИЯ</header>
            <div class="weapon-permit-fields">
              <div><span>Имя:</span><strong>${escapeHtml(firstName)}</strong></div>
              <div><span>Фамилия:</span><strong>${escapeHtml(lastName)}</strong></div>
              <div><span>ID:</span><strong>${escapeHtml(staticId)}</strong></div>
            </div>
            <div class="weapon-permit-seal" aria-hidden="true">★<small>М.П.</small></div>
            <p>Разрешение действительно для хранения и ношения по месту регистрации владельца.</p>
          </section>
          <section class="weapon-permit-page weapon-permit-issued">
            <header>ОРГАН ВЫДАЧИ ЛИЦЕНЗИИ</header>
            <div><span>Выдана:</span><strong>${issued}</strong></div>
            <div><span>Действительна до:</span><strong>${expiry}</strong></div>
            <div><span>Орган выдачи:</span><strong>Управление Росгвардии по Тульской области</strong></div>
            <div class="weapon-permit-signature">Подпись <strong>Лицензионно-разрешительный отдел</strong></div>
            <div class="weapon-permit-stamp" aria-hidden="true">РОСГВАРДИЯ<br>ТУЛА</div>
          </section>
        </article>`;
    }

    if (kind === 'registration') {
      return `<button class="official-document-close" data-close-official-document type="button" aria-label="Закрыть карточку регистрации">×</button>
        <article class="official-document-sheet official-document-residency">
          <header class="residency-heading">РОССИЙСКАЯ ФЕДЕРАЦИЯ</header>
          <div class="residency-issued"><span>Кем выдано:</span><strong>ОВД города Тулы</strong></div>
          <div class="residency-dates">
            <div><span>Дата выдачи:</span><strong>${issued}</strong></div>
            <div><span>Срок действия:</span><strong>${expiry}</strong></div>
            <div><span>Место пребывания:</span><strong>г. Тула и Тульская область</strong></div>
          </div>
          <div class="residency-seal" aria-hidden="true">★<small>МВД · ТУЛА</small></div>
          <div class="residency-profile">
            <div class="official-document-portrait"><svg viewBox="0 0 100 120" aria-hidden="true"><circle cx="50" cy="33" r="20"></circle><path d="M11 118c2-34 15-52 39-52s37 18 39 52z"></path></svg></div>
            <div><div><span>Имя</span><strong>${escapeHtml(firstName)}</strong></div>
              <div><span>Фамилия</span><strong>${escapeHtml(lastName)}</strong></div>
              <div><span>ID</span><strong>${escapeHtml(staticId)}</strong></div>
            </div>
          </div>
          <footer>RMRP · КАРТОЧКА ПЕРСОНАЖА</footer>
        </article>`;
    }

    if (!details) return '';
    const numberPrefix = kind === 'fsin' ? 'ФСИН' : kind === 'fsb' ? 'ФСБ' : kind === 'health' ? 'МЗ' : 'ПРАВ';
    const expiryMarkup = kind === 'health'
      ? `<div class="official-document-valid"><span>Срок действия:</span><strong>${expiry}</strong></div>`
      : '';
    return `<button class="official-document-close" data-close-official-document type="button" aria-label="Закрыть ${escapeHtml(details.title.toLocaleLowerCase('ru-RU'))}">×</button>
      <article class="official-document-sheet official-document-service official-document-${details.theme}">
        <div class="official-document-service-spread">
          <section class="official-document-service-page official-document-service-front">
            <div class="official-document-portrait"><svg viewBox="0 0 100 120" aria-hidden="true"><circle cx="50" cy="33" r="20"></circle><path d="M11 118c2-34 15-52 39-52s37 18 39 52z"></path></svg><span>ФОТО</span></div>
            <div class="official-document-emblem" aria-hidden="true">★</div>
            <div class="official-document-brand"><strong>${escapeHtml(details.title.replace('УДОСТОВЕРЕНИЕ ', ''))}</strong><span>Личный №:</span><b>${numberPrefix}-${escapeHtml(staticId)}</b></div>
            <div class="official-document-issued"><span>Выдано:</span><strong>${issued}</strong></div>
          </section>
          <section class="official-document-service-page official-document-service-back">
            <header>${escapeHtml(details.agency)}<br>${escapeHtml(details.office)}</header>
            <div class="official-document-number">${escapeHtml(details.title)} № ${numberPrefix}-${escapeHtml(staticId)}</div>
            <strong class="official-document-rank">${escapeHtml(details.rank)}</strong>
            <strong class="official-document-name">${escapeHtml(fullName)}</strong>
            <div class="official-document-position"><span>Должность:</span><strong>${escapeHtml(details.rank)}</strong></div>
            ${expiryMarkup}
            <small>Удостоверение предъявляется вместе с документом, удостоверяющим личность.</small>
            <span class="official-document-barcode" aria-hidden="true"></span>
            <div class="official-document-stamp" aria-hidden="true">★<small>${escapeHtml(details.theme === 'health' ? 'ТУЛА' : numberPrefix)}</small></div>
          </section>
        </div>
      </article>`;
  }

  function openOfficialDocument(kind) {
    const content = officialDocumentHtml(kind);
    if (!content) return;
    selectedOfficialDocument = kind;
    officialDocumentSheet.dataset.document = kind;
    officialDocumentSheet.innerHTML = content;
    officialDocumentOverlay.hidden = false;
    shell.classList.add('is-document-covered');
  }

  function closeOfficialDocument() {
    if (officialDocumentOverlay.hidden) return;
    officialDocumentOverlay.hidden = true;
    delete officialDocumentSheet.dataset.document;
    selectedOfficialDocument = '';
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
      <div class="call-note">Голос рядом работает в радиусе 15 м. Звонки через контакты соединяют игроков на любом расстоянии.</div>`;
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

  homePageIndicator.addEventListener('click', function (event) {
    const dot = event.target.closest('[data-home-page]');
    if (dot) setHomePage(dot.dataset.homePage);
  });
  homeAppsViewport.addEventListener('pointerdown', function (event) {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    homeSwipeStartX = event.clientX;
  });
  homeAppsViewport.addEventListener('pointerup', function (event) {
    if (homeSwipeStartX === null) return;
    const distance = event.clientX - homeSwipeStartX;
    homeSwipeStartX = null;
    if (Math.abs(distance) < 42) return;
    event.preventDefault();
    suppressHomeClick = true;
    setHomePage(activeHomePage + (distance < 0 ? 1 : -1));
    window.setTimeout(function () { suppressHomeClick = false; }, 0);
  });
  homeAppsViewport.addEventListener('pointercancel', function () {
    homeSwipeStartX = null;
  });
  homeAppsViewport.addEventListener('click', function (event) {
    if (!suppressHomeClick) return;
    event.preventDefault();
    event.stopPropagation();
    suppressHomeClick = false;
  }, true);
  homeDock.addEventListener('click', function (event) {
    const button = event.target.closest('[data-home-action]');
    if (!button) return;
    if (button.dataset.homeAction === 'quick') {
      openQuickActions();
    } else if (button.dataset.homeAction === 'vehicle') {
      sendAction('starter-vehicle', {});
    } else if (button.dataset.homeAction === 'lock') {
      lockPhone();
    }
  });
  quickActionsOverlay.addEventListener('click', function (event) {
    if (event.target === quickActionsOverlay || event.target.closest('[data-close-quick-actions]')) {
      closeQuickActions();
      return;
    }
    const appButton = event.target.closest('[data-quick-app]');
    if (appButton) {
      closeQuickActions();
      openApp(appButton.dataset.quickApp);
      return;
    }
    const actionButton = event.target.closest('[data-quick-action]');
    if (actionButton && actionButton.dataset.quickAction === 'vehicle') {
      closeQuickActions();
      sendAction('starter-vehicle', {});
    }
  });

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
  medicalBookOverlay.addEventListener('click', function (event) {
    if (event.target === medicalBookOverlay || event.target.closest('[data-close-medical-book]')) {
      closeMedicalBook();
    }
  });
  policeIdOverlay.addEventListener('click', function (event) {
    if (event.target === policeIdOverlay || event.target.closest('[data-close-police-id]')) {
      closePoliceId();
    }
  });
  officialDocumentOverlay.addEventListener('click', function (event) {
    if (event.target === officialDocumentOverlay || event.target.closest('[data-close-official-document]')) {
      closeOfficialDocument();
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

    if (action === 'open-medical-book') {
      openMedicalBook();
      return;
    }

    if (action === 'open-police-id') {
      openPoliceId();
      return;
    }

    if (action === 'open-official-document') {
      openOfficialDocument(button.dataset.document);
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

    if (action === 'phone-call') {
      const targetId = validStaticId(button.dataset.id);
      if (!targetId || targetId === state.staticId) return;
      sendAction('phone-call', { targetId: targetId });
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
    setPreferences: function (preferences) {
      if (!preferences || typeof preferences !== 'object') return;
      const scale = Number(preferences.scale);
      const right = Number(preferences.right);
      const bottom = Number(preferences.bottom);
      if (Number.isFinite(scale)) {
        const scaledValue = .72 * Math.max(75, Math.min(130, scale)) / 100;
        shell.style.setProperty('--phone-scale', String(scaledValue));
        shell.style.setProperty('--phone-enter-scale', String(scaledValue * .95));
      }
      if (Number.isFinite(right)) {
        shell.style.setProperty('--phone-offset-right', `${Math.max(0, Math.min(15, right))}vw`);
      }
      if (Number.isFinite(bottom)) {
        shell.style.setProperty('--phone-offset-bottom', `${Math.max(0, Math.min(15, bottom))}vh`);
      }
    },
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
      if (!medicalBookOverlay.hidden) medicalBookSheet.innerHTML = medicalBookHtml();
      if (!policeIdOverlay.hidden) policeIdSheet.innerHTML = policeIdHtml();
      if (selectedOfficialDocument) {
        officialDocumentSheet.innerHTML = officialDocumentHtml(selectedOfficialDocument);
      }
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
      if (!medicalBookOverlay.hidden) medicalBookSheet.innerHTML = medicalBookHtml();
      if (!policeIdOverlay.hidden) policeIdSheet.innerHTML = policeIdHtml();
      if (selectedOfficialDocument) {
        officialDocumentSheet.innerHTML = officialDocumentHtml(selectedOfficialDocument);
      }
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
      if (!medicalBookOverlay.hidden) {
        closeMedicalBook();
        return;
      }
      if (!policeIdOverlay.hidden) {
        closePoliceId();
        return;
      }
      if (!officialDocumentOverlay.hidden) {
        closeOfficialDocument();
        return;
      }
      if (!prisonerFileOverlay.hidden) {
        closePrisonerFile();
        return;
      }
      if (!quickActionsOverlay.hidden) {
        closeQuickActions();
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
  setHomePage(0);
  updateClock();
  window.setInterval(updateClock, 1000);
})();
