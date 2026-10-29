const test = require('node:test');
const assert = require('node:assert/strict');

const { buildFixture } = require('./helpers/inMemoryRepositories');
const { calculateDueDate } = require('../src/services/slaCalculator.service');
const {
  checkWarranty,
  normalizeSerial
} = require('../src/services/warrantyCheck.service');
const { normalizePhone } = require('../src/services/customer.service');
const { toVietnamIso } = require('../src/services/ticket.contract');

const CONTRACT_KEYS = [
  'ticketId',
  'ticketCode',
  'tenKhach',
  'sdtHienThi',
  'tenThietBi',
  'serialNo',
  'nhomSuCo',
  'mucUuTien',
  'trangThai',
  'conBaoHanh',
  'ketLuanBaoHanh',
  'hanCamKet',
  'ngayTiepNhan',
  'trungTam'
];

const STAFF = Object.freeze({ username: 'nhanvien', role: 'NHAN_VIEN', center_id: '1' });

/**
 * Tạo payload tiếp nhận hợp lệ, cho phép ghi đè từng trường.
 *
 * @param {object} fixture Bộ dữ liệu test.
 * @param {object} [overrides] Ghi đè.
 * @returns {object} Payload.
 */
function ticketPayload(fixture, overrides = {}) {
  return {
    customer_id: 'CUS0001',
    device_id: 'DEV0004',
    center_id: '1',
    category_id: '1',
    issue_desc: 'Màn hình bị sọc và không hiển thị khi mở máy.',
    accessories: ['SAC'],
    exterior_note: 'Trầy nhẹ góc phải.',
    received_at: fixture.FIXED_NOW.toISOString(),
    ...overrides
  };
}

test('happy path: tạo phiếu MOI, sinh mã, tính hạn 24h và ghi log khởi tạo', async () => {
  const fixture = buildFixture();
  const detail = await fixture.ticketService.createTicket(ticketPayload(fixture), STAFF);

  assert.deepEqual(Object.keys(detail.ticket).sort(), [...CONTRACT_KEYS].sort());
  assert.equal(detail.ticket.ticketId, 'TCK0001');
  assert.equal(detail.ticket.ticketCode, 'BH-000001/2026');
  assert.equal(detail.ticket.tenKhach, 'Nguyễn Văn An');
  assert.equal(detail.ticket.sdtHienThi, '0901***567');
  assert.equal(detail.ticket.tenThietBi, 'iPhone 13');
  assert.equal(detail.ticket.serialNo, 'SN000000000004');
  assert.equal(detail.ticket.nhomSuCo, 'MAN_HINH');
  assert.equal(detail.ticket.mucUuTien, 'CAO');
  assert.equal(detail.ticket.trangThai, 'MOI');
  assert.equal(detail.ticket.conBaoHanh, true);
  assert.equal(detail.ticket.ketLuanBaoHanh, 'Còn bảo hành');
  assert.equal(detail.ticket.hanCamKet, '2026-10-22T09:00:00+07:00');
  assert.equal(detail.ticket.ngayTiepNhan, '2026-10-21T09:00:00+07:00');
  assert.equal(detail.ticket.trungTam, 'Trung tâm Bảo hành Quận 1');

  assert.equal(detail.moTaLoi, 'Màn hình bị sọc và không hiển thị khi mở máy.');
  assert.deepEqual(detail.phuKien, ['SAC']);
  assert.equal(detail.ngoaiQuan, 'Trầy nhẹ góc phải.');
  assert.equal(detail.lyDoUuTien, '');
  assert.deepEqual(detail.trangThaiKeTiep, []);

  assert.equal(detail.lichSuTrangThai.length, 1);
  assert.equal(detail.lichSuTrangThai[0].fromStatus, null);
  assert.equal(detail.lichSuTrangThai[0].toStatus, 'MOI');
  assert.equal(detail.lichSuTrangThai[0].changedBy, 'nhanvien');
  assert.equal(detail.lichSuTrangThai[0].changedAt, '2026-10-21T09:00:00+07:00');

  const list = await fixture.ticketService.listTickets({}, STAFF);
  assert.equal(list.length, 1);
  assert.deepEqual(Object.keys(list[0]).sort(), [...CONTRACT_KEYS].sort());

  const found = await fixture.ticketService.getTicket('TCK0001', STAFF);
  assert.equal(found.ticket.ticketCode, 'BH-000001/2026');
});

