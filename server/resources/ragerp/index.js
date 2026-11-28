const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Inventory = require('./inventory');
const Parking = require('./parking');
const Dealership = require('./dealership');
const Voice = require('./voice');
const Admin = require('./admin');
const VehiclePassport = require('./vehicle-passport');
const VehicleFuel = require('./vehicle_fuel');
const VehicleStats = require('./vehicle_stats');
const VehicleAccess = require('./vehicle-access');
const VehicleTheftConfig = require('./vehicle-theft.config');
const PersonalVehicles = require('./personal-vehicles');

const dataDirectory = path.join(__dirname, 'data');
const accountsFile = path.join(dataDirectory, 'accounts.json');
const sessions = new Map();
const workCooldowns = new Map();
const previewUpdates = new Map();
const previewGenders = new Map();
const rotationUpdates = new Map();
const openPhones = new Set();
const openInventories = new Set();
const openDealerships = new Set();
const inventoryActionCooldowns = new Map();
const phoneMessageCooldowns = new Map();
const phoneAdCooldowns = new Map();
const taxiRequestCooldowns = new Map();
const vehicleCallCooldowns = new Map();
const vehiclePassportShareRequests = new Map();
const vehiclePassportShareCooldowns = new Map();
const phoneCallCooldowns = new Map();
const vehicleLockCooldowns = new Map();
const spawnedStarterVehicles = new Map();
const spawnedPurchasedVehicles = new Map();
const adminTestVehicles = new Map();
const vehicleFuelRecords = new WeakMap();
const trackedFuelVehicles = new Map();
const vehicleFuelDisplayStates = new Map();
const vehicleRefuelCooldowns = new Map();
const vehicleStatsRequestCooldowns = new Map();
const vehicleSignalCooldowns = new Map();
const openVehicleTrunks = new Map();
const vehicleTrunkUsers = new Map();
const vehicleDoorStates = new Map();
const theftAttemptRegistry = new VehicleAccess.TheftAttemptRegistry();
const hotwiredVehicles = new Map();
const hudNotifications = new Map();
const playtimeCheckpointAt = new Map();
const voiceRouteStates = new Map();
const phoneCalls = new Map();
const phoneCallByPlayer = new Map();
const adminFrozenPlayers = new Map();
const phoneAds = [];
const taxiCalls = [];
let taxiCallSequence = 0;
let phoneCallSequence = 0;
let hudNotificationSequence = 0;
const voiceProximityRange = 15;
const phoneCallTimeoutMs = 30000;
const vehiclePassportRequestTimeoutMs = 30000;
let vehiclePassportRequestSequence = 0;
const vehicleAccountsSaveIntervalMs = 30000;
const starterVehicleModel = 'blista';
const starterVehicleName = 'Blista';
const starterVehicleRegion = '97';
const russianPlateLetters = 'ABEKMHOPCTYX';
const spawnPoint = { x: 215.76, y: -810.12, z: 30.73 };
const mapTestPoint = { x: 215.76, y: -810.12, z: 30.73 };
const registrationPoint = { x: 402.8664, y: -996.4108, z: -99.0 };
const registrationDimensionOffset = 100000;
const workPay = 500;
const workCooldownMs = 60 * 1000;
const allowedGenders = new Set(['male', 'female']);
const validRussianName = /^[А-ЯЁа-яё]{2,20}$/;
const allowedFactions = new Map([
  ['civilian', 'Civilian'],
  ['mechanic', 'Mechanic']
]);
const justiceAdminStaticIds = new Set(
  String(process.env.RAGERP_JUSTICE_ADMIN_IDS || '')
    .split(',')
    .map((staticId) => staticId.trim())
    .filter((staticId) => /^\d{3}-\d{3}$/.test(staticId))
);
const inventoryAdminStaticIds = new Set(
  String(process.env.RAGERP_INVENTORY_ADMIN_IDS || '')
    .split(',')
    .map((staticId) => staticId.trim())
    .filter((staticId) => /^\d{3}-\d{3}$/.test(staticId))
);
const adminStaticIds = new Set([
  '163-269',
  ...String(process.env.RAGERP_ADMIN_IDS || '')
    .split(',')
    .map((staticId) => staticId.trim())
    .filter((staticId) => /^\d{3}-\d{3}$/.test(staticId))
]);

fs.mkdirSync(dataDirectory, { recursive: true });

function loadAccounts() {
  try {
    const accounts = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
    if (accounts === null || Array.isArray(accounts) || typeof accounts !== 'object') {
      throw new Error('Account data must be a JSON object.');
    }

    return accounts;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return Object.create(null);
    }

    throw error;
  }
}

const accounts = loadAccounts();
let lastFuelAccountsSaveAt = Date.now();
let vehicleAccountsDirty = false;
let vehicleMigrationBackupCreated = false;

function saveAccounts() {
  const temporaryFile = `${accountsFile}.tmp`;
  fs.writeFileSync(temporaryFile, JSON.stringify(accounts, null, 2), 'utf8');
  fs.renameSync(temporaryFile, accountsFile);
}

function backupAccountsBeforeVehicleMigration() {
  if (vehicleMigrationBackupCreated || !fs.existsSync(accountsFile)) return;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(dataDirectory, `accounts-vehicle-migration-${stamp}.json`);
  fs.copyFileSync(accountsFile, backupFile);
  vehicleMigrationBackupCreated = true;
}

function registerVehicleFuel(vehicle, accountKey, model, personalVehicleId) {
  if (!vehicle || !accountKey || !VehicleFuel.isSupportedModel(model)) return null;
  const account = accounts[accountKey];
  if (!account) return null;
  const now = Date.now();
  const record = {
    accountKey,
    model,
    vehicleId: personalVehicleId || null,
    fuel: VehicleFuel.fuelForAccount(account, model, personalVehicleId),
    stats: VehicleStats.statsForAccount(account, model, personalVehicleId),
    lastEngineTickAt: now,
    lastPosition: isValidPosition(vehicle.position)
      ? {
          x: Number(vehicle.position.x),
          y: Number(vehicle.position.y),
          z: Number(vehicle.position.z),
          dimension: vehicle.dimension
        }
      : null,
    lastPositionAt: now,
    signals: { left: false, right: false, hazards: false }
  };
  vehicleFuelRecords.set(vehicle, record);
  trackedFuelVehicles.set(vehicle, record);
  broadcastVehicleDirt(vehicle, record);
  if (record.fuel <= 0) vehicle.engine = false;
  return record;
}

function unregisterVehicleFuel(vehicle) {
  if (!vehicle) return;
  vehicleFuelRecords.delete(vehicle);
  trackedFuelVehicles.delete(vehicle);
}

function vehicleFuelPayload(vehicle, record) {
  return {
    fuel: record.fuel,
    engineOn: vehicle.engine === true,
    model: record.model,
    odometerKm: record.stats.odometerKm,
    dirtLevel: record.stats.dirtLevel
  };
}

function sendVehicleFuel(player, vehicle, record) {
  if (!player || !vehicle || !record) return;
  player.call('ragerp:vehicle:fuel:update', [
    vehicle.id,
    JSON.stringify(vehicleFuelPayload(vehicle, record))
  ]);
}

function broadcastVehicleDirt(vehicle, record) {
  mp.players.forEach((observer) => {
    if (observer.dimension !== vehicle.dimension) return;
    observer.call('ragerp:vehicle:dirt:update', [vehicle.id, record.stats.dirtLevel]);
  });
}

function broadcastVehicleSignals(vehicle, record) {
  const payload = JSON.stringify(record.signals);
  mp.players.forEach((observer) => {
    observer.call('ragerp:vehicle:signals:update', [vehicle.id, payload]);
  });
}

function updateVehicleFuel() {
  const now = Date.now();
  trackedFuelVehicles.forEach((record, vehicle) => {
    if (!mp.vehicles.exists(vehicle)) {
      unregisterVehicleFuel(vehicle);
      return;
    }

    const currentPosition = isValidPosition(vehicle.position)
      ? {
          x: Number(vehicle.position.x),
          y: Number(vehicle.position.y),
          z: Number(vehicle.position.z),
          dimension: vehicle.dimension
        }
      : null;
    const positionElapsedMs = Math.max(0, now - record.lastPositionAt);
    const previousPosition = record.lastPosition;
    record.lastPosition = currentPosition;
    record.lastPositionAt = now;
    if (vehicle.engine === true && currentPosition && previousPosition &&
        currentPosition.dimension === previousPosition.dimension && positionElapsedMs > 0) {
      const distance = VehicleStats.distanceMeters(previousPosition, currentPosition);
      const maxDistance = VehicleStats.MAX_TRACKED_SPEED_METERS_PER_SECOND *
        positionElapsedMs / 1000;
      if (distance !== null && distance > 0 && distance <= maxDistance) {
        const previousDirtDecile = Math.floor(record.stats.dirtLevel * 10);
        VehicleStats.addDistance(record.stats, distance);
        vehicleAccountsDirty = true;
        const dirtDecile = Math.floor(record.stats.dirtLevel * 10);
        if (dirtDecile !== previousDirtDecile) {
          broadcastVehicleDirt(vehicle, record);
        }
      }
    }

    const elapsed = Math.max(0, now - record.lastEngineTickAt);
    record.lastEngineTickAt = now;
    if (vehicle.engine !== true || elapsed === 0) return;

    const previousFuel = record.fuel;
    record.fuel = VehicleFuel.consumeFuel(record.fuel, elapsed, true);
    if (record.fuel === previousFuel) return;
    const account = accounts[record.accountKey];
    if (!account) return;
    VehicleFuel.setFuelForAccount(account, record.model, record.fuel, record.vehicleId);
    vehicleAccountsDirty = true;
    if (record.fuel <= 0) {
      vehicle.engine = false;
      mp.players.forEach((driver) => {
        if (driver.vehicle === vehicle && driver.seat === -1) {
          message(driver, 'Топливо закончилось. Заправь автомобиль на АЗС.');
          vehicleFuelDisplayStates.delete(driver.id);
        }
      });
    }
  });

  mp.players.forEach((player) => {
    const vehicle = player.vehicle;
    if (!vehicle || !mp.vehicles.exists(vehicle)) {
      vehicleFuelDisplayStates.delete(player.id);
      return;
    }

    const record = vehicleFuelRecords.get(vehicle);
    if (!record || player.dimension !== vehicle.dimension) {
      vehicleFuelDisplayStates.delete(player.id);
      return;
    }

    const previousDisplay = vehicleFuelDisplayStates.get(player.id);
    const fuelRounded = Math.round(record.fuel);
    const engineOn = vehicle.engine === true;
    const odometerTenths = Math.round(record.stats.odometerKm * 10);
    const dirtDecile = Math.floor(record.stats.dirtLevel * 10);
    if (!previousDisplay || previousDisplay.vehicle !== vehicle ||
        previousDisplay.fuel !== fuelRounded || previousDisplay.engineOn !== engineOn ||
        previousDisplay.odometerTenths !== odometerTenths ||
        previousDisplay.dirtDecile !== dirtDecile) {
      sendVehicleFuel(player, vehicle, record);
      if (!previousDisplay || previousDisplay.vehicle !== vehicle) {
        player.call('ragerp:vehicle:signals:update', [
          vehicle.id,
          JSON.stringify(record.signals)
        ]);
      }
      vehicleFuelDisplayStates.set(player.id, {
        vehicle,
        fuel: fuelRounded,
        engineOn,
        odometerTenths,
        dirtDecile
      });
    }

  });

  if (vehicleAccountsDirty && now - lastFuelAccountsSaveAt >= vehicleAccountsSaveIntervalMs) {
    try {
      saveAccounts();
      lastFuelAccountsSaveAt = now;
      vehicleAccountsDirty = false;
    } catch (error) {
      console.error('[RageRP vehicle] Could not persist vehicle state:', error);
    }
  }
}

const adminInitialization = Admin.initialize({
  dataDirectory,
  accountsFile,
  retentionDays: 7
}).then((result) => {
  if (!result.ok) {
    console.error('[RageRP admin] Could not initialize SQLite:', result.error);
  } else {
    console.log('[RageRP admin] SQLite logging initialized.');
  }
  return result;
});

function addCalendarMonths(timestamp, months) {
  const date = new Date(timestamp);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return date.getTime();
}

function criminalRecordsFor(character) {
  if (!character || !Array.isArray(character.criminalRecords)) return [];

  return character.criminalRecords.filter((record) =>
    record && Number.isSafeInteger(Number(record.issuedAt)) &&
    Number.isSafeInteger(Number(record.expiresAt)) &&
    Number.isSafeInteger(Number(record.termMonths)) &&
    Number(record.termMonths) >= 1 && Number(record.termMonths) <= 120
  ).slice(-100).map((record, index) => ({
    id: String(record.id || `${record.issuedAt}-${index + 1}`).slice(0, 64),
    issuedAt: Number(record.issuedAt),
    termMonths: Number(record.termMonths),
    expiresAt: Number(record.expiresAt),
    reason: String(record.reason || '—').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 120),
    issuerName: String(record.issuerName || '—').replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 60),
    issuerStaticId: /^\d{3}-\d{3}$/.test(String(record.issuerStaticId || ''))
      ? String(record.issuerStaticId)
      : ''
  }));
}

function getAccountKey(player) {
  const rgscId = String(player.rgscId || '').trim();
  if (rgscId) {
    return `rgsc:${rgscId}`;
  }

  const socialClub = String(player.socialClub || '').trim().toLowerCase();
  if (socialClub) {
    return `socialclub:${socialClub}`;
  }

  const playerName = String(player.name || '').trim().toLowerCase();
  if (!playerName) {
    throw new Error('Could not identify the connected player.');
  }

  return `name:${playerName}`;
}

function getAccount(player) {
  const key = sessions.get(player.id) || getAccountKey(player);
  sessions.set(player.id, key);

  if (!accounts[key]) {
    accounts[key] = { character: null };
  }

  return accounts[key];
}

function mediaSettingsFor(account) {
  if (!account.mediaSettings || typeof account.mediaSettings !== 'object' ||
      Array.isArray(account.mediaSettings)) {
    account.mediaSettings = {
      voiceMuteUnderHours: 0,
      showCallNotifications: true
    };
  }

  const settings = account.mediaSettings;
  const threshold = Number(settings.voiceMuteUnderHours);
  settings.voiceMuteUnderHours = Number.isFinite(threshold)
    ? Math.max(0, Math.min(200, threshold))
    : 0;
  if (typeof settings.showCallNotifications !== 'boolean') {
    settings.showCallNotifications = true;
  }
  return settings;
}

function playtimeMsFor(account, playerId) {
  const stored = Number(account.playtimeMs);
  const savedPlaytime = Number.isSafeInteger(stored) && stored >= 0 ? stored : 0;
  const checkpoint = playtimeCheckpointAt.get(playerId);
  return savedPlaytime + (checkpoint ? Math.max(0, Date.now() - checkpoint) : 0);
}

function checkpointPlayerPlaytime(player, now) {
  const account = getAccount(player);
  const checkpoint = playtimeCheckpointAt.get(player.id);
  if (!checkpoint) {
    playtimeCheckpointAt.set(player.id, now);
    return false;
  }

  const elapsed = Math.max(0, now - checkpoint);
  if (elapsed === 0) return false;
  const stored = Number(account.playtimeMs);
  account.playtimeMs = (Number.isSafeInteger(stored) && stored >= 0 ? stored : 0) + elapsed;
  playtimeCheckpointAt.set(player.id, now);
  return true;
}

function characterFor(player) {
  return getAccount(player).character;
}

function ensureCharacterInventory(character) {
  const previous = JSON.stringify(character.inventory);
  const inventory = Inventory.normalizeInventory(character.inventory);
  character.inventory = inventory;
  if (previous !== JSON.stringify(inventory)) saveAccounts();
  return inventory;
}

function vehicleTrunkStateFor(player) {
  const session = openVehicleTrunks.get(player.id);
  if (!session) return null;
  const vehicleInfo = starterVehicleForEntity(session.vehicle);
  if (!vehicleInfo || vehicleInfo.vehicle.vehicleId !== session.vehicleId ||
      !hasVehicleAccess(player, vehicleInfo)) {
    return null;
  }

  const inventory = Inventory.normalizeInventory(vehicleInfo.vehicle.trunkInventory);
  return {
    vehicleId: vehicleInfo.vehicle.vehicleId,
    plate: `${vehicleInfo.vehicle.plate} ${vehicleInfo.vehicle.region}`,
    inventory: Inventory.inventoryForClient(inventory),
    weight: Inventory.inventoryWeight(inventory),
    capacity: VehicleAccess.TRUNK_CAPACITY_WEIGHT
  };
}

function inventoryStateFor(player) {
  const account = getAccount(player);
  const character = account.character;
  if (!character) return null;

  const inventory = ensureCharacterInventory(character);
  const previousEquipment = JSON.stringify(inventory.equipment);
  updateEquippedWeaponAmmo(player, inventory);
  if (previousEquipment !== JSON.stringify(inventory.equipment)) saveAccounts();
  return {
    staticId: ensureStaticId(account),
    name: `${character.firstName} ${character.lastName}`,
    health: Math.max(0, Math.min(100, Number(player.health) || 0)),
    armour: Math.max(0, Math.min(100, Number(player.armour) || 0)),
    weight: Inventory.inventoryWeight(inventory),
    capacity: Inventory.MAX_WEIGHT,
    inventory: Inventory.inventoryForClient(inventory),
    vehicleTrunk: vehicleTrunkStateFor(player),
    catalog: Object.keys(Inventory.ITEM_DEFINITIONS).map((itemId) => {
      const item = Inventory.ITEM_DEFINITIONS[itemId];
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        type: item.type,
        equipSlot: item.equipSlot || '',
        weight: item.weight,
        maxStack: item.maxStack,
        icon: item.icon
      };
    })
  };
}

function updateInventoryClient(player) {
  if (!openInventories.has(player.id)) return;
  const state = inventoryStateFor(player);
  if (state) player.call('ragerp:inventory:update', [JSON.stringify(state)]);
}

function inventoryNotice(player, text) {
  if (openInventories.has(player.id)) {
    player.call('ragerp:inventory:notice', [text]);
  } else {
    message(player, text);
  }
}

function equippedItemId(equipment) {
  return typeof equipment === 'string'
    ? equipment
    : equipment && typeof equipment.itemId === 'string' ? equipment.itemId : null;
}

function equippedAmmo(equipment, definition) {
  const ammo = Number(equipment && equipment.ammo);
  return Number.isInteger(ammo) && ammo >= 0 && ammo <= 999 ? ammo : definition.ammo;
}

function applyWeaponChange(player, previousEquipment, nextEquipment) {
  const previousItemId = equippedItemId(previousEquipment);
  const nextItemId = equippedItemId(nextEquipment);
  if (previousItemId === nextItemId) return;
  if ((previousItemId && typeof player.removeWeapon !== 'function') ||
      (nextItemId && (typeof player.giveWeapon !== 'function' ||
        typeof player.setWeaponAmmo !== 'function'))) {
    throw new Error('RAGE MP weapon APIs are unavailable.');
  }

  const previous = previousItemId && Inventory.ITEM_DEFINITIONS[previousItemId];
  const next = nextItemId && Inventory.ITEM_DEFINITIONS[nextItemId];
  if (previous && previous.weaponName) player.removeWeapon(mp.joaat(previous.weaponName));
  if (next && next.weaponName) {
    const weaponHash = mp.joaat(next.weaponName);
    player.giveWeapon(weaponHash, 0);
    player.setWeaponAmmo(weaponHash, equippedAmmo(nextEquipment, next));
  }
}

