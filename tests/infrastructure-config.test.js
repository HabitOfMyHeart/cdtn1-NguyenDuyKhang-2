const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const { loadConfig, ConfigError } = require('../src/config');
const { createDatabase } = require('../src/config/db');

const ENV = {
  NODE_ENV: 'test', JWT_SECRET: 'unit-test-key-not-for-deployment-123456789',
  DEMO_STAFF_PASSWORD: 'unit-test-password'
};

test('configuration validates and freezes explicit credentials plus safe local defaults', () => {
  const config = loadConfig(ENV);
  assert.equal(config.port, 3000);
  assert.equal(config.jwtExpiresIn, '8h');
  assert.equal(config.demoStaff.username, 'nhanvien');
  assert.equal(config.demoStaff.center_id, '1');
  assert.ok(config.dbSocketTimeoutMs > 0);
  assert.ok(Object.isFrozen(config));
  assert.ok(Object.isFrozen(config.demoStaff));
  assert.throws(() => loadConfig({}), (error) => error instanceof ConfigError &&
    !!error.fields.JWT_SECRET && !!error.fields.DEMO_STAFF_PASSWORD);
});

test('configuration rejects invalid ports, lifetime, staff scope, log levels and timeout bounds', () => {
  const cases = [
    ['NODE_ENV', 'staging'], ['PORT', '0'], ['PORT', '65536'], ['PORT', '3.5'], ['PORT', 'abc'], ['PORT', ''],
    ['JWT_SECRET', ''], ['JWT_EXPIRES_IN', '0s'], ['JWT_EXPIRES_IN', '8'],
    ['JWT_EXPIRES_IN', '-1h'], ['JWT_EXPIRES_IN', '31d'], ['JWT_EXPIRES_IN', 'Infinityh'],
    ['DEMO_STAFF_USERNAME', 'a'.repeat(25)], ['DEMO_STAFF_USERNAME', 'staff name'],
    ['DEMO_STAFF_PASSWORD', ''], ['DEMO_STAFF_CENTER', '../1'], ['DEMO_STAFF_CENTER', ''],
    ['DEMO_STAFF_NAME', 'x\nInjected'], ['LOG_LEVEL', 'constructor'], ['LOG_LEVEL', 'verbose'],
    ['DB_SERVER_SELECTION_TIMEOUT_MS', '0'], ['DB_CONNECT_TIMEOUT_MS', '60001'],
    ['DB_SOCKET_TIMEOUT_MS', 'NaN'], ['HTTP_REQUEST_TIMEOUT_MS', '99'],
    ['HTTP_HEADERS_TIMEOUT_MS', '40000'], ['SHUTDOWN_TIMEOUT_MS', '30001'],
    ['MONGODB_URI', 'https://secret.invalid']
  ];
  for (const [key, value] of cases) {
    assert.throws(() => loadConfig({ ...ENV, [key]: value }), (error) =>
      error instanceof ConfigError && Object.hasOwn(error.fields, key), `${key} must reject invalid input`);
  }
  assert.equal(loadConfig({ ...ENV, DEMO_STAFF_USERNAME: 'a'.repeat(24), JWT_EXPIRES_IN: '30d' }).demoStaff.username.length, 24);
});

test('production has no secret/demo fallback and never prints supplied secrets in diagnostics', () => {
  const production = {
    ...ENV, NODE_ENV: 'production', MONGODB_URI: 'mongodb://127.0.0.1:27017/test',
    DEMO_STAFF_USERNAME: 'staff', DEMO_STAFF_NAME: 'Test Staff', DEMO_STAFF_CENTER: '1'
  };
  assert.equal(loadConfig(production).nodeEnv, 'production');
  assert.equal(loadConfig({ ...ENV, NODE_ENV: 'development', JWT_SECRET: 'local-demo-key' }).jwtSecret, 'local-demo-key');
  assert.throws(() => loadConfig({ ...production, JWT_SECRET: 'local-demo-key' }), (error) => !!error.fields.JWT_SECRET);
  for (const key of ['JWT_SECRET', 'DEMO_STAFF_PASSWORD', 'DEMO_STAFF_USERNAME', 'DEMO_STAFF_NAME', 'DEMO_STAFF_CENTER', 'MONGODB_URI']) {
    const env = { ...production };
    delete env[key];
    assert.throws(() => loadConfig(env), (error) => !!error.fields[key]);
  }
  assert.throws(() => loadConfig({ ...production, JWT_SECRET: 'dev-only-jwt-key-change-me-before-production-2026' }),
    (error) => !!error.fields.JWT_SECRET && !error.message.includes('dev-only'));
  assert.throws(() => loadConfig({ ...production, DEMO_STAFF_PASSWORD: 'dev-only-password-change-me' }),
    (error) => !!error.fields.DEMO_STAFF_PASSWORD && !JSON.stringify(error).includes('dev-only-password'));
});

test('.env.example is an explicit usable local configuration, not usable production credentials', () => {
  const env = dotenv.parse(fs.readFileSync(path.join(__dirname, '..', '.env.example')));
  assert.equal(loadConfig(env).nodeEnv, 'development');
  assert.throws(() => loadConfig({ ...env, NODE_ENV: 'production' }), (error) =>
    !!error.fields.JWT_SECRET && !!error.fields.DEMO_STAFF_PASSWORD);
});

test('database adapter applies all timeouts, disables buffering, shares connections and disconnects safely', async () => {
  const calls = [];
  const config = loadConfig(ENV);
  const driver = {
    connection: { readyState: 0 },
    set(key, value) { calls.push(['set', key, value]); },
    async connect(uri, options) {
      calls.push(['connect', uri, options]);
      this.connection.readyState = 1;
    },
    async disconnect() { calls.push(['disconnect']); this.connection.readyState = 0; }
  };
  const db = createDatabase({ driver, config });
  assert.equal(db.getDatabaseState(), 'disconnected');
  await Promise.all([db.connectDatabase(), db.connectDatabase()]);
  assert.equal(db.getDatabaseState(), 'connected');
  await db.connectDatabase();
  const connects = calls.filter(([name]) => name === 'connect');
  assert.equal(connects.length, 1);
  assert.deepEqual(connects[0].slice(1), [config.mongodbUri, {
    serverSelectionTimeoutMS: config.dbServerSelectionTimeoutMs,
    connectTimeoutMS: config.dbConnectTimeoutMs,
    socketTimeoutMS: config.dbSocketTimeoutMs,
    bufferCommands: false
  }]);
  assert.ok(calls.some((call) => call[1] === 'bufferCommands' && call[2] === false));
  await db.disconnectDatabase();
  await db.disconnectDatabase();
  assert.equal(calls.filter(([name]) => name === 'disconnect').length, 1);
});

test('database adapter releases a failed connection attempt so it can retry', async () => {
  let attempts = 0;
  const driver = {
    connection: { readyState: 0 }, set() {},
    async connect() { if (++attempts === 1) throw new Error('offline'); this.connection.readyState = 1; },
    async disconnect() { this.connection.readyState = 0; }
  };
  const db = createDatabase({ driver, config: loadConfig(ENV) });
  await assert.rejects(db.connectDatabase());
  await db.connectDatabase('mongodb://127.0.0.1:27017/explicit');
  assert.equal(attempts, 2);
  await db.disconnectDatabase();
});