test('danh sách lọc theo từ khóa SĐT, mã phiếu và phạm vi trung tâm', async () => {
  const fixture = buildFixture();
  await fixture.ticketService.createTicket(ticketPayload(fixture), STAFF);

  const byPhone = await fixture.ticketService.listTickets({ q: '0901234567' }, STAFF);
  assert.equal(byPhone.length, 1);

  const byCode = await fixture.ticketService.listTickets({ q: 'BH-000001' }, STAFF);
  assert.equal(byCode.length, 1);

  const otherCenter = await fixture.ticketService.listTickets(
    {},
    { username: 'nhanvien2', role: 'NHAN_VIEN', center_id: '2' }
  );
  assert.deepEqual(otherCenter, []);

  const overriddenCenter = await fixture.ticketService.listTickets(
    { center_id: '1' },
    { username: 'nhanvien2', role: 'NHAN_VIEN', center_id: '2' }
  );
  assert.deepEqual(overriddenCenter, []);
});

test('QT-04: CAO 24h, TRUNG_BINH 72h, THAP 120h và bỏ trọn Chủ Nhật', () => {
  const saturday = '2026-10-24T09:00:00+07:00';
  const sunday = '2026-10-25T09:00:00+07:00';
  const wednesday = '2026-10-21T09:00:00+07:00';

  assert.equal(toVietnamIso(calculateDueDate(saturday, 'CAO')), '2026-10-26T09:00:00+07:00');
  assert.equal(toVietnamIso(calculateDueDate(sunday, 'CAO')), '2026-10-27T09:00:00+07:00');
  assert.equal(toVietnamIso(calculateDueDate(wednesday, 'TRUNG_BINH')), '2026-10-24T09:00:00+07:00');
  assert.equal(toVietnamIso(calculateDueDate(wednesday, 'THAP')), '2026-10-27T09:00:00+07:00');
});

test('QT-04: previewDueDate trả đúng hạn và số giờ SLA', async () => {
  const fixture = buildFixture();
  const preview = await fixture.ticketService.previewDueDate({
    priority: 'CAO',
    received_at: '2026-10-24T09:00:00+07:00'
  });

  assert.equal(preview.sla_hours, 24);
  assert.equal(preview.due_date, '2026-10-26T09:00:00+07:00');
  assert.equal(preview.received_at, '2026-10-24T09:00:00+07:00');
});

test('QT-04: đổi ưu tiên phải có lý do và tính lại hạn cam kết', async () => {
  const fixture = buildFixture();

  await assert.rejects(
    () =>
      fixture.ticketService.createTicket(
        ticketPayload(fixture, { priority: 'THAP', priority_reason: '' }),
        STAFF
      ),
    (error) => {
      assert.equal(error.kind, 'validation');
      assert.equal(error.code, 'DU_LIEU_KHONG_HOP_LE');
      assert.ok(error.fields.priority_reason);
      return true;
    }
  );

  const detail = await fixture.ticketService.createTicket(
    ticketPayload(fixture, {
      priority: 'THAP',
      priority_reason: 'Khách đồng ý chờ thêm vì máy dự phòng đang dùng được.'
    }),
    STAFF
  );

  assert.equal(detail.ticket.mucUuTien, 'THAP');
  assert.equal(detail.ticket.hanCamKet, '2026-10-27T09:00:00+07:00');
  assert.equal(detail.lyDoUuTien, 'Khách đồng ý chờ thêm vì máy dự phòng đang dùng được.');
});

