const Inventory = require('./inventory');
const VehicleAccess = require('./vehicle-access');

const VEHICLE_ID = 'vaz2106';
const MODEL = '2103';
const NAME = 'ВАЗ-2106';
const PRICE = 155000;
const LIMIT = 5;
const REGION = '97';
const PLATE_PATTERN = /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}$/;

function purchaseState(vehicles) {
  const count = Array.isArray(vehicles) ? vehicles.length : 0;
  return {
    count,
    limit: LIMIT,
    canPurchase: count < LIMIT
  };
}

function purchaseQuote(vehicleId, vehicles, paymentMethod, balances) {
  if (vehicleId !== VEHICLE_ID) return { error: 'vehicle-not-purchasable' };
  if (!Array.isArray(vehicles)) return { error: 'invalid-vehicle-list' };
  if (vehicles.length >= LIMIT) return { error: 'vehicle-limit' };
  if (paymentMethod !== 'cash' && paymentMethod !== 'bank') {
    return { error: 'invalid-payment-method' };
  }

  const balance = Number(balances && balances[paymentMethod]);
  if (!Number.isSafeInteger(balance) || balance < 0) {
    return { error: 'invalid-balance' };
  }
  if (balance < PRICE) return { error: 'insufficient-funds' };

  return {
    price: PRICE,
    paymentMethod,
    balanceAfter: balance - PRICE
  };
}

function createVehicleRecord(vehicleId, plate) {
  if (!VehicleAccess.VEHICLE_ID_PATTERN.test(String(vehicleId || '')) ||
      !PLATE_PATTERN.test(String(plate || ''))) {
    return { error: 'invalid-vehicle-record' };
  }

  return {
    vehicleId,
    model: MODEL,
    name: NAME,
    price: PRICE,
    plate,
    region: REGION,
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
  VEHICLE_ID,
  createVehicleRecord,
  purchaseQuote,
  purchaseState
};
