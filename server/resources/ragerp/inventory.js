const SLOT_COUNT = 24;
const QUICK_SLOT_COUNT = 4;
const MAX_WEIGHT = 30;
const EQUIPMENT_SLOTS = ['primary', 'secondary'];

const ITEM_DEFINITIONS = Object.freeze(Object.assign(Object.create(null), {
  medkit: Object.freeze({
    id: 'medkit',
    name: 'Аптечка',
    description: 'Восстанавливает 35 единиц здоровья.',
    type: 'consumable',
    effect: 'health',
    amount: 35,
    weight: 0.5,
    maxStack: 5,
    icon: 'medkit'
  }),
  armor_vest: Object.freeze({
    id: 'armor_vest',
    name: 'Бронежилет',
    description: 'Восстанавливает 50 единиц брони.',
    type: 'consumable',
    effect: 'armour',
    amount: 50,
    weight: 4,
    maxStack: 1,
    icon: 'armour'
  }),
  pistol: Object.freeze({
    id: 'pistol',
    name: 'Пистолет',
    description: 'Личное оружие. Можно экипировать во второй слот.',
    type: 'weapon',
    equipSlot: 'secondary',
    weaponName: 'weapon_pistol',
    ammo: 48,
    weight: 2.5,
    maxStack: 1,
    icon: 'pistol'
  }),
  carbine: Object.freeze({
    id: 'carbine',
    name: 'Карабин',
    description: 'Основное оружие. Можно экипировать в первый слот.',
    type: 'weapon',
    equipSlot: 'primary',
    weaponName: 'weapon_carbinerifle',
    ammo: 90,
    weight: 4.5,
    maxStack: 1,
    icon: 'carbine'
  }),
  lockpick: Object.freeze({
    id: 'lockpick',
    name: 'Отмычка',
    description: 'Инструмент для попытки взлома закрытого автомобиля.',
    type: 'tool',
    weight: 0.2,
    maxStack: 5,
    icon: 'lockpick'
  })
}));

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function validAmmo(value, fallback) {
  if (value === null || value === undefined || value === '') return fallback;
  const ammo = Number(value);
  return Number.isInteger(ammo) && ammo >= 0 && ammo <= 999 ? ammo : fallback;
}

function equippedItemId(value) {
  return typeof value === 'string'
    ? value
    : isRecord(value) && typeof value.itemId === 'string' ? value.itemId : null;
}

function createEmptyInventory() {
  return {
    slots: new Array(SLOT_COUNT).fill(null),
    quickSlots: new Array(QUICK_SLOT_COUNT).fill(null),
    equipment: {
      primary: null,
      secondary: null
    }
  };
}

function normalizeInventory(value) {
  const inventory = createEmptyInventory();
  if (!isRecord(value)) return inventory;

  if (Array.isArray(value.slots)) {
    value.slots.slice(0, SLOT_COUNT).forEach((rawSlot, index) => {
      if (!isRecord(rawSlot) || typeof rawSlot.itemId !== 'string') return;
      const definition = ITEM_DEFINITIONS[rawSlot.itemId];
      const quantity = Number(rawSlot.quantity);
      if (!definition || !Number.isInteger(quantity) || quantity < 1) return;

      inventory.slots[index] = {
        itemId: definition.id,
        quantity: Math.min(quantity, definition.maxStack),
        ...(definition.type === 'weapon'
          ? { ammo: validAmmo(rawSlot.ammo, definition.ammo) }
          : {})
      };
    });
  }

  if (Array.isArray(value.quickSlots)) {
    const assignedSlots = new Set();
    value.quickSlots.slice(0, QUICK_SLOT_COUNT).forEach((slot, index) => {
      if (!Number.isInteger(slot) || slot < 0 || slot >= SLOT_COUNT ||
          !inventory.slots[slot] || assignedSlots.has(slot)) {
        return;
      }
      inventory.quickSlots[index] = slot;
      assignedSlots.add(slot);
    });
  }

  if (isRecord(value.equipment)) {
    EQUIPMENT_SLOTS.forEach((slot) => {
      const equipped = value.equipment[slot];
      const itemId = equippedItemId(equipped);
      const definition = typeof itemId === 'string' ? ITEM_DEFINITIONS[itemId] : null;
      if (definition && definition.type === 'weapon' && definition.equipSlot === slot) {
        inventory.equipment[slot] = {
          itemId,
          ammo: validAmmo(isRecord(equipped) ? equipped.ammo : null, definition.ammo)
        };
      }
    });
  }

  return inventory;
}

