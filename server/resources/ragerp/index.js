const fs = require('fs');
const path = require('path');

const dataDirectory = path.join(__dirname, 'data');
const accountsFile = path.join(dataDirectory, 'accounts.json');
const sessions = new Map();
const workCooldowns = new Map();
const previewUpdates = new Map();
const previewGenders = new Map();
const rotationUpdates = new Map();
const openPhones = new Set();
const phoneMessageCooldowns = new Map();
const phoneAdCooldowns = new Map();
const taxiRequestCooldowns = new Map();
const vehicleCallCooldowns = new Map();
const spawnedStarterVehicles = new Map();
const hudNotifications = new Map();
const phoneAds = [];
const taxiCalls = [];
let taxiCallSequence = 0;
let hudNotificationSequence = 0;
const starterVehicleModel = 'blista';
const starterVehicleName = 'Blista';
const spawnPoint = { x: 215.76, y: -810.12, z: 30.73 };
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

function saveAccounts() {
  fs.writeFileSync(accountsFile, JSON.stringify(accounts, null, 2), 'utf8');
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

function characterFor(player) {
  return getAccount(player).character;
}

function ensureStarterVehicle(account) {
  if (!account.character) return null;

  const starterVehicle = account.character.starterVehicle;
  if (starterVehicle &&
      starterVehicle.model === starterVehicleModel &&
      typeof starterVehicle.plate === 'string' &&
      /^RP\d{6}$/.test(starterVehicle.plate)) {
    return starterVehicle;
  }

  ensureStaticId(account);
  account.character.starterVehicle = {
    model: starterVehicleModel,
    plate: `RP${account.staticId.replace('-', '')}`
  };
  saveAccounts();
  return account.character.starterVehicle;
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
    model: starterVehicle.model,
    name: starterVehicleName,
    plate: starterVehicle.plate,
    isOut: Boolean(vehicle)
  };
  if (vehicle) {
    state.x = Number(vehicle.position.x);
    state.y = Number(vehicle.position.y);
    state.z = Number(vehicle.position.z);
  }
  return state;
}

function summonStarterVehicle(player) {
  const account = getAccount(player);
  const key = sessions.get(player.id);
  const existing = spawnedStarterVehicles.get(key);
  if (existing && mp.vehicles.exists(existing)) {
    player.call('ragerp:phone:waypoint', [JSON.stringify({
      x: existing.position.x,
      y: existing.position.y
    })]);
    updatePhone(player, {
      starterVehicle: starterVehicleState(player),
      notice: `Твоя ${starterVehicleName} уже в городе. Метка добавлена на GPS.`
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
  const starterVehicle = ensureStarterVehicle(account);
  const heading = Number.isFinite(player.heading) ? player.heading : 0;
  const angle = heading * Math.PI / 180;
  const position = new mp.Vector3(
    player.position.x + Math.sin(angle) * 3.5,
    player.position.y - Math.cos(angle) * 3.5,
    player.position.z + 0.25
  );
  const vehicle = mp.vehicles.new(mp.joaat(starterVehicle.model), position, {
    heading,
    dimension: player.dimension,
    numberPlate: starterVehicle.plate,
    locked: false,
    engine: true
  });
  if (!vehicle) {
    phoneNotice(player, 'Не удалось создать автомобиль. Попробуй ещё раз.');
    return;
  }

  vehicle.setVariable('ragerp:ownerStaticId', account.staticId);
  vehicle.setVariable('ragerp:starterVehicle', true);
  spawnedStarterVehicles.set(key, vehicle);
  player.putIntoVehicle(vehicle, -1);
  updatePhone(player, {
    starterVehicle: starterVehicleState(player),
    notice: `Твоя ${starterVehicleName} готова. Номер: ${starterVehicle.plate}.`
  });
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
      x: Number(player.position.x),
      y: Number(player.position.y),
      z: Number(player.position.z)
    });
  });
  return online;
}

