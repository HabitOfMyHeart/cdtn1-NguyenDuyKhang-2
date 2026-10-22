const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { calculateDueDate } = require('../src/services/slaCalculator.service');
const { checkWarranty } = require('../src/services/warrantyCheck.service');
const { toTicketView, maskPhone } = require('../src/services/ticket.contract');

const ROOT = path.join(__dirname, '..');

/**
 * Đọc một tệp văn bản trong dự án.
 *
 * @param {string} relativePath Đường dẫn tương đối.
 * @returns {string} Nội dung.
 */
function readText(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

/**
 * Đọc một tệp JSON trong dự án.
 *
 * @param {string} relativePath Đường dẫn tương đối.
 * @returns {unknown} Dữ liệu JSON.
 */
function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

test('giao diện chỉ gọi API qua apiClient, không tự fetch/axios trong app.js', () => {
  const appSource = readText('src/public/app.js');
  const apiSource = readText('src/public/apiClient.js');

  assert.ok(!/\bfetch\s*\(/.test(appSource), 'app.js không được gọi fetch trực tiếp');
  assert.ok(!/axios/.test(appSource), 'app.js không được dùng axios');
  assert.equal((apiSource.match(/\bfetch\s*\(/g) || []).length, 1);

  for (const method of [
    'listTickets',
    'getTicket',
    'createTicket',
    'changeStatus',
    'deleteTicket',
    'lookupCustomer',
    'createCustomer',
    'lookupDevice',
    'createDevice',
    'previewDueDate'
  ]) {
    assert.ok(appSource.includes(`api.${method}`), `app.js phải dùng api.${method}`);
  }
});

test('giao diện có DataState loading/empty/error và phân biệt hai loại empty', () => {
  const appSource = readText('src/public/app.js');

  assert.ok(appSource.includes('function DataState'));
  assert.ok(appSource.includes('Đang tải danh sách phiếu bảo hành...'));
  assert.ok(appSource.includes('Chưa có phiếu bảo hành nào. Bấm Tiếp nhận phiếu mới để tạo phiếu đầu tiên.'));
  assert.ok(appSource.includes('Không có phiếu nào khớp bộ lọc hiện tại.'));
  assert.ok(appSource.includes('Chuyện gì'));
  assert.ok(appSource.includes('Vì sao'));
  assert.ok(appSource.includes('Làm gì tiếp'));
  assert.ok(appSource.includes('Mã tra cứu'));
  assert.ok(appSource.includes('Thử lại'));
  assert.ok(appSource.includes('Kiểm chứng trạng thái giao diện'));
  assert.ok(appSource.includes('Về dữ liệu thật'));
});

test('giao diện có đủ 3 màn hình và các trường chi tiết đúng nguồn dữ liệu', () => {
  const appSource = readText('src/public/app.js');

  assert.ok(appSource.includes('function TicketList'));
  assert.ok(appSource.includes('function IntakeScreen'));
  assert.ok(appSource.includes('function TicketDetail'));
  assert.ok(appSource.includes('detail.moTaLoi'));
  assert.ok(appSource.includes('detail.phuKien'));
  assert.ok(appSource.includes('detail.ngoaiQuan'));
  assert.ok(appSource.includes('detail.lyDoUuTien'));
  assert.ok(!appSource.includes('${detail.ticket ? ticket.tenKhach : \'\'}'));
  assert.ok(appSource.includes('sdtHienThi'));
  assert.ok(appSource.includes('hanCamKet'));
});

test('index.html tải React UMD, apiClient và app đúng thứ tự', () => {
  const htmlSource = readText('src/public/index.html');

  assert.ok(htmlSource.includes('/vendor/react.production.min.js'));
  assert.ok(htmlSource.includes('/vendor/react-dom.production.min.js'));
  assert.ok(htmlSource.includes('/vendor/htm.umd.js'));
  assert.ok(htmlSource.indexOf('/apiClient.js') < htmlSource.indexOf('/app.js'));
  assert.ok(htmlSource.includes('id="root"'));
});

test('dataset mẫu có đúng số lượng và đủ 6 trạng thái', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');

  assert.equal(sample.customers.length, 30);
  assert.equal(sample.devices.length, 30);
  assert.equal(sample.tickets.length, 30);
  assert.equal(sample.status_logs.length, 99);

  const statuses = new Set(sample.tickets.map((ticket) => ticket.status));
  assert.deepEqual(
    [...statuses].sort(),
    ['CHO_LINH_KIEN', 'DA_DONG', 'DA_PHAN_CONG', 'DANG_XU_LY', 'HOAN_TAT', 'MOI'].sort()
  );

  const warranty = { true: 0, false: 0, null: 0 };
  for (const ticket of sample.tickets) warranty[String(ticket.is_warranty)] += 1;
  assert.equal(warranty.true, 15);
  assert.equal(warranty.false, 9);
  assert.equal(warranty.null, 6);
});

test('dataset mẫu: khóa nghiệp vụ duy nhất và quan hệ đầy đủ', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');
  const customerIds = new Set(sample.customers.map((row) => row.customer_id));
  const deviceIds = new Set(sample.devices.map((row) => row.device_id));
  const centerIds = new Set(readJson('data/sample/service_centers.json').map((row) => row.center_id));
  const categoryIds = new Set(readJson('data/sample/issue_categories.json').map((row) => row.category_id));

  assert.equal(customerIds.size, 30);
  assert.equal(deviceIds.size, 30);
  assert.equal(new Set(sample.tickets.map((row) => row.ticket_id)).size, 30);
  assert.equal(new Set(sample.tickets.map((row) => row.ticket_code)).size, 30);
  assert.equal(new Set(sample.tickets.map((row) => row.device_id)).size, 30);
  assert.equal(new Set(sample.devices.map((row) => row.serial_no)).size, 30);
  assert.equal(new Set(sample.customers.map((row) => row.phone)).size, 30);

  for (const ticket of sample.tickets) {
    assert.ok(customerIds.has(ticket.customer_id), `Thiếu khách ${ticket.customer_id}`);
    assert.ok(deviceIds.has(ticket.device_id), `Thiếu thiết bị ${ticket.device_id}`);
    assert.ok(centerIds.has(ticket.center_id), `Thiếu trung tâm ${ticket.center_id}`);
    assert.ok(categoryIds.has(ticket.category_id), `Thiếu nhóm ${ticket.category_id}`);
  }
});

test('dataset mẫu: due_date và is_warranty khớp quy tắc QT-04/QT-05', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');
  const deviceById = new Map(sample.devices.map((device) => [device.device_id, device]));

  for (const ticket of sample.tickets) {
    const calculated = calculateDueDate(ticket.received_at, ticket.priority);
    assert.equal(
      new Date(ticket.due_date).getTime(),
      calculated.getTime(),
      `${ticket.ticket_id} có due_date lệch QT-04`
    );

    const warranty = checkWarranty(deviceById.get(ticket.device_id), ticket.received_at);
    assert.equal(
      warranty.conBaoHanh,
      ticket.is_warranty,
      `${ticket.ticket_id} có is_warranty lệch QT-05`
    );
  }
});