function updateEquippedWeaponAmmo(player, inventory) {
  Inventory.EQUIPMENT_SLOTS.forEach((slot) => {
    const equipment = inventory.equipment[slot];
    const itemId = equippedItemId(equipment);
    if (!itemId) return;

    const item = Inventory.ITEM_DEFINITIONS[itemId];
    if (typeof player.getWeaponAmmo !== 'function') {
      throw new Error('RAGE MP weapon ammo API is unavailable.');
    }
    const ammo = Number(player.getWeaponAmmo(mp.joaat(item.weaponName)));
    if (Number.isFinite(ammo)) {
      inventory.equipment[slot].ammo = Math.max(0, Math.min(999, Math.trunc(ammo)));
    }
  });
}

function restoreInventoryWeapons(player, inventory) {
  Inventory.EQUIPMENT_SLOTS.forEach((slot) => {
    const equipment = inventory.equipment[slot];
    if (equipment) applyWeaponChange(player, null, equipment);
  });
}

function inventoryActionError(error) {
  const messages = {
    'already-equipped': 'Это оружие уже экипировано.',
    'armour-full': 'Броня уже полностью восстановлена.',
    'cannot-use': 'Этот предмет сейчас нельзя использовать.',
    'empty-slot': 'В этом слоте нет предмета.',
    'health-full': 'Здоровье уже полностью восстановлено.',
    'invalid-action': 'Неизвестное действие инвентаря.',
    'invalid-item': 'Неизвестный предмет.',
    'invalid-slot': 'Указан неверный слот.',
    'no-character': 'Для этого действия нужен персонаж.',
    'no-vehicle-access': 'У тебя больше нет доступа к багажнику.',
    'no-space': 'В инвентаре нет свободного места.',
    'no-vehicle-trunk': 'Багажник не открыт.',
    'not-consumable': 'Этот предмет нельзя использовать.',
    'vehicle-too-far': 'Подойди ближе к автомобилю.',
    'slot-occupied': 'Сначала освободи выбранный слот.',
    'stack-full': 'В целевом слоте недостаточно места.',
    'too-heavy': 'Превышена грузоподъёмность инвентаря.',
    'wrong-equipment-slot': 'Этот предмет нельзя поместить в выбранный слот.'
  };
  return messages[error] || 'Не удалось выполнить действие с предметом.';
}

function useInventorySlot(player, inventory, slotIndex) {
  if (!Number.isInteger(slotIndex) || slotIndex < 0 || slotIndex >= Inventory.SLOT_COUNT) {
    return { error: 'invalid-slot' };
  }
  const stack = inventory.slots[slotIndex];
  if (!stack) return { error: 'empty-slot' };
  const item = Inventory.ITEM_DEFINITIONS[stack.itemId];
  if (!item) return { error: 'invalid-item' };

  if (item.type === 'weapon') {
    const result = Inventory.equipItem(inventory, slotIndex, item.equipSlot);
    if (result.error) return result;
    return {
      inventory: result.inventory,
      weaponChange: {
        previous: inventory.equipment[item.equipSlot],
        next: result.inventory.equipment[item.equipSlot]
      },
      notice: `${item.name} экипирован.`
    };
  }

  const currentValue = item.effect === 'health'
    ? Number(player.health) || 0
    : Number(player.armour) || 0;
  if (currentValue >= 100) return { error: item.effect === 'health' ? 'health-full' : 'armour-full' };
  if (item.effect === 'health' && currentValue <= 0) return { error: 'cannot-use' };

  const result = Inventory.consumeItem(inventory, slotIndex);
  if (result.error) return result;
  return {
    inventory: result.inventory,
    effect: result.effect,
    notice: `${item.name} использован.`
  };
}

function performInventoryAction(player, action, data) {
  const character = characterFor(player);
  if (!character) return { error: 'no-character' };
  const inventory = ensureCharacterInventory(character);
  if (['equip', 'unequip', 'use', 'use-quick'].includes(action)) {
    updateEquippedWeaponAmmo(player, inventory);
  }
  let result;

  if (action === 'move') {
    result = Inventory.moveSlot(inventory, data.from, data.to);
  } else if (action === 'assign-quick') {
    result = Inventory.assignQuickSlot(inventory, data.quickSlot, data.slot);
  } else if (action === 'equip') {
    result = Inventory.equipItem(inventory, data.slot, data.equipmentSlot);
    if (!result.error) {
      result.weaponChange = {
        previous: inventory.equipment[data.equipmentSlot],
        next: result.inventory.equipment[data.equipmentSlot]
      };
      result.notice = 'Оружие экипировано.';
    }
  } else if (action === 'unequip') {
    const previous = inventory.equipment[data.equipmentSlot];
    result = Inventory.unequipItem(inventory, data.equipmentSlot, data.to);
    if (!result.error) {
      result.weaponChange = { previous, next: null };
      result.notice = 'Оружие убрано в инвентарь.';
    }
  } else if (action === 'use') {
    result = useInventorySlot(player, inventory, data.slot);
  } else if (action === 'use-quick') {
    if (!Number.isInteger(data.quickSlot) ||
        data.quickSlot < 0 || data.quickSlot >= Inventory.QUICK_SLOT_COUNT) {
      return { error: 'invalid-slot' };
    }
    const slotIndex = inventory.quickSlots[data.quickSlot];
    result = slotIndex === null
      ? { error: 'empty-slot' }
      : useInventorySlot(player, inventory, slotIndex);
  } else {
    return { error: 'invalid-action' };
  }

  if (!result || result.error) return { error: result && result.error || 'invalid-action' };
  if (result.weaponChange) {
    applyWeaponChange(player, result.weaponChange.previous, result.weaponChange.next);
  }

  character.inventory = result.inventory;
  saveAccounts();
  if (result.effect && result.effect.type === 'health') {
    player.health = Math.min(100, (Number(player.health) || 0) + result.effect.amount);
  } else if (result.effect && result.effect.type === 'armour') {
    player.armour = Math.min(100, (Number(player.armour) || 0) + result.effect.amount);
  }

  if (openInventories.has(player.id)) {
    updateInventoryClient(player);
    if (result.notice) player.call('ragerp:inventory:notice', [result.notice]);
  } else if (result.notice) {
    message(player, result.notice);
  }
  return { success: true };
}

function performVehicleInventoryTransfer(player, data) {
  const session = openVehicleTrunks.get(player.id);
  if (!session) return { error: 'no-vehicle-trunk' };
  if (!session.vehicle || !mp.vehicles.exists(session.vehicle) ||
      !playerNearVehicle(player, session.vehicle, 3.5)) {
    return { error: 'vehicle-too-far' };
  }

  const vehicleInfo = starterVehicleForEntity(session.vehicle);
  if (!vehicleInfo || vehicleInfo.vehicle.vehicleId !== session.vehicleId ||
      vehicleTrunkUsers.get(session.vehicleId) !== player.id ||
      !hasVehicleAccess(player, vehicleInfo)) {
    return { error: 'no-vehicle-access' };
  }

  const character = characterFor(player);
  if (!character) return { error: 'no-character' };
  const playerInventory = ensureCharacterInventory(character);
  const trunkInventory = Inventory.normalizeInventory(vehicleInfo.vehicle.trunkInventory);
  const direction = data.direction;
  const transfer = direction === 'to-trunk'
    ? Inventory.transferItems(
      playerInventory,
      trunkInventory,
      data.slot,
      data.quantity,
      VehicleAccess.TRUNK_CAPACITY_WEIGHT
    )
    : direction === 'to-player'
      ? Inventory.transferItems(
        trunkInventory,
        playerInventory,
        data.slot,
        data.quantity,
        Inventory.MAX_WEIGHT
      )
      : { error: 'invalid-direction' };
  if (transfer.error) return transfer;

  const previousPlayerInventory = character.inventory;
  const updatedVehicle = Object.assign({}, vehicleInfo.vehicle, {
    trunkInventory: direction === 'to-trunk'
      ? transfer.targetInventory
      : transfer.sourceInventory
  });
  character.inventory = direction === 'to-trunk'
    ? transfer.sourceInventory
    : transfer.targetInventory;
  try {
    persistVehicleRecord(vehicleInfo.account, updatedVehicle);
  } catch (error) {
    character.inventory = previousPlayerInventory;
    throw error;
  }

  updateInventoryClient(player);
  return { success: true };
}

function performVehicleInventoryMove(player, data) {
  const session = openVehicleTrunks.get(player.id);
  if (!session) return { error: 'no-vehicle-trunk' };
  if (!session.vehicle || !mp.vehicles.exists(session.vehicle) ||
      !playerNearVehicle(player, session.vehicle, 3.5)) {
    return { error: 'vehicle-too-far' };
  }
  const vehicleInfo = starterVehicleForEntity(session.vehicle);
  if (!vehicleInfo || vehicleInfo.vehicle.vehicleId !== session.vehicleId ||
      vehicleTrunkUsers.get(session.vehicleId) !== player.id ||
      !hasVehicleAccess(player, vehicleInfo)) {
    return { error: 'no-vehicle-access' };
  }

  const moved = Inventory.moveSlot(
    Inventory.normalizeInventory(vehicleInfo.vehicle.trunkInventory),
    data.from,
    data.to
  );
  if (moved.error) return moved;
  const updatedVehicle = Object.assign({}, vehicleInfo.vehicle, {
    trunkInventory: moved.inventory
  });
  try {
    persistVehicleRecord(vehicleInfo.account, updatedVehicle);
  } catch (error) {
    throw error;
  }
  updateInventoryClient(player);
  return { success: true };
}

function russianPlateForStaticId(staticId) {
  const digits = String(staticId).replace(/\D/g, '').padStart(6, '0');
  if (!/^\d{6}$/.test(digits)) {
    throw new Error('Cannot generate a vehicle plate without a valid static ID.');
  }

  const letterCode = Number(digits.slice(3));
  const letters = [
    russianPlateLetters[Math.floor(letterCode / 144)],
    russianPlateLetters[Math.floor(letterCode / 12) % 12],
    russianPlateLetters[letterCode % 12]
  ];
  return `${letters[0]}${digits.slice(0, 3)}${letters[1]}${letters[2]}`;
}

function newVehicleId() {
  return crypto.randomBytes(16).toString('hex');
}

function purchasedVehiclesFor(account) {
  if (!account || !account.character) return [];
  const vehicles = account.character.purchasedVehicles;
  if (vehicles === undefined) return [];
  if (!Array.isArray(vehicles)) {
    throw new Error('Purchased vehicle data must be an array.');
  }
  return vehicles;
}

function purchasedVehicleById(account, vehicleId) {
  return purchasedVehiclesFor(account).find((vehicle) =>
    vehicle && vehicle.vehicleId === vehicleId &&
    vehicle.model === PersonalVehicles.MODEL
  ) || null;
}

function newVehiclePlate() {
  const usedPlates = new Set();
  Object.keys(accounts).forEach((accountKey) => {
    const character = accounts[accountKey] && accounts[accountKey].character;
    if (!character) return;
    const vehicles = [character.starterVehicle].concat(
      Array.isArray(character.purchasedVehicles) ? character.purchasedVehicles : []
    );
    vehicles.forEach((vehicle) => {
      if (vehicle && typeof vehicle.plate === 'string') usedPlates.add(vehicle.plate);
    });
  });

  for (let attempt = 0; attempt < 100; attempt += 1) {
    const digits = String(crypto.randomBytes(4).readUInt32BE(0) % 1000000).padStart(6, '0');
    const plate = russianPlateForStaticId(digits);
    if (!usedPlates.has(plate)) return plate;
  }
  throw new Error('Could not generate a unique vehicle plate.');
}

function persistVehicleRecord(account, vehicleRecord) {
  if (!account || !account.character || !vehicleRecord) {
    throw new Error('Cannot persist an invalid personal vehicle record.');
  }

  const character = account.character;
  const starterVehicle = character.starterVehicle;
  const purchasedVehicles = purchasedVehiclesFor(account);
  const purchasedIndex = purchasedVehicles.findIndex((vehicle) =>
    vehicle && vehicle.vehicleId === vehicleRecord.vehicleId
  );
  let previous;
  if (starterVehicle && starterVehicle.vehicleId === vehicleRecord.vehicleId) {
    previous = starterVehicle;
    character.starterVehicle = vehicleRecord;
  } else if (purchasedIndex >= 0) {
    previous = character.purchasedVehicles;
    const updatedVehicles = purchasedVehicles.slice();
    updatedVehicles[purchasedIndex] = vehicleRecord;
    character.purchasedVehicles = updatedVehicles;
  } else {
    throw new Error('Personal vehicle record was not found on its owner account.');
  }

  try {
    saveAccounts();
  } catch (error) {
    if (starterVehicle && starterVehicle.vehicleId === vehicleRecord.vehicleId) {
      character.starterVehicle = previous;
    } else {
      character.purchasedVehicles = previous;
    }
    throw error;
  }
}

function ensureStarterVehicle(account) {
  if (!account.character) return null;

  const starterVehicle = account.character.starterVehicle;
  if (starterVehicle &&
      starterVehicle.model === starterVehicleModel &&
      /^[ABEKMHOPCTYX]\d{3}[ABEKMHOPCTYX]{2}$/.test(String(starterVehicle.plate || '')) &&
      /^\d{2,3}$/.test(String(starterVehicle.region || ''))) {
    const normalized = VehicleAccess.normalizeVehicleRecord(
      starterVehicle,
      ensureStaticId(account),
      newVehicleId
    );
    if (normalized.error) throw new Error('Could not normalize the personal vehicle record.');
    if (normalized.changed) {
      backupAccountsBeforeVehicleMigration();
      persistVehicleRecord(account, normalized.vehicle);
      return normalized.vehicle;
    }
    return starterVehicle;
  }

  if (starterVehicle) backupAccountsBeforeVehicleMigration();
  const staticId = ensureStaticId(account);
  const vehicle = {
    model: starterVehicleModel,
    plate: russianPlateForStaticId(staticId),
    region: starterVehicleRegion,
    vehicleId: newVehicleId(),
    keyHolderStaticIds: [],
    locked: false,
    trunkInventory: Inventory.createEmptyInventory()
  };
  persistVehicleRecord(account, vehicle);
  return account.character.starterVehicle;
}

function starterVehicleForEntity(entity) {
  for (const [accountKey, spawnedVehicle] of spawnedStarterVehicles) {
    if (!spawnedVehicle || !mp.vehicles.exists(spawnedVehicle)) {
      spawnedStarterVehicles.delete(accountKey);
      continue;
    }
    if (spawnedVehicle !== entity) continue;

    const account = accounts[accountKey];
    if (!account || !account.character) return null;
    const vehicle = ensureStarterVehicle(account);
    if (!vehicle) return null;
    return {
      accountKey,
      account,
      vehicle,
      entity: spawnedVehicle,
      ownerStaticId: ensureStaticId(account),
      vehicleType: 'starter'
    };
  }

  for (const [vehicleId, spawned] of spawnedPurchasedVehicles) {
    const spawnedVehicle = spawned && spawned.entity;
    if (!spawnedVehicle || !mp.vehicles.exists(spawnedVehicle)) {
      spawnedPurchasedVehicles.delete(vehicleId);
      continue;
    }
    if (spawnedVehicle !== entity) continue;

    const account = accounts[spawned.accountKey];
    if (!account || !account.character) return null;
    const vehicle = purchasedVehicleById(account, vehicleId);
    if (!vehicle) return null;
    return {
      accountKey: spawned.accountKey,
      account,
      vehicle,
      entity: spawnedVehicle,
      ownerStaticId: ensureStaticId(account),
      vehicleType: 'purchased'
    };
  }
  return null;
}

function hasVehicleAccess(player, vehicleInfo) {
  if (!player || !vehicleInfo) return false;
  return VehicleAccess.hasKey(
    vehicleInfo.vehicle,
    vehicleInfo.ownerStaticId,
    ensureStaticId(getAccount(player))
  ) || hotwiredVehicles.get(vehicleInfo.vehicle.vehicleId) === vehicleInfo.entity;
}

function vehicleIsLocked(vehicleInfo) {
  return Boolean(vehicleInfo && vehicleInfo.vehicle.locked) &&
    hotwiredVehicles.get(vehicleInfo.vehicle.vehicleId) !== vehicleInfo.entity;
}

function clearVehicleRuntimeState(entity) {
  const vehicleInfo = starterVehicleForEntity(entity);
  if (!vehicleInfo) return;

  const vehicleId = vehicleInfo.vehicle.vehicleId;
  const attempt = theftAttemptRegistry.getByVehicle(vehicleId);
  if (attempt) cancelTheftAttempt(attempt, 'Взлом отменён: автомобиль покинул город.');
  hotwiredVehicles.delete(vehicleId);
  vehicleDoorStates.delete(vehicleId);
  const userId = vehicleTrunkUsers.get(vehicleId);
  if (userId !== undefined) {
    const user = openVehicleTrunks.get(userId);
    if (user) {
      closeVehicleTrunk(user.player);
      openInventories.delete(userId);
      if (mp.players.exists(user.player)) {
        user.player.call('ragerp:inventory:close');
        message(user.player, 'Багажник закрылся: автомобиль покинул город.');
      }
    }
  }
  if (vehicleInfo.vehicleType === 'purchased') {
    const spawned = spawnedPurchasedVehicles.get(vehicleId);
    if (spawned && spawned.entity === entity) spawnedPurchasedVehicles.delete(vehicleId);
  }
}

function vehicleKeysFor(player, selectedVehicle) {
  const account = getAccount(player);
  const vehicle = selectedVehicle || ensureStarterVehicle(account);
  if (!vehicle) return [];
  return vehicle.keyHolderStaticIds.map((staticId) => {
    const target = accountByStaticId(staticId);
    return {
      staticId,
      name: target && target.account.character
        ? `${target.account.character.firstName} ${target.account.character.lastName}`
        : 'Персонаж не найден'
    };
  });
}

function starterVehicleState(player) {
  const account = getAccount(player);
  const starterVehicle = ensureStarterVehicle(account);
  if (!starterVehicle) return null;

  const key = sessions.get(player.id);
  let vehicle = spawnedStarterVehicles.get(key);
  if (vehicle && !mp.vehicles.exists(vehicle)) {
    spawnedStarterVehicles.delete(key);
    vehicle = null;
  }

  const state = {
    vehicleId: starterVehicle.vehicleId,
    model: starterVehicle.model,
    name: starterVehicleName,
    plate: starterVehicle.plate,
    region: starterVehicle.region,
    locked: vehicle
      ? vehicleIsLocked(starterVehicleForEntity(vehicle))
      : starterVehicle.locked,
    isOut: Boolean(vehicle)
  };
  if (vehicle) {
    state.x = Number(vehicle.position.x);
    state.y = Number(vehicle.position.y);
    state.z = Number(vehicle.position.z);
  }
  return state;
}

