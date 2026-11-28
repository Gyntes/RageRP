const test = require('node:test');
const assert = require('node:assert/strict');
const Inventory = require('../server/resources/ragerp/inventory');
const VehicleAccess = require('../server/resources/ragerp/vehicle-access');

const ownerStaticId = '123-456';
const holderStaticId = '234-567';

test('legacy vehicle records gain access and trunk fields without changing ownership data', () => {
  const legacy = {
    model: 'blista',
    plate: 'A123ABC',
    region: '97'
  };
  const result = VehicleAccess.normalizeVehicleRecord(
    legacy,
    ownerStaticId,
    () => 'a'.repeat(32)
  );

  assert.ifError(result.error);
  assert.equal(result.changed, true);
  assert.equal(result.vehicle.model, 'blista');
  assert.equal(result.vehicle.vehicleId, 'a'.repeat(32));
  assert.deepEqual(result.vehicle.keyHolderStaticIds, []);
  assert.equal(result.vehicle.locked, false);
  assert.deepEqual(result.vehicle.trunkInventory, Inventory.createEmptyInventory());
  assert.equal(VehicleAccess.hasKey(result.vehicle, ownerStaticId, ownerStaticId), true);
});

test('normalization deduplicates grants and never stores the owner as a shared holder', () => {
  const result = VehicleAccess.normalizeVehicleRecord({
    model: 'blista',
    plate: 'A123ABC',
    region: '97',
    vehicleId: 'b'.repeat(32),
    keyHolderStaticIds: [holderStaticId, holderStaticId, ownerStaticId, 'invalid']
  }, ownerStaticId, () => 'c'.repeat(32));

  assert.deepEqual(result.vehicle.keyHolderStaticIds, [holderStaticId]);
  assert.equal(VehicleAccess.hasKey(result.vehicle, ownerStaticId, holderStaticId), true);
});

test('key grants are idempotent and revocation immediately removes access', () => {
  const vehicle = { keyHolderStaticIds: [] };
  const granted = VehicleAccess.grantKey(vehicle, ownerStaticId, holderStaticId);
  assert.equal(VehicleAccess.hasKey(granted.vehicle, ownerStaticId, holderStaticId), true);
  assert.equal(VehicleAccess.grantKey(granted.vehicle, ownerStaticId, holderStaticId).error,
    'already-granted');

  const revoked = VehicleAccess.revokeKey(granted.vehicle, holderStaticId);
  assert.equal(VehicleAccess.hasKey(revoked.vehicle, ownerStaticId, holderStaticId), false);
  assert.deepEqual(vehicle.keyHolderStaticIds, []);
});

test('theft outcomes are determined solely by supplied server rolls and configured chances', () => {
  assert.deepEqual(VehicleAccess.resolveTheftOutcome(0.2, 0.1, {
    successChance: 0.35,
    breakChanceOnFailure: 0.25
  }), { success: true, lockpickBroken: false });
  assert.deepEqual(VehicleAccess.resolveTheftOutcome(0.8, 0.1, {
    successChance: 0.35,
    breakChanceOnFailure: 0.25
  }), { success: false, lockpickBroken: true });
  assert.equal(VehicleAccess.shouldAlertPolice('success', 0.2, {
    enabled: true,
    stages: ['success'],
    chance: 0.25
  }), true);
  assert.equal(VehicleAccess.shouldAlertPolice('failure', 0.2, {
    enabled: true,
    stages: ['success'],
    chance: 0.25
  }), false);
});

test('only one theft attempt can reserve a vehicle or player at a time', () => {
  const registry = new VehicleAccess.TheftAttemptRegistry();
  const first = { vehicleId: 'vehicle-a', playerId: 1 };
  const secondPlayer = { vehicleId: 'vehicle-a', playerId: 2 };
  const secondVehicle = { vehicleId: 'vehicle-b', playerId: 1 };
  assert.equal(registry.reserve(first), true);
  assert.equal(registry.reserve(secondPlayer), false);
  assert.equal(registry.reserve(secondVehicle), false);

  registry.release(first);
  assert.equal(registry.reserve(secondPlayer), true);
});
