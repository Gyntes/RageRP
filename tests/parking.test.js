const test = require('node:test');
const assert = require('node:assert/strict');
const parking = require('../server/resources/ragerp/parking');

const cityOrigin = { x: 215.76, y: -810.12, z: 30.73 };

test('chooses the nearest free parking spot', () => {
  const spot = parking.nearestFreeParkingSpot(cityOrigin, [], 0);
  assert.equal(spot.id, '479219415');
});

test('skips occupied spots but ignores vehicles in another dimension', () => {
  const nearest = parking.PARKING_SPOTS[0];
  const vehicles = [
    { x: nearest.x, y: nearest.y, z: nearest.z, dimension: 0 },
    { x: nearest.x, y: nearest.y, z: nearest.z, dimension: 10 }
  ];

  const spot = parking.nearestFreeParkingSpot(cityOrigin, vehicles, 0);
  assert.notEqual(spot.id, nearest.id);
});

test('returns no spot when every parking location is occupied', () => {
  const vehicles = parking.PARKING_SPOTS.map((spot) => ({
    x: spot.x,
    y: spot.y,
    z: spot.z,
    dimension: 0
  }));

  assert.equal(parking.nearestFreeParkingSpot(cityOrigin, vehicles, 0), null);
});

test('rejects invalid player positions', () => {
  assert.equal(parking.nearestFreeParkingSpot({ x: 0, y: 0 }, [], 0), null);
});

test('falls back to the nearest parking spot when all locations are occupied', () => {
  const vehicles = parking.PARKING_SPOTS.map((spot) => ({
    x: spot.x,
    y: spot.y,
    z: spot.z,
    dimension: 0
  }));

  const freeSpot = parking.nearestFreeParkingSpot(cityOrigin, vehicles, 0);
  const fallbackSpot = parking.nearestParkingSpot(cityOrigin);
  assert.equal(freeSpot, null);
  assert.equal(fallbackSpot.id, '479219415');
});