function purchasedVehicleStatesFor(player) {
  const account = getAccount(player);
  return purchasedVehiclesFor(account).map((vehicle) => {
    const spawned = spawnedPurchasedVehicles.get(vehicle.vehicleId);
    const entity = spawned && mp.vehicles.exists(spawned.entity)
      ? spawned.entity
      : null;
    if (!entity && spawned) spawnedPurchasedVehicles.delete(vehicle.vehicleId);
    const vehicleInfo = entity ? starterVehicleForEntity(entity) : null;
    const state = {
      vehicleId: vehicle.vehicleId,
      model: vehicle.model,
      name: vehicle.name || PersonalVehicles.NAME,
      plate: vehicle.plate,
      region: vehicle.region,
      locked: entity ? vehicleIsLocked(vehicleInfo) : Boolean(vehicle.locked),
      isOut: Boolean(entity),
      keyHolders: vehicleKeysFor(player, vehicle)
    };
    if (entity) {
      state.x = Number(entity.position.x);
      state.y = Number(entity.position.y);
      state.z = Number(entity.position.z);
    }
    return state;
  });
}

function phoneNumbersFor(starterVehicle, purchasedVehicles) {
  return [starterVehicle].concat(purchasedVehicles || [])
    .filter((vehicle) => vehicle && vehicle.plate)
    .map((vehicle) => ({
      plate: vehicle.plate,
      region: vehicle.region,
      vehicleName: vehicle.name
    }));
}

function summonStarterVehicle(player) {
  const account = getAccount(player);
  const key = sessions.get(player.id);
  const existing = spawnedStarterVehicles.get(key);
  if (existing && mp.vehicles.exists(existing)) {
    if (player.vehicle) {
      phoneNotice(player, 'Выйди из машины перед повторным вызовом стартового автомобиля.');
      return;
    }

    const lastCall = vehicleCallCooldowns.get(player.id) || 0;
    if (Date.now() - lastCall < 3000) {
      phoneNotice(player, 'Подожди немного перед следующим вызовом машины.');
      return;
    }
    vehicleCallCooldowns.set(player.id, Date.now());

    const occupants = [];
    mp.vehicles.forEach((vehicle) => {
      if (vehicle === existing ||
          vehicle.dimension !== player.dimension ||
          !isValidPosition(vehicle.position)) return;
      occupants.push({
        x: Number(vehicle.position.x),
        y: Number(vehicle.position.y),
        z: Number(vehicle.position.z),
        dimension: vehicle.dimension
      });
    });
    mp.players.forEach((otherPlayer) => {
      if (otherPlayer.dimension !== player.dimension ||
          !isValidPosition(otherPlayer.position)) return;
      occupants.push({
        x: Number(otherPlayer.position.x),
        y: Number(otherPlayer.position.y),
        z: Number(otherPlayer.position.z),
        dimension: otherPlayer.dimension
      });
    });

    let parkingSpot = Parking.nearestFreeParkingSpot(
      player.position,
      occupants,
      player.dimension
    );
    if (!parkingSpot) {
      parkingSpot = Parking.nearestParkingSpot(player.position);
    }
    if (!parkingSpot) {
      phoneNotice(player, 'Не удалось найти парковочное место для машины.');
      return;
    }

    const starterVehicle = ensureStarterVehicle(account);
    clearVehicleRuntimeState(existing);
    existing.destroy();
    unregisterVehicleFuel(existing);
    const respawned = mp.vehicles.new(
      mp.joaat(starterVehicle.model),
      new mp.Vector3(parkingSpot.x, parkingSpot.y, parkingSpot.z),
      {
        heading: parkingSpot.heading,
        dimension: player.dimension,
        numberPlate: `${starterVehicle.plate}${starterVehicle.region}`,
        locked: false,
        engine: false
      }
    );
    if (!respawned) {
      spawnedStarterVehicles.delete(key);
      phoneNotice(player, 'Не удалось переспавнить автомобиль. Попробуй ещё раз.');
      return;
    }

    spawnedStarterVehicles.set(key, respawned);
    registerVehicleFuel(respawned, key, starterVehicle.model);
    player.call('ragerp:phone:waypoint', [JSON.stringify({
      x: parkingSpot.x,
      y: parkingSpot.y
    })]);
    const vehicleState = starterVehicleState(player);
    const ownedVehicles = purchasedVehicleStatesFor(player);
    updatePhone(player, {
      starterVehicle: vehicleState,
      ownedVehicles,
      vehiclePassport: vehiclePassportFor(player),
      numbers: phoneNumbersFor(vehicleState, ownedVehicles),
      notice: `Твоя ${starterVehicleName} переспавнена на ближайшей парковке. Метка GPS обновлена.`
    });
    return;
  }

  const lastCall = vehicleCallCooldowns.get(player.id) || 0;
  if (Date.now() - lastCall < 3000) {
    phoneNotice(player, 'Подожди немного перед следующим вызовом машины.');
    return;
  }
  if (player.vehicle) {
    phoneNotice(player, 'Выйди из машины перед вызовом стартового автомобиля.');
    return;
  }

  vehicleCallCooldowns.set(player.id, Date.now());
  const occupants = [];
  mp.vehicles.forEach((vehicle) => {
    if (vehicle.dimension !== player.dimension || !isValidPosition(vehicle.position)) return;
    occupants.push({
      x: Number(vehicle.position.x),
      y: Number(vehicle.position.y),
      z: Number(vehicle.position.z),
      dimension: vehicle.dimension
    });
  });
  mp.players.forEach((otherPlayer) => {
    if (otherPlayer.dimension !== player.dimension || !isValidPosition(otherPlayer.position)) return;
    occupants.push({
      x: Number(otherPlayer.position.x),
      y: Number(otherPlayer.position.y),
      z: Number(otherPlayer.position.z),
      dimension: otherPlayer.dimension
    });
  });
  const parkingSpot = Parking.nearestFreeParkingSpot(player.position, occupants, player.dimension);
  if (!parkingSpot) {
    phoneNotice(player, 'Свободных мест на парковках нет. Попробуй вызвать машину позже.');
    return;
  }

  const starterVehicle = ensureStarterVehicle(account);
  const vehicle = mp.vehicles.new(
    mp.joaat(starterVehicle.model),
    new mp.Vector3(parkingSpot.x, parkingSpot.y, parkingSpot.z),
    {
      heading: parkingSpot.heading,
      dimension: player.dimension,
      numberPlate: `${starterVehicle.plate}${starterVehicle.region}`,
      locked: false,
      engine: false
    }
  );
  if (!vehicle) {
    phoneNotice(player, 'Не удалось создать автомобиль. Попробуй ещё раз.');
    return;
  }

  spawnedStarterVehicles.set(key, vehicle);
  registerVehicleFuel(vehicle, key, starterVehicle.model);
  player.call('ragerp:phone:waypoint', [JSON.stringify({
    x: parkingSpot.x,
    y: parkingSpot.y
  })]);
  const plateLabel = `${starterVehicle.plate} ${starterVehicle.region}`;
  const vehicleState = starterVehicleState(player);
  const ownedVehicles = purchasedVehicleStatesFor(player);
  updatePhone(player, {
    starterVehicle: vehicleState,
    ownedVehicles,
    vehiclePassport: vehiclePassportFor(player),
    numbers: phoneNumbersFor(vehicleState, ownedVehicles),
    notice: `Твоя ${starterVehicleName} припаркована. Метка GPS добавлена. Номер: ${plateLabel}.`
  });
}

function summonPurchasedVehicle(player, vehicleId) {
  const account = getAccount(player);
  const vehicle = purchasedVehicleById(account, vehicleId);
  if (!vehicle) {
    phoneNotice(player, 'Этот автомобиль не найден в твоём гараже.');
    return;
  }
  if (player.vehicle) {
    phoneNotice(player, 'Выйди из машины перед вызовом личного автомобиля.');
    return;
  }

  const lastCall = vehicleCallCooldowns.get(player.id) || 0;
  if (Date.now() - lastCall < 3000) {
    phoneNotice(player, 'Подожди немного перед следующим вызовом машины.');
    return;
  }

  const key = sessions.get(player.id);
  const spawned = spawnedPurchasedVehicles.get(vehicle.vehicleId);
  let existing = spawned && spawned.entity;
  if (existing && !mp.vehicles.exists(existing)) {
    spawnedPurchasedVehicles.delete(vehicle.vehicleId);
    existing = null;
  }
  if (existing) {
    let occupied = false;
    mp.players.forEach((otherPlayer) => {
      if (otherPlayer.vehicle === existing) occupied = true;
    });
    if (occupied) {
      phoneNotice(player, 'Сначала дождись, пока другие игроки выйдут из автомобиля.');
      return;
    }
  }

  const occupants = [];
  mp.vehicles.forEach((otherVehicle) => {
    if (otherVehicle === existing ||
        otherVehicle.dimension !== player.dimension ||
        !isValidPosition(otherVehicle.position)) return;
    occupants.push({
      x: Number(otherVehicle.position.x),
      y: Number(otherVehicle.position.y),
      z: Number(otherVehicle.position.z),
      dimension: otherVehicle.dimension
    });
  });
  mp.players.forEach((otherPlayer) => {
    if (otherPlayer.dimension !== player.dimension ||
        !isValidPosition(otherPlayer.position)) return;
    occupants.push({
      x: Number(otherPlayer.position.x),
      y: Number(otherPlayer.position.y),
      z: Number(otherPlayer.position.z),
      dimension: otherPlayer.dimension
    });
  });

  const parkingSpot = Parking.nearestFreeParkingSpot(
    player.position,
    occupants,
    player.dimension
  );
  if (!parkingSpot) {
    phoneNotice(player, 'Свободных мест на парковках нет. Попробуй вызвать машину позже.');
    return;
  }

  vehicleCallCooldowns.set(player.id, Date.now());
  if (existing) {
    clearVehicleRuntimeState(existing);
    existing.destroy();
    unregisterVehicleFuel(existing);
  }

  const entity = mp.vehicles.new(
    mp.joaat(vehicle.model),
    new mp.Vector3(parkingSpot.x, parkingSpot.y, parkingSpot.z),
    {
      heading: parkingSpot.heading,
      dimension: player.dimension,
      numberPlate: `${vehicle.plate}${vehicle.region}`,
      locked: false,
      engine: false
    }
  );
  if (!entity) {
    phoneNotice(player, 'Не удалось создать автомобиль. Попробуй ещё раз.');
    return;
  }

  spawnedPurchasedVehicles.set(vehicle.vehicleId, { accountKey: key, entity });
  registerVehicleFuel(entity, key, vehicle.model, vehicle.vehicleId);
  player.call('ragerp:phone:waypoint', [JSON.stringify({
    x: parkingSpot.x,
    y: parkingSpot.y
  })]);
  const ownedVehicles = purchasedVehicleStatesFor(player);
  updatePhone(player, {
    ownedVehicles,
    numbers: phoneNumbersFor(starterVehicleState(player), ownedVehicles),
    notice: `Твоя ${vehicle.name || PersonalVehicles.NAME} припаркована. Метка GPS добавлена.`
  });
}

function distanceSquared(first, second) {
  if (!isValidPosition(first) || !isValidPosition(second)) return Infinity;
  const dx = Number(first.x) - Number(second.x);
  const dy = Number(first.y) - Number(second.y);
  const dz = Number(first.z) - Number(second.z);
  return dx * dx + dy * dy + dz * dz;
}

function playerNearVehicle(player, vehicle, radius) {
  return player.dimension === vehicle.dimension &&
    distanceSquared(player.position, vehicle.position) <= radius * radius;
}

function setVehicleDoorForNearbyPlayers(vehicle, doorIndex, open) {
  mp.players.forEach((player) => {
    if (player.dimension !== vehicle.dimension ||
        distanceSquared(player.position, vehicle.position) > 80 * 80) return;
    player.call('ragerp:vehicle:door', [vehicle.id, doorIndex, open]);
  });
}

function setVehicleCompartmentState(vehicleInfo, compartment, open) {
  const state = vehicleDoorStates.get(vehicleInfo.vehicle.vehicleId) || {
    hoodOpen: false,
    trunkOpen: false
  };
  const doorIndex = compartment === 'hood' ? 4 : 5;
  state[compartment === 'hood' ? 'hoodOpen' : 'trunkOpen'] = open;
  vehicleDoorStates.set(vehicleInfo.vehicle.vehicleId, state);
  setVehicleDoorForNearbyPlayers(vehicleInfo.entity, doorIndex, open);
}

function closeVehicleTrunk(player) {
  const session = openVehicleTrunks.get(player.id);
  if (!session) return;
  openVehicleTrunks.delete(player.id);
  if (vehicleTrunkUsers.get(session.vehicleId) === player.id) {
    vehicleTrunkUsers.delete(session.vehicleId);
  }
  if (session.vehicle && mp.vehicles.exists(session.vehicle)) {
    setVehicleCompartmentState(
      { vehicle: { vehicleId: session.vehicleId }, entity: session.vehicle },
      'trunk',
      false
    );
  }
}

function openVehicleTrunk(player, vehicle) {
  if (!characterFor(player) || player.dimension !== 0 || player.vehicle ||
      openPhones.has(player.id) || openInventories.has(player.id) ||
      openDealerships.has(player.id) || hudNotifications.has(player.id)) {
    message(player, 'Багажник сейчас недоступен.');
    return;
  }
  const vehicleInfo = starterVehicleForEntity(vehicle);
  if (!vehicleInfo || !playerNearVehicle(player, vehicle, 3.5)) {
    message(player, 'Подойди ближе к личному автомобилю.');
    return;
  }
  if (!hasVehicleAccess(player, vehicleInfo)) {
    message(player, 'У тебя нет ключа от этого автомобиля.');
    return;
  }
  if (vehicleTrunkUsers.has(vehicleInfo.vehicle.vehicleId)) {
    message(player, 'Багажник уже используется другим игроком.');
    return;
  }

  const session = {
    vehicleId: vehicleInfo.vehicle.vehicleId,
    vehicle,
    player
  };
  openVehicleTrunks.set(player.id, session);
  vehicleTrunkUsers.set(session.vehicleId, player.id);
  openInventories.add(player.id);
  setVehicleCompartmentState(vehicleInfo, 'trunk', true);
  try {
    const state = inventoryStateFor(player);
    if (!state || !state.vehicleTrunk) throw new Error('Vehicle trunk state is unavailable.');
    player.call('ragerp:inventory:open', [JSON.stringify(state)]);
  } catch (error) {
    closeVehicleTrunk(player);
    openInventories.delete(player.id);
    console.error('[RageRP vehicle] Could not open trunk:', error);
    message(player, 'Не удалось открыть багажник.');
  }
}

function toggleVehicleLock(player, vehicleInfo) {
  if (!vehicleInfo || !mp.vehicles.exists(vehicleInfo.entity)) return false;
  if (!VehicleAccess.hasKey(
    vehicleInfo.vehicle,
    vehicleInfo.ownerStaticId,
    ensureStaticId(getAccount(player))
  )) {
    message(player, 'У тебя нет ключа от этого автомобиля.');
    return false;
  }

  const locked = !vehicleIsLocked(vehicleInfo);
  const updated = Object.assign({}, vehicleInfo.vehicle, { locked });
  persistVehicleRecord(vehicleInfo.account, updated);
  vehicleInfo.vehicle = updated;
  vehicleInfo.entity.locked = false;
  player.call('ragerp:vehicle:lock-animation', [locked]);
  message(player, locked ? 'Автомобиль закрыт.' : 'Автомобиль открыт.');
  return true;
}

function cancelTheftAttempt(attempt, notice) {
  if (attempt.timeout) clearTimeout(attempt.timeout);
  theftAttemptRegistry.release(attempt);
  if (notice && mp.players.exists(attempt.player)) message(attempt.player, notice);
}

function maybeSendPoliceTheftAlert(stage, player, vehicleInfo) {
  const settings = VehicleTheftConfig.policeAlert;
  if (!VehicleAccess.shouldAlertPolice(stage, Math.random(), settings)) return;
  const alert = {
    type: 'vehicle-theft',
    stage,
    plate: `${vehicleInfo.vehicle.plate} ${vehicleInfo.vehicle.region}`,
    model: vehicleInfo.vehicle.model,
    position: {
      x: Number(vehicleInfo.entity.position.x),
      y: Number(vehicleInfo.entity.position.y),
      z: Number(vehicleInfo.entity.position.z)
    },
    dimension: vehicleInfo.entity.dimension
  };
  mp.events.call('ragerp:police:vehicle-theft', JSON.stringify(alert));
}

function completeTheftAttempt(attempt) {
  if (theftAttemptRegistry.getByVehicle(attempt.vehicleId) !== attempt) return;
  cancelTheftAttempt(attempt, null);

  if (!mp.players.exists(attempt.player) ||
      !attempt.vehicle || !mp.vehicles.exists(attempt.vehicle) ||
      !playerNearVehicle(attempt.player, attempt.vehicle, 3.5) ||
      attempt.player.vehicle) {
    if (mp.players.exists(attempt.player)) {
      message(attempt.player, 'Взлом отменён: ты отошёл от автомобиля.');
    }
    return;
  }

  const vehicleInfo = starterVehicleForEntity(attempt.vehicle);
  if (!vehicleInfo || vehicleInfo.vehicle.vehicleId !== attempt.vehicleId ||
      vehicleInfo.accountKey !== attempt.ownerAccountKey ||
      !vehicleIsLocked(vehicleInfo) ||
      VehicleAccess.hasKey(
        vehicleInfo.vehicle,
        vehicleInfo.ownerStaticId,
        ensureStaticId(getAccount(attempt.player))
      )) {
    message(attempt.player, 'Взлом отменён: состояние автомобиля изменилось.');
    return;
  }

  const character = characterFor(attempt.player);
  const inventory = ensureCharacterInventory(character);
  if (Inventory.countItems(inventory, 'lockpick') < 1) {
    message(attempt.player, 'Взлом отменён: у тебя больше нет отмычки.');
    return;
  }

  const outcome = VehicleAccess.resolveTheftOutcome(
    Math.random(),
    Math.random(),
    VehicleTheftConfig
  );
  if (outcome.error) throw new Error('Vehicle theft settings are invalid.');
  if (!outcome.success) {
    attempt.vehicle.locked = false;
    if (outcome.lockpickBroken) {
      const removed = Inventory.removeItems(inventory, 'lockpick', 1);
      if (!removed.error) {
        character.inventory = removed.inventory;
        try {
          saveAccounts();
        } catch (error) {
          character.inventory = inventory;
          console.error('[RageRP vehicle] Could not save a broken lockpick:', error);
          message(attempt.player, 'Не удалось сохранить результат взлома.');
          return;
        }
      }
    }
    message(attempt.player, outcome.lockpickBroken
      ? 'Не удалось взломать автомобиль. Отмычка сломалась.'
      : 'Не удалось взломать автомобиль.');
    maybeSendPoliceTheftAlert('failure', attempt.player, vehicleInfo);
    return;
  }

  hotwiredVehicles.set(attempt.vehicleId, attempt.vehicle);
  message(attempt.player, 'Замок вскрыт. Двигатель можно запустить без штатного ключа.');
  maybeSendPoliceTheftAlert('success', attempt.player, vehicleInfo);
}

