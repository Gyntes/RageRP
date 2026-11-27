const fs = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const LOG_CATEGORIES = Object.freeze([
  'admin_online',
  'family_logs',
  'auth_logs',
  'house_inventory',
  'car_inventory',
  'taxi_inventory',
  'item_transfer',
  'appeals',
  'family_search',
  'inventory_search',
  'universal_inventory',
  'house_search',
  'appeal_search'
]);

let database = null;
let databaseFile = null;
let initialized = false;
let initializationError = null;
let retentionDays = 7;

function escapeLike(value) {
  return String(value || '').replace(/[%_\\]/g, '\\$&');
}

function ensureDataDirectory(dataDirectory) {
  fs.mkdirSync(dataDirectory, { recursive: true });
  const databaseDirectory = path.join(dataDirectory, 'admin');
  fs.mkdirSync(databaseDirectory, { recursive: true });
  return databaseDirectory;
}

function createBackup(databaseDirectory, accountsFile) {
  if (!accountsFile || !fs.existsSync(accountsFile)) return null;
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFile = path.join(databaseDirectory, `accounts-backup-${stamp}.json`);
  fs.copyFileSync(accountsFile, backupFile);
  return backupFile;
}

function saveDatabase() {
  if (!database || !databaseFile) return;
  fs.writeFileSync(databaseFile, Buffer.from(database.export()));
}

function deleteExpiredLogs() {
  if (!database) return;
  const cutoff = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
  database.run(
    'DELETE FROM admin_logs WHERE created_at_ms < ?',
    [cutoff]
  );
  saveDatabase();
}

async function initialize(options) {
  if (initialized) return { ok: !initializationError, error: initializationError };
  try {
    const dataDirectory = options && options.dataDirectory
      ? options.dataDirectory
      : path.join(__dirname, 'data');
    const accountsFile = options && options.accountsFile
      ? options.accountsFile
      : path.join(dataDirectory, 'accounts.json');
    const configuredRetention = Number(options && options.retentionDays);
    if (Number.isFinite(configuredRetention) && configuredRetention > 0) {
      retentionDays = Math.min(365, Math.max(1, Math.trunc(configuredRetention)));
    }

    const databaseDirectory = ensureDataDirectory(dataDirectory);
    databaseFile = path.join(databaseDirectory, 'rageadmin.sqlite');
    if (!fs.existsSync(databaseFile)) {
      createBackup(databaseDirectory, accountsFile);
    }

    const SQL = await initSqlJs();
    if (fs.existsSync(databaseFile)) {
      database = new SQL.Database(fs.readFileSync(databaseFile));
    } else {
      database = new SQL.Database();
    }

    database.run(`
      CREATE TABLE IF NOT EXISTS admin_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        action TEXT NOT NULL,
        admin_static_id TEXT NOT NULL,
        target_static_id TEXT,
        details TEXT NOT NULL DEFAULT '',
        created_at_ms INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_admin_logs_category
        ON admin_logs(category, created_at_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_admin_logs_target
        ON admin_logs(target_static_id, created_at_ms DESC);

      CREATE TABLE IF NOT EXISTS bans (
        static_id TEXT PRIMARY KEY,
        reason TEXT NOT NULL,
        expires_at_ms INTEGER,
        created_at_ms INTEGER NOT NULL,
        created_by TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_bans_expiry
        ON bans(expires_at_ms);
    `);

    initialized = true;
    deleteExpiredLogs();
    saveDatabase();
    return { ok: true, error: null };
  } catch (error) {
    initializationError = error;
    initialized = true;
    return { ok: false, error };
  }
}

