// Explicit opt-in integration check: run inside the isolated Docker app only.
// Not named *.test.js: the regular offline suite never opens a real database.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { randomInt, randomUUID } = require('node:crypto');
const { mongo: { MongoClient } } = require('mongoose');
const { assertSmokeEnvironment } = require('../docker/smoke-guard');

async function verifyDockerDemo() {
  assertSmokeEnvironment({
    uri: process.env.MONGODB_URI,
    inContainer: fs.existsSync('/.dockerenv')
  });
  const root = 'http://127.0.0.1:3000';
  const checks = [];
  async function request(method, route, body, token, expected = 200) {
    const response = await fetch(root + route, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(15000)
    });
    assert.equal(response.status, expected, `${method} ${route}: unexpected HTTP status`);
    return response.json();
  }

  const health = await request('GET', '/health');
  assert.equal(health.status, 'ok');
  assert.equal(health.database, 'connected');
  checks.push('health_200_connected');

  const unauthorized = await request('GET', '/api/auth/me', undefined, undefined, 401);
  assert.equal(unauthorized.error, 'CHUA_DANG_NHAP');
  checks.push('missing_token_401');

  const login = await request('POST', '/api/auth/login', {
    username: process.env.DEMO_STAFF_USERNAME,
    password: process.env.DEMO_STAFF_PASSWORD
  });
  const token = login.data.token;
  assert.ok(token);
  assert.equal((await request('GET', '/api/auth/me', undefined, token)).data.role, 'NHAN_VIEN');
  checks.push('login_and_me_200');

  const marker = randomUUID();
  const customer = await request('POST', '/api/customers', {
    full_name: 'BT3 Docker verification', phone: `0${randomInt(100000000, 1000000000)}`,
    email: 'bt3-docker@example.com', segment: 'MOI'
  }, token, 201);
  const device = await request('POST', '/api/devices', {
    customer_id: customer.data.customer_id, product_name: 'BT3 Docker verification device',
    serial_no: `BT3-${marker}`, purchase_date: null, warranty_months: 12
  }, token, 201);
  assert.equal(device.data.conBaoHanh, null);
  const catalog = await request('GET', '/api/catalogs', undefined, token);
  assert.equal(catalog.data.centers.length, 6);
  assert.equal(catalog.data.categories.length, 6);
  const input = {
    customer_id: customer.data.customer_id, device_id: device.data.device.device_id,
    center_id: login.data.user.center_id, category_id: catalog.data.categories[0].category_id,
    issue_desc: 'BT3 Docker smoke check: device does not charge.',
    received_at: '2026-11-12T09:00:00+07:00'
  };
  const invalid = await request('POST', '/api/tickets', { ...input, issue_desc: {} }, token, 422);
  assert.equal(invalid.error, 'DU_LIEU_KHONG_HOP_LE');
  assert.ok(invalid.fields.issue_desc);
  checks.push('invalid_body_422_with_field');

  const created = await request('POST', '/api/tickets', input, token, 201);
  const ticket = created.data.ticket;
  assert.equal(ticket.trangThai, 'MOI');
  assert.equal(ticket.conBaoHanh, null);
  assert.equal(created.data.lichSuTrangThai[0].toStatus, 'MOI');
  const detail = await request('GET', `/api/tickets/${ticket.ticketId}`, undefined, token);
  assert.equal(detail.data.ticket.ticketCode, ticket.ticketCode);
  checks.push('customer_device_ticket_created_and_reloaded');

  const duplicate = await request('POST', '/api/tickets', input, token, 409);
  assert.equal(duplicate.error, 'PHIEU_DANG_MO');
  checks.push('second_open_ticket_409');

  // Test-only trusted identity for another center; never print or persist its JWT.
  const foreignToken = require('../src/middlewares/auth.middleware').signAccessToken({
    username: 'bt3_other_center', role: 'NHAN_VIEN', center_id: '2', fullName: 'Test employee'
  });
  const forbidden = await request('GET', `/api/tickets/${ticket.ticketId}`, undefined, foreignToken, 403);
  assert.equal(forbidden.error, 'KHONG_DU_QUYEN');
  checks.push('cross_center_read_403');
  assert.ok(!JSON.stringify([invalid, unauthorized, forbidden]).match(/mongodb:\/\/|MongoServer|stack|password|JWT_SECRET/));
  checks.push('error_bodies_do_not_expose_internal_details');

  const client = new MongoClient(process.env.MONGODB_URI);
  try {
    await client.connect();
    const db = client.db('mekong_bt3_demo');
    assert.equal(await db.collection('ticket').countDocuments({ ticket_id: ticket.ticketId }), 1);
    assert.equal(await db.collection('ticket_status_log').countDocuments({ ticket_id: ticket.ticketId }), 1);
    await db.collection('_bt3_deployment').updateOne({ _id: 'smoke-verification' }, {
      $set: { ticket_id: ticket.ticketId, ticket_code: ticket.ticketCode }
    }, { upsert: true });
  } finally {
    await client.close();
  }
  // Operational IDs only: do not print tokens, phones, names or source records.
  console.log(JSON.stringify({ status: 'PASS', checks, ticket_id: ticket.ticketId }, null, 2));
}

verifyDockerDemo().catch((error) => {
  console.error(error.message.startsWith('Smoke verification')
    ? `${error.message} No requests were sent and no credentials are printed.`
    : 'FAIL: Docker smoke verification did not complete; no credentials are printed.');
  process.exitCode = 1;
});