function startTheftAttempt(player, vehicle) {
  if (!characterFor(player) || player.dimension !== 0 || player.vehicle ||
      openPhones.has(player.id) || openInventories.has(player.id) ||
      openDealerships.has(player.id) || hudNotifications.has(player.id)) return;

  const vehicleInfo = starterVehicleForEntity(vehicle);
  if (!vehicleInfo || !playerNearVehicle(player, vehicle, 3.5)) {
    message(player, 'Подойди ближе к личному автомобилю.');
    return;
  }
  if (!vehicleIsLocked(vehicleInfo)) {
    message(player, 'Автомобиль не закрыт.');
    return;
  }
  if (hasVehicleAccess(player, vehicleInfo)) {
    message(player, 'У тебя уже есть доступ к этому автомобилю.');
    return;
  }
  if (theftAttemptRegistry.getByPlayer(player.id) ||
      theftAttemptRegistry.getByVehicle(vehicleInfo.vehicle.vehicleId)) {
    message(player, 'Кто-то уже пытается взломать автомобиль.');
    return;
  }
  const inventory = ensureCharacterInventory(characterFor(player));
  if (Inventory.countItems(inventory, 'lockpick') < 1) {
    message(player, 'Для взлома нужна отмычка.');
    return;
  }

  const attempt = {
    vehicleId: vehicleInfo.vehicle.vehicleId,
    playerId: player.id,
    ownerAccountKey: vehicleInfo.accountKey,
    vehicle,
    player,
    timeout: null
  };
  if (!theftAttemptRegistry.reserve(attempt)) {
    message(player, 'Кто-то уже пытается взломать автомобиль.');
    return;
  }
  attempt.timeout = setTimeout(
    () => completeTheftAttempt(attempt),
    VehicleTheftConfig.attemptDurationMs
  );
  message(player, 'Начался взлом замка. Не отходи от автомобиля.');
  maybeSendPoliceTheftAlert('attempt', player, vehicleInfo);
}

function toggleVehicleHood(player, vehicle) {
  const vehicleInfo = starterVehicleForEntity(vehicle);
  if (!vehicleInfo || !playerNearVehicle(player, vehicle, 3.5)) {
    message(player, 'Подойди ближе к личному автомобилю.');
    return;
  }
  if (!hasVehicleAccess(player, vehicleInfo)) {
    message(player, 'У тебя нет доступа к капоту этого автомобиля.');
    return;
  }

  const state = vehicleDoorStates.get(vehicleInfo.vehicle.vehicleId) || {
    hoodOpen: false,
    trunkOpen: false
  };
  setVehicleCompartmentState(vehicleInfo, 'hood', !state.hoodOpen);
}

function onlinePhonePlayers() {
  const online = [];
  mp.players.forEach((player) => {
    if (player.dimension !== 0) return;
    const account = getAccount(player);
    if (!account.character) return;

    online.push({
      player,
      staticId: ensureStaticId(account),
      name: `${account.character.firstName} ${account.character.lastName}`,
      criminalRecords: criminalRecordsFor(account.character),
      x: Number(player.position.x),
      y: Number(player.position.y),
      z: Number(player.position.z)
    });
  });
  return online;
}

function adminIsAuthorized(player) {
  const account = getAccount(player);
  if (!account || !account.character) return false;
  return adminStaticIds.has(ensureStaticId(account));
}

function findOnlinePlayerByStaticId(staticId) {
  const safeStaticId = String(staticId || '').trim();
  return onlineAdminPlayers().find((entry) => entry.staticId === safeStaticId) || null;
}

function onlineAdminPlayers() {
  const online = [];
  mp.players.forEach((player) => {
    const account = getAccount(player);
    if (!account) return;
    const character = account.character;
    online.push({
      player,
      staticId: ensureStaticId(account),
      name: character
        ? `${character.firstName} ${character.lastName}`
        : String(player.name || 'Без имени'),
      faction: character && character.faction
        ? String(character.faction)
        : 'Civilian',
      x: Number(player.position.x),
      y: Number(player.position.y),
      z: Number(player.position.z)
    });
  });
  return online;
}

function adminPlayerSnapshot() {
  return onlineAdminPlayers().map((entry) => ({
    staticId: entry.staticId,
    name: entry.name,
    faction: entry.faction,
    isAdmin: adminStaticIds.has(entry.staticId),
    isFrozen: adminFrozenPlayers.get(entry.player.id) === true,
    x: entry.x,
    y: entry.y,
    z: entry.z
  }));
}

function phoneStateFor(player) {
  const account = getAccount(player);
  ensureStarterVehicle(account);
  if (!Array.isArray(account.messages)) account.messages = [];
  const starterVehicle = starterVehicleState(player);
  const ownedVehicles = purchasedVehicleStatesFor(player);
  const passportRequest = vehiclePassportShareRequests.get(player.id);
  return {
    staticId: account.staticId,
    name: `${account.character.firstName} ${account.character.lastName}`,
    cash: Number(account.character.cash) || 0,
    bank: Number(account.character.bank) || 0,
    online: onlinePhonePlayers().map((person) => ({
      staticId: person.staticId,
      name: person.name,
      criminalRecords: person.criminalRecords,
      x: person.x,
      y: person.y,
      z: person.z
    })),
    messages: account.messages.slice(-100),
    ads: phoneAds.slice(-30),
    taxiCalls: taxiCalls.slice(-20),
    starterVehicle,
    vehicleKeys: vehicleKeysFor(player),
    ownedVehicles,
    vehiclePassport: vehiclePassportFor(player),
    passportShareRequest: passportRequest
      ? { requestId: passportRequest.requestId, fromName: passportRequest.fromName }
      : null,
    numbers: phoneNumbersFor(starterVehicle, ownedVehicles),
    firstName: account.character.firstName,
    lastName: account.character.lastName,
    criminalRecords: criminalRecordsFor(account.character),
    militaryTicket: account.character.militaryTicket || null
  };
}

function vehiclePassportFor(player) {
  const account = getAccount(player);
  const character = account.character;
  const vehicle = starterVehicleState(player);
  if (!character || !vehicle) return null;

  return {
    model: vehicle.name,
    plate: vehicle.plate,
    region: vehicle.region,
    ownerName: `${character.firstName} ${character.lastName}`,
    ownerFirstName: character.firstName,
    ownerLastName: character.lastName,
    ownerStaticId: ensureStaticId(account),
    status: vehicle.isOut ? 'Вызван' : 'На парковке'
  };
}

function nearbyVehiclePassportTargets(player) {
  const account = getAccount(player);
  const origin = {
    staticId: ensureStaticId(account),
    dimension: player.dimension,
    x: Number(player.position.x),
    y: Number(player.position.y),
    z: Number(player.position.z)
  };
  const candidates = onlinePhonePlayers().map((entry) => ({
    staticId: entry.staticId,
    name: entry.name,
    dimension: entry.player.dimension,
    x: entry.x,
    y: entry.y,
    z: entry.z
  }));
  return VehiclePassport.targetsWithinShareRange(origin, candidates);
}

function findNearbyPassportTarget(player, staticId) {
  const target = onlinePhonePlayers().find((entry) => entry.staticId === staticId);
  if (!target) return null;
  const targets = nearbyVehiclePassportTargets(player);
  return targets.some((entry) => entry.staticId === staticId) ? target.player : null;
}

function findNearbyPassportTargetById(player, targetId) {
  const target = onlinePhonePlayers().find((entry) => entry.player.id === targetId);
  if (!target || target.player.id === player.id) return null;
  return findNearbyPassportTarget(player, target.staticId);
}

function vehiclePassportShareNotice(player, text) {
  if (openPhones.has(player.id)) phoneNotice(player, text);
  else message(player, text);
}

function requestVehiclePassportShare(player, target) {
  if (!target || target.id === player.id) {
    vehiclePassportShareNotice(player, 'Выбери другого игрока рядом.');
    return;
  }

  const now = Date.now();
  const lastShare = vehiclePassportShareCooldowns.get(player.id) || 0;
  if (now - lastShare < 2000) {
    vehiclePassportShareNotice(player, 'Подожди немного перед следующим показом ПТС.');
    return;
  }
  if (vehiclePassportShareRequests.has(target.id)) {
    vehiclePassportShareNotice(player, 'У этого игрока уже есть ожидающий запрос на просмотр документа.');
    return;
  }

  const passport = vehiclePassportFor(player);
  if (!passport) {
    vehiclePassportShareNotice(player, 'Не удалось получить данные ПТС.');
    return;
  }

  const account = getAccount(player);
  const character = account.character;
  vehiclePassportShareCooldowns.set(player.id, now);
  const requestId = `${now.toString(36)}-${(++vehiclePassportRequestSequence).toString(36)}`;
  const targetCharacter = characterFor(target);
  const targetName = targetCharacter
    ? `${targetCharacter.firstName} ${targetCharacter.lastName}`
    : String(target.name || 'Игрок');
  const request = {
    requestId,
    sender: player,
    target,
    passport,
    targetName,
    fromName: `${character.firstName} ${character.lastName}`,
    timeout: null
  };
  request.timeout = setTimeout(() => {
    if (vehiclePassportShareRequests.get(target.id) !== request) return;
    clearVehiclePassportShare(
      target.id,
      'Время запроса на просмотр ПТС истекло.',
      'Игрок не ответил на запрос показа ПТС.'
    );
  }, vehiclePassportRequestTimeoutMs);
  vehiclePassportShareRequests.set(target.id, request);

  target.call('ragerp:phone:passport:request', [JSON.stringify({
    requestId,
    fromName: request.fromName
  })]);
  const notice = `Запрос показа ПТС отправлен игроку ${targetName}.`;
  if (openPhones.has(player.id)) {
    updatePhone(player, {
      vehiclePassportTargets: null,
      vehiclePassportTargetsLoading: false,
      notice
    });
  } else {
    message(player, notice);
  }
}

function clearVehiclePassportShare(targetId, targetNotice, senderNotice) {
  const request = vehiclePassportShareRequests.get(targetId);
  if (!request) return null;

  clearTimeout(request.timeout);
  vehiclePassportShareRequests.delete(targetId);
  if (mp.players.exists(request.target)) {
    request.target.call('ragerp:phone:passport:request', [JSON.stringify(null)]);
    if (targetNotice) vehiclePassportShareNotice(request.target, targetNotice);
  }
  if (senderNotice && mp.players.exists(request.sender)) {
    vehiclePassportShareNotice(request.sender, senderNotice);
  }
  return request;
}

function onlinePhoneState() {
  return onlinePhonePlayers().map((person) => ({
    staticId: person.staticId,
    name: person.name,
    criminalRecords: person.criminalRecords,
    x: person.x,
    y: person.y,
    z: person.z
  }));
}

function updatePhone(player, update) {
  if (openPhones.has(player.id)) {
    player.call('ragerp:phone:update', [JSON.stringify(update)]);
  }
}

function updateOpenPhones(update) {
  mp.players.forEach((player) => {
    if (openPhones.has(player.id)) updatePhone(player, update);
  });
}

function phoneNotice(player, text) {
  if (openPhones.has(player.id)) player.call('ragerp:phone:notice', [text]);
}

function phoneCallState(player, call, state, partnerName, text) {
  if (!player || !mp.players.exists(player)) return;
  const partner = player.id === call.caller.id ? call.receiver : call.caller;
  player.call('ragerp:phone:call:state', [JSON.stringify({
    callId: call.id,
    state,
    partnerId: partner.id,
    partnerName,
    message: text || ''
  })]);
}

function finishPhoneCall(call, text) {
  if (!call || phoneCalls.get(call.id) !== call) return;
  if (call.timeout) {
    clearTimeout(call.timeout);
    call.timeout = null;
  }
  phoneCalls.delete(call.id);
  if (phoneCallByPlayer.get(call.caller.id) === call) phoneCallByPlayer.delete(call.caller.id);
  if (phoneCallByPlayer.get(call.receiver.id) === call) phoneCallByPlayer.delete(call.receiver.id);

  phoneCallState(call.caller, call, 'ended', call.receiverName, text);
  if (call.receiverNotified || call.status === 'active') {
    phoneCallState(call.receiver, call, 'ended', call.callerName, text);
  }
}

function startPhoneCall(player, targetStaticId) {
  const account = getAccount(player);
  const character = account.character;
  if (!character || player.dimension !== 0 || !openPhones.has(player.id)) return;
  if (phoneCallByPlayer.has(player.id)) {
    phoneNotice(player, 'У тебя уже есть активный вызов.');
    return;
  }

  const now = Date.now();
  if (now - (phoneCallCooldowns.get(player.id) || 0) < 1500) {
    phoneNotice(player, 'Подожди немного перед следующим вызовом.');
    return;
  }
  phoneCallCooldowns.set(player.id, now);

  const validTargetId = String(targetStaticId || '');
  if (!/^\d{3}-\d{3}$/.test(validTargetId) || validTargetId === account.staticId) {
    phoneNotice(player, 'Укажи корректный ID игрока.');
    return;
  }

  const target = onlinePhonePlayers().find((person) => person.staticId === validTargetId);
  if (!target || target.player === player) {
    phoneNotice(player, 'Абонент не в сети.');
    return;
  }
  if (phoneCallByPlayer.has(target.player.id)) {
    phoneNotice(player, 'Абонент уже разговаривает.');
    return;
  }

  const call = {
    id: `${Date.now()}-${++phoneCallSequence}`,
    caller: player,
    receiver: target.player,
    callerName: `${character.firstName} ${character.lastName}`,
    receiverName: target.name,
    status: 'ringing',
    receiverNotified: false,
    timeout: null
  };
  phoneCalls.set(call.id, call);
  phoneCallByPlayer.set(call.caller.id, call);
  phoneCallByPlayer.set(call.receiver.id, call);
  phoneCallState(call.caller, call, 'ringing', call.receiverName);

  if (mediaSettingsFor(getAccount(call.receiver)).showCallNotifications) {
    call.receiverNotified = true;
    phoneCallState(call.receiver, call, 'incoming', call.callerName);
  }

  call.timeout = setTimeout(() => {
    finishPhoneCall(call, 'Нет ответа.');
  }, phoneCallTimeoutMs);
}

function answerPhoneCall(player, callId, accepted) {
  const call = phoneCalls.get(callId);
  if (!call || call.receiver.id !== player.id || call.status !== 'ringing') return;
  if (accepted !== true) {
    finishPhoneCall(call, 'Звонок отклонён.');
    return;
  }
  if (!mp.players.exists(call.caller) || !mp.players.exists(call.receiver) ||
      !characterFor(call.caller) || !characterFor(call.receiver)) {
    finishPhoneCall(call, 'Абонент недоступен.');
    return;
  }

  if (call.timeout) {
    clearTimeout(call.timeout);
    call.timeout = null;
  }
  call.status = 'active';
  phoneCallState(call.caller, call, 'active', call.receiverName);
  phoneCallState(call.receiver, call, 'active', call.callerName);
}

function endPhoneCall(player) {
  const call = phoneCallByPlayer.get(player.id);
  if (!call || (call.caller.id !== player.id && call.receiver.id !== player.id)) return;
  finishPhoneCall(call, 'Звонок завершён.');
}

function updateVoiceRoute(listener, speaker, allowed) {
  let speakerStates = voiceRouteStates.get(listener.id);
  if (!speakerStates) {
    speakerStates = new Map();
    voiceRouteStates.set(listener.id, speakerStates);
  }
  if (speakerStates.get(speaker.id) === allowed) return;

  const method = allowed ? listener.enableVoiceTo : listener.disableVoiceTo;
  if (typeof method !== 'function') {
    console.error('[RageRP voice] The server runtime does not support voice routing.');
    return;
  }
  method.call(listener, speaker);
  speakerStates.set(speaker.id, allowed);
}

function updateVoiceRoutes() {
  const players = [];
  mp.players.forEach((player) => players.push(player));
  const playerIds = new Set(players.map((player) => player.id));

  players.forEach((listener) => {
    const listenerAccount = getAccount(listener);
    const listenerCharacter = listenerAccount.character;
    const listenerSettings = mediaSettingsFor(listenerAccount);

    players.forEach((speaker) => {
      if (speaker === listener) return;
      const speakerAccount = getAccount(speaker);
      const dx = Number(listener.position.x) - Number(speaker.position.x);
      const dy = Number(listener.position.y) - Number(speaker.position.y);
      const dz = Number(listener.position.z) - Number(speaker.position.z);
      const distanceSquared = dx * dx + dy * dy + dz * dz;
      const listenerCall = phoneCallByPlayer.get(listener.id);
      const speakerCall = phoneCallByPlayer.get(speaker.id);
      const phoneCall = Boolean(listenerCall && listenerCall === speakerCall &&
        listenerCall.status === 'active');
      const allowed = Boolean(listenerCharacter && speakerAccount.character) &&
        Voice.canReceiveVoice({
          listenerDimension: listener.dimension,
          speakerDimension: speaker.dimension,
          distanceSquared,
          range: voiceProximityRange,
          speakerPlaytimeMs: playtimeMsFor(speakerAccount, speaker.id),
          muteUnderHours: listenerSettings.voiceMuteUnderHours,
          phoneCall
        });
      updateVoiceRoute(listener, speaker, allowed);
    });
  });

  voiceRouteStates.forEach((speakerStates, listenerId) => {
    if (!playerIds.has(listenerId)) {
      voiceRouteStates.delete(listenerId);
      return;
    }
    speakerStates.forEach((_, speakerId) => {
      if (!playerIds.has(speakerId)) speakerStates.delete(speakerId);
    });
  });
}

function accountByStaticId(staticId) {
  const key = Object.keys(accounts).find((accountKey) =>
    accounts[accountKey] && accounts[accountKey].staticId === staticId
  );
  return key ? { key, account: accounts[key] } : null;
}

function playerByAccountKey(accountKey) {
  let result = null;
  mp.players.forEach((player) => {
    if (sessions.get(player.id) === accountKey) result = player;
  });
  return result;
}

function broadcastTaxiCalls(notice) {
  const update = { taxiCalls: taxiCalls.slice(-20) };
  updateOpenPhones(update);
  if (notice) {
    mp.players.forEach((player) => phoneNotice(player, notice));
  }
}

