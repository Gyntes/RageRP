const fs = require('fs');
const path = require('path');

const dataDirectory = path.join(__dirname, 'data');
const accountsFile = path.join(dataDirectory, 'accounts.json');
const sessions = new Map();
const workCooldowns = new Map();
const previewUpdates = new Map();
const previewGenders = new Map();
const rotationUpdates = new Map();
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
    cash: 5000,
    bank: 10000,
    faction: 'Civilian',
    job: 'unemployed',
    position: spawnPoint
  };
  saveAccounts();
  spawnPlayer(player, account.character);
  player.dimension = 0;
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
  ensureStaticId(account);
  console.log(`[RageRP] ${player.name} connected.`);
});

mp.events.add('playerReady', (player) => {
  const character = characterFor(player);
  if (!character) {
    openRegistration(player);
    return;
  }

  spawnPlayer(player, character);
  message(player, `С возвращением, ${character.firstName}. Используй /help.`);
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

mp.events.add('playerQuit', (player) => {
  const key = sessions.get(player.id);
  if (!key) return;

  const character = accounts[key] && accounts[key].character;
  if (character && isValidPosition(player.position)) {
    character.position = {
      x: player.position.x,
      y: player.position.y,
      z: player.position.z
    };
    saveAccounts();
  }

  sessions.delete(player.id);
  previewUpdates.delete(player.id);
  previewGenders.delete(player.id);
  rotationUpdates.delete(player.id);
  console.log(`[RageRP] ${player.name} disconnected.`);
});

console.log('[RageRP] RP mechanics loaded.');
