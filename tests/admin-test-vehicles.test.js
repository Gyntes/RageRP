const test = require('node:test');
const assert = require('node:assert/strict');
const AdminTestVehicles = require('../server/resources/ragerp/admin-test-vehicles');

test('admin test vehicle lookup only accepts supported model IDs', () => {
  assert.deepEqual(AdminTestVehicles.getSupportedModelIds(), [
    'blista',
    'bmwm5g90',
    'ragerp_vaz2106',
    'ragerp_vaz2114'
  ]);
  assert.equal(AdminTestVehicles.getVehicle(' RAGERP_VAZ2106 ').name, 'ВАЗ-2106');
  assert.equal(AdminTestVehicles.getVehicle('2103'), null);
  assert.equal(AdminTestVehicles.getVehicle('adder'), null);
  assert.equal(AdminTestVehicles.getVehicle('toString'), null);
});

test('admin test vehicle spawn position is five metres ahead of the player', () => {
  assert.deepEqual(
    AdminTestVehicles.spawnPosition({ x: 10, y: 25, z: 30 }, 0),
    { x: 10, y: 30, z: 30.3 }
  );

  const eastFacing = AdminTestVehicles.spawnPosition({ x: 10, y: 25, z: 30 }, 90);
  assert.ok(Math.abs(eastFacing.x - 5) < 1e-10);
  assert.ok(Math.abs(eastFacing.y - 25) < 1e-10);
  assert.equal(eastFacing.z, 30.3);
  assert.equal(AdminTestVehicles.spawnPosition({ x: 0, y: 0, z: 0 }, Infinity), null);
});
