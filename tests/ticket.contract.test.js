const test = require('node:test');
const assert = require('node:assert/strict');

const {
  maskPhone,
  toVietnamIso,
  warrantyConclusion,
  toTicketView,
  toTicketViewList,
  toStatusLogView
} = require('../src/services/ticket.contract');

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

/**
 * Tạo một phiếu giả đã gắn đủ quan hệ để kiểm tra hợp đồng.
 *
 * @param {object} [overrides] Ghi đè một phần dữ liệu.
 * @returns {object} Phiếu giả.
 */
function makeTicket(overrides = {}) {
  return {
    ticket_id: 'TCK0001',
    ticket_code: 'BH-000001/2026',
    priority: 'CAO',
    status: 'MOI',
    is_warranty: true,
    due_date: new Date('2026-10-22T02:00:00.000Z'),
    received_at: new Date('2026-10-21T02:00:00.000Z'),
    customer: { full_name: 'Nguyễn Văn An', phone: '0901234567' },
    device: { product_name: 'Samsung Galaxy A15', serial_no: 'SN541017338391' },
    category: { category_name: 'MAN_HINH' },
    center: { center_name: 'Trung tâm Bảo hành Quận 1' },
    ...overrides
  };
}

test('maskPhone che đúng 3 chữ số giữa theo QT-15', () => {
  assert.equal(maskPhone('0901234567'), '0901***567');
  assert.equal(maskPhone('0901 234 567'), '0901***567');
  assert.equal(maskPhone('+84 90 123 4567'), '+84 90 123 4567');
  assert.equal(maskPhone(null), '');
});

test('toVietnamIso trả ISO 8601 kèm +07:00', () => {
  assert.equal(toVietnamIso('2026-10-21T09:00:00+07:00'), '2026-10-21T09:00:00+07:00');
  assert.equal(toVietnamIso(new Date('2026-10-21T02:00:00.000Z')), '2026-10-21T09:00:00+07:00');
  assert.equal(toVietnamIso(null), null);
  assert.equal(toVietnamIso('khong-phai-ngay'), null);
});

test('warrantyConclusion phân biệt rõ null với false theo QT-05', () => {
  assert.equal(warrantyConclusion(true), 'Còn bảo hành');
  assert.equal(warrantyConclusion(false), 'Hết bảo hành');
  assert.equal(warrantyConclusion(null), 'Chưa xác minh bảo hành');
});

test('toTicketView trả đúng 14 khóa hợp đồng, không thêm khóa lịch sử', () => {
  const view = toTicketView(makeTicket());

  assert.deepEqual(Object.keys(view).sort(), [...CONTRACT_KEYS].sort());
  assert.equal(Object.keys(view).length, 14);
  assert.equal(view.ticketId, 'TCK0001');
  assert.equal(view.ticketCode, 'BH-000001/2026');
  assert.equal(view.tenKhach, 'Nguyễn Văn An');
  assert.equal(view.sdtHienThi, '0901***567');
  assert.equal(view.tenThietBi, 'Samsung Galaxy A15');
  assert.equal(view.serialNo, 'SN541017338391');
  assert.equal(view.nhomSuCo, 'MAN_HINH');
  assert.equal(view.mucUuTien, 'CAO');
  assert.equal(view.trangThai, 'MOI');
  assert.equal(view.conBaoHanh, true);
  assert.equal(view.ketLuanBaoHanh, 'Còn bảo hành');
  assert.equal(view.hanCamKet, '2026-10-22T09:00:00+07:00');
  assert.equal(view.ngayTiepNhan, '2026-10-21T09:00:00+07:00');
  assert.equal(view.trungTam, 'Trung tâm Bảo hành Quận 1');
});

test('toTicketView giữ conBaoHanh = null khi chưa xác minh QT-05', () => {
  const view = toTicketView(makeTicket({ is_warranty: null }));

  assert.equal(view.conBaoHanh, null);
  assert.equal(view.ketLuanBaoHanh, 'Chưa xác minh bảo hành');
  assert.notEqual(view.conBaoHanh, false);
});

test('toTicketView ném 404 KHONG_TIM_THAY khi thiếu phiếu', () => {
  assert.throws(
    () => toTicketView(null),
    (error) => error.statusCode === 404 && error.code === 'KHONG_TIM_THAY'
  );
});

test('toTicketViewList trả [] cho danh sách rỗng và map đủ phần tử', () => {
  assert.deepEqual(toTicketViewList([]), []);
  assert.deepEqual(toTicketViewList(null), []);
  assert.equal(toTicketViewList([makeTicket(), makeTicket({ ticket_id: 'TCK0002' })]).length, 2);
});

test('toStatusLogView chỉ trả trường an toàn cho giao diện', () => {
  const view = toStatusLogView({
    log_id: 'LOG000001',
    from_status: null,
    to_status: 'MOI',
    changed_at: new Date('2026-10-21T02:00:00.000Z'),
    changed_by: 'nhanvien',
    note: 'Tạo phiếu.'
  });

  assert.deepEqual(Object.keys(view).sort(), [
    'changedAt',
    'changedBy',
    'fromStatus',
    'logId',
    'note',
    'toStatus'
  ]);
  assert.equal(view.changedAt, '2026-10-21T09:00:00+07:00');
  assert.equal(view.fromStatus, null);
});
