const test = require('node:test');
const assert = require('node:assert/strict');
const VehiclePassport = require('../server/resources/ragerp/vehicle-passport');

test('lists only valid players within three metres in the same dimension', () => {
  const origin = {
    staticId: '111-111',
    dimension: 0,
    x: 0,
    y: 0,
    z: 0
  };
  const targets = VehiclePassport.targetsWithinShareRange(origin, [
    { staticId: '111-111', name: 'Owner', dimension: 0, x: 0, y: 0, z: 0 },
    { staticId: '222-222', name: 'Nearby', dimension: 0, x: 1, y: 2, z: 0 },
    { staticId: '333-333', name: 'At range', dimension: 0, x: 3, y: 0, z: 0 },
    { staticId: '444-444', name: 'Too far', dimension: 0, x: 3.01, y: 0, z: 0 },
    { staticId: '555-555', name: 'Other dimension', dimension: 1, x: 0, y: 0, z: 0 },
    { staticId: 'invalid', name: 'Invalid ID', dimension: 0, x: 0, y: 0, z: 0 }
  ]);

  assert.deepEqual(targets.map((target) => target.staticId), ['222-222', '333-333']);
});

test('rejects invalid origin and excludes candidates with invalid positions', () => {
  assert.deepEqual(VehiclePassport.targetsWithinShareRange({ x: 0, y: 0 }, []), []);
  assert.deepEqual(VehiclePassport.targetsWithinShareRange(
    { staticId: '111-111', dimension: 0, x: 0, y: 0, z: 0 },
    [{ staticId: '222-222', dimension: 0, x: 0, y: 'invalid', z: 0 }]
  ), []);
});