function cloneInventory(inventory) {
  function cloneWeapon(equipped) {
    if (!equipped) return null;
    const itemId = equippedItemId(equipped);
    const definition = ITEM_DEFINITIONS[itemId];
    if (!definition || definition.type !== 'weapon') return null;
    return {
      itemId,
      ammo: validAmmo(isRecord(equipped) ? equipped.ammo : null, definition.ammo)
    };
  }

  return {
    slots: inventory.slots.map((slot) => {
      if (!slot) return null;
      const copy = { itemId: slot.itemId, quantity: slot.quantity };
      const definition = ITEM_DEFINITIONS[slot.itemId];
      if (definition && definition.type === 'weapon') {
        copy.ammo = validAmmo(slot.ammo, definition.ammo);
      }
      return copy;
    }),
    quickSlots: inventory.quickSlots.slice(),
    equipment: {
      primary: cloneWeapon(inventory.equipment.primary),
      secondary: cloneWeapon(inventory.equipment.secondary)
    }
  };
}

function inventoryWeight(inventory) {
  let weight = 0;
  inventory.slots.forEach((slot) => {
    if (!slot) return;
    const definition = ITEM_DEFINITIONS[slot.itemId];
    if (definition) weight += definition.weight * slot.quantity;
  });
  EQUIPMENT_SLOTS.forEach((slot) => {
    const definition = ITEM_DEFINITIONS[equippedItemId(inventory.equipment[slot])];
    if (definition) weight += definition.weight;
  });
  return Math.round(weight * 10) / 10;
}

function addItems(inventory, itemId, quantity, ammoOverride, maxWeight) {
  const definition = ITEM_DEFINITIONS[itemId];
  const capacity = maxWeight === undefined ? MAX_WEIGHT : Number(maxWeight);
  if (!definition || !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
    return { error: 'invalid-item' };
  }
  if (!Number.isFinite(capacity) || capacity <= 0) return { error: 'invalid-capacity' };
  if (inventoryWeight(inventory) + definition.weight * quantity > capacity) {
    return { error: 'too-heavy' };
  }

  let remaining = quantity;
  const next = cloneInventory(inventory);
  next.slots.forEach((slot) => {
    if (!slot || slot.itemId !== itemId || remaining === 0) return;
    const added = Math.min(definition.maxStack - slot.quantity, remaining);
    slot.quantity += added;
    remaining -= added;
  });

  const emptySlots = next.slots.reduce((count, slot) => count + (slot === null ? 1 : 0), 0);
  if (Math.ceil(remaining / definition.maxStack) > emptySlots) {
    return { error: 'no-space' };
  }

  while (remaining > 0) {
    const slotIndex = next.slots.indexOf(null);
    const stackSize = Math.min(definition.maxStack, remaining);
    const stack = { itemId, quantity: stackSize };
    if (definition.type === 'weapon') {
      stack.ammo = validAmmo(ammoOverride, definition.ammo);
    }
    next.slots[slotIndex] = stack;
    remaining -= stackSize;
  }
  return { inventory: next };
}

function moveSlot(inventory, from, to) {
  if (!Number.isInteger(from) || !Number.isInteger(to) ||
      from < 0 || from >= SLOT_COUNT || to < 0 || to >= SLOT_COUNT || from === to) {
    return { error: 'invalid-slot' };
  }
  if (!inventory.slots[from]) return { error: 'empty-slot' };

  const next = cloneInventory(inventory);
  const source = next.slots[from];
  const target = next.slots[to];
  if (!target) {
    next.slots[to] = source;
    next.slots[from] = null;
    next.quickSlots = next.quickSlots.map((slot) => slot === from ? to : slot);
    return { inventory: next };
  }

  if (source.itemId === target.itemId) {
    const definition = ITEM_DEFINITIONS[source.itemId];
    const moved = Math.min(source.quantity, definition.maxStack - target.quantity);
    if (moved < 1) return { error: 'stack-full' };
    target.quantity += moved;
    source.quantity -= moved;
    if (source.quantity === 0) {
      next.slots[from] = null;
      next.quickSlots = next.quickSlots.map((slot) => slot === from ? to : slot);
    }
    return { inventory: next };
  }

  next.slots[from] = target;
  next.slots[to] = source;
  next.quickSlots = next.quickSlots.map((slot) => {
    if (slot === from) return to;
    if (slot === to) return from;
    return slot;
  });
  return { inventory: next };
}

