const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const Admin = require('../server/resources/ragerp/admin');

test('SQLite admin database creates backup and stores logs and bans', async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ragerp-admin-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));

  const accountsFile = path.join(root, 'accounts.json');
  fs.writeFileSync(accountsFile, JSON.stringify({ '123': { character: {} } }), 'utf8');

  const initialized = await Admin.initialize({
    dataDirectory: root,
    accountsFile,
    retentionDays: 7
  });
  assert.equal(initialized.ok, true);

  const backupDirectory = path.join(root, 'admin');
  const backups = fs.readdirSync(backupDirectory).filter((name) => name.startsWith('accounts-backup-'));
  assert.equal(backups.length, 1);

  assert.equal(Admin.recordLog(
    'auth_logs',
    'player_connected',
    null,
    '163-269',
    'Игрок подключился'
  ), true);

  const logs = Admin.getLogs('auth_logs', '', 10);
  assert.equal(logs.length, 1);
  assert.equal(logs[0].targetStaticId, '163-269');
  assert.equal(logs[0].action, 'player_connected');

  const banned = Admin.addBan('163-269', 'Тестовая блокировка', '001-001', 7);
  assert.equal(banned.ok, true);
  assert.equal(Admin.getBan('163-269').reason, 'Тестовая блокировка');

  Admin.removeBan('163-269');
  assert.equal(Admin.getBan('163-269'), null);
});

test('invalid admin categories and static IDs are rejected', () => {
  assert.equal(Admin.recordLog('unknown_category', 'test', '001-001', null, 'test'), false);
  assert.equal(Admin.addBan('invalid', 'test', '001-001', 7).ok, false);
});