function formatStaticId(value) {
  const digits = String(value).padStart(6, '0');
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

function ensureStaticId(account) {
  const used = new Set();
  Object.keys(accounts).forEach((key) => {
    const otherAccount = accounts[key];
    if (otherAccount && otherAccount !== account &&
        /^\d{3}-\d{3}$/.test(String(otherAccount.staticId || ''))) {
      used.add(otherAccount.staticId);
    }
  });

  if (/^\d{3}-\d{3}$/.test(String(account.staticId || '')) && !used.has(account.staticId)) {
    return account.staticId;
  }

  const start = Math.floor(Math.random() * 1000000);
  for (let offset = 0; offset < 1000000; offset++) {
    const id = formatStaticId((start + offset) % 1000000);
    if (used.has(id)) continue;

    account.staticId = id;
    saveAccounts();
    return id;
  }

  throw new Error('No static IDs are available.');
}

function defaultAppearance(gender) {
  const selectedGender = allowedGenders.has(gender) ? gender : 'male';
  return {
    gender: selectedGender,
    mother: 21,
    father: 0,
    shapeMix: 0.5,
    skinMix: 0.5,
    eyeColor: 0,
    hairColor: 0,
    highlightColor: 0,
    hairStyle: 0,
    eyebrows: 0,
    beard: 255,
    faceFeatures: new Array(20).fill(0),
    clothing: {
      torso: 0,
      legs: 0,
      shoes: 0,
      undershirt: 0,
      top: 0
    }
  };
}

function normalizeAppearance(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      !allowedGenders.has(value.gender) ||
      !Array.isArray(value.faceFeatures) || value.faceFeatures.length !== 20 ||
      !value.clothing || typeof value.clothing !== 'object' || Array.isArray(value.clothing)) {
    return null;
  }

  const integerInRange = (candidate, min, max) =>
    Number.isInteger(candidate) && candidate >= min && candidate <= max;
  const numberInRange = (candidate, min, max) =>
    Number.isFinite(candidate) && candidate >= min && candidate <= max;
  const features = value.faceFeatures.map((feature) =>
    numberInRange(feature, -1, 1) ? feature : null
  );
  const clothing = {};

  for (const component of ['torso', 'legs', 'shoes', 'undershirt', 'top']) {
    if (!integerInRange(value.clothing[component], 0, 255)) return null;
    clothing[component] = value.clothing[component];
  }

  if (!integerInRange(value.mother, 0, 45) ||
      !integerInRange(value.father, 0, 45) ||
      !numberInRange(value.shapeMix, 0, 1) ||
      !numberInRange(value.skinMix, 0, 1) ||
      !integerInRange(value.eyeColor, 0, 31) ||
      !integerInRange(value.hairColor, 0, 63) ||
      !integerInRange(value.highlightColor, 0, 63) ||
      !integerInRange(value.hairStyle, 0, 255) ||
      !integerInRange(value.eyebrows, 0, 33) ||
      (value.beard !== 255 && !integerInRange(value.beard, 0, 28)) ||
      features.includes(null)) {
    return null;
  }

  return {
    gender: value.gender,
    mother: value.mother,
    father: value.father,
    shapeMix: value.shapeMix,
    skinMix: value.skinMix,
    eyeColor: value.eyeColor,
    hairColor: value.hairColor,
    highlightColor: value.highlightColor,
    hairStyle: value.hairStyle,
    eyebrows: value.eyebrows,
    beard: value.gender === 'male' ? value.beard : 255,
    faceFeatures: features,
    clothing
  };
}

function applyAppearance(player, appearance) {
  const model = mp.joaat(appearance.gender === 'female' ? 'mp_f_freemode_01' : 'mp_m_freemode_01');
  if (player.model !== model) {
    player.model = model;
  }

  player.setCustomization(
    appearance.gender === 'male',
    appearance.mother,
    appearance.father,
    0,
    appearance.mother,
    appearance.father,
    0,
    appearance.shapeMix,
    appearance.skinMix,
    0,
    appearance.eyeColor,
    appearance.hairColor,
    appearance.highlightColor,
    appearance.faceFeatures
  );
  player.setHeadOverlay(2, [appearance.eyebrows, 1, appearance.hairColor, appearance.hairColor]);
  player.setHeadOverlay(1, [
    appearance.beard,
    appearance.beard === 255 ? 0 : 1,
    appearance.hairColor,
    appearance.hairColor
  ]);
  player.setClothes(2, appearance.hairStyle, 0, 0);
  player.setClothes(3, appearance.clothing.torso, 0, 0);
  player.setClothes(4, appearance.clothing.legs, 0, 0);
  player.setClothes(6, appearance.clothing.shoes, 0, 0);
  player.setClothes(8, appearance.clothing.undershirt, 0, 0);
  player.setClothes(11, appearance.clothing.top, 0, 0);
}

function publishNameTag(player) {
  const account = getAccount(player);
  const character = account.character;
  if (!character) return;

  player.setVariable('ragerp:nametag', `${account.staticId}\n${character.firstName} ${character.lastName}`);
}

function message(player, text) {
  player.outputChatBox(`[RageRP] ${text}`);
}

function isValidPosition(position) {
  return position &&
    Number.isFinite(position.x) &&
    Number.isFinite(position.y) &&
    Number.isFinite(position.z);
}

function spawnPlayer(player, character) {
  const position = character && isValidPosition(character.position)
    ? character.position
    : spawnPoint;

  if (character) {
    let appearance = normalizeAppearance(character.appearance);
    if (!appearance) {
      appearance = defaultAppearance(character.gender);
      character.appearance = appearance;
      character.gender = appearance.gender;
      saveAccounts();
    }

    player.dimension = 0;
    applyAppearance(player, appearance);
  }

  player.spawn(new mp.Vector3(position.x, position.y, position.z));
  player.health = 100;
  if (character) restoreInventoryWeapons(player, ensureCharacterInventory(character));
  if (character) publishNameTag(player);
}

function showHelp(player) {
  message(player, '/register <Имя> <Фамилия> <возраст> [male|female] — резервное создание персонажа');
  message(player, '/stats, /bank, /deposit <сумма>, /withdraw <сумма>');
  message(player, 'Инвентарь: I; быстрые слоты: 1–4. Предметы выдаются разрешённым администраторам через /inventorygive.');
  message(player, '/job [courier|unemployed], /work, /faction, /joinfaction <civilian|mechanic>, /me <текст>');
  message(player, '/conviction <статик ID> <месяцев> <причина> — добавить приговор (для разрешённых ID)');
  message(player, 'Телефон: стрелка вверх или Tab. Доступны SMS, банк, GPS, такси и объявления.');
  message(player, 'Автомобиль: наведи камеру на машину и нажми E. Управляй ключами в приложении «Моя машина».');
  message(player, 'Автосалон: нажми E у отметки в городе, чтобы посмотреть каталог машин.');
  message(player, 'Машина: двигатель 2, замок L, радио Q; поворотники [ ] и аварийка \\. Заправка — E у АЗС.');
  message(player, 'Администраторам: /bmwm5g90 — создать тестовый BMW M5 рядом с собой.');
  message(player, 'Тестовая карта: /maptest — перейти к пилоту Тулы. HUD: /hudtest — проверить уведомление.');
}

function parseAmount(value) {
  if (!/^\d+$/.test(String(value || ''))) {
    return null;
  }

  const amount = Number(value);
  return Number.isSafeInteger(amount) && amount > 0 && amount <= 1000000
    ? amount
    : null;
}

function formatMoney(amount) {
  return `${Math.trunc(amount).toLocaleString('ru-RU')} ₽`;
}

function onlinePlayerCount(excludedPlayerId) {
  let count = 0;
  mp.players.forEach((onlinePlayer) => {
    if (excludedPlayerId === undefined || onlinePlayer.id !== excludedPlayerId) count += 1;
  });
  return count;
}

function hudStateFor(player) {
  const account = getAccount(player);
  const character = account.character;
  if (!character) return null;

  return {
    staticId: ensureStaticId(account),
    name: `${character.firstName} ${character.lastName}`,
    faction: String(character.faction || 'Civilian'),
    job: String(character.job || 'unemployed'),
    cash: Number(character.cash) || 0,
    bank: Number(character.bank) || 0,
    onlineCount: onlinePlayerCount()
  };
}

function updateHud(player) {
  const state = hudStateFor(player);
  if (state) player.call('ragerp:hud:update', [JSON.stringify(state)]);
}

function broadcastHudOnlineCount(excludedPlayerId) {
  const payload = JSON.stringify({ onlineCount: onlinePlayerCount(excludedPlayerId) });
  mp.players.forEach((target) => {
    if (target.id === excludedPlayerId || !hudStateFor(target)) return;
    target.call('ragerp:hud:update', [payload]);
  });
}

function sendHudNotification(player, details) {
  const account = getAccount(player);
  if (!account.character || player.dimension !== 0) return;

  const id = `${Date.now()}-${++hudNotificationSequence}`;
  const notification = {
    id,
    title: String(details.title || 'Уведомление').slice(0, 40),
    message: String(details.message || '').slice(0, 240),
    acceptLabel: String(details.acceptLabel || 'Принять').slice(0, 24),
    declineLabel: String(details.declineLabel || 'Отказаться').slice(0, 24)
  };
  hudNotifications.set(player.id, {
    id,
    responseEvent: details.responseEvent || ''
  });
  player.call('ragerp:hud:notification', [JSON.stringify(notification)]);
}

function requireCharacter(player) {
  const character = characterFor(player);
  if (!character) {
    message(player, 'Сначала создай персонажа: /register Имя Фамилия 25');
    return null;
  }

  return character;
}

function sendStats(player, character) {
  const account = getAccount(player);
  message(player, `${character.firstName} ${character.lastName}, ${character.age} лет`);
  message(player, `Статик ID: ${account.staticId}`);
  message(player, `Фракция: ${character.faction}; работа: ${character.job}`);
  message(player, `Наличные: ${formatMoney(character.cash)}; банк: ${formatMoney(character.bank)}`);
}

function createCharacter(player, firstNameValue, lastNameValue, ageValue, appearanceValue) {
  const account = getAccount(player);
  if (account.character) {
    return 'Персонаж уже зарегистрирован.';
  }

  const firstName = String(firstNameValue || '').trim();
  const lastName = String(lastNameValue || '').trim();
  const age = Number(ageValue);
  const appearance = normalizeAppearance(appearanceValue);
  if (!validRussianName.test(firstName) || !validRussianName.test(lastName) ||
      !Number.isInteger(age) || age < 18 || age > 100 || !appearance) {
    return 'Имя и фамилия — только кириллица (2–20 букв); проверь возраст и настройки внешности.';
  }

  ensureStaticId(account);
  account.character = {
    firstName,
    lastName,
    age,
    gender: appearance.gender,
    appearance,
    starterVehicle: {
      model: starterVehicleModel,
      plate: russianPlateForStaticId(account.staticId),
      region: starterVehicleRegion
    },
    cash: 5000,
    bank: 10000,
    faction: 'Civilian',
    job: 'unemployed',
    militaryTicket: null,
    inventory: Inventory.createEmptyInventory(),
    position: spawnPoint
  };
  saveAccounts();
  spawnPlayer(player, account.character);
  player.dimension = 0;
  player.call('ragerp:hud:show', [JSON.stringify(hudStateFor(player))]);
  message(player, `Добро пожаловать, ${firstName} ${lastName}! Начни с /help.`);
  return null;
}

function openRegistration(player) {
  const account = getAccount(player);
  ensureStaticId(account);
  player.dimension = registrationDimensionOffset + Number(player.id || 0);

  const appearance = defaultAppearance('male');
  applyAppearance(player, appearance);
  player.spawn(new mp.Vector3(registrationPoint.x, registrationPoint.y, registrationPoint.z));
  player.heading = 180;
  player.health = 100;
  previewGenders.set(player.id, appearance.gender);
  player.call('ragerp:registration:show', [account.staticId]);
}

function openAdminMenu(player) {
  if (!requireCharacter(player)) return;
  if (!adminIsAuthorized(player)) {
    message(player, 'Доступ в админ-меню запрещён.');
    return;
  }

  const account = getAccount(player);
  const staticId = ensureStaticId(account);
  Admin.recordLog('admin_online', 'admin_menu_open', staticId, null, 'Админ-меню открыто.');
  player.call('ragerp:admin:open', [JSON.stringify({
    staticId,
    categories: Admin.LOG_CATEGORIES,
    players: adminPlayerSnapshot(),
    logs: Admin.getLogs(null, '', 100)
  })]);
}

function handleCommand(player, command) {
  const parts = String(command || '').trim().replace(/^\/+/, '').split(/\s+/);
  const name = (parts.shift() || '').toLowerCase();
  const args = parts;

  if (name === 'bmwm5g90') {
    if (!requireCharacter(player)) return;
    if (!adminIsAuthorized(player)) {
      message(player, 'Доступ к тестовому автомобилю запрещён.');
      return;
    }
    if (player.vehicle) {
      message(player, 'Выйди из текущей машины перед тестовым спавном.');
      return;
    }
    if (!isValidPosition(player.position)) {
      message(player, 'Не удалось определить позицию для тестового спавна.');
      return;
    }

    const heading = Number(player.heading) || 0;
    const radians = heading * Math.PI / 180;
    const position = new mp.Vector3(
      Number(player.position.x) - Math.sin(radians) * 5,
      Number(player.position.y) + Math.cos(radians) * 5,
      Number(player.position.z) + 0.3
    );
    const vehicle = mp.vehicles.new(mp.joaat('bmwm5g90'), position, {
      heading,
      dimension: player.dimension,
      numberPlate: 'TESTM5',
      locked: false,
      engine: false
    });
    if (!vehicle) {
      message(player, 'RAGE:MP не смог создать BMW M5. Проверь загрузку vehicle DLC.');
      return;
    }

    const previousVehicle = adminTestVehicles.get(player.id);
    if (previousVehicle && mp.vehicles.exists(previousVehicle)) {
      previousVehicle.destroy();
      unregisterVehicleFuel(previousVehicle);
    }
    adminTestVehicles.set(player.id, vehicle);
    const account = getAccount(player);
    registerVehicleFuel(vehicle, sessions.get(player.id), 'bmwm5g90');
    Admin.recordLog('admin_online', 'test_vehicle_spawn', ensureStaticId(account), null,
      'Создан тестовый BMW M5 G90.');
    message(player, 'Тестовый BMW M5 G90 создан рядом.');
    return;
  }

  if (name === 'admin') {
    openAdminMenu(player);
    return;
  }

  if (name === 'hudtest') {
    if (!requireCharacter(player)) return;
    sendHudNotification(player, {
      title: 'Уведомление',
      message: 'Демо-событие: зафиксирована поломка светофора. Направиться на ремонт?',
      acceptLabel: 'Принять',
      declineLabel: 'Отказаться',
      responseEvent: 'ragerp:hud:demo-response'
    });
    return;
  }

  if (name === 'maptest') {
    if (!requireCharacter(player)) return;
    player.dimension = 0;
    player.position = new mp.Vector3(mapTestPoint.x, mapTestPoint.y, mapTestPoint.z);
    message(player, 'Перемещение к тестовому greybox-пилоту Тулы.');
    return;
  }

  if (name === 'help') {
    showHelp(player);
    return;
  }

  if (name === 'inventorygive') {
    if (!requireCharacter(player)) return;
    const issuerAccount = getAccount(player);
    const issuerStaticId = ensureStaticId(issuerAccount);
    if (!inventoryAdminStaticIds.size) {
      message(player, 'Команда отключена: задай RAGERP_INVENTORY_ADMIN_IDS перед запуском сервера.');
      return;
    }
    if (!inventoryAdminStaticIds.has(issuerStaticId)) {
      message(player, 'У тебя нет прав выдавать предметы.');
      return;
    }

    const targetStaticId = String(args[0] || '');
    const itemId = String(args[1] || '').toLowerCase();
    const quantity = /^\d{1,3}$/.test(String(args[2] || '')) ? Number(args[2]) : 0;
    if (!/^\d{3}-\d{3}$/.test(targetStaticId) ||
        !Inventory.ITEM_DEFINITIONS[itemId] ||
        !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
      message(player, 'Использование: /inventorygive <статик ID> <medkit|armor_vest|pistol|carbine|lockpick> <1–100>.');
      return;
    }

    const target = accountByStaticId(targetStaticId);
    if (!target || !target.account.character) {
      message(player, 'Персонаж с таким статик ID не найден.');
      return;
    }
    const targetCharacter = target.account.character;
    const result = Inventory.addItems(ensureCharacterInventory(targetCharacter), itemId, quantity);
    if (result.error) {
      inventoryNotice(player, inventoryActionError(result.error));
      return;
    }

    targetCharacter.inventory = result.inventory;
    saveAccounts();
    const targetPlayer = playerByAccountKey(target.key);
    if (targetPlayer) {
      updateInventoryClient(targetPlayer);
      message(targetPlayer, `Получен предмет: ${Inventory.ITEM_DEFINITIONS[itemId].name} ×${quantity}.`);
    }
    console.info(`[RageRP inventory] ${issuerStaticId} granted ${itemId} x${quantity} to ${targetStaticId}.`);
    message(player, `Выдано: ${Inventory.ITEM_DEFINITIONS[itemId].name} ×${quantity}; получатель ${targetStaticId}.`);
    return;
  }

  if (name === 'conviction') {
    const issuerCharacter = requireCharacter(player);
    if (!issuerCharacter) return;

    const issuerAccount = getAccount(player);
    const issuerStaticId = ensureStaticId(issuerAccount);
    if (!justiceAdminStaticIds.size) {
      message(player, 'Команда отключена: задай RAGERP_JUSTICE_ADMIN_IDS перед запуском сервера.');
      return;
    }
    if (!justiceAdminStaticIds.has(issuerStaticId)) {
      message(player, 'У тебя нет прав добавлять судебные записи.');
      return;
    }

    const targetStaticId = String(args[0] || '');
    const termMonths = /^\d{1,3}$/.test(String(args[1] || '')) ? Number(args[1]) : 0;
    const reason = args.slice(2).join(' ').replace(/[\u0000-\u001f\u007f]/g, ' ').trim();
    if (!/^\d{3}-\d{3}$/.test(targetStaticId) ||
        !Number.isInteger(termMonths) || termMonths < 1 || termMonths > 120 ||
        !reason || reason.length > 120) {
      message(player, 'Использование: /conviction <статик ID> <месяцев 1–120> <причина до 120 символов>.');
      return;
    }

    const target = accountByStaticId(targetStaticId);
    if (!target || !target.account.character) {
      message(player, 'Персонаж с таким статик ID не найден.');
      return;
    }

    const targetCharacter = target.account.character;
    const records = criminalRecordsFor(targetCharacter);
    if (records.length >= 100) {
      message(player, 'В деле уже максимальное количество записей.');
      return;
    }

    const issuedAt = Date.now();
    const expiresAt = addCalendarMonths(issuedAt, termMonths);
    const record = {
      id: `${issuedAt}-${records.length + 1}`,
      issuedAt,
      termMonths,
      expiresAt,
      reason,
      issuerName: `${issuerCharacter.firstName} ${issuerCharacter.lastName}`,
      issuerStaticId
    };
    targetCharacter.criminalRecords = records.concat(record);
    saveAccounts();

    updateOpenPhones({ online: onlinePhoneState() });
    const targetPlayer = playerByAccountKey(target.key);
    if (targetPlayer) {
      updatePhone(targetPlayer, {
        criminalRecords: targetCharacter.criminalRecords,
        notice: 'В личное дело добавлена судебная запись.'
      });
      message(targetPlayer, 'В личное дело добавлена судебная запись.');
    }

    message(player, `Приговор добавлен. Срок: ${termMonths} мес.; погашение: ${new Date(expiresAt).toLocaleDateString('ru-RU', { timeZone: 'UTC' })}.`);
    return;
  }

  if (name === 'register') {
    const gender = String(args[3] || 'male').toLowerCase();
    const error = allowedGenders.has(gender)
      ? createCharacter(player, args[0], args[1], args[2], defaultAppearance(gender))
      : 'Пол укажи как male или female.';
    if (error) message(player, error);
    return;
  }

  if (name === 'me') {
    const character = requireCharacter(player);
    const text = args.join(' ').trim().slice(0, 120);
    if (!character) return;
    if (!text) {
      message(player, 'Использование: /me <действие>');
      return;
    }

    const position = player.position;
    const line = `* ${character.firstName} ${character.lastName} ${text}`;
    mp.players.forEach((target) => {
      const targetPosition = target.position;
      const dx = position.x - targetPosition.x;
      const dy = position.y - targetPosition.y;
      const dz = position.z - targetPosition.z;
      if (dx * dx + dy * dy + dz * dz <= 20 * 20) {
        target.outputChatBox(line);
      }
    });
    return;
  }

  if (name === 'stats') {
    const character = requireCharacter(player);
    if (character) sendStats(player, character);
    return;
  }

  if (name === 'bank') {
    const character = requireCharacter(player);
    if (character) {
      message(player, `Наличные: ${formatMoney(character.cash)}; счёт: ${formatMoney(character.bank)}.`);
    }
    return;
  }

  if (name === 'deposit' || name === 'withdraw') {
    const character = requireCharacter(player);
    if (!character) return;

    const amount = parseAmount(args[0]);
    if (amount === null) {
      message(player, `Использование: /${name} <сумма до 1000000>.`);
      return;
    }

    const from = name === 'deposit' ? 'cash' : 'bank';
    const to = name === 'deposit' ? 'bank' : 'cash';
    if (character[from] < amount) {
      message(player, 'Недостаточно средств.');
      return;
    }

    character[from] -= amount;
    character[to] += amount;
    saveAccounts();
    updateHud(player);
    message(player, `Переведено ${formatMoney(amount)}. Наличные: ${formatMoney(character.cash)}; банк: ${formatMoney(character.bank)}.`);
    return;
  }

  if (name === 'job') {
    const character = requireCharacter(player);
    if (!character) return;

    const requestedJob = (args[0] || '').toLowerCase();
    if (!requestedJob) {
      message(player, `Текущая работа: ${character.job}. Доступно: courier, unemployed.`);
      return;
    }

    if (requestedJob !== 'courier' && requestedJob !== 'unemployed') {
      message(player, 'Доступно: /job courier или /job unemployed.');
      return;
    }

    character.job = requestedJob;
    saveAccounts();
    message(player, requestedJob === 'courier' ? 'Ты устроился курьером. Используй /work.' : 'Ты уволился.');
    return;
  }

  if (name === 'work') {
    const character = requireCharacter(player);
    if (!character) return;
    if (character.job !== 'courier') {
      message(player, 'Сначала устройся курьером: /job courier.');
      return;
    }

    const key = sessions.get(player.id);
    const remaining = workCooldownMs - (Date.now() - (workCooldowns.get(key) || 0));
    if (remaining > 0) {
      message(player, `Следующая смена доступна через ${Math.ceil(remaining / 1000)} сек.`);
      return;
    }

    workCooldowns.set(key, Date.now());
    character.cash += workPay;
    saveAccounts();
    updateHud(player);
    message(player, `Смена завершена. Получено ${formatMoney(workPay)}.`);
    return;
  }

  if (name === 'faction') {
    const character = requireCharacter(player);
    if (character) {
      message(player, `Текущая фракция: ${character.faction}. Открытые фракции: Civilian, Mechanic.`);
    }
    return;
  }

  if (name === 'joinfaction') {
    const character = requireCharacter(player);
    if (!character) return;

    const faction = allowedFactions.get((args[0] || '').toLowerCase());
    if (!faction) {
      message(player, 'Использование: /joinfaction civilian или /joinfaction mechanic.');
      return;
    }

    character.faction = faction;
    saveAccounts();
    message(player, `Ты вступил во фракцию ${faction}.`);
    return;
  }

  if (name) {
    message(player, 'Неизвестная команда. Используй /help.');
  }
}

