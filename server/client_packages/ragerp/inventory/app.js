(function () {
  const inventoryGrid = document.getElementById('inventory-grid');
  const quickbar = document.getElementById('quickbar');
  const toast = document.getElementById('inventory-toast');
  const itemAction = document.getElementById('item-action');
  const transferAction = document.getElementById('transfer-action');
  const storageSwitch = document.getElementById('storage-switch');
  const storageTabs = Array.from(document.querySelectorAll('[data-storage-mode]'));
  const itemCatalog = Object.create(null);
  const iconMarkup = {
    medkit: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 4h6v5h5v6h-5v5H9v-5H4V9h5z"/></svg>',
    armour: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 4 4 2 4-2 4 3-2 13H6L4 7zM9 10h6M12 6v14"/></svg>',
    pistol: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8h13l3 2-2 3h-5l-1 6H8l1-6H5zM16 8V5h4v3M5 10h8"/></svg>',
    carbine: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9h12l2-2h3v2h3v3h-6l-2 2H8l-1 3H4l1-4-3-1zM18 7V5h2v2"/></svg>',
    lockpick: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20 15 9m-3-3 6 6m-2-9 5 5-3 3-5-5zM4 20l-1 1"/></svg>'
  };
  let state = null;
  let selectedSlot = null;
  let selectedEquipment = null;
  let dragSource = null;
  let toastTimer = null;
  let containerMode = 'player';

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function parseState(payload) {
    let value = payload;
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch (error) {
        console.error('[RageRP inventory] Could not parse server state:', error);
        showToast('Не удалось загрузить инвентарь.');
        return null;
      }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value) ||
        !value.inventory || !Array.isArray(value.inventory.slots) ||
        !Array.isArray(value.inventory.quickSlots) || !value.inventory.equipment ||
        !Array.isArray(value.catalog)) {
      console.error('[RageRP inventory] Received an invalid server state.');
      showToast('Сервер прислал некорректные данные инвентаря.');
      return null;
    }
    return value;
  }

  function showToast(message) {
    toast.textContent = String(message || '');
    toast.classList.add('is-visible');
    if (toastTimer !== null) window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastTimer = null;
      toast.classList.remove('is-visible');
    }, 2400);
  }

  function sendAction(action, data) {
    if (typeof mp === 'undefined' || typeof mp.trigger !== 'function') {
      showToast('Инвентарь работает только при подключении к серверу.');
      return;
    }
    mp.trigger('ragerp:inventory:action', action, JSON.stringify(data || {}));
  }

  function activeInventory() {
    return containerMode === 'trunk' && state && state.vehicleTrunk
      ? state.vehicleTrunk.inventory
      : state && state.inventory;
  }

  function itemForSlot(slotIndex, inventory) {
    const source = inventory || activeInventory();
    if (!source || !Number.isInteger(slotIndex) || slotIndex < 0 ||
        slotIndex >= source.slots.length) return null;
    const stack = source.slots[slotIndex];
    if (!stack || !itemCatalog[stack.itemId]) return null;
    return { stack, definition: itemCatalog[stack.itemId] };
  }

  function iconFor(definition) {
    const markup = iconMarkup[definition.icon] || '';
    return `<span class="item-icon icon-${escapeHtml(definition.icon)}">${markup}</span>`;
  }

  function setMeter(id, value) {
    const amount = Math.max(0, Math.min(100, Number(value) || 0));
    document.getElementById(id).style.width = `${amount}%`;
    return Math.round(amount);
  }

  function renderVitals() {
    const health = setMeter('health-meter', state.health);
    const armour = setMeter('armour-meter', state.armour);
    document.getElementById('health-value').textContent = `${health}%`;
    document.getElementById('armour-value').textContent = `${armour}%`;
    document.getElementById('armour-status-value').textContent = `${armour}%`;

    const trunk = containerMode === 'trunk' && state.vehicleTrunk;
    const weight = Math.max(0, Number(trunk ? trunk.weight : state.weight) || 0);
    const capacity = Math.max(1, Number(trunk ? trunk.capacity : state.capacity) || 30);
    const weightText = weight.toLocaleString('ru-RU', {
      minimumFractionDigits: 1,
      maximumFractionDigits: 1
    });
    document.getElementById('weight-value').innerHTML =
      `${escapeHtml(weightText)} <small>/ ${escapeHtml(capacity)} кг</small>`;
    document.getElementById('capacity-meter').style.width =
      `${Math.max(0, Math.min(100, weight / capacity * 100))}%`;
  }

  function renderEquipment() {
    ['primary', 'secondary'].forEach(function (slot) {
      const itemId = state.inventory.equipment[slot];
      const item = itemId && itemCatalog[itemId];
      const ammo = state.inventory.equipmentAmmo && state.inventory.equipmentAmmo[slot];
      const ammoLabel = Number.isInteger(ammo) ? `, патронов ${ammo}` : '';
      const button = document.querySelector(`[data-equipment-slot="${slot}"]`);
      button.classList.toggle('is-equipped', Boolean(item));
      button.draggable = Boolean(item);
      button.setAttribute('aria-label',
        `${slot === 'primary' ? 'Основное' : 'Вторичное'} оружие: ${item ? item.name + ammoLabel : 'пусто'}`);
      button.querySelector(`[data-equipment-name="${slot}"]`).textContent =
        item ? `${item.name}${Number.isInteger(ammo) ? ` · ${ammo} патр.` : ''}` : 'Пусто';
    });
  }

  function renderGrid() {
    const active = activeInventory();
    if (!active) return;
    inventoryGrid.innerHTML = '';
    active.slots.forEach(function (stack, index) {
      const item = stack && itemCatalog[stack.itemId];
      const cell = document.createElement('button');
      cell.type = 'button';
      cell.className = `inventory-cell${selectedSlot === index ? ' is-selected' : ''}`;
      cell.dataset.inventorySlot = String(index);
      cell.draggable = Boolean(item) && containerMode === 'player';
      cell.setAttribute('aria-label', item
        ? `${item.name}${item.type === 'weapon' ? `, патронов ${stack.ammo}` : ''}, количество ${stack.quantity}, слот ${index + 1}`
        : `Пустой слот ${index + 1}`);
      if (item) {
        cell.innerHTML = `${iconFor(item)}<span class="item-name">${escapeHtml(item.name)}</span>` +
          (item.type === 'weapon' ? `<span class="item-ammo">${stack.ammo} патр.</span>` : '') +
          (stack.quantity > 1 ? `<span class="item-quantity">×${stack.quantity}</span>` : '');
      } else {
        cell.innerHTML = `<kbd>${String(index + 1).padStart(2, '0')}</kbd>`;
      }
      inventoryGrid.appendChild(cell);
    });
    document.getElementById('empty-inventory').hidden =
      active.slots.some(function (slot) { return slot !== null; });
  }

  function renderQuickbar() {
    quickbar.querySelectorAll('[data-quick-slot]').forEach(function (button) {
      const quickSlot = Number(button.dataset.quickSlot);
      const inventorySlot = state.inventory.quickSlots[quickSlot];
      const item = inventorySlot === null ? null : itemForSlot(inventorySlot, state.inventory);
      button.classList.toggle('has-item', Boolean(item));
      button.draggable = Boolean(item);
      button.innerHTML = `<kbd>${quickSlot + 1}</kbd>` +
        (item ? `${iconFor(item.definition)}<span class="quick-slot-name">${escapeHtml(item.definition.name)}</span>` : '');
      button.setAttribute('aria-label', item
        ? `Быстрый слот ${quickSlot + 1}: ${item.definition.name}, нажми для использования`
        : `Пустой быстрый слот ${quickSlot + 1}`);
    });
  }

  function renderInspector() {
    const copy = document.querySelector('.inspector-copy');
    const icon = document.getElementById('inspector-icon');
    const type = document.getElementById('inspector-type');
    const name = document.getElementById('inspector-name');
    const description = document.getElementById('inspector-description');
    let selectedItem = null;

    if (selectedEquipment) {
      const itemId = state.inventory.equipment[selectedEquipment];
      if (itemId && itemCatalog[itemId]) {
        selectedItem = { definition: itemCatalog[itemId], equipmentSlot: selectedEquipment };
      }
    } else if (selectedSlot !== null) {
      const slotItem = itemForSlot(selectedSlot);
      if (slotItem) selectedItem = Object.assign(slotItem, { slot: selectedSlot });
    }

    itemAction.disabled = !selectedItem;
    transferAction.hidden = !state.vehicleTrunk || selectedSlot === null ||
      !itemForSlot(selectedSlot);
    transferAction.disabled = transferAction.hidden;
    transferAction.textContent = containerMode === 'trunk' ? 'В рюкзак' : 'В багажник';
    if (!selectedItem) {
      icon.textContent = '?';
      icon.className = 'inspector-icon';
      type.textContent = 'ВЫБЕРИ ПРЕДМЕТ';
      name.textContent = 'Информация о предмете';
      description.textContent = 'Нажми на предмет, чтобы посмотреть его описание и доступные действия.';
      itemAction.textContent = 'Использовать';
      return;
    }

    const definition = selectedItem.definition;
    icon.className = 'inspector-icon';
    icon.innerHTML = iconFor(definition);
    type.textContent = definition.type === 'weapon'
      ? 'ЭКИПИРОВКА'
      : definition.type === 'tool' ? 'ИНСТРУМЕНТ' : 'РАСХОДУЕМЫЙ ПРЕДМЕТ';
    name.textContent = definition.name;
    const quantity = selectedItem.stack ? ` · Количество: ${selectedItem.stack.quantity}` : '';
    const ammo = selectedItem.stack && definition.type === 'weapon'
      ? ` · Патроны: ${selectedItem.stack.ammo}`
      : '';
    description.textContent = `${definition.description} Вес: ${definition.weight} кг${quantity}${ammo}`;
    itemAction.textContent = selectedItem.equipmentSlot
      ? 'Снять'
      : definition.type === 'weapon' ? 'Экипировать' : 'Использовать';
    itemAction.disabled = containerMode === 'trunk' || definition.type === 'tool';
    copy.dataset.selected = selectedItem.equipmentSlot ? 'equipment' : 'inventory';
  }

  function render() {
    if (!state) return;
    Object.keys(itemCatalog).forEach(function (key) { delete itemCatalog[key]; });
    state.catalog.forEach(function (item) {
      if (item && typeof item.id === 'string') itemCatalog[item.id] = item;
    });
    if (!state.vehicleTrunk) containerMode = 'player';
    storageSwitch.hidden = !state.vehicleTrunk;
    storageTabs.forEach(function (button) {
      button.classList.toggle('is-active', button.dataset.storageMode === containerMode);
    });
    document.querySelector('.storage-header .section-heading h3').textContent =
      containerMode === 'trunk' ? 'Багажник' : 'Рюкзак';
    document.getElementById('character-name').textContent = state.name || 'Персонаж';
    document.getElementById('character-static-id').textContent = state.staticId || '--- ---';
    renderVitals();
    renderEquipment();
    renderGrid();
    renderQuickbar();
    renderInspector();
  }

  function setBootstrap(payload) {
    const nextState = parseState(payload);
    if (!nextState) return;
    state = nextState;
    containerMode = 'player';
    selectedSlot = null;
    selectedEquipment = null;
    render();
  }

  function update(payload) {
    const nextState = parseState(payload);
    if (!nextState) return;
    state = nextState;
    if (!state.vehicleTrunk) containerMode = 'player';
    if (selectedEquipment && !state.inventory.equipment[selectedEquipment]) {
      selectedEquipment = null;
    }
    const active = activeInventory();
    if (selectedSlot !== null && (!active || !active.slots[selectedSlot])) {
      selectedSlot = null;
    }
    render();
  }

  function closeInventory() {
    if (typeof mp !== 'undefined' && typeof mp.trigger === 'function') {
      mp.trigger('ragerp:inventory:close-request');
    }
  }

  function sourceFromEvent(event) {
    const target = event.target.closest('[data-inventory-slot], [data-equipment-slot], [data-quick-slot]');
    if (!target) return null;
    if (target.hasAttribute('data-inventory-slot')) {
      return { type: 'inventory', slot: Number(target.dataset.inventorySlot) };
    }
    if (target.hasAttribute('data-equipment-slot')) {
      return { type: 'equipment', equipmentSlot: target.dataset.equipmentSlot };
    }
    return { type: 'quick', quickSlot: Number(target.dataset.quickSlot) };
  }

  function startDrag(event) {
    const source = sourceFromEvent(event);
    if (!source) return;
    if (containerMode === 'trunk' && source.type !== 'inventory') return;
    if (source.type === 'inventory' && !itemForSlot(source.slot)) return;
    if (source.type === 'equipment' && !state.inventory.equipment[source.equipmentSlot]) return;
    if (source.type === 'quick' && state.inventory.quickSlots[source.quickSlot] === null) return;
    dragSource = source;
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', 'inventory-item');
    }
  }

  function endDrag() {
    dragSource = null;
    document.querySelectorAll('.is-drop-target').forEach(function (element) {
      element.classList.remove('is-drop-target');
    });
  }

  function onDragOver(event) {
    if (!dragSource) return;
    const target = sourceFromEvent(event);
    if (!target) return;
    event.preventDefault();
    const targetElement = event.target.closest(
      '[data-inventory-slot], [data-equipment-slot], [data-quick-slot]'
    );
    if (targetElement) targetElement.classList.add('is-drop-target');
  }

  function onDragLeave(event) {
    const targetElement = event.target.closest(
      '[data-inventory-slot], [data-equipment-slot], [data-quick-slot]'
    );
    if (targetElement && !targetElement.contains(event.relatedTarget)) {
      targetElement.classList.remove('is-drop-target');
    }
  }

  function onDrop(event) {
    const target = sourceFromEvent(event);
    if (!dragSource || !target) return;
    event.preventDefault();
    const source = dragSource;
    endDrag();

    if (containerMode === 'trunk') {
      if (source.type === 'inventory' && target.type === 'inventory') {
        sendAction('vehicle-move', { from: source.slot, to: target.slot });
      }
      return;
    }

    if (target.type === 'inventory') {
      if (source.type === 'inventory') {
        sendAction('move', { from: source.slot, to: target.slot });
      } else if (source.type === 'equipment') {
        sendAction('unequip', { equipmentSlot: source.equipmentSlot, to: target.slot });
      } else if (source.type === 'quick') {
        const from = state.inventory.quickSlots[source.quickSlot];
        if (from !== null) sendAction('move', { from, to: target.slot });
      }
    } else if (target.type === 'equipment' && source.type === 'inventory') {
      sendAction('equip', { slot: source.slot, equipmentSlot: target.equipmentSlot });
    } else if (target.type === 'quick' && source.type === 'inventory') {
      sendAction('assign-quick', { slot: source.slot, quickSlot: target.quickSlot });
    } else if (target.type === 'quick' && source.type === 'quick') {
      const slot = state.inventory.quickSlots[source.quickSlot];
      sendAction('assign-quick', { slot, quickSlot: target.quickSlot });
    }
  }

  inventoryGrid.addEventListener('click', function (event) {
    const cell = event.target.closest('[data-inventory-slot]');
    if (!cell) return;
    const slot = Number(cell.dataset.inventorySlot);
    selectedSlot = itemForSlot(slot) ? slot : null;
    selectedEquipment = null;
    renderGrid();
    renderInspector();
  });
  inventoryGrid.addEventListener('dragstart', startDrag);
  inventoryGrid.addEventListener('dragend', endDrag);
  inventoryGrid.addEventListener('dragover', onDragOver);
  inventoryGrid.addEventListener('dragleave', onDragLeave);
  inventoryGrid.addEventListener('drop', onDrop);

  storageTabs.forEach(function (button) {
    button.addEventListener('click', function () {
      if (!state || !state.vehicleTrunk) return;
      containerMode = button.dataset.storageMode === 'trunk' ? 'trunk' : 'player';
      selectedSlot = null;
      selectedEquipment = null;
      render();
    });
  });

  document.querySelectorAll('[data-equipment-slot]').forEach(function (button) {
    button.addEventListener('click', function () {
      const slot = button.dataset.equipmentSlot;
      if (!state.inventory.equipment[slot]) return;
      selectedEquipment = slot;
      selectedSlot = null;
      renderInspector();
    });
    button.addEventListener('dragstart', startDrag);
    button.addEventListener('dragend', endDrag);
    button.addEventListener('dragover', onDragOver);
    button.addEventListener('dragleave', onDragLeave);
    button.addEventListener('drop', onDrop);
  });

  quickbar.addEventListener('click', function (event) {
    const button = event.target.closest('[data-quick-slot]');
    if (!button) return;
    const quickSlot = Number(button.dataset.quickSlot);
    if (selectedSlot !== null && containerMode === 'player') {
      sendAction('assign-quick', { slot: selectedSlot, quickSlot });
      return;
    }
    sendAction('use-quick', { quickSlot });
  });
  quickbar.addEventListener('dragstart', startDrag);
  quickbar.addEventListener('dragend', endDrag);
  quickbar.addEventListener('dragover', onDragOver);
  quickbar.addEventListener('dragleave', onDragLeave);
  quickbar.addEventListener('drop', onDrop);

  itemAction.addEventListener('click', function () {
    if (containerMode !== 'player') return;
    if (selectedEquipment) {
      sendAction('unequip', { equipmentSlot: selectedEquipment });
      selectedEquipment = null;
      renderInspector();
      return;
    }
    if (selectedSlot === null) return;
    const item = itemForSlot(selectedSlot, state.inventory);
    if (!item) return;
    if (item.definition.type === 'tool') return;
    if (item.definition.type === 'weapon') {
      sendAction('equip', { slot: selectedSlot, equipmentSlot: item.definition.equipSlot });
    } else {
      sendAction('use', { slot: selectedSlot });
    }
  });

  transferAction.addEventListener('click', function () {
    const active = activeInventory();
    const stack = active && selectedSlot !== null ? active.slots[selectedSlot] : null;
    if (!state || !state.vehicleTrunk || !stack) return;
    sendAction('vehicle-transfer', {
      direction: containerMode === 'trunk' ? 'to-player' : 'to-trunk',
      slot: selectedSlot,
      quantity: stack.quantity
    });
  });

  document.getElementById('close-inventory').addEventListener('click', closeInventory);
  document.getElementById('inventory-screen').addEventListener('click', function (event) {
    if (event.target.classList.contains('screen-backdrop')) closeInventory();
  });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeInventory();
    }
  });

  window.ragerpInventory = {
    close: closeInventory,
    setBootstrap,
    setNotice: showToast,
    update
  };
}());
