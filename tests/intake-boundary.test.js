const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFixture } = require('./helpers/inMemoryRepositories');
const validators = require('../src/validators/ticket.validator');

const STAFF = { username: 'nhanvien', role: 'NHAN_VIEN', center_id: '1' };
const PAYLOAD = { customer_id: 'CUS0001', device_id: 'DEV0004', center_id: '1',
  category_id: '1', issue_desc: 'Màn hình không hiển thị khi mở máy.' };

test('L2: mọi phiếu sau MOI chỉ đọc, không thể xóa để tiếp nhận lại thiết bị', async () => {
  for (const status of ['DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG']) {
    const f = buildFixture({ withOpenTicket: true });
    await f.ticketRepository.update('TCK0001', { status });
    const before = await f.ticketService.getTicket('TCK0001', STAFF);
    const readOnly = (error) => error.kind === 'conflict' && error.code === 'PHIEU_CHI_DOC';
    await assert.rejects(f.ticketService.updateTicket('TCK0001', { priority: 'THAP', priority_reason: 'Đổi ưu tiên.' }, STAFF), readOnly);
    await assert.rejects(f.ticketService.deleteTicket('TCK0001', STAFF), readOnly);
    assert.deepEqual(await f.ticketService.getTicket('TCK0001', STAFF), before);
    if (status !== 'DA_DONG') {
      await assert.rejects(f.ticketService.createTicket({ ...PAYLOAD, device_id: 'DEV0001' }, STAFF),
        (error) => error.code === 'PHIEU_DANG_MO');
    }
  }
});

test('L2: CRUD phiếu MOI vẫn hoạt động, xóa mềm giữ log khởi tạo', async () => {
  const f = buildFixture();
  const created = await f.ticketService.createTicket(PAYLOAD, STAFF);
  const id = created.ticket.ticketId;
  const updated = await f.ticketService.updateTicket(id, { issue_desc: 'Mô tả lỗi đã được nhân viên sửa lại.' }, STAFF);
  assert.equal(updated.ticket.trangThai, 'MOI');
  assert.match(updated.moTaLoi, /đã được/);
  await f.ticketService.deleteTicket(id, STAFF);
  await assert.rejects(f.ticketService.getTicket(id, STAFF), (error) => error.kind === 'not_found');
  assert.equal((await f.ticketRepository.listStatusLogs(id)).length, 1);
});

test('L2: trạng thái thay đổi giữa đọc và ghi không được báo sửa/xóa thành công', async () => {
  const f = buildFixture();
  const created = await f.ticketService.createTicket(PAYLOAD, STAFF);
  f.ticketRepository.update = async () => null;
  f.ticketRepository.softDelete = async () => null;
  await assert.rejects(f.ticketService.updateTicket(created.ticket.ticketId, { issue_desc: 'Mô tả cập nhật hợp lệ.' }, STAFF),
    (error) => error.code === 'PHIEU_CHI_DOC');
  await assert.rejects(f.ticketService.deleteTicket(created.ticket.ticketId, STAFF),
    (error) => error.code === 'PHIEU_CHI_DOC');
});

test('repository: điều kiện ghi sửa/xóa phiếu kiểm tra MOI ngay tại CSDL', async (t) => {
  const { Ticket } = require('../src/models/schemas');
  const repository = require('../src/repositories/ticket.repository');
  const calls = [];
  t.mock.method(Ticket, 'findOneAndUpdate', (filter) => {
    calls.push(filter);
    return { lean: async () => null };
  });
  await repository.update('TCK0001', { issue_desc: 'Mô tả cập nhật hợp lệ.' });
  await repository.softDelete('TCK0001');
  assert.deepEqual(calls, [1, 2].map(() => ({ ticket_id: 'TCK0001', is_deleted: false, status: 'MOI' })));
});

test('validation: từ chối object/mảng/số ở trường văn bản và body sai kiểu', () => {
  for (const issue_desc of [{ bad: true }, ['Mô tả không phải chuỗi.'], 1234567890123]) {
    const result = validators.validateCreateTicket({ ...PAYLOAD, issue_desc });
    assert.equal(result.valid, false);
    assert.ok(result.fields.issue_desc);
  }
  for (const fn of ['validateCreateTicket', 'validateUpdateTicket', 'validateCreateCustomer',
    'validateUpdateCustomer', 'validateCreateDevice', 'validateUpdateDevice', 'validateLogin', 'validatePreview']) {
    for (const body of [null, [], 'body', 42]) {
      assert.equal(validators[fn](body).valid, false, fn);
    }
  }
});

test('validation: chỉ nhận ngày lịch có thật, giữ ngày nhuận và múi giờ hợp lệ', () => {
  for (const value of ['2026-02-30', '2025-02-29', '2026-04-31T09:00:00+07:00',
    '2026-13-01', '2026-10-27T24:01:00+07:00', 0, true, [], {}]) {
    assert.equal(validators.isValidDate(value), false, String(value));
  }
  for (const value of ['2024-02-29', '2026-10-27T09:00:00+07:00',
    '2026-10-27T02:00:00.000Z', new Date('2026-10-27T02:00:00Z')]) {
    assert.equal(validators.isValidDate(value), true, String(value));
  }
  assert.ok(validators.validateCreateDevice({ customer_id: 'CUS0001', product_name: 'Máy',
    serial_no: 'SN12345678', purchase_date: '2026-02-30' }).fields.purchase_date);
});

test('service: từ chối ngày không tồn tại và mô tả sai kiểu ngay cả khi không đi qua route', async () => {
  const f = buildFixture();
  for (const patch of [{ issue_desc: {} }, { received_at: '2026-02-30T09:00:00+07:00' }]) {
    await assert.rejects(f.ticketService.createTicket({ ...PAYLOAD, ...patch }, STAFF), (error) => error.kind === 'validation');
  }
  await assert.rejects(f.warrantyService.createDevice({ customer_id: 'CUS0001', product_name: 'Máy',
    serial_no: 'SN12345678', purchase_date: '2026-02-30' }), (error) => error.kind === 'validation');
  assert.equal(f.ticketRepository.allTickets().length, 0);
});

test('HTTP thật: route từ chối ngày và kiểu sai bằng 422 có fields, không cần CSDL', async (t) => {
  // Cấu hình riêng của tiến trình test, không dùng secret hay dữ liệu trên máy.
  Object.assign(process.env, { NODE_ENV: 'test', JWT_SECRET: 'test-only-intake-boundary-key',
    DEMO_STAFF_USERNAME: 'nhanvien', DEMO_STAFF_PASSWORD: 'test-only-password',
    DEMO_STAFF_NAME: 'Test', DEMO_STAFF_CENTER: '1' });
  const { createApp } = require('../src/app');
  const { signAccessToken } = require('../src/middlewares/auth.middleware');
  const app = createApp({ database: { getDatabaseState: () => 'disconnected' },
    logger: { info() {}, warn() {}, error() {} } });
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => { server.close(resolve); server.closeAllConnections(); }));
  const token = signAccessToken({ ...STAFF, fullName: 'Test' });
  for (const body of [{ ...PAYLOAD, issue_desc: {} },
    { ...PAYLOAD, received_at: '2026-02-30T09:00:00+07:00' }, []]) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/tickets`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(body)
    });
    assert.equal(response.status, 422);
    const result = await response.json();
    assert.equal(result.error, 'DU_LIEU_KHONG_HOP_LE');
    assert.ok(Object.keys(result.fields).some((key) => key !== 'maTraCuu'));
  }
});