function assignQuickSlot(inventory, quickSlot, inventorySlot) {
  if (!Number.isInteger(quickSlot) || quickSlot < 0 || quickSlot >= QUICK_SLOT_COUNT ||
      (inventorySlot !== null &&
       (!Number.isInteger(inventorySlot) || inventorySlot < 0 ||
        inventorySlot >= SLOT_COUNT || !inventory.slots[inventorySlot]))) {
    return { error: 'invalid-slot' };
  }

  const next = cloneInventory(inventory);
  next.quickSlots = next.quickSlots.map((slot, index) =>
    slot === inventorySlot && index !== quickSlot ? null : slot
  );
  next.quickSlots[quickSlot] = inventorySlot;
  return { inventory: next };
}

function equipItem(inventory, inventorySlot, equipmentSlot) {
  if (!Number.isInteger(inventorySlot) || inventorySlot < 0 || inventorySlot >= SLOT_COUNT ||
      !EQUIPMENT_SLOTS.includes(equipmentSlot)) {
    return { error: 'invalid-slot' };
  }
  const source = inventory.slots[inventorySlot];
  if (!source) return { error: 'empty-slot' };
  const definition = ITEM_DEFINITIONS[source.itemId];
  if (!definition || definition.type !== 'weapon' || definition.equipSlot !== equipmentSlot) {
    return { error: 'wrong-equipment-slot' };
  }

  const next = cloneInventory(inventory);
  const previous = next.equipment[equipmentSlot];
  if (equippedItemId(previous) === source.itemId) return { error: 'already-equipped' };
  next.equipment[equipmentSlot] = null;

  if (source.quantity === 1) {
    next.slots[inventorySlot] = null;
    next.quickSlots = next.quickSlots.map((slot) => slot === inventorySlot ? null : slot);
  } else {
    next.slots[inventorySlot].quantity -= 1;
  }

  if (previous) {
    const previousId = equippedItemId(previous);
    const returned = addItems(next, previousId, 1, previous.ammo);
    if (returned.error) return returned;
    next.slots = returned.inventory.slots;
    next.quickSlots = returned.inventory.quickSlots;
  }
  next.equipment[equipmentSlot] = {
    itemId: source.itemId,
    ammo: validAmmo(source.ammo, definition.ammo)
  };
  return { inventory: next };
}

function unequipItem(inventory, equipmentSlot, targetSlot) {
  if (!EQUIPMENT_SLOTS.includes(equipmentSlot)) return { error: 'invalid-slot' };
  const equipped = inventory.equipment[equipmentSlot];
  const itemId = equippedItemId(equipped);
  if (!itemId) return { error: 'empty-slot' };
  const definition = ITEM_DEFINITIONS[itemId];
  const ammo = validAmmo(isRecord(equipped) ? equipped.ammo : null, definition.ammo);

  const next = cloneInventory(inventory);
  next.equipment[equipmentSlot] = null;
  if (targetSlot !== undefined && targetSlot !== null) {
    if (!Number.isInteger(targetSlot) || targetSlot < 0 || targetSlot >= SLOT_COUNT) {
      return { error: 'invalid-slot' };
    }
    if (next.slots[targetSlot]) return { error: 'slot-occupied' };
    next.slots[targetSlot] = { itemId, quantity: 1, ammo };
    return { inventory: next };
  }

  const returned = addItems(next, itemId, 1, ammo);
  if (returned.error) return returned;
  return { inventory: returned.inventory };
}

