const test = require('node:test');
const assert = require('node:assert/strict');
const PersonalVehicles = require('../server/resources/ragerp/personal-vehicles');

test('only the configured VAZ-2106 can be purchased and payment is not substituted', () => {
  const quote = PersonalVehicles.purchaseQuote(
    PersonalVehicles.VEHICLE_ID,
    [],
    'bank',
    { cash: 0, bank: 200000 }
  );
  assert.deepEqual(quote, {
    price: 155000,
    paymentMethod: 'bank',
    balanceAfter: 45000
  });
  assert.equal(
    PersonalVehicles.purchaseQuote(
      PersonalVehicles.VEHICLE_ID,
      [],
      'cash',
      { cash: 1000, bank: 200000 }
    ).error,
    'insufficient-funds'
  );
  assert.equal(
    PersonalVehicles.purchaseQuote('blista', [], 'cash', { cash: 200000 }).error,
    'vehicle-not-purchasable'
  );
});

test('purchase is blocked at the five-vehicle account limit', () => {
  const vehicles = Array.from({ length: PersonalVehicles.LIMIT }, (_, index) => ({
    vehicleId: String(index)
  }));
  assert.deepEqual(PersonalVehicles.purchaseState(vehicles), {
    count: 5,
    limit: 5,
    canPurchase: false
  });
  assert.equal(
    PersonalVehicles.purchaseQuote(
      PersonalVehicles.VEHICLE_ID,
      vehicles,
      'cash',
      { cash: 200000 }
    ).error,
    'vehicle-limit'
  );
});

test('purchased vehicle records start with owner-only access and an empty trunk', () => {
  const vehicle = PersonalVehicles.createVehicleRecord(
    'a'.repeat(32),
    'A123BC'
  );
  assert.equal(vehicle.model, '2103');
  assert.equal(vehicle.name, 'ВАЗ-2106');
  assert.equal(vehicle.price, 155000);
  assert.deepEqual(vehicle.keyHolderStaticIds, []);
  assert.equal(vehicle.locked, false);
  assert.equal(vehicle.trunkInventory.slots.length, 24);
});
