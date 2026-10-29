const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const { loadConfig } = require('../src/config');
const { createAuthMiddleware, getBearerToken, requireRole } = require('../src/middlewares/auth.middleware');

const config = loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'unit-test-key-not-for-deployment-123456789', DEMO_STAFF_PASSWORD: 'unit-test-password' });
const user = { username: 'staff', role: 'NHAN_VIEN', center_id: '1', fullName: 'Test Staff' };
const auth = createAuthMiddleware({ config });
const request = (token) => ({ headers: token ? { authorization: `Bearer ${token}` } : {} });
function authenticate(token) {
  const req = request(token);
  let result;
  auth.requireAuth(req, {}, (error) => { result = error || null; });
  return { req, error: result };
}

test('auth signs expiring HS256 tokens and verifies only the expected public identity', () => {
  const token = auth.signAccessToken(user);
  const payload = jwt.verify(token, config.jwtSecret, { algorithms: ['HS256'] });
  assert.equal(payload.sub, user.username);
  assert.equal(payload.exp - payload.iat, 8 * 3600);
  assert.equal(jwt.decode(token, { complete: true }).header.alg, 'HS256');
  const result = authenticate(token);
  assert.equal(result.error, null);
  assert.deepEqual(result.req.user, user);
  assert.equal(result.req.user.password, undefined);
});

test('auth rejects missing, malformed, expired, foreign, non-HS256 and incomplete identities', () => {
  const payload = { sub: user.username, role: user.role, center_id: user.center_id };
  const signed = (overrides, options = {}) => jwt.sign({ ...payload, ...overrides }, config.jwtSecret, { expiresIn: '1h', ...options });
  const tokens = [undefined, 'not-a-token',
    jwt.sign(payload, 'another-key', { expiresIn: '1h' }),
    signed({}, { expiresIn: -1 }), signed({}, { algorithm: 'HS384' }),
    signed({ role: 'ADMIN' }), signed({ center_id: '' }), signed({ center_id: '../1' }),
    signed({ sub: 'a'.repeat(25) }), signed({ sub: '' }), signed({ fullName: { private: 'object' } }),
    jwt.sign(payload, config.jwtSecret)
  ];
  for (const token of tokens) {
    const { req, error } = authenticate(token);
    assert.equal(error.kind, 'unauthorized');
    assert.equal(error.code, 'CHUA_DANG_NHAP');
    assert.equal(error.statusCode, undefined);
    assert.equal(req.user, undefined);
  }
  assert.throws(() => auth.signAccessToken({ ...user, username: 'x'.repeat(25) }), (error) => error.kind === 'unauthorized');
});

test('Bearer parsing never accepts ambiguous headers, arrays, extra tokens or oversized values', () => {
  const token = auth.signAccessToken(user);
  assert.equal(getBearerToken(request(token)), token);
  for (const header of ['', 'Basic abc', `Bearer ${token} extra`, `Bearer  ${token}`, ['Bearer token'], 'Bearer ' + 'a'.repeat(9000)]) {
    assert.equal(getBearerToken({ headers: { authorization: header } }), null);
  }
});

test('auth passes algorithm/lifetime options to an injected provider and role errors remain semantic', () => {
  const calls = [];
  const provider = {
    sign(payload, secret, options) { calls.push({ payload, secret, options }); return 'a.b.c'; },
    verify(token, secret, options) {
      calls.push({ token, secret, options });
      return { sub: user.username, role: user.role, center_id: user.center_id, exp: Math.floor(Date.now() / 1000) + 60 };
    }
  };
  const injected = createAuthMiddleware({ config, tokenProvider: provider });
  assert.equal(injected.signAccessToken(user), 'a.b.c');
  const req = request('a.b.c');
  injected.requireAuth(req, {}, (error) => assert.equal(error, undefined));
  assert.deepEqual(calls[0].options, { algorithm: 'HS256', expiresIn: config.jwtExpiresIn });
  assert.deepEqual(calls[1].options, { algorithms: ['HS256'] });
  const guard = requireRole('NHAN_VIEN');
  guard(req, {}, (error) => assert.equal(error, undefined));
  guard({}, {}, (error) => assert.equal(error.kind, 'unauthorized'));
  requireRole('ADMIN')(req, {}, (error) => assert.equal(error.kind, 'forbidden'));
});
