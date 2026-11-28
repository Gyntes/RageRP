const Inventory = require('./inventory');
const VehicleAccess = require('./vehicle-access');

const VEHICLE_CONFIGS = Object.freeze({
  vaz2106: Object.freeze({
    id: 'vaz2106',
    model: 'ragerp_vaz2106',
    name: 'ВАЗ-2106',
    price: 155000,
    region: '97'
  }),
  vaz2114: Object.freeze({
    id: 'vaz2114',
    model: 'ragerp_vaz2114',
    name: 'ВАЗ-2114 «Самара»',
    price: 502000,
    region: '97'
  })
});
const VEHICLE_ID = 'vaz2106';
const MODEL_ALIASES = Object.freeze({
  '2103': 'ragerp_vaz2106',
  vaz2114: 'ragerp_vaz2114'
});
const DEFAULT_VEHICLE = VEHICLE_CONFIGS[VEHICLE_ID];
const MODEL = DEFAULT_VEHICLE.model;
const NAME = DEFAULT_VEHICLE.name;
const PRICE = DEFAULT_VEHICLE.price;
const LIMIT = 5;
const REGION = DEFAULT_VEHICLE.region;
const PLATE_PATTERN = /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}$/;

function getVehicleConfig(vehicleId) {
  return typeof vehicleId === 'string' &&
    Object.prototype.hasOwnProperty.call(VEHICLE_CONFIGS, vehicleId)
    ? VEHICLE_CONFIGS[vehicleId]
    : null;
}

function canonicalModel(model) {
  const normalized = String(model || '').toLowerCase();
  return Object.prototype.hasOwnProperty.call(MODEL_ALIASES, normalized)
    ? MODEL_ALIASES[normalized]
    : normalized;
}

function isSupportedModel(model) {
  const selectedModel = canonicalModel(model);
  return Object.values(VEHICLE_CONFIGS).some((vehicle) => vehicle.model === selectedModel);
}

function nameForModel(model) {
  const selectedModel = canonicalModel(model);
  const vehicle = Object.values(VEHICLE_CONFIGS).find((entry) => entry.model === selectedModel);
  return vehicle ? vehicle.name : null;
}

function purchaseState(vehicles) {
  const count = Array.isArray(vehicles) ? vehicles.length : 0;
  return {
    count,
    limit: LIMIT,
    canPurchase: count < LIMIT
  };
}

function purchaseQuote(vehicleId, vehicles, paymentMethod, balances) {
  const vehicle = getVehicleConfig(vehicleId);
  if (!vehicle) return { error: 'vehicle-not-purchasable' };
  if (!Array.isArray(vehicles)) return { error: 'invalid-vehicle-list' };
  if (vehicles.length >= LIMIT) return { error: 'vehicle-limit' };
  if (paymentMethod !== 'cash' && paymentMethod !== 'bank') {
    return { error: 'invalid-payment-method' };
  }

  const balance = Number(balances && balances[paymentMethod]);
  if (!Number.isSafeInteger(balance) || balance < 0) {
    return { error: 'invalid-balance' };
  }
  if (balance < vehicle.price) return { error: 'insufficient-funds' };

  return {
    price: vehicle.price,
    paymentMethod,
    balanceAfter: balance - vehicle.price
  };
}

function createVehicleRecord(vehicleId, plate, catalogVehicleId) {
  const selectedVehicleId = catalogVehicleId === undefined ? VEHICLE_ID : catalogVehicleId;
  const vehicle = getVehicleConfig(selectedVehicleId);
  if (!vehicle) return { error: 'vehicle-not-purchasable' };
  if (!VehicleAccess.VEHICLE_ID_PATTERN.test(String(vehicleId || '')) ||
      !PLATE_PATTERN.test(String(plate || ''))) {
    return { error: 'invalid-vehicle-record' };
  }

  return {
    vehicleId,
    model: vehicle.model,
    name: vehicle.name,
    price: vehicle.price,
    plate,
    region: vehicle.region,
    keyHolderStaticIds: [],
    locked: false,
    trunkInventory: Inventory.createEmptyInventory()
  };
}

module.exports = {
  LIMIT,
  MODEL,
  NAME,
  PLATE_PATTERN,
  PRICE,
  REGION,
  VEHICLE_CONFIGS,
  VEHICLE_ID,
  canonicalModel,
  createVehicleRecord,
  getVehicleConfig,
  isSupportedModel,
  nameForModel,
  purchaseQuote,
  purchaseState
};