mp.events.add('playerJoin', (player) => {
  const account = getAccount(player);
  const staticId = ensureStaticId(account);
  Admin.recordLog('auth_logs', 'player_connected', null, staticId,
    `Игрок подключился: ${player.name || 'Без имени'}.`);
  if (!Number.isSafeInteger(account.playtimeMs) || account.playtimeMs < 0) {
    account.playtimeMs = 0;
  }
  mediaSettingsFor(account);
  playtimeCheckpointAt.set(player.id, Date.now());
  console.log(`[RageRP] ${player.name} connected.`);
  broadcastHudOnlineCount();
});

mp.events.add('playerReady', async (player) => {
  const adminDatabase = await adminInitialization;
  if (!adminDatabase.ok) {
    player.kick('Не удалось проверить блокировки. Попробуйте подключиться позже.');
    return;
  }

  const account = getAccount(player);
  const ban = Admin.getBan(ensureStaticId(account));
  if (ban) {
    player.kick(`Админ-блокировка: ${ban.reason}`);
    Admin.recordLog('auth_logs', 'banned_connect_attempt', ban.createdBy,
      ensureStaticId(account), `Причина: ${ban.reason}`);
    return;
  }
  const character = account.character;
  if (!character) {
    openRegistration(player);
    return;
  }

  ensureStarterVehicle(account);
  spawnPlayer(player, character);
  player.call('ragerp:hud:show', [JSON.stringify(hudStateFor(player))]);
  message(player, `С возвращением, ${character.firstName}. Используй /help.`);
});

mp.events.add('ragerp:client:ui-ready', (player) => {
  const account = getAccount(player);
  player.call('ragerp:dealership:location', [JSON.stringify({
    position: Dealership.DEALERSHIP_POSITION,
    radius: Dealership.INTERACTION_RADIUS
  })]);
  if (!account.character) {
    player.call('ragerp:registration:show', [ensureStaticId(account)]);
    return;
  }

  if (player.dimension !== 0) return;
  player.call('ragerp:hud:show', [JSON.stringify(hudStateFor(player))]);
});

function dealershipCatalogFor(player) {
  const purchase = PersonalVehicles.purchaseState(purchasedVehiclesFor(getAccount(player)));
  return Dealership.VEHICLES.map((vehicle) => vehicle.id === PersonalVehicles.VEHICLE_ID
    ? Object.assign({}, vehicle, {
        purchasable: true,
        purchasedCount: purchase.count,
        purchaseLimit: purchase.limit,
        canPurchase: purchase.canPurchase
      })
    : vehicle);
}

function sendDealershipPurchaseResult(player, success, notice) {
  player.call('ragerp:dealership:purchase-result', [JSON.stringify({
    success,
    notice,
    vehicles: dealershipCatalogFor(player)
  })]);
}

mp.events.add('ragerp:dealership:request-open', (player) => {
  if (!characterFor(player) || openDealerships.has(player.id) ||
      openPhones.has(player.id) || openInventories.has(player.id) ||
      hudNotifications.has(player.id) ||
      !Dealership.isNearDealership(player.position, player.dimension)) {
    return;
  }

  try {
    openDealerships.add(player.id);
    player.call('ragerp:dealership:open', [JSON.stringify(dealershipCatalogFor(player))]);
  } catch (error) {
    openDealerships.delete(player.id);
    console.error('[RageRP dealership] Could not open vehicle catalog:', error);
    message(player, 'Не удалось открыть каталог автосалона.');
  }
});

mp.events.add('ragerp:dealership:purchase', (player, vehicleId, paymentMethod) => {
  if (!characterFor(player) || player.dimension !== 0 ||
      !openDealerships.has(player.id) ||
      !Dealership.isNearDealership(player.position, player.dimension)) {
    return;
  }

  const account = getAccount(player);
  const character = account.character;
  const vehicles = purchasedVehiclesFor(account);
  const quote = PersonalVehicles.purchaseQuote(
    vehicleId,
    vehicles,
    paymentMethod,
    character
  );
  if (quote.error) {
    const notices = {
      'vehicle-limit': `Достигнут лимит: не более ${PersonalVehicles.LIMIT} личных автомобилей.`,
      'insufficient-funds': 'Недостаточно средств на выбранном способе оплаты.',
      'invalid-payment-method': 'Выбери наличные или банковский счёт.',
      'vehicle-not-purchasable': 'Эту модель пока нельзя купить.'
    };
    try {
      sendDealershipPurchaseResult(
        player,
        false,
        notices[quote.error] || 'Не удалось проверить покупку.'
      );
    } catch (error) {
      console.error('[RageRP dealership] Could not return purchase status:', error);
    }
    return;
  }

  let vehicleRecord;
  try {
    vehicleRecord = PersonalVehicles.createVehicleRecord(newVehicleId(), newVehiclePlate());
    if (vehicleRecord.error) throw new Error('Could not create a VAZ-2106 vehicle record.');
    const normalized = VehicleAccess.normalizeVehicleRecord(
      vehicleRecord,
      ensureStaticId(account),
      newVehicleId
    );
    if (normalized.error) throw new Error('Could not normalize a VAZ-2106 vehicle record.');
    vehicleRecord = normalized.vehicle;
  } catch (error) {
    console.error('[RageRP dealership] Could not prepare vehicle purchase:', error);
    sendDealershipPurchaseResult(
      player,
      false,
      'Не удалось подготовить документы автомобиля. Попробуй позже.'
    );
    return;
  }

  const previousVehicles = character.purchasedVehicles;
  const previousBalance = character[quote.paymentMethod];
  character.purchasedVehicles = vehicles.concat([vehicleRecord]);
  character[quote.paymentMethod] = quote.balanceAfter;
  try {
    saveAccounts();
  } catch (error) {
    character.purchasedVehicles = previousVehicles;
    character[quote.paymentMethod] = previousBalance;
    console.error('[RageRP dealership] Could not save vehicle purchase:', error);
    sendDealershipPurchaseResult(
      player,
      false,
      'Покупка отменена: не удалось сохранить данные. Деньги не списаны.'
    );
    return;
  }

  updateHud(player);
  sendDealershipPurchaseResult(
    player,
    true,
    `Куплен ${PersonalVehicles.NAME}. Вызови его через приложение «Моя машина».`
  );
});

mp.events.add('ragerp:dealership:close', (player) => {
  openDealerships.delete(player.id);
});

mp.events.add('ragerp:inventory:request-open', (player) => {
  const character = characterFor(player);
  if (!character || player.dimension !== 0 || openPhones.has(player.id) ||
      openDealerships.has(player.id) || hudNotifications.has(player.id)) {
    message(player, 'Инвентарь сейчас недоступен.');
    return;
  }

  try {
    const state = inventoryStateFor(player);
    openInventories.add(player.id);
    player.call('ragerp:inventory:open', [JSON.stringify(state)]);
  } catch (error) {
    openInventories.delete(player.id);
    console.error('[RageRP inventory] Could not open inventory:', error);
    message(player, 'Не удалось открыть инвентарь.');
  }
});

mp.events.add('ragerp:inventory:close', (player) => {
  openInventories.delete(player.id);
  closeVehicleTrunk(player);
});

mp.events.add('ragerp:inventory:action', (player, action, payload) => {
  if (!openInventories.has(player.id) || typeof action !== 'string' ||
      typeof payload !== 'string' || payload.length > 512 ||
      player.dimension !== 0 || !characterFor(player)) {
    return;
  }
  const now = Date.now();
  if (now - (inventoryActionCooldowns.get(player.id) || 0) < 120) {
    inventoryNotice(player, 'Подожди немного перед следующим действием.');
    return;
  }
  inventoryActionCooldowns.set(player.id, now);

  let data;
  try {
    data = JSON.parse(payload);
  } catch (error) {
    inventoryNotice(player, 'Не удалось прочитать действие инвентаря.');
    return;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    inventoryNotice(player, 'Некорректное действие инвентаря.');
    return;
  }

  try {
    if (action === 'vehicle-transfer') {
      const result = performVehicleInventoryTransfer(player, data);
      if (result.error) inventoryNotice(player, inventoryActionError(result.error));
      return;
    }
    if (action === 'vehicle-move') {
      const result = performVehicleInventoryMove(player, data);
      if (result.error) inventoryNotice(player, inventoryActionError(result.error));
      return;
    }
    const result = performInventoryAction(player, action, data);
    if (result.error) inventoryNotice(player, inventoryActionError(result.error));
  } catch (error) {
    console.error('[RageRP inventory] Action failed:', error);
    inventoryNotice(player, 'Не удалось сохранить инвентарь. Попробуй позже.');
  }
});

mp.events.add('ragerp:inventory:quick-use', (player, quickSlot) => {
  if (openInventories.has(player.id) || openPhones.has(player.id) ||
      openDealerships.has(player.id) ||
      player.dimension !== 0 || !characterFor(player)) {
    return;
  }
  if (!Number.isInteger(quickSlot) || quickSlot < 0 ||
      quickSlot >= Inventory.QUICK_SLOT_COUNT) {
    return;
  }
  const now = Date.now();
  if (now - (inventoryActionCooldowns.get(player.id) || 0) < 120) return;
  inventoryActionCooldowns.set(player.id, now);

  try {
    const result = performInventoryAction(player, 'use-quick', { quickSlot });
    if (result.error) inventoryNotice(player, inventoryActionError(result.error));
  } catch (error) {
    console.error('[RageRP inventory] Quick-slot use failed:', error);
    inventoryNotice(player, 'Не удалось использовать предмет. Попробуй позже.');
  }
});

mp.events.add('playerDamage', (player) => {
  updateInventoryClient(player);
});

mp.events.add('ragerp:phone:request-open', (player) => {
  const character = characterFor(player);
  if (!character || player.dimension !== 0) {
    player.call('ragerp:phone:notice', ['Сначала создай персонажа, чтобы пользоваться телефоном.']);
    return;
  }
  if (openInventories.has(player.id) || openDealerships.has(player.id)) {
    player.call('ragerp:phone:notice', ['Телефон сейчас недоступен.']);
    return;
  }

  const account = getAccount(player);
  if (!Array.isArray(account.messages)) account.messages = [];
  ensureStaticId(account);
  openPhones.add(player.id);
  player.call('ragerp:phone:open', [JSON.stringify(phoneStateFor(player))]);
});

mp.events.add('ragerp:phone:close', (player) => {
  openPhones.delete(player.id);
});

mp.events.add('ragerp:phone:call:answer', (player, callId, accepted) => {
  if (typeof callId !== 'string' || callId.length > 64 || typeof accepted !== 'boolean') return;
  answerPhoneCall(player, callId, accepted);
});

mp.events.add('ragerp:phone:call:end', (player) => {
  endPhoneCall(player);
});

mp.events.add('ragerp:media:settings', (player, payload) => {
  if (typeof payload !== 'string' || payload.length > 1024) return;
  let settings;
  try {
    settings = JSON.parse(payload);
  } catch (error) {
    console.error('[RageRP media] Could not parse media settings:', error);
    return;
  }
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) return;

  const account = getAccount(player);
  const mediaSettings = mediaSettingsFor(account);
  let changed = false;
  if (typeof settings.voiceMuteUnderHours === 'number' &&
      Number.isFinite(settings.voiceMuteUnderHours)) {
    const threshold = Math.round(Math.max(0, Math.min(200, settings.voiceMuteUnderHours)));
    if (mediaSettings.voiceMuteUnderHours !== threshold) {
      mediaSettings.voiceMuteUnderHours = threshold;
      changed = true;
    }
  }
  if (typeof settings.showCallNotifications === 'boolean' &&
      mediaSettings.showCallNotifications !== settings.showCallNotifications) {
    mediaSettings.showCallNotifications = settings.showCallNotifications;
    changed = true;
  }
  if (changed) saveAccounts();
});

mp.events.add('ragerp:vehicle:toggle-lock', (player) => {
  if (player.dimension !== 0 || !characterFor(player) ||
      openPhones.has(player.id) || openInventories.has(player.id) ||
      openDealerships.has(player.id) || hudNotifications.has(player.id)) {
    return;
  }

  const lastToggle = vehicleLockCooldowns.get(player.id) || 0;
  if (Date.now() - lastToggle < 500) return;
  vehicleLockCooldowns.set(player.id, Date.now());

  const key = sessions.get(player.id);
  const vehicle = player.vehicle || spawnedStarterVehicles.get(key);
  if (!vehicle || !mp.vehicles.exists(vehicle)) {
    spawnedStarterVehicles.delete(key);
    message(player, 'Твоя личная машина сейчас не находится в городе.');
    return;
  }

  const vehicleInfo = starterVehicleForEntity(vehicle);
  if (!vehicleInfo) {
    message(player, 'У тебя нет доступа к этому автомобилю.');
    return;
  }
  try {
    toggleVehicleLock(player, vehicleInfo);
  } catch (error) {
    console.error('[RageRP vehicle] Could not update vehicle lock:', error);
    message(player, 'Не удалось сохранить состояние замка.');
  }
});

mp.events.add('ragerp:vehicle:toggle-engine', (player) => {
  if (!characterFor(player) || openPhones.has(player.id) ||
      openInventories.has(player.id) || openDealerships.has(player.id) ||
      hudNotifications.has(player.id)) {
    return;
  }

  const vehicle = player.vehicle;
  if (!vehicle) return;
  if (player.seat !== -1) {
    message(player, 'Завести или заглушить двигатель может только водитель.');
    return;
  }

  const vehicleInfo = starterVehicleForEntity(vehicle);
  if (vehicleInfo && !hasVehicleAccess(player, vehicleInfo) && !vehicle.engine) {
    message(player, 'Для запуска двигателя нужен ключ или успешно взломанный замок.');
    return;
  }

  const fuelRecord = vehicleFuelRecords.get(vehicle);
  if (!vehicle.engine && fuelRecord && fuelRecord.fuel <= 0) {
    message(player, 'Топливо закончилось. Заправь автомобиль на АЗС.');
    sendVehicleFuel(player, vehicle, fuelRecord);
    return;
  }

  vehicle.engine = !vehicle.engine;
  if (fuelRecord) {
    fuelRecord.lastEngineTickAt = Date.now();
    sendVehicleFuel(player, vehicle, fuelRecord);
    vehicleFuelDisplayStates.delete(player.id);
  }
  message(player, vehicle.engine ? 'Двигатель запущен.' : 'Двигатель заглушён.');
});

mp.events.add('playerEnterVehicle', (player, vehicle, seat) => {
  if (seat !== -1) return;
  const vehicleInfo = starterVehicleForEntity(vehicle);
  if (vehicleInfo && !hasVehicleAccess(player, vehicleInfo)) {
    vehicle.engine = false;
  }
});

mp.events.add('ragerp:vehicle:interaction', (player, action, vehicleId) => {
  if (typeof action !== 'string' || !Number.isSafeInteger(vehicleId) ||
      vehicleId < 0 || !characterFor(player) || player.dimension !== 0 ||
      openPhones.has(player.id) || openInventories.has(player.id) ||
      openDealerships.has(player.id) || hudNotifications.has(player.id)) {
    return;
  }
  const vehicle = mp.vehicles.at(vehicleId);
  if (!vehicle || vehicle.dimension !== player.dimension ||
      !playerNearVehicle(player, vehicle, 3.5)) {
    message(player, 'Подойди ближе к автомобилю.');
    return;
  }

  if (action === 'trunk') {
    openVehicleTrunk(player, vehicle);
  } else if (action === 'hood') {
    toggleVehicleHood(player, vehicle);
  } else if (action === 'lock') {
    const vehicleInfo = starterVehicleForEntity(vehicle);
    try {
      toggleVehicleLock(player, vehicleInfo);
    } catch (error) {
      console.error('[RageRP vehicle] Could not update vehicle lock:', error);
      message(player, 'Не удалось сохранить состояние замка.');
    }
  } else if (action === 'lockpick') {
    startTheftAttempt(player, vehicle);
  }
});

