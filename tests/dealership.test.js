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

test('VAZ-2106 and VAZ-2114 replace the old Zhiga and Pyatnashka entries', () => {
  const vaz = dealership.VEHICLES.find((vehicle) => vehicle.id === 'vaz2106');
  assert.ok(vaz);
  assert.equal(vaz.name, 'ВАЗ-2106');
  assert.equal(vaz.model, 'ragerp_vaz2106');
  assert.equal(vaz.price, 155000);

  const samara = dealership.VEHICLES.find((vehicle) => vehicle.id === 'vaz2114');
  assert.ok(samara);
  assert.equal(samara.name, 'ВАЗ-2114 «Самара»');
  assert.equal(samara.model, 'ragerp_vaz2114');
  assert.equal(samara.price, 502000);

  assert.equal(dealership.VEHICLES.some((vehicle) => vehicle.id === 'zhiga-2105'), false);
  assert.equal(dealership.VEHICLES.some((vehicle) => vehicle.id === 'pyatnashka'), false);
});

test('opens the catalog only within the configured physical dealership and public dimension', () => {
  const position = dealership.DEALERSHIP_POSITION;
  assert.equal(dealership.isNearDealership(position, 0), true);
  assert.equal(dealership.isNearDealership({ x: position.x + 5.01, y: position.y, z: position.z }, 0), false);
  assert.equal(dealership.isNearDealership(position, 10), false);
  assert.equal(dealership.isNearDealership({ x: NaN, y: position.y, z: position.z }, 0), false);
});
