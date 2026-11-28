const MAX_ODOMETER_KM = 1000000000;
const MAX_DIRT_LEVEL = 15;
const DIRT_LEVELS_PER_KILOMETER = 1;
const MAX_TRACKED_SPEED_METERS_PER_SECOND = 120;
const CAR_WASH_RADIUS_METERS = 14;
const CAR_WASH_PRICE = 500;
const SUPPORTED_VEHICLE_MODELS = new Set([
  'blista',
  'bmwm5g90',
  'ragerp_vaz2106',
  'ragerp_vaz2114',
  '2103',
  'vaz2114'
]);

const CAR_WASHES = Object.freeze([
  { x: 25.72, y: -1391.91, z: 29.37 },
  { x: -699.81, y: -932.86, z: 19.01 }
]);

function isSupportedModel(model) {
  return SUPPORTED_VEHICLE_MODELS.has(String(model || '').toLowerCase());
}

function normalizedOdometer(value) {
  const odometerKm = Number(value);
  if (!Number.isFinite(odometerKm)) return 0;
  return Math.round(Math.max(0, Math.min(MAX_ODOMETER_KM, odometerKm)) * 10000) / 10000;
}

function normalizedDirt(value) {
  const dirtLevel = Number(value);
  if (!Number.isFinite(dirtLevel)) return 0;
  return Math.round(Math.max(0, Math.min(MAX_DIRT_LEVEL, dirtLevel)) * 10000) / 10000;
}

function statsForAccount(account, model, vehicleId) {
  if (!account || typeof account !== 'object' || !isSupportedModel(model)) return null;
  const storageField = vehicleId ? 'vehicleStatsById' : 'vehicleStatsByModel';
  if (!account[storageField] || typeof account[storageField] !== 'object' ||
      Array.isArray(account[storageField])) {
    account[storageField] = {};
  }

  const storageKey = vehicleId || model;
  let stats = account[storageField][storageKey];
  if (!stats || typeof stats !== 'object' || Array.isArray(stats)) {
    stats = {};
    account[storageField][storageKey] = stats;
  }
  stats.odometerKm = normalizedOdometer(stats.odometerKm);
  stats.dirtLevel = normalizedDirt(stats.dirtLevel);
  return stats;
}

function distanceMeters(first, second) {
  if (!first || !second) return null;
  const coordinates = [
    Number(first.x), Number(first.y), Number(first.z),
    Number(second.x), Number(second.y), Number(second.z)
  ];
  if (!coordinates.every(Number.isFinite)) return null;
  const [x1, y1, z1, x2, y2, z2] = coordinates;
  return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2 + (z2 - z1) ** 2);
}

function addDistance(stats, distance) {
  const meters = Number(distance);
  if (!stats || typeof stats !== 'object' || !Number.isFinite(meters) || meters <= 0) {
    return null;
  }

  const distanceKm = meters / 1000;
  stats.odometerKm = normalizedOdometer(normalizedOdometer(stats.odometerKm) + distanceKm);
  stats.dirtLevel = normalizedDirt(
    normalizedDirt(stats.dirtLevel) + distanceKm * DIRT_LEVELS_PER_KILOMETER
  );
  return stats;
}

function setDirtLevel(stats, value) {
  if (!stats || typeof stats !== 'object') return null;
  stats.dirtLevel = normalizedDirt(value);
  return stats.dirtLevel;
}

function isNearCarWash(position, radius) {
  const allowedRadius = Number.isFinite(Number(radius))
    ? Math.max(0, Number(radius))
    : CAR_WASH_RADIUS_METERS;
  const radiusSquared = allowedRadius * allowedRadius;
  return CAR_WASHES.some((wash) => {
    const distance = distanceMeters(position, wash);
    return distance !== null && distance * distance <= radiusSquared;
  });
}

function washQuote(cash) {
  const availableCash = Number(cash);
  if (!Number.isSafeInteger(availableCash) || availableCash < 0) return null;
  return {
    cost: CAR_WASH_PRICE,
    affordable: availableCash >= CAR_WASH_PRICE
  };
}

module.exports = {
  MAX_ODOMETER_KM,
  MAX_DIRT_LEVEL,
  DIRT_LEVELS_PER_KILOMETER,
  MAX_TRACKED_SPEED_METERS_PER_SECOND,
  CAR_WASH_RADIUS_METERS,
  CAR_WASH_PRICE,
  CAR_WASHES,
  isSupportedModel,
  normalizedOdometer,
  normalizedDirt,
  statsForAccount,
  distanceMeters,
  addDistance,
  setDirtLevel,
  isNearCarWash,
  washQuote
};
