const test = require('node:test');
const assert = require('node:assert/strict');
const PersonalVehicles = require('../server/resources/ragerp/personal-vehicles');

test('configured VAZ models can be purchased at their prices without payment substitution', () => {
  const quote = PersonalVehicles.purchaseQuote(
    'vaz2106',
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
      'vaz2106',
      [],
      'cash',
      { cash: 1000, bank: 200000 }
    ).error,
    'insufficient-funds'
  );
  assert.deepEqual(
    PersonalVehicles.purchaseQuote(
      'vaz2114',
      [],
      'cash',
      { cash: 600000 }
    ),
    {
      price: 502000,
      paymentMethod: 'cash',
      balanceAfter: 98000
    }
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
      'vaz2114',
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
  assert.equal(vehicle.model, 'ragerp_vaz2106');
  assert.equal(vehicle.name, 'ВАЗ-2106');
  assert.equal(vehicle.price, 155000);
  assert.deepEqual(vehicle.keyHolderStaticIds, []);
  assert.equal(vehicle.locked, false);
  assert.equal(vehicle.trunkInventory.slots.length, 24);
});

test('VAZ-2114 purchases create records with the custom model and catalogue price', () => {
  const vehicle = PersonalVehicles.createVehicleRecord(
    'b'.repeat(32),
    'B456CE',
    'vaz2114'
  );

  assert.equal(vehicle.model, 'ragerp_vaz2114');
  assert.equal(vehicle.name, 'ВАЗ-2114 «Самара»');
  assert.equal(vehicle.price, 502000);
  assert.equal(vehicle.region, '97');
  assert.deepEqual(vehicle.keyHolderStaticIds, []);
});

test('purchased-vehicle model validation accepts only configured models', () => {
  assert.equal(PersonalVehicles.isSupportedModel('ragerp_vaz2106'), true);
  assert.equal(PersonalVehicles.isSupportedModel('ragerp_vaz2114'), true);
  assert.equal(PersonalVehicles.canonicalModel('2103'), 'ragerp_vaz2106');
  assert.equal(PersonalVehicles.canonicalModel('vaz2114'), 'ragerp_vaz2114');
  assert.equal(PersonalVehicles.nameForModel('2103'), 'ВАЗ-2106');
  assert.equal(PersonalVehicles.nameForModel('vaz2114'), 'ВАЗ-2114 «Самара»');
  assert.equal(PersonalVehicles.isSupportedModel('oracle'), false);
  assert.equal(PersonalVehicles.getVehicleConfig('constructor'), null);
  assert.equal(PersonalVehicles.createVehicleRecord(
    'c'.repeat(32),
    'C789DE',
    'unknown'
  ).error, 'vehicle-not-purchasable');
});
