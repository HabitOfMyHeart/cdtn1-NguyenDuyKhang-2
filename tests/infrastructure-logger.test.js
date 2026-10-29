const test = require('node:test');
const assert = require('node:assert/strict');
const { createLogger, redact } = require('../src/logger');
const { DataAccessError } = require('../src/services/errors');

test('structured logger keeps only bounded operational metadata and redacts PII, secrets, strings and Error causes', () => {
  const output = [];
  const logger = createLogger({ stream: { write: (line) => output.push(line) }, now: () => new Date('2026-10-27T00:00:00Z') });
  const requestId = '8f5b3fd8-56f1-48b1-8f68-e2924080a847';
  const cause = new Error('password=needle-secret phone 0901234567 Nguyễn Văn An');
  const error = new DataAccessError('mongodb://user:needle-secret@host db private', { cause });
  logger.error('http.request.failed', {
    requestId, method: 'POST', statusCode: 503, durationMs: 12,
    password: 'needle-secret', authorization: 'Bearer needle-token', cookie: 'sid=needle-cookie',
    phone: '0901234567', email: 'private@example.com', address: '123 Private Street',
    fullName: 'Nguyễn Văn An', username: 'private-user', serialNo: 'private-serial',
    body: { anything: 'needle-body' }, query: { q: 'needle-query' },
    info: 'unknown-secret and Nguyễn Văn An', numericPii: 901234567,
    error, nested: { text: 'needle-nested', error }
  });
  logger.info('needle-secret phone 0901234567', 'private free-form text');
  const raw = output.join('');
  for (const secret of ['needle-secret', '0901234567', 'Nguyễn Văn An', 'private@example.com', 'Private Street',
    'private-user', 'private-serial', 'needle-token', 'needle-cookie', 'needle-body', 'needle-query', 'needle-nested', '901234567', 'mongodb://', 'free-form text']) {
    assert.ok(!raw.includes(secret), `must redact ${secret}`);
  }
  const record = JSON.parse(output[0]);
  assert.equal(record.level, 'error');
  assert.equal(record.event, 'http.request.failed');
  assert.equal(record.data.requestId, requestId);
  assert.equal(record.data.statusCode, 503);
  assert.equal(record.data.durationMs, 12);
  assert.equal(record.data.error.message, '[REDACTED]');
  assert.equal(record.data.error.cause.message, '[REDACTED]');
  assert.equal(JSON.parse(output[1]).event, 'application.event');
});

test('logger respects level, uses a single JSON line, handles cycles and cannot break requests on write failure', () => {
  const lines = [];
  const logger = createLogger({ level: 'warn', stream: { write: (line) => lines.push(line) } });
  logger.debug('http.request.completed');
  logger.info('http.request.completed');
  const cycle = { message: 'secret\nnew line' };
  cycle.self = cycle;
  logger.warn('http.request.failed', cycle);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].split('\n').length, 2);
  assert.doesNotThrow(() => JSON.parse(lines[0]));
  assert.equal(redact(new Error('private')).message, '[REDACTED]');
  assert.doesNotThrow(() => createLogger({ stream: { write() { throw new Error('stream down'); } } }).error('server.startup_failed'));
  createLogger({ level: 'silent', stream: { write() { assert.fail('silent must not write'); } } }).error('server.startup_failed');
  assert.throws(() => createLogger({ level: 'constructor' }));
});