function consumeItem(inventory, inventorySlot) {
  if (!Number.isInteger(inventorySlot) || inventorySlot < 0 || inventorySlot >= SLOT_COUNT) {
    return { error: 'invalid-slot' };
  }
  const source = inventory.slots[inventorySlot];
  if (!source) return { error: 'empty-slot' };
  const definition = ITEM_DEFINITIONS[source.itemId];
  if (!definition || definition.type !== 'consumable') return { error: 'not-consumable' };

  const next = cloneInventory(inventory);
  next.slots[inventorySlot].quantity -= 1;
  if (next.slots[inventorySlot].quantity === 0) {
    next.slots[inventorySlot] = null;
    next.quickSlots = next.quickSlots.map((slot) => slot === inventorySlot ? null : slot);
  }
  return {
    inventory: next,
    effect: {
      type: definition.effect,
      amount: definition.amount
    }
  };
}

function countItems(inventory, itemId) {
  return inventory.slots.reduce((count, slot) =>
    slot && slot.itemId === itemId ? count + slot.quantity : count, 0);
}

function removeItems(inventory, itemId, quantity) {
  if (!ITEM_DEFINITIONS[itemId] || !Number.isInteger(quantity) || quantity < 1) {
    return { error: 'invalid-item' };
  }
  if (countItems(inventory, itemId) < quantity) return { error: 'insufficient-items' };

  const next = cloneInventory(inventory);
  let remaining = quantity;
  for (let index = 0; index < next.slots.length && remaining > 0; index += 1) {
    const slot = next.slots[index];
    if (!slot || slot.itemId !== itemId) continue;
    const removed = Math.min(slot.quantity, remaining);
    slot.quantity -= removed;
    remaining -= removed;
    if (slot.quantity === 0) {
      next.slots[index] = null;
      next.quickSlots = next.quickSlots.map((assigned) => assigned === index ? null : assigned);
    }
  }
  return { inventory: next };
}

function transferItems(source, target, sourceSlot, quantity, targetMaxWeight) {
  if (!Number.isInteger(sourceSlot) || sourceSlot < 0 || sourceSlot >= SLOT_COUNT) {
    return { error: 'invalid-slot' };
  }
  const stack = source.slots[sourceSlot];
  if (!stack) return { error: 'empty-slot' };
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > stack.quantity) {
    return { error: 'invalid-quantity' };
  }

  const definition = ITEM_DEFINITIONS[stack.itemId];
  const added = addItems(
    target,
    stack.itemId,
    quantity,
    definition.type === 'weapon' ? stack.ammo : undefined,
    targetMaxWeight
  );
  if (added.error) return added;

  const nextSource = cloneInventory(source);
  nextSource.slots[sourceSlot].quantity -= quantity;
  if (nextSource.slots[sourceSlot].quantity === 0) {
    nextSource.slots[sourceSlot] = null;
    nextSource.quickSlots = nextSource.quickSlots.map((assigned) =>
      assigned === sourceSlot ? null : assigned
    );
  }
  return { sourceInventory: nextSource, targetInventory: added.inventory };
}

function inventoryForClient(inventory) {
  return {
    slots: inventory.slots.map((slot) => slot ? {
      itemId: slot.itemId,
      quantity: slot.quantity,
      ...(ITEM_DEFINITIONS[slot.itemId].type === 'weapon' ? { ammo: slot.ammo } : {})
    } : null),
    quickSlots: inventory.quickSlots.slice(),
    equipment: {
      primary: equippedItemId(inventory.equipment.primary),
      secondary: equippedItemId(inventory.equipment.secondary)
    },
    equipmentAmmo: {
      primary: inventory.equipment.primary ? inventory.equipment.primary.ammo : null,
      secondary: inventory.equipment.secondary ? inventory.equipment.secondary.ammo : null
    }
  };
}

module.exports = {
  EQUIPMENT_SLOTS,
  ITEM_DEFINITIONS,
  MAX_WEIGHT,
  QUICK_SLOT_COUNT,
  SLOT_COUNT,
  addItems,
  assignQuickSlot,
  cloneInventory,
  countItems,
  consumeItem,
  createEmptyInventory,
  equipItem,
  inventoryForClient,
  inventoryWeight,
  moveSlot,
  normalizeInventory,
  removeItems,
  transferItems,
  unequipItem
};