function recordLog(category, action, adminStaticId, targetStaticId, details) {
  if (!database) return false;
  if (!LOG_CATEGORIES.includes(category)) return false;

  database.run(
    `INSERT INTO admin_logs
      (category, action, admin_static_id, target_static_id, details, created_at_ms)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [
      category,
      String(action || '').slice(0, 80),
      String(adminStaticId || '').slice(0, 16),
      targetStaticId ? String(targetStaticId).slice(0, 16) : null,
      String(details || '').slice(0, 2000),
      Date.now()
    ]
  );
  saveDatabase();
  return true;
}

function getLogs(category, search, limit) {
  if (!database) return [];
  const selectedCategory = LOG_CATEGORIES.includes(category) ? category : null;
  const safeLimit = Number.isInteger(limit)
    ? Math.max(1, Math.min(250, limit))
    : 100;
  const query = selectedCategory
    ? `SELECT id, category, action, admin_static_id, target_static_id, details, created_at_ms
       FROM admin_logs
       WHERE category = ?
       AND (? = '' OR admin_static_id LIKE ? ESCAPE '\\' OR target_static_id LIKE ? ESCAPE '\\'
            OR action LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\')
       ORDER BY created_at_ms DESC
       LIMIT ?`
    : `SELECT id, category, action, admin_static_id, target_static_id, details, created_at_ms
       FROM admin_logs
       WHERE (? = '' OR admin_static_id LIKE ? ESCAPE '\\' OR target_static_id LIKE ? ESCAPE '\\'
            OR action LIKE ? ESCAPE '\\' OR details LIKE ? ESCAPE '\\')
       ORDER BY created_at_ms DESC
       LIMIT ?`;
  const term = escapeLike(search);
  const like = `%${term}%`;
  const parameters = selectedCategory
    ? [selectedCategory, term, like, like, like, like, safeLimit]
    : [term, like, like, like, like, safeLimit];
  const statement = database.prepare(query);
  statement.bind(parameters);

  const rows = [];
  while (statement.step()) {
    const row = statement.getAsObject();
    rows.push({
      id: Number(row.id),
      category: String(row.category),
      action: String(row.action),
      adminStaticId: String(row.admin_static_id),
      targetStaticId: row.target_static_id ? String(row.target_static_id) : null,
      details: String(row.details || ''),
      createdAt: Number(row.created_at_ms)
    });
  }
  statement.free();
  return rows;
}

function addBan(staticId, reason, createdBy, durationDays) {
  if (!database) return { ok: false, error: 'database-unavailable' };
  const now = Date.now();
  const safeStaticId = String(staticId || '').trim();
  if (!/^\d{3}-\d{3}$/.test(safeStaticId)) {
    return { ok: false, error: 'invalid-static-id' };
  }
  const days = Number(durationDays);
  const expiresAt = Number.isFinite(days) && days > 0
    ? now + Math.min(3650, Math.trunc(days)) * 24 * 60 * 60 * 1000
    : null;

  database.run(
    `INSERT INTO bans
      (static_id, reason, expires_at_ms, created_at_ms, created_by)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(static_id) DO UPDATE SET
      reason = excluded.reason,
      expires_at_ms = excluded.expires_at_ms,
      created_at_ms = excluded.created_at_ms,
      created_by = excluded.created_by`,
    [safeStaticId, String(reason || 'Админ блокировка').slice(0, 500), expiresAt, now,
      String(createdBy || '').slice(0, 16)]
  );
  saveDatabase();
  return { ok: true, expiresAt };
}

function removeBan(staticId) {
  if (!database) return false;
  database.run('DELETE FROM bans WHERE static_id = ?', [String(staticId || '').trim()]);
  saveDatabase();
  return true;
}

function getBan(staticId) {
  if (!database) return null;
  const statement = database.prepare(
    `SELECT static_id, reason, expires_at_ms, created_at_ms, created_by
     FROM bans WHERE static_id = ?`
  );
  statement.bind([String(staticId || '').trim()]);
  if (!statement.step()) {
    statement.free();
    return null;
  }
  const row = statement.getAsObject();
  statement.free();
  const expiresAt = row.expires_at_ms === null ? null : Number(row.expires_at_ms);
  if (expiresAt !== null && expiresAt <= Date.now()) {
    removeBan(staticId);
    return null;
  }
  return {
    staticId: String(row.static_id),
    reason: String(row.reason),
    expiresAt,
    createdAt: Number(row.created_at_ms),
    createdBy: String(row.created_by)
  };
}

module.exports = {
  LOG_CATEGORIES,
  initialize,
  recordLog,
  getLogs,
  addBan,
  removeBan,
  getBan
};
