const DEFAULT_FUEL_PERCENT = 100;
const MAX_FUEL_PERCENT = 100;
const FUEL_CONSUMPTION_PERCENT_PER_MINUTE = 0.45;
const REFUEL_PRICE_PER_PERCENT = 25;
const GAS_STATION_RADIUS_METERS = 14;
const SUPPORTED_VEHICLE_MODELS = new Set(['blista', 'bmwm5g90', '2103']);

const GAS_STATIONS = Object.freeze([
  { x: 49.42, y: 2778.79, z: 58.04 },
  { x: 263.89, y: 2606.46, z: 44.98 },
  { x: 1039.96, y: 2671.13, z: 39.55 },
  { x: 1207.26, y: 2660.18, z: 37.90 },
  { x: 2539.69, y: 2594.19, z: 37.94 },
  { x: 2679.86, y: 3263.95, z: 55.24 },
  { x: 2005.06, y: 3773.89, z: 32.40 },
  { x: 1687.16, y: 4929.39, z: 42.08 },
  { x: 1701.31, y: 6416.03, z: 32.76 },
  { x: 179.86, y: 6602.84, z: 31.87 },
  { x: -94.46, y: 6419.59, z: 31.49 },
  { x: -2555.00, y: 2334.40, z: 33.08 },
  { x: -1800.38, y: 803.66, z: 138.65 },
  { x: -1437.62, y: -276.75, z: 46.21 },
  { x: -2096.24, y: -320.29, z: 13.17 },
  { x: -724.62, y: -935.16, z: 19.21 },
  { x: -526.02, y: -1211.00, z: 18.18 },
  { x: -70.21, y: -1761.79, z: 29.53 },
  { x: 265.65, y: -1261.31, z: 29.29 },
  { x: 819.65, y: -1028.85, z: 26.40 },
  { x: 1208.95, y: -1402.57, z: 35.22 },
  { x: 1181.38, y: -330.85, z: 69.32 },
  { x: 620.84, y: 269.10, z: 103.09 },
  { x: 2581.32, y: 362.04, z: 108.47 }
]);

function isSupportedModel(model) {
  return SUPPORTED_VEHICLE_MODELS.has(String(model || '').toLowerCase());
}

function isAccountOwner(accountKey, vehicleOwnerAccountKey) {
  return typeof accountKey === 'string' &&
    accountKey.length > 0 &&
    accountKey === vehicleOwnerAccountKey;
}

function normalizeFuel(value) {
  const fuel = Number(value);
  if (!Number.isFinite(fuel)) return DEFAULT_FUEL_PERCENT;
  return Math.round(Math.max(0, Math.min(MAX_FUEL_PERCENT, fuel)) * 10000) / 10000;
}

function fuelForAccount(account, model, vehicleId) {
  if (!account || typeof account !== 'object' || !isSupportedModel(model)) {
    return DEFAULT_FUEL_PERCENT;
  }
  const storageField = vehicleId ? 'vehicleFuelById' : 'vehicleFuelByModel';
  if (!account[storageField] || typeof account[storageField] !== 'object' ||
      Array.isArray(account[storageField])) {
    account[storageField] = {};
  }

  const storageKey = vehicleId || model;
  const stored = account[storageField][storageKey];
  const fuel = stored === undefined ? DEFAULT_FUEL_PERCENT : normalizeFuel(stored);
  account[storageField][storageKey] = fuel;
  return fuel;
}

function setFuelForAccount(account, model, value, vehicleId) {
  if (!account || typeof account !== 'object' || !isSupportedModel(model)) return null;
  fuelForAccount(account, model, vehicleId);
  const fuel = normalizeFuel(value);
  const storageField = vehicleId ? 'vehicleFuelById' : 'vehicleFuelByModel';
  account[storageField][vehicleId || model] = fuel;
  return fuel;
}

function consumeFuel(value, elapsedMs, engineRunning) {
  const fuel = normalizeFuel(value);
  const elapsed = Number(elapsedMs);
  if (engineRunning !== true || !Number.isFinite(elapsed) || elapsed <= 0) return fuel;

  const consumed = FUEL_CONSUMPTION_PERCENT_PER_MINUTE * elapsed / 60000;
  return Math.round(Math.max(0, fuel - consumed) * 10000) / 10000;
}

function distanceSquared(first, second) {
  if (!first || !second) return Infinity;
  const x1 = Number(first.x);
  const y1 = Number(first.y);
  const z1 = Number(first.z);
  const x2 = Number(second.x);
  const y2 = Number(second.y);
  const z2 = Number(second.z);
  if (![x1, y1, z1, x2, y2, z2].every(Number.isFinite)) return Infinity;
  return (x1 - x2) ** 2 + (y1 - y2) ** 2 + (z1 - z2) ** 2;
}

function isNearGasStation(position, radius) {
  const allowedRadius = Number.isFinite(Number(radius))
    ? Math.max(0, Number(radius))
    : GAS_STATION_RADIUS_METERS;
  const radiusSquared = allowedRadius * allowedRadius;
  return GAS_STATIONS.some((station) => distanceSquared(position, station) <= radiusSquared);
}

function refillQuote(value, cash) {
  const fuel = normalizeFuel(value);
  const availableCash = Number(cash);
  if (!Number.isSafeInteger(availableCash) || availableCash < 0) return null;
  const amount = Math.round((MAX_FUEL_PERCENT - fuel) * 100) / 100;
  const cost = Math.ceil(amount * REFUEL_PRICE_PER_PERCENT);
  return { amount, cost, affordable: availableCash >= cost };
}

module.exports = {
  DEFAULT_FUEL_PERCENT,
  MAX_FUEL_PERCENT,
  FUEL_CONSUMPTION_PERCENT_PER_MINUTE,
  REFUEL_PRICE_PER_PERCENT,
  GAS_STATION_RADIUS_METERS,
  GAS_STATIONS,
  isSupportedModel,
  isAccountOwner,
  normalizeFuel,
  fuelForAccount,
  setFuelForAccount,
  consumeFuel,
  isNearGasStation,
  refillQuote
};
