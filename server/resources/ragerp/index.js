const fs = require('fs');
const path = require('path');

const dataDirectory = path.join(__dirname, 'data');
const accountsFile = path.join(dataDirectory, 'accounts.json');
const sessions = new Map();
const workCooldowns = new Map();
const spawnPoint = { x: 215.76, y: -810.12, z: 30.73 };
const workPay = 500;
const workCooldownMs = 60 * 1000;
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

  player.spawn(new mp.Vector3(position.x, position.y, position.z));
  player.health = 100;
}

function showHelp(player) {
  message(player, '/register <Имя> <Фамилия> <возраст> — создать персонажа');
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
  return `${Math.trunc(amount).toLocaleString('ru-RU')} $`;
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
  message(player, `${character.firstName} ${character.lastName}, ${character.age} лет`);
  message(player, `Фракция: ${character.faction}; работа: ${character.job}`);
  message(player, `Наличные: ${formatMoney(character.cash)}; банк: ${formatMoney(character.bank)}`);
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
    const account = getAccount(player);
    if (account.character) {
      message(player, 'Персонаж уже зарегистрирован.');
      return;
    }

    const firstName = args[0] || '';
    const lastName = args[1] || '';
    const age = Number(args[2]);
    const validName = /^[A-Za-zА-Яа-яЁё][A-Za-zА-Яа-яЁё'-]{1,19}$/;
    if (!validName.test(firstName) || !validName.test(lastName) ||
        !Number.isInteger(age) || age < 18 || age > 100) {
      message(player, 'Формат: /register Имя Фамилия 25 (возраст 18–100).');
      return;
    }

    account.character = {
      firstName,
      lastName,
      age,
      cash: 5000,
      bank: 10000,
      faction: 'Civilian',
      job: 'unemployed',
      position: spawnPoint
    };
    saveAccounts();
    spawnPlayer(player, account.character);
    message(player, `Добро пожаловать, ${firstName} ${lastName}! Начни с /help.`);
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
  const key = getAccountKey(player);
  sessions.set(player.id, key);
  if (!accounts[key]) {
    accounts[key] = { character: null };
  }
  console.log(`[RageRP] ${player.name} connected.`);
});

mp.events.add('playerReady', (player) => {
  const character = characterFor(player);
  spawnPlayer(player, character);
  if (character) {
    message(player, `С возвращением, ${character.firstName}. Используй /help.`);
  } else {
    message(player, 'Привет! Создай персонажа командой /register Имя Фамилия 25.');
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
  console.log(`[RageRP] ${player.name} disconnected.`);
});

console.log('[RageRP] RP mechanics loaded.');
