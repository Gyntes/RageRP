const test = require('node:test');
const assert = require('node:assert/strict');
const fuel = require('../server/resources/ragerp/vehicle_fuel');
const dashboardLogic = require('../server/client_packages/ragerp/dashboard/logic');

test('fuel is stored additively by supported vehicle model', () => {
  const account = { character: { cash: 5000 }, unrelatedSetting: true };
  assert.equal(fuel.fuelForAccount(account, 'blista'), 100);
  assert.equal(account.vehicleFuelByModel.blista, 100);

  fuel.setFuelForAccount(account, 'blista', 42.128);
  fuel.setFuelForAccount(account, 'bmwm5g90', 76);
  assert.equal(fuel.fuelForAccount(account, 'blista'), 42.128);
  assert.equal(fuel.fuelForAccount(account, 'bmwm5g90'), 76);
  assert.equal(account.character.cash, 5000);
  assert.equal(account.unrelatedSetting, true);
});

test('fuel is stored independently by personal vehicle ID', () => {
  const account = {};
  fuel.setFuelForAccount(account, '2103', 40, 'vehicle-one');
  fuel.setFuelForAccount(account, '2103', 75, 'vehicle-two');

  assert.equal(fuel.fuelForAccount(account, '2103', 'vehicle-one'), 40);
  assert.equal(fuel.fuelForAccount(account, '2103', 'vehicle-two'), 75);
  assert.equal(fuel.fuelForAccount(account, '2103'), 100);
});

test('fuel values are bounded and unsupported models are not persisted', () => {
  const account = {};
  assert.equal(fuel.setFuelForAccount(account, 'blista', -5), 0);
  assert.equal(fuel.setFuelForAccount(account, 'bmwm5g90', 120), 100);
  assert.equal(fuel.setFuelForAccount(account, 'adder', 30), null);
  assert.equal(Object.prototype.hasOwnProperty.call(account.vehicleFuelByModel, 'adder'), false);
});

test('only the account owner may refuel a tracked vehicle', () => {
  assert.equal(fuel.isAccountOwner('account-1', 'account-1'), true);
  assert.equal(fuel.isAccountOwner('account-2', 'account-1'), false);
  assert.equal(fuel.isAccountOwner(undefined, 'account-1'), false);
});

test('engine use consumes fuel at the named rate while idling or driving', () => {
  assert.equal(fuel.consumeFuel(50, 60000, true), 49.55);
  assert.equal(fuel.consumeFuel(100, 1000, true), 99.9925);
  assert.equal(fuel.consumeFuel(50, 60000, false), 50);
  assert.equal(fuel.consumeFuel(0.1, 60000, true), 0);
  assert.equal(fuel.consumeFuel(50, -1000, true), 50);
});

test('Check Engine threshold includes exactly half engine health', () => {
  assert.equal(dashboardLogic.isCheckEngineRequired(500), true);
  assert.equal(dashboardLogic.isCheckEngineRequired(499.9), true);
  assert.equal(dashboardLogic.isCheckEngineRequired(500.1), false);
  assert.equal(dashboardLogic.isCheckEngineRequired(1000), false);
});

test('odometer uses a zero-padded kilometer display with one decimal place', () => {
  assert.equal(dashboardLogic.formatOdometer(73.4), '0000073.4');
  assert.equal(dashboardLogic.formatOdometer(0), '0000000.0');
  assert.equal(dashboardLogic.formatOdometer(-1), '0000000.0');
});

test('refill station validation uses bounded GTA gas-station locations', () => {
  assert.equal(fuel.isNearGasStation({ x: -70.21, y: -1761.79, z: 29.53 }), true);
  assert.equal(fuel.isNearGasStation({ x: -70.21, y: -1761.79, z: 29.53 }, 1), true);
  assert.equal(fuel.isNearGasStation({ x: -70.21, y: -1761.79, z: 80 }), false);
  assert.equal(fuel.isNearGasStation({ x: 0, y: 0 }), false);
});

test('refill quote charges only for missing fuel and rejects invalid balances', () => {
  assert.deepEqual(fuel.refillQuote(60, 1000), {
    amount: 40,
    cost: 1000,
    affordable: true
  });
  assert.equal(fuel.refillQuote(60, 999).affordable, false);
  assert.deepEqual(fuel.refillQuote(100, 0), {
    amount: 0,
    cost: 0,
    affordable: true
  });
  assert.equal(fuel.refillQuote(30, NaN), null);
  assert.equal(fuel.refillQuote(30, 1000.5), null);
});
