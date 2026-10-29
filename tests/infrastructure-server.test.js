const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { startServer } = require('../src/server');

const config = {
  port: 3100, logLevel: 'silent', httpRequestTimeoutMs: 30000,
  httpHeadersTimeoutMs: 10000, shutdownTimeoutMs: 100
};
const tick = () => new Promise((resolve) => setImmediate(resolve));

function doubles(options = {}) {
  const records = [];
  const logger = Object.fromEntries(['debug', 'info', 'warn', 'error'].map((level) => [level, (event, data) => records.push({ level, event, data })]));
  const processRef = new EventEmitter();
  processRef.exits = [];
  processRef.exit = (code) => processRef.exits.push(code);
  const server = new EventEmitter();
  Object.assign(server, {
    closeCalls: 0, forceCalls: 0, idleCalls: 0,
    listen(port) {
      this.port = port;
      if (options.syncListenFailure) throw new Error('listen failed');
      queueMicrotask(() => this.emit(options.listenFailure ? 'error' : 'listening', new Error('listen failed')));
      return this;
    },
    close(callback) {
      this.closeCalls++;
      if (!options.hangClose) queueMicrotask(() => callback(options.closeFailure ? new Error('close failed') : undefined));
    },
    closeIdleConnections() { this.idleCalls++; },
    closeAllConnections() { this.forceCalls++; }
  });
  const database = {
    connects: 0, disconnects: 0,
    async connectDatabase() {
      this.connects++;
      if (options.connection) await options.connection;
      if (options.databaseFailure) throw new Error('database offline');
    },
    async disconnectDatabase() {
      this.disconnects++;
      if (options.disconnectFailure) throw new Error('disconnect failed');
      if (options.hangDisconnect) await new Promise(() => {});
    }
  };
  return { server, database, records, processRef, logger,
    deps: { config, app() {}, logger, processRef, database, createHttpServer: () => server } };
}

test('startup configures HTTP timeouts, remains available after DB failure and shuts down idempotently', async () => {
  const fake = doubles({ databaseFailure: true });
  const lifecycle = await startServer(fake.deps);
  await lifecycle.databaseReady;
  assert.equal(fake.server.port, config.port);
  assert.equal(fake.server.requestTimeout, config.httpRequestTimeoutMs);
  assert.equal(fake.server.headersTimeout, config.httpHeadersTimeoutMs);
  assert.ok(fake.records.some((record) => record.event === 'database.unavailable'));
  assert.equal(fake.server.closeCalls, 0);
  assert.equal(fake.processRef.listenerCount('SIGTERM'), 1);
  const first = lifecycle.shutdown();
  assert.equal(lifecycle.shutdown(), first);
  assert.deepEqual(await first, { timedOut: false, exitCode: 0 });
  assert.equal(fake.server.closeCalls, 1);
  assert.equal(fake.database.disconnects, 1);
  assert.equal(fake.processRef.listenerCount('SIGTERM'), 0);
  assert.equal(fake.processRef.listenerCount('SIGINT'), 0);
  assert.deepEqual(fake.processRef.exits, []);
});

test('listen errors (async or sync) reject startup without database work or leaked signal listeners', async () => {
  for (const option of ['listenFailure', 'syncListenFailure']) {
    const fake = doubles({ [option]: true });
    await assert.rejects(startServer(fake.deps), /listen failed/);
    assert.equal(fake.database.connects, 0);
    assert.equal(fake.processRef.listenerCount('SIGINT'), 0);
    assert.equal(fake.processRef.listenerCount('SIGTERM'), 0);
    assert.equal(fake.server.listenerCount('listening'), 0);
    assert.equal(fake.server.listenerCount('error'), 0);
    assert.ok(fake.records.some((record) => record.event === 'server.listen_failed'));
  }
});

test('shutdown bounds hung HTTP/DB work and closes only its own server connections', async () => {
  const fake = doubles({ hangClose: true, hangDisconnect: true });
  const lifecycle = await startServer({ ...fake.deps, config: { ...config, shutdownTimeoutMs: 20 } });
  const start = Date.now();
  assert.deepEqual(await lifecycle.shutdown(), { timedOut: true, exitCode: 1 });
  assert.ok(Date.now() - start < 1500);
  assert.equal(fake.server.forceCalls, 1);
  assert.equal(fake.server.closeCalls, 1);
  assert.equal(fake.processRef.listenerCount('SIGTERM'), 0);
});

test('shutdown waits for an in-flight database connection, then disconnects it', async () => {
  let resolveConnection;
  const connection = new Promise((resolve) => { resolveConnection = resolve; });
  const fake = doubles({ connection });
  const lifecycle = await startServer(fake.deps);
  const stopped = lifecycle.shutdown();
  assert.equal(fake.database.disconnects, 0);
  resolveConnection();
  assert.deepEqual(await stopped, { timedOut: false, exitCode: 0 });
  assert.equal(fake.database.disconnects, 1);
});

test('shutdown failures produce nonzero outcome; signals use injected process only and clean handlers', async () => {
  const fake = doubles({ disconnectFailure: true });
  const lifecycle = await startServer(fake.deps);
  fake.processRef.emit('SIGTERM', 'SIGTERM');
  fake.processRef.emit('SIGINT', 'SIGINT');
  assert.deepEqual(await lifecycle.shutdown(), { timedOut: false, exitCode: 1 });
  await tick();
  assert.deepEqual(fake.processRef.exits, [1]);
  assert.equal(fake.server.closeCalls, 1);
  assert.ok(fake.records.some((record) => record.event === 'server.shutdown_failed'));
});

test('HTTP close errors are reported as a failed shutdown without unhandled rejection', async () => {
  const fake = doubles({ closeFailure: true });
  const lifecycle = await startServer(fake.deps);
  assert.deepEqual(await lifecycle.shutdown(), { timedOut: false, exitCode: 1 });
  assert.equal(fake.database.disconnects, 1);
});

test('a connection resolving after shutdown timeout is still disconnected', async () => {
  let resolveConnection;
  const connection = new Promise((resolve) => { resolveConnection = resolve; });
  const fake = doubles({ connection });
  const lifecycle = await startServer({ ...fake.deps, config: { ...config, shutdownTimeoutMs: 20 } });
  assert.deepEqual(await lifecycle.shutdown(), { timedOut: true, exitCode: 1 });
  const before = fake.database.disconnects;
  resolveConnection();
  await lifecycle.databaseReady;
  await tick();
  assert.ok(fake.database.disconnects > before);
});

test('runtime listener errors trigger bounded shutdown and a nonzero injected exit', async () => {
  const fake = doubles();
  const lifecycle = await startServer(fake.deps);
  fake.server.emit('error', new Error('runtime server failure'));
  await lifecycle.shutdown();
  await tick();
  assert.deepEqual(fake.processRef.exits, [1]);
  assert.equal(fake.database.disconnects, 1);
});
