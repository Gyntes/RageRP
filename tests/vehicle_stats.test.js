const test = require('node:test');
const assert = require('node:assert/strict');
const stats = require('../server/resources/ragerp/vehicle_stats');

test('odometer and dirt are saved additively for supported vehicle models', () => {
  const account = { unrelatedSetting: true };
  const blista = stats.statsForAccount(account, 'blista');
  stats.addDistance(blista, 1250);
  const bmw = stats.statsForAccount(account, 'bmwm5g90');
  stats.addDistance(bmw, 500);

  assert.equal(blista.odometerKm, 1.25);
  assert.equal(blista.dirtLevel, 1.25);
  assert.equal(bmw.odometerKm, 0.5);
  assert.equal(bmw.dirtLevel, 0.5);
  assert.equal(stats.statsForAccount(account, 'blista').odometerKm, 1.25);
  assert.equal(account.unrelatedSetting, true);
});

test('maintenance statistics are independent by personal vehicle ID', () => {
  const account = {};
  const first = stats.statsForAccount(account, '2103', 'vehicle-one');
  const second = stats.statsForAccount(account, '2103', 'vehicle-two');
  stats.addDistance(first, 1500);

  assert.equal(first.odometerKm, 1.5);
  assert.equal(second.odometerKm, 0);
  assert.notEqual(first, second);
});

test('distance updates ignore invalid input and clamp dirt at the GTA maximum', () => {
  const account = {};
  const vehicle = stats.statsForAccount(account, 'blista');
  assert.equal(stats.addDistance(vehicle, -1), null);
  assert.equal(stats.addDistance(vehicle, NaN), null);

  stats.addDistance(vehicle, 20000);
  assert.equal(vehicle.odometerKm, 20);
  assert.equal(vehicle.dirtLevel, stats.MAX_DIRT_LEVEL);
  assert.equal(stats.statsForAccount(account, 'adder'), null);
});

test('distance measurement rejects malformed coordinates', () => {
  assert.equal(stats.distanceMeters({ x: 0, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), 5);
  assert.equal(stats.distanceMeters({ x: NaN, y: 0, z: 0 }, { x: 3, y: 4, z: 0 }), null);
});

test('car wash validation and quote use the configured location and price', () => {
  const wash = stats.CAR_WASHES[0];
  assert.equal(stats.isNearCarWash(wash), true);
  assert.equal(stats.isNearCarWash({ x: 0, y: 0, z: 0 }), false);
  assert.deepEqual(stats.washQuote(500), { cost: 500, affordable: true });
  assert.deepEqual(stats.washQuote(499), { cost: 500, affordable: false });
  assert.equal(stats.washQuote(NaN), null);
});