function phoneStateFor(player) {
  const account = getAccount(player);
  ensureStarterVehicle(account);
  if (!Array.isArray(account.messages)) account.messages = [];
  return {
    staticId: account.staticId,
    name: `${account.character.firstName} ${account.character.lastName}`,
    cash: Number(account.character.cash) || 0,
    bank: Number(account.character.bank) || 0,
    online: onlinePhonePlayers().map((person) => ({
      staticId: person.staticId,
      name: person.name,
      x: person.x,
      y: person.y,
      z: person.z
    })),
    messages: account.messages.slice(-100),
    ads: phoneAds.slice(-30),
    taxiCalls: taxiCalls.slice(-20),
    starterVehicle: starterVehicleState(player)
  };
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
  if (character) publishNameTag(player);
}

function showHelp(player) {
  message(player, '/register <Имя> <Фамилия> <возраст> [male|female] — резервное создание персонажа');
  message(player, '/stats, /bank, /deposit <сумма>, /withdraw <сумма>');
  message(player, '/job [courier|unemployed], /work, /faction, /joinfaction <civilian|mechanic>, /me <текст>');
  message(player, 'Телефон: клавиша P. Доступны SMS, банк, GPS, такси и объявления.');
  message(player, 'HUD: /hudtest — проверить окно уведомления.');
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

function hudStateFor(player) {
  const account = getAccount(player);
  const character = account.character;
  if (!character) return null;

  return {
    staticId: ensureStaticId(account),
    cash: Number(character.cash) || 0,
    bank: Number(character.bank) || 0
  };
}

function updateHud(player) {
  const state = hudStateFor(player);
  if (state) player.call('ragerp:hud:update', [JSON.stringify(state)]);
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
      plate: `RP${account.staticId.replace('-', '')}`
    },
    cash: 5000,
    bank: 10000,
    faction: 'Civilian',
    job: 'unemployed',
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

function handleCommand(player, command) {
  const parts = String(command || '').trim().replace(/^\/+/, '').split(/\s+/);
  const name = (parts.shift() || '').toLowerCase();
  const args = parts;

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

  if (name === 'help') {
    showHelp(player);
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

if (typeof mp !== 'undefined') {
mp.events.add('playerJoin', (player) => {
  const account = getAccount(player);
  ensureStaticId(account);
  console.log(`[RageRP] ${player.name} connected.`);
});

mp.events.add('playerReady', (player) => {
  const account = getAccount(player);
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

mp.events.add('ragerp:phone:request-open', (player) => {
  const character = characterFor(player);
  if (!character || player.dimension !== 0) {
    player.call('ragerp:phone:notice', ['Сначала создай персонажа, чтобы пользоваться телефоном.']);
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

  if (action === 'starter-vehicle') {
    try {
      summonStarterVehicle(player);
    } catch (error) {
      console.error('[RageRP] Starter vehicle summon failed:', error);
      phoneNotice(player, 'Не удалось вызвать автомобиль. Попробуй позже.');
    }
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

mp.events.add('playerEnterVehicle', (player, vehicle) => {
  if (!vehicle.getVariable('ragerp:starterVehicle')) return;

  const account = getAccount(player);
  if (ensureStaticId(account) !== vehicle.getVariable('ragerp:ownerStaticId')) {
    player.removeFromVehicle();
    message(player, 'Этот автомобиль закреплён за другим персонажем.');
  }
});

mp.events.add('playerQuit', (player) => {
  const key = sessions.get(player.id);
  openPhones.delete(player.id);
  phoneMessageCooldowns.delete(player.id);
  phoneAdCooldowns.delete(player.id);
  taxiRequestCooldowns.delete(player.id);
  vehicleCallCooldowns.delete(player.id);
  hudNotifications.delete(player.id);
  if (!key) return;

  const starterVehicle = spawnedStarterVehicles.get(key);
  if (starterVehicle && mp.vehicles.exists(starterVehicle)) starterVehicle.destroy();
  spawnedStarterVehicles.delete(key);

  const account = accounts[key];
  const character = account && account.character;
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

} else {
  console.log('[RageRP] mp API is unavailable; package loaded in server compatibility mode.');
}
console.log('[RageRP] RP mechanics loaded.');