test('QT-05: đúng ngày hết hạn vẫn còn bảo hành, hôm sau thì hết', () => {
  const device = {
    purchase_date: new Date('2025-10-21T00:00:00+07:00'),
    warranty_months: 12
  };

  const lastDay = checkWarranty(device, '2026-10-21T23:59:59+07:00');
  assert.equal(lastDay.conBaoHanh, true);
  assert.equal(lastDay.ketLuanBaoHanh, 'Còn bảo hành');
  assert.equal(toVietnamIso(lastDay.ngayHetHan), '2026-10-21T00:00:00+07:00');

  const nextDay = checkWarranty(device, '2026-10-22T00:00:00+07:00');
  assert.equal(nextDay.conBaoHanh, false);
  assert.equal(nextDay.ketLuanBaoHanh, 'Hết bảo hành');
});

test('QT-05: thiếu ngày mua trả null (chưa xác minh), không phải false', async () => {
  const fixture = buildFixture();

  const empty = checkWarranty({ purchase_date: null, warranty_months: 12 }, fixture.FIXED_NOW);
  assert.equal(empty.conBaoHanh, null);
  assert.equal(empty.ketLuanBaoHanh, 'Chưa xác minh bảo hành');

  const detail = await fixture.ticketService.createTicket(
    ticketPayload(fixture, {
      customer_id: 'CUS0002',
      device_id: 'DEV0002',
      category_id: '2'
    }),
    STAFF
  );

  assert.equal(detail.ticket.conBaoHanh, null);
  assert.equal(detail.ticket.ketLuanBaoHanh, 'Chưa xác minh bảo hành');
});

test('QT-05: thiết bị đã hết bảo hành trả false và kết luận tương ứng', async () => {
  const fixture = buildFixture();
  const detail = await fixture.ticketService.createTicket(
    ticketPayload(fixture, { device_id: 'DEV0003' }),
    STAFF
  );

  assert.equal(detail.ticket.conBaoHanh, false);
  assert.equal(detail.ticket.ketLuanBaoHanh, 'Hết bảo hành');
});

test('dữ liệu sai tại ranh giới trả 422 kèm fields', async () => {
  const fixture = buildFixture();

  await assert.rejects(
    () => fixture.ticketService.createTicket(ticketPayload(fixture, { issue_desc: 'ngắn' }), STAFF),
    (error) => {
      assert.equal(error.kind, 'validation');
      assert.equal(error.code, 'DU_LIEU_KHONG_HOP_LE');
      assert.ok(error.fields.issue_desc);
      return true;
    }
  );

  await assert.rejects(
    () => fixture.ticketService.createTicket(ticketPayload(fixture, { priority: 'GAP' }), STAFF),
    (error) => {
      assert.equal(error.kind, 'validation');
      assert.ok(error.fields.priority);
      return true;
    }
  );

  await assert.rejects(
    () =>
      fixture.ticketService.createTicket(
        ticketPayload(fixture, { customer_id: 'CUS0002', device_id: 'DEV0004' }),
        STAFF
      ),
    (error) => {
      assert.equal(error.kind, 'validation');
      assert.ok(error.fields.device_id);
      return true;
    }
  );
});

test('QT-03: chặn mở phiếu thứ hai trên thiết bị đang có phiếu mở', async () => {
  const fixture = buildFixture({ withOpenTicket: true });

  await assert.rejects(
    () =>
      fixture.ticketService.createTicket(
        ticketPayload(fixture, { device_id: 'DEV0001' }),
        STAFF
      ),
    (error) => {
      assert.equal(error.kind, 'conflict');
      assert.equal(error.code, 'PHIEU_DANG_MO');
      assert.match(error.message, /BH-000009\/2026/);
      return true;
    }
  );
});

test('L2: phiếu mới không có lệnh chuyển sang xử lý sau tiếp nhận', async () => {
  const fixture = buildFixture();
  const created = await fixture.ticketService.createTicket(ticketPayload(fixture), STAFF);
  assert.equal(created.ticket.trangThai, 'MOI');
  assert.deepEqual(created.trangThaiKeTiep, []);
  assert.equal(fixture.ticketService.changeStatus, undefined);
});

test('QT-14: nhân viên không được xem phiếu ngoài trung tâm của mình', async () => {
  const fixture = buildFixture();
  const created = await fixture.ticketService.createTicket(ticketPayload(fixture), STAFF);

  await assert.rejects(
    () =>
      fixture.ticketService.getTicket(created.ticket.ticketId, {
        username: 'nhanvien2',
        role: 'NHAN_VIEN',
        center_id: '2'
      }),
    (error) => {
      assert.equal(error.kind, 'forbidden');
      assert.equal(error.code, 'KHONG_DU_QUYEN');
      return true;
    }
  );
});

