const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const bcrypt = require('bcryptjs');

const DEMO_PASSWORD = 'mat-khau-demo-123';
const JWT_SECRET = 'bt3-hardening-test-secret-0123456789abcdef';

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = JWT_SECRET;
process.env.JWT_EXPIRES_IN = '1h';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/bt3_hardening_test';
process.env.DEMO_STAFF_USERNAME = 'nhanvien';
process.env.DEMO_STAFF_PASSWORD_HASH = bcrypt.hashSync(DEMO_PASSWORD, 10);
// Giá trị plaintext cố ý sai: bản cũ dùng nó sẽ trả 401, bản mới phải bỏ qua và dùng hash.
process.env.DEMO_STAFF_PASSWORD = 'plaintext-khong-duoc-dung-123';
process.env.DEMO_STAFF_NAME = 'Nhân viên kiểm thử';
process.env.DEMO_STAFF_CENTER = '1';

const { loadConfig } = require('../src/config');
const { createErrorHandler } = require('../src/middlewares/error.middleware');
const { signAccessToken } = require('../src/middlewares/auth.middleware');
const { createTicketRoutes } = require('../src/routes/ticket.routes');
const { buildFixture } = require('./helpers/inMemoryRepositories');

const BASE_ENV = Object.freeze({
  NODE_ENV: 'test',
  JWT_SECRET,
  MONGODB_URI: 'mongodb://127.0.0.1:27017/bt3_hardening_test',
  DEMO_STAFF_USERNAME: 'nhanvien',
  DEMO_STAFF_NAME: 'Nhân viên kiểm thử',
  DEMO_STAFF_CENTER: '1'
});

const silentLogger = Object.fromEntries(
  ['debug', 'info', 'warn', 'error'].map((level) => [level, () => {}])
);

/**
 * Dựng Express app tối thiểu dùng đúng router nghiệp vụ và error handler thật.
 *
 * @param {object} ticketService Service phiếu cần tiêm.
 * @returns {Promise<{baseUrl: string, close: () => Promise<void>}>} Server đang chạy.
 */
async function startTicketApp(ticketService) {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  const { router } = createTicketRoutes({ service: ticketService });
  app.use('/api/tickets', router);
  app.use(createErrorHandler({ logger: silentLogger }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

/**
 * Payload tiếp nhận hợp lệ theo fixture chuẩn.
 *
 * @param {object} fixture Bộ dữ liệu test.
 * @returns {object} Payload tạo phiếu.
 */
function ticketPayload(fixture) {
  return {
    customer_id: 'CUS0001',
    device_id: 'DEV0004',
    center_id: '1',
    category_id: '1',
    issue_desc: 'Màn hình bị sọc và không hiển thị khi mở máy.',
    accessories: ['SAC'],
    exterior_note: 'Trầy nhẹ góc phải.',
    received_at: fixture.FIXED_NOW.toISOString()
  };
}

test('cấu hình chấp nhận bcrypt hash và production bắt buộc hash', () => {
  const hash = bcrypt.hashSync(DEMO_PASSWORD, 10);
  const config = loadConfig({ ...BASE_ENV, DEMO_STAFF_PASSWORD_HASH: hash });
  assert.equal(config.demoStaff.passwordHash, hash);
  assert.equal(config.demoStaff.password, undefined);

  assert.throws(
    () => loadConfig({ ...BASE_ENV, DEMO_STAFF_PASSWORD_HASH: 'khong-phai-bcrypt' }),
    (error) => Boolean(error.fields.DEMO_STAFF_PASSWORD_HASH)
  );

  assert.throws(
    () => loadConfig({ ...BASE_ENV, NODE_ENV: 'production', DEMO_STAFF_PASSWORD: 'mat-khau-du-dai-123' }),
    (error) => Boolean(error.fields.DEMO_STAFF_PASSWORD_HASH)
  );
});

test('đăng nhập so sánh bcrypt: đúng mật khẩu nhận token, sai mật khẩu nhận 401', async () => {
  const authRouter = require('../src/routes/auth.routes');
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRouter);
  app.use(createErrorHandler({ logger: silentLogger }));
  const server = await new Promise((resolve) => {
    const listener = app.listen(0, '127.0.0.1', () => resolve(listener));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const okResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'nhanvien', password: DEMO_PASSWORD })
    });
    const okBody = await okResponse.json();
    assert.equal(okResponse.status, 200);
    assert.equal(typeof okBody.data.token, 'string');
    assert.equal(okBody.data.user.username, 'nhanvien');

    const badResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ username: 'nhanvien', password: 'sai-mat-khau' })
    });
    const badBody = await badResponse.json();
    assert.equal(badResponse.status, 401);
    assert.equal(badBody.error, 'CHUA_DANG_NHAP');
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test('A01/S2: nhân viên trung tâm khác nhận HTTP 403 khi xem hoặc sửa phiếu', async () => {
  const fixture = buildFixture();
  const created = await fixture.ticketService.createTicket(ticketPayload(fixture), {
    username: 'nhanvien',
    role: 'NHAN_VIEN',
    center_id: '1'
  });
  const ticketId = created.ticket.ticketId;

  const app = await startTicketApp(fixture.ticketService);
  const tokenCenterTwo = signAccessToken({
    username: 'nhanvien2',
    role: 'NHAN_VIEN',
    center_id: '2',
    fullName: 'Nhân viên trung tâm 2'
  });
  const tokenCenterOne = signAccessToken({
    username: 'nhanvien',
    role: 'NHAN_VIEN',
    center_id: '1',
    fullName: 'Nhân viên trung tâm 1'
  });
  const auth = (token) => ({ authorization: `Bearer ${token}` });

  try {
    for (const [method, path, body] of [
      ['GET', `/api/tickets/${ticketId}`, undefined],
      ['GET', `/api/tickets/${ticketId}/history`, undefined],
      ['PUT', `/api/tickets/${ticketId}`, { issue_desc: 'Sửa trái phép nội dung phiếu.' }],
      ['DELETE', `/api/tickets/${ticketId}`, undefined]
    ]) {
      const response = await fetch(`${app.baseUrl}${path}`, {
        method,
        headers: { ...auth(tokenCenterTwo), ...(body ? { 'content-type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined
      });
      const payload = await response.json();
      assert.equal(response.status, 403, `${method} ${path} phải trả 403`);
      assert.equal(payload.error, 'KHONG_DU_QUYEN');
    }

    const sameCenter = await fetch(`${app.baseUrl}/api/tickets/${ticketId}`, {
      headers: auth(tokenCenterOne)
    });
    assert.equal(sameCenter.status, 200);

    const anonymous = await fetch(`${app.baseUrl}/api/tickets/${ticketId}`);
    assert.equal(anonymous.status, 401);

    const unchanged = await fixture.ticketService.getTicket(ticketId, {
      username: 'nhanvien',
      role: 'NHAN_VIEN',
      center_id: '1'
    });
    assert.equal(unchanged.moTaLoi, 'Màn hình bị sọc và không hiển thị khi mở máy.');
  } finally {
    await app.close();
  }
});