test('dataset mẫu: mỗi phiếu có log khởi tạo null → MOI, phiếu MOI chỉ có log khởi tạo', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');
  const logsByTicket = new Map();
  for (const log of sample.status_logs) {
    if (!logsByTicket.has(log.ticket_id)) logsByTicket.set(log.ticket_id, []);
    logsByTicket.get(log.ticket_id).push(log);
  }

  for (const ticket of sample.tickets) {
    const logs = logsByTicket.get(ticket.ticket_id) || [];
    assert.ok(logs.length > 0, `${ticket.ticket_id} thiếu log`);
    assert.ok(
      logs.some((log) => log.from_status === null && log.to_status === 'MOI'),
      `${ticket.ticket_id} thiếu log khởi tạo`
    );
    if (ticket.status === 'MOI') {
      assert.equal(logs.length, 1, `${ticket.ticket_id} MOI phải chỉ có 1 log`);
    }
  }
});

test('dataset mẫu: toTicketView giữ đúng hợp đồng 14 khóa và che SĐT', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');
  const customerById = new Map(sample.customers.map((row) => [row.customer_id, row]));
  const deviceById = new Map(sample.devices.map((row) => [row.device_id, row]));
  const centerById = new Map(readJson('data/sample/service_centers.json').map((row) => [row.center_id, row]));
  const categoryById = new Map(readJson('data/sample/issue_categories.json').map((row) => [row.category_id, row]));
  const ticket = sample.tickets[0];

  const view = toTicketView({
    ...ticket,
    customer: customerById.get(ticket.customer_id),
    device: deviceById.get(ticket.device_id),
    category: categoryById.get(ticket.category_id),
    center: centerById.get(ticket.center_id)
  });

  assert.equal(Object.keys(view).length, 14);
  assert.equal(view.sdtHienThi, maskPhone(customerById.get(ticket.customer_id).phone));
  assert.match(view.hanCamKet, /\+07:00$/);
  assert.equal(view.conBaoHanh, ticket.is_warranty);
});

test('danh mục mẫu có đúng 6 trung tâm và 6 nhóm sự cố', () => {
  const centers = readJson('data/sample/service_centers.json');
  const categories = readJson('data/sample/issue_categories.json');
  const products = readJson('data/sample/products.json');

  assert.equal(centers.length, 6);
  assert.equal(categories.length, 6);
  assert.ok(products.length >= 300);
});
