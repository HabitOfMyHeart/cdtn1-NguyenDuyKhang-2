const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createApp } = require('../src/app');
const { createLogger } = require('../src/logger');
const errors = require('../src/services/errors');
const { asyncHandler, createErrorHandler, normalizeError } = require('../src/middlewares/error.middleware');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const factories = {
  bad: () => errors.badRequest('Kiểm tra yêu cầu.', { priority: 'Không hợp lệ.' }),
  invalid: () => errors.invalid('Dữ liệu không hợp lệ.'),
  missing: () => errors.notFound('Không tìm thấy phiếu.'),
  conflict: () => errors.conflict('PHIEU_DANG_MO', 'Phiếu đang mở.'),
  auth: () => errors.unauthorized(), forbidden: () => errors.forbidden(),
  internal: () => errors.internal('private-secret error message'),
  duplicate: () => Object.assign(new Error('private-secret 0901234567'), { code: 11000, keyPattern: { phone: 1 }, keyValue: { phone: '0901234567' } }),
  wrappedDuplicate: () => new errors.DuplicateKeyError({ phone: 'Giá trị này đã được sử dụng.' }, { cause: new Error('private-secret') }),
  validation: () => Object.assign(new Error('private-secret'), { name: 'ValidationError', errors: { phone: { message: 'private-secret 0901234567', value: '0901234567' } } }),
  cast: () => Object.assign(new Error('private-secret'), { name: 'CastError', path: 'customer_id', value: 'private-secret' }),
  database: () => Object.assign(new Error('mongodb://private-secret'), { name: 'MongoServerSelectionError' }),
  disconnected: () => Object.assign(new Error('Cannot call tickets.find() before initial connection is complete if bufferCommands = false.'), { name: 'MongooseError' }),
  wrappedDatabase: () => new errors.DataAccessError('mongodb://private-secret', { cause: new Error('private-secret 0901234567') }),
  unexpected: () => new Error('private-secret 0901234567'),
  forgedStatus: () => Object.assign(new Error('private-secret'), { status: 401, statusCode: 418 }),
  forgedKind: () => Object.assign(new Error('private-secret'), { kind: 'forbidden', code: 'KHONG_DU_QUYEN' }),
  invalidKind: () => new errors.AppError('PRIVATE', 'private-secret', 'toString')
};

async function withServer(t, { state = 'connected', mountRoutes, lines = [] } = {}) {
  const app = createApp({
    database: { getDatabaseState: () => typeof state === 'function' ? state() : state },
    logger: createLogger({ stream: { write: (line) => lines.push(line) } }),
    mountRoutes: mountRoutes || ((app) => {
      app.get('/api/error/:kind', asyncHandler(async (req) => { throw factories[req.params.kind](); }));
      app.post('/api/probe', (req, res) => res.json({ ok: true }));
    })
  });
  const server = http.createServer(app);
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  return { url: `http://127.0.0.1:${server.address().port}`, lines };
}

test('application errors expose semantic kind/code/message/fields, never transport status', () => {
  const expected = { bad: 'bad_request', invalid: 'validation', missing: 'not_found', conflict: 'conflict', auth: 'unauthorized', forbidden: 'forbidden', internal: 'internal' };
  for (const [factory, kind] of Object.entries(expected)) {
    const error = factories[factory]();
    assert.ok(errors.isAppError(error));
    assert.equal(error.kind, kind);
    assert.equal(error.statusCode, undefined);
    assert.equal(error.status, undefined);
    assert.ok(error.fields && typeof error.fields === 'object');
  }
  const cause = new Error('private');
  const error = new errors.DataAccessError(undefined, { cause });
  assert.equal(error.cause, cause);
  assert.equal(Object.getOwnPropertyDescriptor(error, 'cause').enumerable, false);
  assert.equal(error.kind, 'unavailable');
});

