const test = require('node:test');
const assert = require('node:assert/strict');
const dealership = require('../server/resources/ragerp/dealership');

test('catalog contains 21 unique, priced vehicles with valid visible specifications', () => {
  assert.equal(dealership.VEHICLES.length, 21);
  assert.equal(new Set(dealership.VEHICLES.map((vehicle) => vehicle.id)).size, 21);

  dealership.VEHICLES.forEach((vehicle) => {
    assert.ok(vehicle.name);
    assert.ok(Number.isSafeInteger(vehicle.price) && vehicle.price > 0);
    assert.ok(Number.isInteger(vehicle.seats) && vehicle.seats > 0);
    ['maxSpeed', 'acceleration', 'braking', 'handling'].forEach((specification) => {
      assert.ok(Number.isFinite(vehicle[specification]));
    });
  });
});

test('opens the catalog only within the configured physical dealership and public dimension', () => {
  const position = dealership.DEALERSHIP_POSITION;
  assert.equal(dealership.isNearDealership(position, 0), true);
  assert.equal(dealership.isNearDealership({ x: position.x + 5.01, y: position.y, z: position.z }, 0), false);
  assert.equal(dealership.isNearDealership(position, 10), false);
  assert.equal(dealership.isNearDealership({ x: NaN, y: position.y, z: position.z }, 0), false);
});