mp.events.add('ragerp:vehicle-passport:share-to', (player, targetId) => {
  if (player.dimension !== 0 || !characterFor(player)) return;
  if (!Number.isSafeInteger(targetId) || targetId < 0) {
    message(player, 'Не удалось определить игрока для показа ПТС.');
    return;
  }

  const target = findNearbyPassportTargetById(player, targetId);
  if (!target) {
    message(player, 'Игрок должен находиться рядом, не дальше 3 метров.');
    return;
  }
  requestVehiclePassportShare(player, target);
});

mp.events.add('ragerp:vehicle:service', (player) => {
  if (!characterFor(player) || player.dimension !== 0 ||
      openPhones.has(player.id) || openInventories.has(player.id) ||
      openDealerships.has(player.id)) return;

  const now = Date.now();
  const lastAttempt = vehicleRefuelCooldowns.get(player.id) || 0;
  if (now - lastAttempt < 1500) return;
  vehicleRefuelCooldowns.set(player.id, now);

  const vehicle = player.vehicle;
  if (!vehicle) {
    message(player, 'Сядь в автомобиль, чтобы заправиться или помыть его.');
    return;
  }
  if (player.seat !== -1) {
    message(player, 'Обслуживать автомобиль может только водитель.');
    return;
  }
  const record = vehicleFuelRecords.get(vehicle);
  if (!record) {
    message(player, 'Обслуживание доступно только для личных автомобилей и тестового BMW M5.');
    return;
  }
  if (!VehicleFuel.isAccountOwner(sessions.get(player.id), record.accountKey)) {
    message(player, 'Обслуживать этот автомобиль может только его владелец.');
    return;
  }
  if (vehicle.engine === true) {
    message(player, 'Заглуши двигатель перед обслуживанием.');
    return;
  }

  const account = accounts[record.accountKey];
  const character = account && account.character;
  if (!character) return;
  const cash = Number(character.cash);

  if (VehicleStats.isNearCarWash(player.position)) {
    if (record.stats.dirtLevel <= 0) {
      message(player, 'Автомобиль уже чистый.');
      return;
    }
    const quote = VehicleStats.washQuote(cash);
    if (!quote) {
      message(player, 'Не удалось проверить наличные для оплаты мойки.');
      return;
    }
    if (!quote.affordable) {
      message(player, `Недостаточно наличных. Мойка стоит ${formatMoney(quote.cost)}.`);
      return;
    }

    const previousCash = character.cash;
    const previousDirt = record.stats.dirtLevel;
    character.cash = cash - quote.cost;
    VehicleStats.setDirtLevel(record.stats, 0);
    try {
      saveAccounts();
      lastFuelAccountsSaveAt = now;
      vehicleAccountsDirty = false;
    } catch (error) {
      character.cash = previousCash;
      VehicleStats.setDirtLevel(record.stats, previousDirt);
      console.error('[RageRP vehicle] Could not save car wash transaction:', error);
      message(player, 'Мойка отменена: не удалось сохранить оплату. Попробуй позже.');
      return;
    }

    broadcastVehicleDirt(vehicle, record);
    vehicleFuelDisplayStates.delete(player.id);
    sendVehicleFuel(player, vehicle, record);
    message(player, `Автомобиль помыт. Списано ${formatMoney(quote.cost)}.`);
    updateHud(player);
    return;
  }

  if (!VehicleFuel.isNearGasStation(player.position)) {
    message(player, 'Подъедь к стандартной АЗС или автомойке GTA V.');
    return;
  }

  const quote = VehicleFuel.refillQuote(record.fuel, cash);
  if (!quote) {
    message(player, 'Не удалось проверить наличные для оплаты топлива.');
    return;
  }
  if (quote.amount <= 0) {
    message(player, 'Топливный бак уже полон.');
    return;
  }
  if (!quote.affordable) {
    message(player, `Недостаточно наличных. Заправка стоит ${formatMoney(quote.cost)}.`);
    return;
  }

  const previousCash = character.cash;
  const previousFuel = record.fuel;
  character.cash = cash - quote.cost;
  record.fuel = VehicleFuel.setFuelForAccount(account, record.model, 100, record.vehicleId);
  try {
    saveAccounts();
    lastFuelAccountsSaveAt = now;
    vehicleAccountsDirty = false;
  } catch (error) {
    character.cash = previousCash;
    record.fuel = previousFuel;
    VehicleFuel.setFuelForAccount(account, record.model, previousFuel, record.vehicleId);
    console.error('[RageRP vehicle] Could not save refueling transaction:', error);
    message(player, 'Заправка отменена: не удалось сохранить оплату. Попробуй позже.');
    return;
  }

  vehicleFuelDisplayStates.delete(player.id);
  sendVehicleFuel(player, vehicle, record);
  message(player, `Заправлено ${quote.amount.toLocaleString('ru-RU')}%. Списано ${formatMoney(quote.cost)}.`);
  updateHud(player);
});

mp.events.add('ragerp:vehicle:stats:request', (player, vehicleIdValue) => {
  const vehicleId = Number(vehicleIdValue);
  if (!Number.isInteger(vehicleId)) return;
  const now = Date.now();
  let playerRequests = vehicleStatsRequestCooldowns.get(player.id);
  if (!playerRequests) {
    playerRequests = new Map();
    vehicleStatsRequestCooldowns.set(player.id, playerRequests);
  }
  const lastRequest = playerRequests.get(vehicleId) || 0;
  if (now - lastRequest < 500) return;
  playerRequests.set(vehicleId, now);
  trackedFuelVehicles.forEach((record, vehicle) => {
    if (Number(vehicle.id) !== vehicleId ||
        !mp.vehicles.exists(vehicle) || player.dimension !== vehicle.dimension) return;
    const distance = VehicleStats.distanceMeters(player.position, vehicle.position);
    if (distance === null || distance > 250) return;
    player.call('ragerp:vehicle:dirt:update', [vehicle.id, record.stats.dirtLevel]);
  });
});

mp.events.add('ragerp:vehicle:signals:set', (player, signal) => {
  if (typeof signal !== 'string' ||
      !['left', 'right', 'hazards'].includes(signal) ||
      !characterFor(player) || player.dimension !== 0) return;
  const vehicle = player.vehicle;
  if (!vehicle || player.seat !== -1) return;
  const record = vehicleFuelRecords.get(vehicle);
  if (!record) return;
  const now = Date.now();
  const lastSignalChange = vehicleSignalCooldowns.get(player.id) || 0;
  if (now - lastSignalChange < 250) return;
  vehicleSignalCooldowns.set(player.id, now);

  if (signal === 'hazards') {
    const enabled = !record.signals.hazards;
    record.signals = { left: false, right: false, hazards: enabled };
  } else {
    const enabled = !record.signals[signal] || record.signals.hazards;
    record.signals = {
      left: signal === 'left' && enabled,
      right: signal === 'right' && enabled,
      hazards: false
    };
  }
  broadcastVehicleSignals(vehicle, record);
});

mp.events.add('ragerp:phone:action', (player, action, payload) => {
  if (!openPhones.has(player.id) || typeof action !== 'string' ||
      typeof payload !== 'string' || payload.length > 4096 ||
      player.dimension !== 0 || !characterFor(player)) {
    return;
  }

  let data;
  try {
    data = JSON.parse(payload);
  } catch (error) {
    phoneNotice(player, 'Не удалось прочитать запрос телефона.');
    return;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    phoneNotice(player, 'Некорректный запрос телефона.');
    return;
  }

  const account = getAccount(player);
  const character = account.character;

  if (action === 'refresh') {
    updatePhone(player, phoneStateFor(player));
    return;
  }

  if (action === 'vehicle-passport:targets') {
    updatePhone(player, {
      vehiclePassportTargets: nearbyVehiclePassportTargets(player),
      vehiclePassportTargetsLoading: false
    });
    return;
  }

  if (action === 'vehicle-passport:share') {
    const targetStaticId = String(data.targetStaticId || '').trim();
    if (!/^\d{3}-\d{3}$/.test(targetStaticId)) {
      phoneNotice(player, 'Выбери игрока из списка рядом.');
      return;
    }

    const target = findNearbyPassportTarget(player, targetStaticId);
    if (!target) {
      phoneNotice(player, 'Игрок должен находиться рядом, не дальше 3 метров.');
      updatePhone(player, { vehiclePassportTargets: nearbyVehiclePassportTargets(player) });
      return;
    }
    requestVehiclePassportShare(player, target);
    return;
  }

  if (action === 'vehicle-passport:answer') {
    const request = vehiclePassportShareRequests.get(player.id);
    const requestId = String(data.requestId || '');
    if (!request || request.requestId !== requestId || typeof data.accepted !== 'boolean') {
      phoneNotice(player, 'Запрос на просмотр ПТС уже недействителен.');
      return;
    }
    if (!data.accepted) {
      clearVehiclePassportShare(
        player.id,
        null,
        `${request.targetName} отказался от просмотра ПТС.`
      );
      return;
    }

    if (!mp.players.exists(request.sender) ||
        !findNearbyPassportTarget(request.sender, ensureStaticId(account))) {
      clearVehiclePassportShare(
        player.id,
        'Игрок, показывающий ПТС, уже не рядом.',
        'Показ ПТС отменён: игрок отошёл слишком далеко или вышел.'
      );
      return;
    }

    clearTimeout(request.timeout);
    vehiclePassportShareRequests.delete(player.id);
    player.call('ragerp:phone:passport:request', [JSON.stringify(null)]);
    updatePhone(player, {
      vehiclePassportDisplay: request.passport
    });
    vehiclePassportShareNotice(request.sender, `${request.targetName} открыл ваш ПТС.`);
    return;
  }

  if (action === 'phone-call') {
    startPhoneCall(player, data.targetId);
    return;
  }

  if (action === 'starter-vehicle') {
    try {
      summonStarterVehicle(player);
    } catch (error) {
      console.error('[RageRP] Starter vehicle summon failed:', error);
      phoneNotice(player, 'Не удалось вызвать автомобиль. Попробуй позже.');
    }
    return;
  }

  if (action === 'owned-vehicle') {
    try {
      summonPurchasedVehicle(player, String(data.vehicleId || ''));
    } catch (error) {
      console.error('[RageRP] Purchased vehicle summon failed:', error);
      phoneNotice(player, 'Не удалось вызвать автомобиль. Попробуй позже.');
    }
    return;
  }

  if (action === 'vehicle-key:grant' || action === 'vehicle-key:revoke') {
    const targetStaticId = String(data.staticId || '').trim();
    if (!VehicleAccess.STATIC_ID_PATTERN.test(targetStaticId)) {
      phoneNotice(player, 'Укажи корректный статик ID получателя.');
      return;
    }

    const target = accountByStaticId(targetStaticId);
    if (!target || !target.account.character) {
      phoneNotice(player, 'Персонаж с таким статик ID не найден.');
      return;
    }

    const ownerStaticId = ensureStaticId(account);
    const vehicleId = data.vehicleId === undefined
      ? ''
      : String(data.vehicleId).trim();
    if (vehicleId && !VehicleAccess.VEHICLE_ID_PATTERN.test(vehicleId)) {
      phoneNotice(player, 'Не удалось определить личный автомобиль.');
      return;
    }
    const vehicle = vehicleId
      ? purchasedVehicleById(account, vehicleId)
      : ensureStarterVehicle(account);
    if (!vehicle) {
      phoneNotice(player, 'Этот автомобиль не найден в твоём гараже.');
      return;
    }
    const result = action === 'vehicle-key:grant'
      ? VehicleAccess.grantKey(vehicle, ownerStaticId, targetStaticId)
      : VehicleAccess.revokeKey(vehicle, targetStaticId);
    if (result.error) {
      phoneNotice(player, result.error === 'already-granted'
        ? 'У этого игрока уже есть ключ.'
        : result.error === 'not-granted'
          ? 'У этого игрока нет ключа.'
          : result.error === 'owner-already-has-key'
            ? 'Владелец уже имеет ключ.'
            : 'Не удалось изменить доступ к автомобилю.');
      return;
    }

    try {
      persistVehicleRecord(account, result.vehicle);
    } catch (error) {
      console.error('[RageRP vehicle] Could not save key access:', error);
      phoneNotice(player, 'Не удалось сохранить доступ к автомобилю.');
      return;
    }

    const onlineTarget = onlinePhonePlayers().find((person) =>
      person.staticId === targetStaticId
    );
    if (onlineTarget) {
      if (action === 'vehicle-key:revoke') {
        const starterVehicle = ensureStarterVehicle(account);
        const spawnedPurchased = spawnedPurchasedVehicles.get(vehicle.vehicleId);
        const spawnedVehicle = starterVehicle.vehicleId === vehicle.vehicleId
          ? spawnedStarterVehicles.get(sessions.get(player.id))
          : spawnedPurchased && spawnedPurchased.entity;
        if (spawnedVehicle && onlineTarget.player.vehicle === spawnedVehicle) {
          spawnedVehicle.engine = false;
        }
        const trunkSession = openVehicleTrunks.get(onlineTarget.player.id);
        if (trunkSession && trunkSession.vehicleId === vehicle.vehicleId) {
          closeVehicleTrunk(onlineTarget.player);
          openInventories.delete(onlineTarget.player.id);
          onlineTarget.player.call('ragerp:inventory:close');
        }
        message(onlineTarget.player, 'Доступ к автомобилю отозван владельцем.');
      } else {
        message(onlineTarget.player,
          `Владелец выдал тебе ключ от автомобиля ${vehicle.name || vehicle.plate}.`);
      }
    }

    const ownedVehicles = purchasedVehicleStatesFor(player);
    updatePhone(player, {
      starterVehicle: starterVehicleState(player),
      vehicleKeys: vehicleKeysFor(player),
      ownedVehicles,
      numbers: phoneNumbersFor(starterVehicleState(player), ownedVehicles)
    });
    phoneNotice(player, action === 'vehicle-key:grant'
      ? `Ключ выдан игроку ${targetStaticId}.`
      : `Ключ игрока ${targetStaticId} отозван.`);
    return;
  }

  if (action === 'gps-location') {
    const destinations = {
      city_hall: { x: -545.25, y: -204.34 },
      hospital: { x: 298.4, y: -584.8 },
      police: { x: 425.1, y: -979.5 },
      bank: { x: 150.0, y: -1040.0 },
      spawn: { x: spawnPoint.x, y: spawnPoint.y }
    };
    const destination = destinations[data.key];
    if (!destination) {
      phoneNotice(player, 'Эта точка не найдена.');
      return;
    }
    player.call('ragerp:phone:waypoint', [JSON.stringify(destination)]);
    return;
  }

  if (action === 'gps-player') {
    const staticId = String(data.staticId || '');
    const target = onlinePhonePlayers().find((person) => person.staticId === staticId);
    if (!target || target.player === player) {
      phoneNotice(player, 'Игрок не найден в городе.');
      return;
    }
    player.call('ragerp:phone:waypoint', [JSON.stringify({ x: target.x, y: target.y })]);
    phoneNotice(player, `Маршрут к игроку ${target.name} отмечен на GPS.`);
    return;
  }

  if (action === 'bank') {
    const amount = parseAmount(data.amount);
    if (amount === null) {
      phoneNotice(player, 'Укажи сумму от 1 до 1 000 000 ₽.');
      return;
    }

    if (data.operation === 'deposit') {
      if (character.cash < amount) {
        phoneNotice(player, 'Недостаточно наличных.');
        return;
      }
      character.cash -= amount;
      character.bank += amount;
    } else if (data.operation === 'withdraw') {
      if (character.bank < amount) {
        phoneNotice(player, 'Недостаточно средств на счёте.');
        return;
      }
      character.bank -= amount;
      character.cash += amount;
    } else if (data.operation === 'transfer') {
      const targetId = String(data.targetId || '');
      const target = /^\d{3}-\d{3}$/.test(targetId) ? accountByStaticId(targetId) : null;
      if (!target || !target.account.character || target.account === account) {
        phoneNotice(player, 'Получатель не найден или указан некорректно.');
        return;
      }
      if (character.bank < amount) {
        phoneNotice(player, 'Недостаточно средств на счёте.');
        return;
      }
      character.bank -= amount;
      target.account.character.bank = (Number(target.account.character.bank) || 0) + amount;
      const receiver = playerByAccountKey(target.key);
      if (receiver) {
        updateHud(receiver);
        updatePhone(receiver, {
          cash: Number(target.account.character.cash) || 0,
          bank: target.account.character.bank
        });
        phoneNotice(receiver, `На счёт поступило ${formatMoney(amount)} от ${character.firstName} ${character.lastName}.`);
      }
    } else {
      phoneNotice(player, 'Выбери корректную банковскую операцию.');
      return;
    }

    saveAccounts();
    updateHud(player);
    updatePhone(player, {
      cash: character.cash,
      bank: character.bank,
      notice: `Операция выполнена. Баланс счёта: ${formatMoney(character.bank)}.`
    });
    return;
  }

  if (action === 'message') {
    const targetId = String(data.targetId || '');
    const body = typeof data.body === 'string'
      ? data.body.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
      : '';
    if (!/^\d{3}-\d{3}$/.test(targetId) || !body || body.length > 300) {
      phoneNotice(player, 'Укажи контакт и сообщение длиной до 300 символов.');
      return;
    }
    const lastSent = phoneMessageCooldowns.get(player.id) || 0;
    if (Date.now() - lastSent < 1500) {
      phoneNotice(player, 'Подожди немного перед отправкой следующего SMS.');
      return;
    }

    const target = accountByStaticId(targetId);
    if (!target || !target.account.character || target.account === account) {
      phoneNotice(player, 'Получатель не найден.');
      return;
    }

    phoneMessageCooldowns.set(player.id, Date.now());
    const entry = {
      fromId: account.staticId,
      toId: targetId,
      fromName: `${character.firstName} ${character.lastName}`,
      toName: `${target.account.character.firstName} ${target.account.character.lastName}`,
      body,
      at: Date.now()
    };
    if (!Array.isArray(account.messages)) account.messages = [];
    if (!Array.isArray(target.account.messages)) target.account.messages = [];
    account.messages.push(entry);
    target.account.messages.push(entry);
    account.messages = account.messages.slice(-100);
    target.account.messages = target.account.messages.slice(-100);
    saveAccounts();

    updatePhone(player, {
      messages: account.messages,
      notice: `SMS отправлено: ${entry.toName}.`
    });
    const recipient = playerByAccountKey(target.key);
    if (recipient) {
      updatePhone(recipient, { messages: target.account.messages });
      phoneNotice(recipient, `Новое SMS от ${entry.fromName}.`);
    }
    return;
  }

  if (action === 'ad') {
    const text = typeof data.text === 'string'
      ? data.text.replace(/[\u0000-\u001f\u007f]/g, ' ').trim()
      : '';
    if (!text || text.length > 180) {
      phoneNotice(player, 'Объявление должно содержать от 1 до 180 символов.');
      return;
    }
    const lastPosted = phoneAdCooldowns.get(player.id) || 0;
    if (Date.now() - lastPosted < 10000) {
      phoneNotice(player, 'Подожди перед публикацией следующего объявления.');
      return;
    }

    phoneAdCooldowns.set(player.id, Date.now());
    phoneAds.push({
      authorId: account.staticId,
      authorName: `${character.firstName} ${character.lastName}`,
      text,
      createdAt: Date.now()
    });
    if (phoneAds.length > 30) phoneAds.shift();
    updateOpenPhones({ ads: phoneAds.slice(-30) });
    mp.players.forEach((target) => phoneNotice(target, `Новое объявление от ${character.firstName} ${character.lastName}.`));
    return;
  }

  if (action === 'taxi-request') {
    const lastRequest = taxiRequestCooldowns.get(player.id) || 0;
    if (Date.now() - lastRequest < 15000) {
      phoneNotice(player, 'Подожди перед созданием нового вызова такси.');
      return;
    }
    const activeRequest = taxiCalls.find((call) =>
      call.requesterId === account.staticId && call.status === 'open'
    );
    if (activeRequest) {
      phoneNotice(player, 'У тебя уже есть активный вызов такси.');
      return;
    }

    taxiRequestCooldowns.set(player.id, Date.now());
    taxiCalls.push({
      id: `${Date.now()}-${++taxiCallSequence}`,
      requesterId: account.staticId,
      requesterName: `${character.firstName} ${character.lastName}`,
      x: Number(player.position.x),
      y: Number(player.position.y),
      status: 'open',
      driverId: '',
      driverName: '',
      createdAt: Date.now()
    });
    if (taxiCalls.length > 20) taxiCalls.shift();
    broadcastTaxiCalls(`Новый вызов такси от ${character.firstName} ${character.lastName}.`);
    return;
  }

  if (action === 'taxi-accept') {
    const taxiCall = taxiCalls.find((call) => call.id === String(data.id || ''));
    if (!taxiCall || taxiCall.status !== 'open' || taxiCall.requesterId === account.staticId) {
      phoneNotice(player, 'Этот вызов уже принят или недоступен.');
      return;
    }
    taxiCall.status = 'accepted';
    taxiCall.driverId = account.staticId;
    taxiCall.driverName = `${character.firstName} ${character.lastName}`;
    taxiCall.acceptedAt = Date.now();
    broadcastTaxiCalls(`${taxiCall.driverName} принял вызов такси.`);
    player.call('ragerp:phone:waypoint', [JSON.stringify({ x: taxiCall.x, y: taxiCall.y })]);
    return;
  }

  phoneNotice(player, 'В этом приложении такой команды нет.');
});

