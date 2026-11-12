const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

function fixture(marker = null) {
  const events = [];
  const state = { marker };
  const client = {
    async connect() { events.push('connect'); },
    db(name) {
      assert.equal(name, 'mekong_bt3_demo');
      return {
        collection(name) {
          assert.equal(name, '_bt3_deployment');
          return {
            async findOne(query) {
              assert.deepEqual(query, { _id: 'sample-v1' });
              return state.marker;
            },
            async updateOne(query, update, options) {
              assert.deepEqual(query, { _id: 'sample-v1' });
              assert.equal(options.upsert, true);
              events.push('mark');
              state.marker = { ...query, ...update.$set };
            }
          };
        }
      };
    },
    async close() { events.push('close'); }
  };
  return { events, state, client };
}

test('Docker startup refuses any URI outside the isolated demo before opening a database', async () => {
  const { initializeDemo } = require('../docker/start-demo');
  for (const uri of [undefined, '', 'mongodb://127.0.0.1:27017/mekong_warranty',
    'mongodb://db:27017/other', 'mongodb://user:secret@db:27017/mekong_bt3_demo']) {
    const f = fixture();
    await assert.rejects(initializeDemo({ uri, client: f.client }), /isolated Docker demo/);
    assert.deepEqual(f.events, []);
  }
});

test('first Docker startup migrates and seeds before persisting successful initialization', async () => {
  const { initializeDemo } = require('../docker/start-demo');
  const f = fixture();
  const result = await initializeDemo({ uri: 'mongodb://db:27017/mekong_bt3_demo',
    client: f.client, run: (script) => f.events.push(script) });
  assert.equal(result, 'initialized');
  assert.deepEqual(f.events, ['connect', 'migrations/001_init_collections.js',
    'seeds/seed_l2_data.js', 'mark', 'close']);
  assert.equal(f.state.marker.version, 1);
  assert.equal(f.state.marker.complete, true);
});

test('Docker restart preserves edited application data by not migrating or reseeding an initialized database', async () => {
  const { initializeDemo } = require('../docker/start-demo');
  const marker = { _id: 'sample-v1', version: 1, complete: true };
  const f = fixture(marker);
  const result = await initializeDemo({ uri: 'mongodb://db:27017/mekong_bt3_demo',
    client: f.client, run: () => assert.fail('must not reseed on restart') });
  assert.equal(result, 'existing');
  assert.deepEqual(f.events, ['connect', 'close']);
  assert.equal(f.state.marker, marker);
});

test('migration failure prevents seed and initialization marker; the database connection still closes', async () => {
  const { initializeDemo } = require('../docker/start-demo');
  const f = fixture();
  await assert.rejects(initializeDemo({ uri: 'mongodb://db:27017/mekong_bt3_demo',
    client: f.client, run: (script) => {
      f.events.push(script);
      throw new Error('migration failed');
    } }), /migration failed/);
  assert.equal(f.state.marker, null);
  assert.deepEqual(f.events, ['connect', 'migrations/001_init_collections.js', 'close']);
});

test('seed failure never marks a partial installation as complete', async () => {
  const { initializeDemo } = require('../docker/start-demo');
  const f = fixture();
  await assert.rejects(initializeDemo({ uri: 'mongodb://db:27017/mekong_bt3_demo',
    client: f.client, run: (script) => {
      f.events.push(script);
      if (script.startsWith('seeds/')) throw new Error('sample conflict');
    } }), /sample conflict/);
  assert.equal(f.state.marker, null);
  assert.deepEqual(f.events, ['connect', 'migrations/001_init_collections.js', 'seeds/seed_l2_data.js', 'close']);
});

test('invalid Docker initialization metadata fails closed without modifying application records', async () => {
  const { initializeDemo } = require('../docker/start-demo');
  for (const marker of [{ version: 99, complete: true }, { version: 1, complete: false }]) {
    const f = fixture(marker);
    await assert.rejects(initializeDemo({ uri: 'mongodb://db:27017/mekong_bt3_demo',
      client: f.client, run: () => assert.fail('must not overwrite unknown state') }), /initialization metadata/);
    assert.equal(f.state.marker, marker);
    assert.deepEqual(f.events, ['connect', 'close']);
  }
});

test('failed Docker database connection still closes the client and cannot run initialization commands', async () => {
  const { initializeDemo } = require('../docker/start-demo');
  const f = fixture();
  f.client.connect = async () => { f.events.push('connect'); throw new Error('unavailable'); };
  await assert.rejects(initializeDemo({ uri: 'mongodb://db:27017/mekong_bt3_demo',
    client: f.client, run: () => assert.fail('must not initialize offline') }), /unavailable/);
  assert.deepEqual(f.events, ['connect', 'close']);
});

test('live smoke refuses host execution before any request even with demo environment values', () => {
  const { assertSmokeEnvironment } = require('../docker/smoke-guard');
  assert.throws(() => assertSmokeEnvironment({
    uri: 'mongodb://db:27017/mekong_bt3_demo', inContainer: false
  }), /Docker app container/);
  assert.doesNotThrow(() => assertSmokeEnvironment({
    uri: 'mongodb://db:27017/mekong_bt3_demo', inContainer: true
  }));
  // The subprocess regression applies only on a host; inside a container the
  // same environment is legitimate and the unit assertions above cover the guard.
  if (fs.existsSync('/.dockerenv')) return;
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'tests/docker-smoke.js')], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, MONGODB_URI: 'mongodb://db:27017/mekong_bt3_demo' }
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Docker app container/);
  assert.ok(!result.stdout.includes('"PASS"'));
});

test('Docker entrypoint exits nonzero with a safe configuration category before database initialization', () => {
  const result = spawnSync(process.execPath, [path.join(__dirname, '..', 'docker/start-demo.js')], {
    encoding: 'utf8', timeout: 10000,
    env: { ...process.env, NODE_ENV: 'test', JWT_SECRET: '', DEMO_STAFF_PASSWORD: '',
      MONGODB_URI: 'mongodb://db:27017/mekong_bt3_demo' }
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /configuration invalid/);
  assert.ok(!result.stdout.includes('Migration'));
  assert.ok(!result.stderr.includes('mongodb://'));
});
