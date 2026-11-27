(function () {
  const categoryLabels = {
    admin_online: 'Админы онлайн',
    family_logs: 'Лог фракций',
    auth_logs: 'Лог авторизаций',
    house_inventory: 'Лог инвентаря дома',
    car_inventory: 'Лог инвентаря машины',
    taxi_inventory: 'Лог инвентаря такси',
    item_transfer: 'Передача предметов',
    appeals: 'Обращения',
    family_search: 'Лог инвентаря фракции',
    inventory_search: 'Лог инвентаря игрока',
    universal_inventory: 'Универсальный инвентарь',
    house_search: 'Поиск дома',
    appeal_search: 'Поиск обращений'
  };

  let state = { players: [], logs: [], staticId: '' };
  let selectedPlayer = null;
  let selectedCategory = 'all';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function trigger(eventName, payload) {
    if (typeof mp === 'undefined' || !mp || typeof mp.trigger !== 'function') return;
    mp.trigger(eventName, typeof payload === 'string' ? payload : JSON.stringify(payload));
  }

  function formatTime(timestamp) {
    const date = new Date(Number(timestamp));
    if (!Number.isFinite(date.getTime())) return '--';
    return date.toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function renderCategories(categories) {
    const list = document.getElementById('category-list');
    list.innerHTML = '';
    const items = Array.isArray(categories) && categories.length
      ? categories
      : Object.keys(categoryLabels);
    items.forEach(function (category) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'category-button';
      button.dataset.category = category;
      button.innerHTML = `<span>${escapeHtml(categoryLabels[category] || category)}</span><b>LOG</b>`;
      button.addEventListener('click', function () {
        selectCategory(category);
      });
      list.appendChild(button);
    });
  }

  function selectCategory(category) {
    selectedCategory = category;
    document.querySelectorAll('[data-category]').forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.category === category);
    });
    document.getElementById('logs-heading').textContent =
      category === 'all' ? 'Лог всех событий' : (categoryLabels[category] || category);
    trigger('ragerp:admin:logs', {
      category: category === 'all' ? null : category,
      search: document.getElementById('log-search').value
    });
  }

  function renderPlayers() {
    const search = document.getElementById('player-search').value.trim().toLowerCase();
    const players = (state.players || []).filter(function (player) {
      const text = `${player.name} ${player.staticId}`.toLowerCase();
      return !search || text.includes(search);
    });
    document.getElementById('online-count').textContent = String(players.length);
    const list = document.getElementById('player-list');
    list.innerHTML = '';
    if (!players.length) {
      list.innerHTML = '<p class="empty-log">Игроки не найдены</p>';
      return;
    }
    players.forEach(function (player) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'player-card';
      if (player.isFrozen) button.classList.add('is-frozen');
      if (selectedPlayer && selectedPlayer.staticId === player.staticId) {
        button.classList.add('is-selected');
      }
      button.innerHTML =
        `<span><strong>${escapeHtml(player.name)}</strong>` +
        `<small>${escapeHtml(player.faction)} · ${escapeHtml(player.staticId)}</small></span>` +
        `<b>${player.isAdmin ? 'ADMIN' : (player.isFrozen ? 'FREEZE' : 'ONLINE')}</b>`;
      button.addEventListener('click', function () {
        selectedPlayer = player;
        document.getElementById('selected-player').textContent =
          `${player.name} · ${player.staticId}`;
        renderPlayers();
      });
      list.appendChild(button);
    });
  }

  function renderLogs(logs) {
    const list = document.getElementById('log-list');
    list.innerHTML = '';
    if (!Array.isArray(logs) || !logs.length) {
      list.innerHTML = '<p class="empty-log">Записей пока нет</p>';
      return;
    }
    logs.forEach(function (log) {
      const row = document.createElement('article');
      row.className = 'log-row';
      row.innerHTML =
        `<time>${escapeHtml(formatTime(log.createdAt))}</time>` +
        `<div><strong>${escapeHtml(categoryLabels[log.category] || log.category)} · ${escapeHtml(log.action)}</strong>` +
        `<p>${escapeHtml(log.details)}${log.targetStaticId ? ` · Игрок ${escapeHtml(log.targetStaticId)}` : ''}</p></div>`;
      list.appendChild(row);
    });
  }

  function closeModal() {
    document.getElementById('admin-modal').hidden = true;
  }

  function openModal(action) {
    if (!selectedPlayer && ['spectate', 'teleport', 'freeze', 'warn', 'kick', 'ban',
        'give_money', 'give_item', 'player_info'].includes(action)) return;

    const modal = document.getElementById('admin-modal');
    const title = document.getElementById('admin-modal-title');
    const fields = document.getElementById('admin-modal-fields');
    fields.innerHTML = '';
    modal.hidden = false;

    const targetStaticId = selectedPlayer ? selectedPlayer.staticId : '';
    const labels = {
      spectate: 'Следить за игроком',
      teleport: 'Телепорт к игроку',
      freeze: 'Заморозить или разморозить',
      warn: 'Предупреждение',
      kick: 'Кикнуть игрока',
      ban: 'Выдать блокировку',
      give_money: 'Выдать наличные',
      give_item: 'Выдать предмет',
      player_info: 'Информация о игроке'
    };
    title.textContent = labels[action] || 'Действие';

    if (['warn', 'kick', 'ban'].includes(action)) {
      fields.insertAdjacentHTML('beforeend',
        '<label>Причина<input name="reason" maxlength="500" required></label>');
    }
    if (action === 'ban') {
      fields.insertAdjacentHTML('beforeend',
        '<label>Срок блокировки, дней<input name="durationDays" type="number" min="1" max="3650" value="7" required></label>');
    }
    if (action === 'give_money') {
      fields.insertAdjacentHTML('beforeend',
        '<label>Сумма ₽<input name="amount" type="number" min="1" max="10000000" value="1000" required></label>');
    }
    if (action === 'give_item') {
      fields.insertAdjacentHTML('beforeend',
        '<label>Предмет<select name="itemId"><option value="medkit">Аптечка</option><option value="armor_vest">Бронежилет</option><option value="pistol">Пистолет</option><option value="carbine">Карабин</option></select></label>' +
        '<label>Количество<input name="quantity" type="number" min="1" max="100" value="1" required></label>');
    }
    if (action === 'spectate' || action === 'teleport' || action === 'freeze' ||
        action === 'player_info') {
      fields.insertAdjacentHTML('beforeend',
        `<label>Цель<input name="targetStaticId" value="${escapeHtml(targetStaticId)}" readonly></label>`);
    }

    modal.dataset.action = action;
    modal.dataset.targetStaticId = targetStaticId;
  }

  document.getElementById('close-admin').addEventListener('click', function () {
    trigger('ragerp:admin:close');
  });
  document.getElementById('close-modal').addEventListener('click', closeModal);
  document.getElementById('cancel-modal').addEventListener('click', closeModal);
  document.getElementById('player-search').addEventListener('input', renderPlayers);
  document.getElementById('log-search').addEventListener('input', function () {
    selectCategory(selectedCategory);
  });
  document.querySelectorAll('[data-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      openModal(button.dataset.action);
    });
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      trigger('ragerp:admin:close');
    }
  });
  document.querySelectorAll('[data-category]').forEach(function (button) {
    button.addEventListener('click', function () {
      selectCategory(button.dataset.category);
    });
  });
  document.getElementById('admin-modal-form').addEventListener('submit', function (event) {
    event.preventDefault();
    const modal = document.getElementById('admin-modal');
    const action = modal.dataset.action;
    const targetStaticId = modal.dataset.targetStaticId;
    const formData = new FormData(event.currentTarget);
    const payload = { action, targetStaticId };
    formData.forEach(function (value, key) {
      payload[key] = value;
    });
    trigger('ragerp:admin:action', payload);
    closeModal();
  });

  window.ragerpAdmin = {
    setState: function (payload) {
      const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
      state = value && typeof value === 'object' ? value : state;
      renderCategories(state.categories);
      renderPlayers();
      renderLogs(state.logs);
      selectCategory('all');
    },
    setLogs: function (payload) {
      const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!value || typeof value !== 'object') return;
      if (Array.isArray(value.players)) state.players = value.players;
      renderPlayers();
      renderLogs(value.logs);
    },
    setPlayerInfo: function (payload) {
      const value = typeof payload === 'string' ? JSON.parse(payload) : payload;
      if (!value || typeof value !== 'object') return;
      const fields = document.getElementById('admin-modal-fields');
      fields.innerHTML =
        `<label>Статик ID<input value="${escapeHtml(value.staticId)}" readonly></label>` +
        `<label>Имя<input value="${escapeHtml(value.name)}" readonly></label>` +
        `<label>Фракция<input value="${escapeHtml(value.faction)}" readonly></label>` +
        `<label>Наличные<input value="${escapeHtml(value.cash)} ₽" readonly></label>` +
        `<label>Банк<input value="${escapeHtml(value.bank)} ₽" readonly></label>` +
        `<label>Блокировка<input value="${escapeHtml(value.ban ? value.ban.reason : 'Нет')}" readonly></label>`;
      document.getElementById('admin-modal').hidden = false;
      document.getElementById('admin-modal-title').textContent = 'Информация о игроке';
    },
    close: function () {
      closeModal();
    }
  };

  renderCategories(Object.keys(categoryLabels));
})();