test('không tìm thấy phiếu trả 404 KHONG_TIM_THAY', async () => {
  const fixture = buildFixture();

  await assert.rejects(
    () => fixture.ticketService.getTicket('TCK9999', STAFF),
    (error) => error.kind === 'not_found' && error.code === 'KHONG_TIM_THAY'
  );
});

test('QT-01/QT-02: chuẩn hóa SĐT và chặn trùng số điện thoại', async () => {
  const fixture = buildFixture();

  assert.equal(normalizePhone('0901.234.567'), '0901234567');
  assert.equal(normalizePhone('+84 90 123 4567'), '0901234567');
  assert.equal(normalizePhone('0084 90 123 4567'), '0901234567');
  assert.throws(
    () => normalizePhone('12345'),
    (error) => error.kind === 'validation' && error.code === 'DU_LIEU_KHONG_HOP_LE'
  );

  await assert.rejects(
    () =>
      fixture.customerService.createCustomer({
        full_name: 'Nguyễn Văn An',
        phone: '+84 90 123 4567'
      }),
    (error) => {
      assert.equal(error.kind, 'conflict');
      assert.equal(error.code, 'TRUNG_DU_LIEU');
      return true;
    }
  );

  const created = await fixture.customerService.createCustomer({
    full_name: 'Lê Văn Cường',
    phone: '+84 93 765 4321',
    segment: 'MOI'
  });
  assert.equal(created.phone, '0937654321');
  assert.equal(created.customer_id, 'CUS0003');
});

test('QT-03: chuẩn hóa serial và chặn trùng serial', async () => {
  const fixture = buildFixture();

  assert.equal(normalizeSerial(' sn000000000004 '), 'SN000000000004');
  assert.throws(
    () => normalizeSerial('abc'),
    (error) => error.kind === 'validation' && error.code === 'DU_LIEU_KHONG_HOP_LE'
  );

  await assert.rejects(
    () =>
      fixture.warrantyService.createDevice({
        customer_id: 'CUS0001',
        product_name: 'Thiết bị trùng serial',
        serial_no: 'sn000000000004',
        purchase_date: '2025-01-01',
        warranty_months: 12
      }),
    (error) => {
      assert.equal(error.kind, 'conflict');
      assert.equal(error.code, 'TRUNG_DU_LIEU');
      return true;
    }
  );
});

test('tạo thiết bị mới với ngày mua trống trả chưa xác minh QT-05', async () => {
  const fixture = buildFixture();
  const result = await fixture.warrantyService.createDevice({
    customer_id: 'CUS0001',
    product_name: 'Nokia 105',
    serial_no: 'sn 1234 5678',
    purchase_date: null,
    warranty_months: 6
  });

  assert.equal(result.device.serial_no, 'SN12345678');
  assert.equal(result.conBaoHanh, null);
  assert.equal(result.ketLuanBaoHanh, 'Chưa xác minh bảo hành');
});

test('chi tiết trả trường ngoài hợp đồng trong envelope, không nhét vào 14 khóa', async () => {
  const fixture = buildFixture();
  const detail = await fixture.ticketService.createTicket(ticketPayload(fixture), STAFF);

  assert.equal(Object.keys(detail.ticket).length, 14);
  assert.ok(!Object.prototype.hasOwnProperty.call(detail.ticket, 'moTaLoi'));
  assert.ok(!Object.prototype.hasOwnProperty.call(detail.ticket, 'phuKien'));
  assert.ok(!Object.prototype.hasOwnProperty.call(detail.ticket, 'ngoaiQuan'));
  assert.equal(detail.moTaLoi, 'Màn hình bị sọc và không hiển thị khi mở máy.');
  assert.deepEqual(detail.phuKien, ['SAC']);
  assert.equal(detail.ngoaiQuan, 'Trầy nhẹ góc phải.');
});