mp.events.add('ragerp:registration:preview', (player, payload) => {
  if (typeof payload !== 'string' || payload.length > 8192) return;
  const account = getAccount(player);
  if (account.character ||
      player.dimension !== registrationDimensionOffset + Number(player.id || 0)) {
    return;
  }

  const lastUpdate = previewUpdates.get(player.id) || 0;
  if (Date.now() - lastUpdate < 75) return;
  previewUpdates.set(player.id, Date.now());

  let data;
  try {
    data = JSON.parse(payload);
  } catch (error) {
    return;
  }

  const appearance = normalizeAppearance(data);
  if (!appearance) return;

  const previousGender = previewGenders.get(player.id);
  applyAppearance(player, appearance);
  previewGenders.set(player.id, appearance.gender);
  if (previousGender !== appearance.gender) {
    player.call('ragerp:registration:refresh-drawables');
  }
});

mp.events.add('ragerp:registration:rotate', (player, direction) => {
  const step = Number(direction);
  if ((step !== -1 && step !== 1) ||
      player.dimension !== registrationDimensionOffset + Number(player.id || 0) ||
      characterFor(player)) {
    return;
  }

  const lastUpdate = rotationUpdates.get(player.id) || 0;
  if (Date.now() - lastUpdate < 100) return;
  rotationUpdates.set(player.id, Date.now());

  const currentHeading = Number.isFinite(player.heading) ? player.heading : 180;
  player.heading = (currentHeading + step * 12 + 360) % 360;
});

mp.events.add('ragerp:registration:submit', (player, payload) => {
  if (player.dimension !== registrationDimensionOffset + Number(player.id || 0)) {
    player.call('ragerp:registration:feedback', ['Сессия создания персонажа завершена. Перезайди на сервер.']);
    return;
  }

  if (typeof payload !== 'string' || payload.length > 1024) {
    player.call('ragerp:registration:feedback', ['Форма отправлена некорректно. Попробуй ещё раз.']);
    return;
  }

  let data;
  try {
    data = JSON.parse(payload);
  } catch (error) {
    player.call('ragerp:registration:feedback', ['Не удалось прочитать данные формы. Попробуй ещё раз.']);
    return;
  }

  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    player.call('ragerp:registration:feedback', ['Проверь заполнение формы и попробуй ещё раз.']);
    return;
  }

  try {
    const error = createCharacter(player, data.firstName, data.lastName, data.age, data.appearance);
    if (error) {
      player.call('ragerp:registration:feedback', [error]);
      return;
    }

    player.call('ragerp:registration:success');
  } catch (error) {
    console.error('[RageRP] Registration failed:', error);
    player.call('ragerp:registration:feedback', ['Не удалось сохранить персонажа. Попробуй позже.']);
  }
});

mp.events.add('playerCommand', (player, command) => {
  try {
    handleCommand(player, command);
  } catch (error) {
    console.error('[RageRP] Command failed:', error);
    message(player, 'Команда не выполнена из-за внутренней ошибки. Попробуй позже.');
  }
});

mp.events.add('ragerp:hud:answer', (player, notificationId, accepted) => {
  const notification = hudNotifications.get(player.id);
  if (!notification || notification.id !== String(notificationId) ||
      typeof accepted !== 'boolean') {
    return;
  }

  hudNotifications.delete(player.id);
  if (notification.responseEvent) {
    mp.events.call(notification.responseEvent, player, accepted);
  }
});

mp.events.add('ragerp:hud:demo-response', (player, accepted) => {
  if (typeof accepted !== 'boolean') return;
  message(player, accepted
    ? 'Демо-уведомление принято.'
    : 'Демо-уведомление отклонено.');
});

mp.events.add('ragerp:admin:request-open', (player) => {
  openAdminMenu(player);
});

mp.events.add('ragerp:admin:close', (player) => {
  if (!adminIsAuthorized(player)) return;
  const account = getAccount(player);
  Admin.recordLog('admin_online', 'admin_menu_close', ensureStaticId(account), null,
    'Админ-меню закрыто.');
});

mp.events.add('ragerp:admin:logs', (player, payload) => {
  if (!adminIsAuthorized(player)) return;
  let request = null;
  try {
    request = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch (error) {
    return;
  }
  if (!request || typeof request !== 'object') return;
  const category = typeof request.category === 'string' ? request.category : null;
  const search = typeof request.search === 'string' ? request.search.slice(0, 100) : '';
  player.call('ragerp:admin:logs-response', [JSON.stringify({
    category,
    logs: Admin.getLogs(category, search, 250),
    players: adminPlayerSnapshot()
  })]);
});

mp.events.add('ragerp:admin:action', (player, payload) => {
  if (!adminIsAuthorized(player)) return;
  let request = null;
  try {
    request = typeof payload === 'string' ? JSON.parse(payload) : payload;
  } catch (error) {
    message(player, 'Некорректная команда админ-меню.');
    return;
  }
  if (!request || typeof request !== 'object' || typeof request.action !== 'string') return;

  const issuerAccount = getAccount(player);
  const issuerStaticId = ensureStaticId(issuerAccount);
  const targetStaticId = typeof request.targetStaticId === 'string'
    ? request.targetStaticId
    : '';
  const target = targetStaticId ? findOnlinePlayerByStaticId(targetStaticId) : null;

  switch (request.action) {
    case 'spectate':
    case 'teleport':
      if (!target) {
        message(player, 'Игрок не найден в сети.');
        return;
      }
      player.position = new mp.Vector3(target.x, target.y, target.z);
      if (request.action === 'spectate') {
        player.freezePosition(true);
        adminFrozenPlayers.set(player.id, true);
      }
      Admin.recordLog('admin_online', request.action, issuerStaticId, targetStaticId,
        request.action === 'spectate'
          ? 'Администратор переместился к игроку для наблюдения.'
          : 'Администратор телепортировался к игроку.');
      message(player, request.action === 'spectate'
        ? `Режим наблюдения: ${target.name}.`
        : `Телепорт к ${target.name}.`);
      break;

    case 'freeze':
      if (!target) {
        message(player, 'Игрок не найден в сети.');
        return;
      }
      const frozen = adminFrozenPlayers.get(target.player.id) !== true;
      adminFrozenPlayers.set(target.player.id, frozen);
      target.player.freezePosition(frozen);
      Admin.recordLog('admin_online', frozen ? 'freeze' : 'unfreeze',
        issuerStaticId, targetStaticId, frozen ? 'Игрок заморожен.' : 'Игрок разморожен.');
      message(player, frozen ? `${target.name} заморожен.` : `${target.name} разморожен.`);
      break;

    case 'warn':
      if (!target) {
        message(player, 'Игрок не найден в сети.');
        return;
      }
      const warnReason = String(request.reason || 'Предупреждение администратора').slice(0, 500);
      sendHudNotification(target.player, {
        title: 'Предупреждение',
        message: warnReason,
        acceptLabel: 'Понятно',
        declineLabel: 'Закрыть'
      });
      Admin.recordLog('appeals', 'warn', issuerStaticId, targetStaticId, warnReason);
      break;

    case 'kick':
      if (!target) {
        message(player, 'Игрок не найден в сети.');
        return;
      }
      const kickReason = String(request.reason || 'Кик администратором').slice(0, 500);
      Admin.recordLog('auth_logs', 'kick', issuerStaticId, targetStaticId, kickReason);
      target.player.kick(kickReason);
      break;

    case 'ban':
      if (!/^\d{3}-\d{3}$/.test(targetStaticId)) {
        message(player, 'Укажи корректный статик ID для бана.');
        return;
      }
      const banReason = String(request.reason || 'Блокировка администратором').slice(0, 500);
      const durationDays = Number(request.durationDays);
      const banResult = Admin.addBan(targetStaticId, banReason, issuerStaticId,
        Number.isFinite(durationDays) ? durationDays : 7);
      if (!banResult.ok) {
        message(player, 'Не удалось сохранить блокировку.');
        return;
      }
      Admin.recordLog('auth_logs', 'ban', issuerStaticId, targetStaticId, banReason);
      if (target) target.player.kick(banReason);
      message(player, `Игрок ${targetStaticId} заблокирован.`);
      break;

    case 'unban':
      if (!/^\d{3}-\d{3}$/.test(targetStaticId)) {
        message(player, 'Укажи корректный статик ID.');
        return;
      }
      Admin.removeBan(targetStaticId);
      Admin.recordLog('auth_logs', 'unban', issuerStaticId, targetStaticId,
        'Администратор снял блокировку.');
      message(player, `Блокировка ${targetStaticId} снята.`);
      break;

    case 'give_money':
      if (!target) {
        message(player, 'Игрок не найден в сети.');
        return;
      }
      const amount = Number(request.amount);
      if (!Number.isInteger(amount) || amount < 1 || amount > 10000000) {
        message(player, 'Сумма должна быть от 1 до 10 000 000 ₽.');
        return;
      }
      const targetAccount = getAccount(target.player);
      if (!targetAccount.character) {
        message(player, 'У игрока нет созданного персонажа.');
        return;
      }
      targetAccount.character.cash += amount;
      saveAccounts();
      updateHud(target.player);
      Admin.recordLog('item_transfer', 'give_money', issuerStaticId, targetStaticId,
        `Выдано наличных: ${amount} ₽.`);
      message(player, `Игроку ${target.name} выдано ${amount} ₽.`);
      break;

    case 'give_item':
      if (!target) {
        message(player, 'Игрок не найден в сети.');
        return;
      }
      const itemId = String(request.itemId || '');
      const quantity = Number(request.quantity);
      if (!Inventory.ITEM_DEFINITIONS[itemId] ||
          !Number.isInteger(quantity) || quantity < 1 || quantity > 100) {
        message(player, 'Некорректный предмет или количество.');
        return;
      }
      const targetAccountWithInventory = getAccount(target.player);
      if (!targetAccountWithInventory.character) {
        message(player, 'У игрока нет созданного персонажа.');
        return;
      }
      const inventory = ensureCharacterInventory(targetAccountWithInventory.character);
      const result = Inventory.addItems(inventory, itemId, quantity);
      if (result.error) {
        message(player, 'Предмет не помещается в инвентарь.');
        return;
      }
      targetAccountWithInventory.character.inventory = result.inventory;
      saveAccounts();
      if (openInventories.has(target.player.id)) {
        target.player.call('ragerp:inventory:update',
          [JSON.stringify(inventoryStateFor(target.player))]);
      }
      Admin.recordLog('universal_inventory', 'give_item', issuerStaticId, targetStaticId,
        `Выдано предметов: ${itemId} × ${quantity}.`);
      message(player, `${target.name}: выдано ${itemId} × ${quantity}.`);
      break;

    case 'player_info':
      if (!target) {
        message(player, 'Игрок не найден в сети.');
        return;
      }
      const targetAccountInfo = getAccount(target.player);
      player.call('ragerp:admin:player-info', [JSON.stringify({
        staticId: target.staticId,
        name: target.name,
        faction: targetAccountInfo.character && targetAccountInfo.character.faction
          ? targetAccountInfo.character.faction
          : 'Civilian',
        cash: targetAccountInfo.character ? targetAccountInfo.character.cash : 0,
        bank: targetAccountInfo.character ? targetAccountInfo.character.bank : 0,
        dimension: target.player.dimension,
        position: { x: target.x, y: target.y, z: target.z },
        ban: Admin.getBan(target.staticId)
      })]);
      Admin.recordLog('inventory_search', 'player_info', issuerStaticId, targetStaticId,
        'Просмотрена информация о игроке.');
      break;

    default:
      message(player, 'Неизвестное админ-действие.');
  }
});

mp.events.add('playerQuit', (player) => {
  const playtimeUpdated = checkpointPlayerPlaytime(player, Date.now());
  const adminTestVehicle = adminTestVehicles.get(player.id);
  if (adminTestVehicle && mp.vehicles.exists(adminTestVehicle)) {
    adminTestVehicle.destroy();
    unregisterVehicleFuel(adminTestVehicle);
  }
  adminTestVehicles.delete(player.id);
  const account = getAccount(player);
  if (account && account.character) {
    Admin.recordLog('auth_logs', 'player_disconnected', null,
      ensureStaticId(account), `Игрок отключился: ${player.name || 'Без имени'}.`);
  }
  openDealerships.delete(player.id);
  if (playtimeUpdated) {
    try {
      saveAccounts();
    } catch (error) {
      console.error('[RageRP media] Could not save playtime on disconnect:', error);
    }
  }
  const phoneCall = phoneCallByPlayer.get(player.id);
  if (phoneCall) finishPhoneCall(phoneCall, 'Абонент отключился.');

  for (const [targetId, request] of vehiclePassportShareRequests) {
    if (request.sender !== player && request.target !== player) continue;
    clearVehiclePassportShare(
      targetId,
      request.sender === player ? 'Показ ПТС отменён: владелец отключился.' : null,
      request.target === player ? 'Показ ПТС отменён: получатель отключился.' : null
    );
  }

  const key = sessions.get(player.id);
  openPhones.delete(player.id);
  closeVehicleTrunk(player);
  openInventories.delete(player.id);
  inventoryActionCooldowns.delete(player.id);
  phoneMessageCooldowns.delete(player.id);
  phoneAdCooldowns.delete(player.id);
  taxiRequestCooldowns.delete(player.id);
  phoneCallCooldowns.delete(player.id);
  vehicleCallCooldowns.delete(player.id);
  vehiclePassportShareCooldowns.delete(player.id);
  vehicleLockCooldowns.delete(player.id);
  vehicleRefuelCooldowns.delete(player.id);
  vehicleStatsRequestCooldowns.delete(player.id);
  vehicleSignalCooldowns.delete(player.id);
  vehicleFuelDisplayStates.delete(player.id);
  hudNotifications.delete(player.id);
  playtimeCheckpointAt.delete(player.id);
  const theftAttempt = theftAttemptRegistry.getByPlayer(player.id);
  if (theftAttempt) cancelTheftAttempt(theftAttempt, null);
  broadcastHudOnlineCount(player.id);
  if (!key) return;

  const starterVehicle = spawnedStarterVehicles.get(key);
  if (starterVehicle && mp.vehicles.exists(starterVehicle)) {
    clearVehicleRuntimeState(starterVehicle);
    unregisterVehicleFuel(starterVehicle);
    starterVehicle.destroy();
  }
  spawnedStarterVehicles.delete(key);
  for (const [vehicleId, spawned] of spawnedPurchasedVehicles) {
    if (!spawned || spawned.accountKey !== key) continue;
    const vehicle = spawned.entity;
    if (vehicle && mp.vehicles.exists(vehicle)) {
      clearVehicleRuntimeState(vehicle);
      unregisterVehicleFuel(vehicle);
      vehicle.destroy();
    }
    spawnedPurchasedVehicles.delete(vehicleId);
  }

  const accountFromKey = accounts[key];
  const character = accountFromKey && accountFromKey.character;
  if (character) {
    try {
      const inventory = ensureCharacterInventory(character);
      const previousEquipment = JSON.stringify(inventory.equipment);
      updateEquippedWeaponAmmo(player, inventory);
      if (previousEquipment !== JSON.stringify(inventory.equipment)) saveAccounts();
    } catch (error) {
      console.error('[RageRP inventory] Could not save weapon ammo on disconnect:', error);
    }
  }
  if (character && isValidPosition(player.position)) {
    character.position = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    };
    saveAccounts();
  }

  let taxiCallsChanged = false;
  for (let index = taxiCalls.length - 1; index >= 0; index -= 1) {
    const taxiCall = taxiCalls[index];
    if (account && taxiCall.requesterId === account.staticId) {
      taxiCalls.splice(index, 1);
      taxiCallsChanged = true;
    } else if (account && taxiCall.driverId === account.staticId) {
      taxiCall.status = 'open';
      taxiCall.driverId = '';
      taxiCall.driverName = '';
      delete taxiCall.acceptedAt;
      taxiCallsChanged = true;
    }
  }

  sessions.delete(player.id);
  previewUpdates.delete(player.id);
  previewGenders.delete(player.id);
  rotationUpdates.delete(player.id);
  if (taxiCallsChanged) broadcastTaxiCalls();
  console.log(`[RageRP] ${player.name} disconnected.`);
});

console.log('[RageRP] RP mechanics loaded.');

setInterval(() => {
  const now = Date.now();
  let changed = false;
  mp.players.forEach((player) => {
    if (checkpointPlayerPlaytime(player, now)) changed = true;
  });
  if (changed) {
    try {
      saveAccounts();
    } catch (error) {
      console.error('[RageRP media] Could not save playtime:', error);
    }
  }
}, 60000);

setInterval(updateVoiceRoutes, 1000);
setInterval(updateVehicleFuel, 1000);
