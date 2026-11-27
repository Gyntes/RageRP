const test = require('node:test');
const assert = require('node:assert/strict');
const inventory = require('../server/resources/ragerp/inventory');

test('adding items stacks them without exceeding the configured capacity', () => {
  const result = inventory.addItems(inventory.createEmptyInventory(), 'medkit', 7);
  assert.ifError(result.error);
  assert.deepEqual(result.inventory.slots.slice(0, 2), [
    { itemId: 'medkit', quantity: 5 },
    { itemId: 'medkit', quantity: 2 }
  ]);
  assert.equal(inventory.inventoryWeight(result.inventory), 3.5);
  assert.equal(inventory.addItems(result.inventory, 'medkit', 100).error, 'too-heavy');
});

test('adding items fails atomically when there are no free slots', () => {
  const fullInventory = inventory.normalizeInventory({
    slots: Array.from({ length: inventory.SLOT_COUNT }, () => ({
      itemId: 'medkit',
      quantity: 1
    }))
  });
  const result = inventory.addItems(fullInventory, 'carbine', 1);
  assert.equal(result.error, 'no-space');
  assert.equal(inventory.inventoryWeight(fullInventory), 12);
});

test('moving an item updates its quick slot reference and consuming clears empty slots', () => {
  let state = inventory.createEmptyInventory();
  state = inventory.addItems(state, 'medkit', 1).inventory;
  state = inventory.assignQuickSlot(state, 0, 0).inventory;
  state = inventory.moveSlot(state, 0, 3).inventory;
  assert.equal(state.quickSlots[0], 3);

  const consumed = inventory.consumeItem(state, 3);
  assert.equal(consumed.effect.type, 'health');
  assert.equal(consumed.inventory.slots[3], null);
  assert.equal(consumed.inventory.quickSlots[0], null);
});

test('weapons can only be equipped in their matching slot and returned to inventory', () => {
  let state = inventory.createEmptyInventory();
  state = inventory.addItems(state, 'pistol', 1).inventory;
  assert.equal(inventory.equipItem(state, 0, 'primary').error, 'wrong-equipment-slot');

  state = inventory.equipItem(state, 0, 'secondary').inventory;
  assert.equal(state.equipment.secondary.itemId, 'pistol');
  assert.equal(state.slots[0], null);

  state = inventory.unequipItem(state, 'secondary').inventory;
  assert.equal(state.equipment.secondary, null);
  assert.equal(state.slots[0].itemId, 'pistol');
});

test('equipped weapons can be dragged back to an exact empty inventory slot', () => {
  let state = inventory.createEmptyInventory();
  state = inventory.addItems(state, 'carbine', 1).inventory;
  state.slots[0].ammo = 23;
  state = inventory.equipItem(state, 0, 'primary').inventory;

  const result = inventory.unequipItem(state, 'primary', 5);
  assert.equal(result.inventory.slots[5].itemId, 'carbine');
  assert.equal(result.inventory.slots[5].ammo, 23);
  assert.equal(inventory.unequipItem(state, 'primary', 24).error, 'invalid-slot');
});

test('equipping and returning multiple weapons preserves their ammo', () => {
  let state = inventory.createEmptyInventory();
  state = inventory.addItems(state, 'carbine', 1).inventory;
  state = inventory.addItems(state, 'pistol', 1).inventory;
  state.slots[0].ammo = 27;
  state.slots[1].ammo = 16;

  state = inventory.equipItem(state, 0, 'primary').inventory;
  state = inventory.equipItem(state, 1, 'secondary').inventory;

  assert.deepEqual(state.equipment.primary, { itemId: 'carbine', ammo: 27 });
  assert.deepEqual(state.equipment.secondary, { itemId: 'pistol', ammo: 16 });
  const equippedState = inventory.inventoryForClient(state);
  assert.equal(equippedState.equipmentAmmo.primary, 27);
  assert.equal(equippedState.equipmentAmmo.secondary, 16);
  state = inventory.unequipItem(state, 'primary').inventory;
  state = inventory.unequipItem(state, 'secondary').inventory;

  const publicState = inventory.inventoryForClient(state);
  assert.equal(publicState.equipment.primary, null);
  assert.equal(publicState.slots[0].ammo, 27);
  assert.equal(publicState.slots[1].ammo, 16);
});

test('normalization rejects unknown items and invalid quick slots', () => {
  const state = inventory.normalizeInventory({
    slots: [
      { itemId: 'unknown', quantity: 2 },
      { itemId: 'medkit', quantity: 2 }
    ],
    quickSlots: [0, 1, 1, -1],
    equipment: { primary: 'carbine', secondary: 'pistol' }
  });
  assert.equal(state.slots[0], null);
  assert.equal(state.quickSlots[0], null);
  assert.equal(state.quickSlots[1], 1);
  assert.equal(state.quickSlots[2], null);
  assert.equal(state.equipment.primary.itemId, 'carbine');
  assert.equal(state.equipment.primary.ammo, inventory.ITEM_DEFINITIONS.carbine.ammo);
  assert.equal(state.equipment.secondary.itemId, 'pistol');
  assert.equal(state.equipment.secondary.ammo, inventory.ITEM_DEFINITIONS.pistol.ammo);
});
