const Inventory = require('./inventory');

const TRUNK_CAPACITY_WEIGHT = 100;
const STATIC_ID_PATTERN = /^\d{3}-\d{3}$/;
const VEHICLE_ID_PATTERN = /^[a-f0-9]{32}$/;

class TheftAttemptRegistry {
  constructor() {
    this.byVehicle = new Map();
    this.byPlayer = new Map();
  }

  reserve(attempt) {
    if (!attempt || typeof attempt.vehicleId !== 'string' ||
        !Number.isSafeInteger(attempt.playerId) ||
        this.byVehicle.has(attempt.vehicleId) || this.byPlayer.has(attempt.playerId)) {
      return false;
    }
    this.byVehicle.set(attempt.vehicleId, attempt);
    this.byPlayer.set(attempt.playerId, attempt);
    return true;
  }

  getByVehicle(vehicleId) {
    return this.byVehicle.get(vehicleId) || null;
  }

  getByPlayer(playerId) {
    return this.byPlayer.get(playerId) || null;
  }

  release(attempt) {
    if (!attempt) return;
    if (this.byVehicle.get(attempt.vehicleId) === attempt) {
      this.byVehicle.delete(attempt.vehicleId);
    }
    if (this.byPlayer.get(attempt.playerId) === attempt) {
      this.byPlayer.delete(attempt.playerId);
    }
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function normalizeVehicleRecord(value, ownerStaticId, createVehicleId) {
  if (!isRecord(value) || typeof createVehicleId !== 'function') {
    return { error: 'invalid-vehicle' };
  }

  const vehicle = Object.assign({}, value);
  if (!VEHICLE_ID_PATTERN.test(String(vehicle.vehicleId || ''))) {
    vehicle.vehicleId = createVehicleId();
  }

  const keyHolderStaticIds = [];
  const seen = new Set([ownerStaticId]);
  if (Array.isArray(vehicle.keyHolderStaticIds)) {
    vehicle.keyHolderStaticIds.forEach((staticId) => {
      if (typeof staticId !== 'string' || !STATIC_ID_PATTERN.test(staticId) ||
          seen.has(staticId)) return;
      seen.add(staticId);
      keyHolderStaticIds.push(staticId);
    });
  }
  vehicle.keyHolderStaticIds = keyHolderStaticIds;
  vehicle.locked = typeof vehicle.locked === 'boolean' ? vehicle.locked : false;
  vehicle.trunkInventory = Inventory.normalizeInventory(vehicle.trunkInventory);

  return {
    vehicle,
    changed: JSON.stringify(value) !== JSON.stringify(vehicle)
  };
}

function hasKey(vehicle, ownerStaticId, playerStaticId) {
  if (!vehicle || typeof playerStaticId !== 'string') return false;
  if (playerStaticId === ownerStaticId) return true;
  return Array.isArray(vehicle.keyHolderStaticIds) &&
    vehicle.keyHolderStaticIds.includes(playerStaticId);
}

function grantKey(vehicle, ownerStaticId, targetStaticId) {
  if (!vehicle || typeof vehicle !== 'object' ||
      typeof targetStaticId !== 'string' || !STATIC_ID_PATTERN.test(targetStaticId)) {
    return { error: 'invalid-target' };
  }
  if (targetStaticId === ownerStaticId) return { error: 'owner-already-has-key' };

  const keyHolderStaticIds = Array.isArray(vehicle.keyHolderStaticIds)
    ? vehicle.keyHolderStaticIds.slice()
    : [];
  if (keyHolderStaticIds.includes(targetStaticId)) return { error: 'already-granted' };

  keyHolderStaticIds.push(targetStaticId);
  return { vehicle: Object.assign({}, vehicle, { keyHolderStaticIds }) };
}

function revokeKey(vehicle, targetStaticId) {
  if (!vehicle || !Array.isArray(vehicle.keyHolderStaticIds)) {
    return { error: 'not-granted' };
  }
  if (!vehicle.keyHolderStaticIds.includes(targetStaticId)) return { error: 'not-granted' };

  return {
    vehicle: Object.assign({}, vehicle, {
      keyHolderStaticIds: vehicle.keyHolderStaticIds.filter((staticId) =>
        staticId !== targetStaticId
      )
    })
  };
}

function resolveTheftOutcome(successRoll, breakRoll, settings) {
  const config = settings || {};
  const successChance = Number(config.successChance);
  const breakChance = Number(config.breakChanceOnFailure);
  if (!Number.isFinite(successRoll) || successRoll < 0 || successRoll >= 1 ||
      !Number.isFinite(breakRoll) || breakRoll < 0 || breakRoll >= 1 ||
      !Number.isFinite(successChance) || successChance < 0 || successChance > 1 ||
      !Number.isFinite(breakChance) || breakChance < 0 || breakChance > 1) {
    return { error: 'invalid-settings' };
  }

  const success = successRoll < successChance;
  return {
    success,
    lockpickBroken: !success && breakRoll < breakChance
  };
}

function shouldAlertPolice(stage, roll, settings) {
  const config = settings || {};
  const chance = Number(config.chance);
  return config.enabled === true &&
    Array.isArray(config.stages) &&
    config.stages.includes(stage) &&
    Number.isFinite(chance) && chance > 0 && chance <= 1 &&
    Number.isFinite(roll) && roll >= 0 && roll < chance;
}

module.exports = {
  STATIC_ID_PATTERN,
  TheftAttemptRegistry,
  TRUNK_CAPACITY_WEIGHT,
  VEHICLE_ID_PATTERN,
  grantKey,
  hasKey,
  normalizeVehicleRecord,
  resolveTheftOutcome,
  revokeKey,
  shouldAlertPolice
};