test('HTTP boundary maps all semantic/repository failures safely and correlates each response with stdout', async (t) => {
  const { url, lines } = await withServer(t);
  const expected = {
    bad: 400, invalid: 422, missing: 404, conflict: 409, auth: 401, forbidden: 403,
    internal: 500, duplicate: 409, wrappedDuplicate: 409, validation: 422, cast: 422,
    database: 503, disconnected: 503, wrappedDatabase: 503, unexpected: 500,
    forgedStatus: 500, forgedKind: 500, invalidKind: 500
  };
  const ids = new Set();
  for (const [kind, status] of Object.entries(expected)) {
    const response = await fetch(`${url}/api/error/${kind}?phone=0901234567&token=private-secret`, {
      headers: { 'X-Request-ID': 'private-secret-0901234567', authorization: 'Bearer private-secret' }
    });
    assert.equal(response.status, status, kind);
    const body = await response.json();
    assert.deepEqual(Object.keys(body).sort(), ['error', 'fields', 'message']);
    const requestId = response.headers.get('x-request-id');
    assert.match(requestId, UUID);
    assert.equal(body.fields.maTraCuu, requestId);
    assert.ok(!ids.has(requestId));
    ids.add(requestId);
    assert.ok(!JSON.stringify(body).includes('private-secret'));
    assert.ok(!JSON.stringify(body).includes('0901234567'));
    const record = lines.map(JSON.parse).find((entry) => entry.event === 'http.request.failed' && entry.data.requestId === requestId);
    assert.equal(record.data.statusCode, status);
    if (kind === 'bad') assert.equal(body.fields.priority, 'Không hợp lệ.');
    if (kind === 'duplicate') assert.equal(body.fields.phone, 'Giá trị này đã được sử dụng.');
    if (kind === 'validation') assert.equal(body.fields.phone, 'Giá trị không hợp lệ.');
  }
  const logText = lines.join('');
  assert.ok(!logText.includes('private-secret'));
  assert.ok(!logText.includes('0901234567'));
  assert.ok(!logText.includes('mongodb://'));
});

test('request IDs exist before JSON parsing; invalid JSON and oversized body become correlated 400/413', async (t) => {
  const { url, lines } = await withServer(t);
  for (const [body, status] of [['{"password":"private-secret",', 400], [JSON.stringify({ secret: 'x'.repeat(1024 * 1024) }), 413]]) {
    const response = await fetch(`${url}/api/probe`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Request-ID': 'untrusted-id' }, body
    });
    assert.equal(response.status, status);
    const result = await response.json();
    assert.equal(result.fields.maTraCuu, response.headers.get('x-request-id'));
    assert.match(result.fields.maTraCuu, UUID);
    assert.ok(lines.map(JSON.parse).some((record) => record.data.requestId === result.fields.maTraCuu));
  }
  assert.ok(!lines.join('').includes('private-secret'));
  assert.ok(!lines.join('').includes('untrusted-id'));
});

test('API 404 never reflects URLs/query PII and successful requests receive server-generated IDs', async (t) => {
  const { url } = await withServer(t);
  const missing = await fetch(`${url}/api/unknown/0901234567?token=private-secret`);
  assert.equal(missing.status, 404);
  const body = await missing.json();
  assert.ok(!JSON.stringify(body).includes('0901234567'));
  assert.ok(!JSON.stringify(body).includes('private-secret'));
  const success = await fetch(`${url}/api/probe`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
  assert.equal(success.status, 200);
  assert.match(success.headers.get('x-request-id'), UUID);
  assert.equal(success.headers.get('x-powered-by'), null);
});

test('readiness is 503 for all unavailable states but the UI stays available; connected state is 200', async (t) => {
  let state = 'disconnected';
  const { url } = await withServer(t, { state: () => state });
  for (const unavailable of ['disconnected', 'connecting', 'disconnecting', 'unknown', 'private-secret']) {
    state = unavailable;
    const response = await fetch(`${url}/health`);
    assert.equal(response.status, 503);
    const body = await response.json();
    assert.equal(body.status, 'degraded');
    assert.ok(!JSON.stringify(body).includes('private-secret'));
  }
  const ui = await fetch(`${url}/`);
  assert.equal(ui.status, 200);
  assert.match(ui.headers.get('content-type'), /text\/html/);
  state = 'connected';
  const ready = await fetch(`${url}/health`);
  assert.equal(ready.status, 200);
  assert.equal((await ready.json()).status, 'ok');
});

test('boundary handles malformed field paths, synchronous throws and headers-already-sent correctly', async () => {
  const cast = normalizeError({ name: 'CastError', path: '__proto__' });
  assert.deepEqual(cast.fields, { du_lieu: 'Giá trị không hợp lệ.' });
  const boom = new Error('private-secret');
  await asyncHandler(() => { throw boom; })({}, {}, (error) => assert.equal(error, boom));
  const boundary = createErrorHandler({ logger: { warn() { assert.fail(); }, error() { assert.fail(); } } });
  boundary(boom, {}, { headersSent: true }, (error) => assert.equal(error, boom));
  const res = { setHeader(key, value) { this.header = value; }, status(value) { this.statusCode = value; return this; }, json(body) { this.body = body; } };
  const req = { requestId: '-'.repeat(36) };
  createErrorHandler({ logger: { warn() {}, error() {} } })(boom, req, res, assert.fail);
  assert.match(res.header, UUID);
  assert.equal(res.body.fields.maTraCuu, res.header);
});
