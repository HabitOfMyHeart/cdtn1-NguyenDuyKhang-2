const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const htm = require('htm');

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
  const clientSource = readText('src/api/client.js');
  const ticketSource = readText('src/api/ticket.api.js');

  assert.ok(!/\bfetch\s*\(/.test(appSource), 'app.js không được gọi fetch trực tiếp');
  assert.ok(!/axios/.test(appSource), 'app.js không được dùng axios');
  assert.equal((clientSource.match(/\bfetch\s*\(/g) || []).length, 1);
  for (const source of [apiSource, ticketSource]) {
    assert.ok(!/\bfetch\s*\(|axios/.test(source), 'các module phải dùng transport chung');
  }
  assert.ok(!apiSource.includes('/api/tickets'), 'endpoint phiếu phải nằm trong ticket.api.js');

  for (const method of [
    'listTickets',
    'getTicket',
    'createTicket',
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
  assert.ok(appSource.includes('Mã yêu cầu (requestId)'));
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

test('index.html tải React UMD, transport, ticket API, facade và app đúng thứ tự', () => {
  const htmlSource = readText('src/public/index.html');
  const serverSource = readText('src/app.js');

  const scripts = [...htmlSource.matchAll(/<script src="([^"]+)"><\/script>/g)]
    .map((match) => match[1]);
  assert.deepEqual(scripts, [
    '/vendor/react.production.min.js',
    '/vendor/react-dom.production.min.js',
    '/vendor/htm.umd.js',
    '/assets/api/client.js',
    '/assets/api/ticket.api.js',
    '/apiClient.js',
    '/app.js'
  ]);
  assert.ok(serverSource.includes("app.use('/assets/api', express.static(path.join(__dirname, 'api')))"));
  assert.ok(htmlSource.includes('id="root"'));
});

test('dataset mẫu nằm trong phạm vi phiếu đăng ký', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');

  assert.ok(sample.customers.length >= 30 && sample.customers.length <= 50);
  assert.ok(sample.tickets.length >= 50 && sample.tickets.length <= 100);
  assert.ok(sample.status_logs.length >= 100 && sample.status_logs.length <= 200);
});

test('dataset mẫu: khóa nghiệp vụ duy nhất và quan hệ đầy đủ', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');
  const customerIds = new Set(sample.customers.map((row) => row.customer_id));
  const deviceIds = new Set(sample.devices.map((row) => row.device_id));
  const centerIds = new Set(readJson('data/sample/service_centers.json').map((row) => row.center_id));
  const categoryIds = new Set(readJson('data/sample/issue_categories.json').map((row) => row.category_id));

  assert.equal(customerIds.size, sample.customers.length);
  assert.equal(deviceIds.size, sample.devices.length);
  assert.equal(new Set(sample.tickets.map((row) => row.ticket_id)).size, sample.tickets.length);
  assert.equal(new Set(sample.tickets.map((row) => row.ticket_code)).size, sample.tickets.length);
  assert.equal(new Set(sample.tickets.map((row) => row.device_id)).size, sample.tickets.length);
  assert.equal(new Set(sample.devices.map((row) => row.serial_no)).size, sample.devices.length);
  assert.equal(new Set(sample.customers.map((row) => row.phone)).size, sample.customers.length);

  for (const ticket of sample.tickets) {
    assert.ok(customerIds.has(ticket.customer_id), `Thiếu khách ${ticket.customer_id}`);
    assert.ok(deviceIds.has(ticket.device_id), `Thiếu thiết bị ${ticket.device_id}`);
    assert.ok(centerIds.has(ticket.center_id), `Thiếu trung tâm ${ticket.center_id}`);
    assert.ok(categoryIds.has(ticket.category_id), `Thiếu nhóm ${ticket.category_id}`);
  }
});

test('dataset mẫu: lịch sử giữ nguyên kết quả nguồn, ngày mua không tự bịa', () => {
  const sample = readJson('data/sample/l2_seed_sample.json');
  assert.ok(sample.devices.every((device) => device.purchase_date === null));
  assert.ok(sample.tickets.every((ticket) => !Number.isNaN(new Date(ticket.due_date).getTime())));
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

// Chạy component thật với hooks tối thiểu và cây htm, không cần DOM, server hay DB.
function createScreen(api, name = 'IntakeScreen', extraProps = {}) {
  const hooks = [];
  let cursor = 0;
  let effects = [];
  let tree;
  let props = {
    session: { user: { role: 'NHAN_VIEN', center_id: 'CTR0001' } },
    catalogs: {
      centers: [{ center_id: 'CTR0001', center_name: 'Trung tâm mẫu' }],
      categories: [{ category_id: 'CAT0001', category_name: 'MAN_HINH', default_priority: 'CAO' }]
    },
    onCreated() {}, onCancel() {}, onBack() {},
    ...extraProps
  };
  const sameDeps = (left, right) => left && right && left.length === right.length && left.every((value, index) => Object.is(value, right[index]));
  const React = {
    createElement: (type, attributes, ...children) => ({ type, props: attributes || {}, children }),
    useState(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = typeof initial === 'function' ? initial() : initial;
      return [hooks[index], (value) => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in hooks)) hooks[index] = { current: initial };
      return hooks[index];
    },
    useMemo(callback, deps) {
      const index = cursor++;
      if (!hooks[index] || !sameDeps(hooks[index].deps, deps)) hooks[index] = { deps, value: callback() };
      return hooks[index].value;
    },
    useCallback(callback, deps) { return React.useMemo(() => callback, deps); },
    useEffect(callback, deps) {
      const index = cursor++;
      if (!hooks[index] || !sameDeps(hooks[index].deps, deps)) {
        const previous = hooks[index];
        hooks[index] = { deps };
        effects.push(() => {
          if (previous && previous.cleanup) previous.cleanup();
          hooks[index].cleanup = callback();
        });
      }
    }
  };
  const window = { apiClient: api };
  const context = vm.createContext({ window, React, htm, setTimeout: () => 1, clearTimeout() {} });
  const source = readText('src/public/app.js').replace(
    "ReactDOM.createRoot(document.getElementById('root')).render(html`<${App} />`);",
    'window.screens = { IntakeScreen, TicketDetail, TicketList, App, toUiError, DataState };'
  );
  assert.ok(source.includes('window.screens ='), 'Test phải tải component thay vì khởi động DOM.');
  vm.runInContext(source, context, { filename: 'src/public/app.js' });
  function render(nextProps) {
    if (nextProps) props = { ...props, ...nextProps };
    cursor = 0;
    effects = [];
    tree = window.screens[name](props);
    for (const effect of effects) effect();
    return tree;
  }
  function nodes(value) {
    if (arguments.length === 0) value = tree;
    if (Array.isArray(value)) return value.flatMap((item) => nodes(item));
    if (!value || typeof value !== 'object' || !('type' in value)) return [];
    return [value, ...value.children.flatMap((item) => nodes(item))];
  }
  function text(value) {
    if (arguments.length === 0) value = tree;
    if (Array.isArray(value)) return value.map((item) => text(item)).join('');
    if (value && typeof value === 'object' && 'type' in value) return text(value.children);
    return value == null || value === false ? '' : String(value);
  }
  function button(label) {
    const found = nodes().find((node) => node.type === 'button' && text(node).trim() === label);
    assert.ok(found, `Không tìm thấy nút ${label}`);
    return found;
  }
  function input(placeholder) {
    const found = nodes().find((node) => node.type === 'input' && node.props.placeholder === placeholder);
    assert.ok(found, `Không tìm thấy input ${placeholder}`);
    return found;
  }
  function change(node, value) {
    node.props.onChange({ target: { value } });
    render();
  }
  render();
  return {
    render, nodes, text, button, input, change, screens: window.screens,
    unmount() { for (const hook of hooks) if (hook && hook.cleanup) hook.cleanup(); }
  };
}

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

const PHONE_INPUT = '0901234567 hoặc +84 90 123 4567';
const SERIAL_INPUT = 'Ví dụ: SN541017338391';
const CUSTOMER = { customer_id: 'CUS0001', full_name: 'Khách đã chọn', phone: '0901234567' };
const DEVICE = { device: { device_id: 'DEV0001', customer_id: 'CUS0001', product_name: 'Máy đã chọn', serial_no: 'SERIAL1' }, conBaoHanh: null };

test('danh sách rỗng hoặc lỗi không tự tuyên bố đạt SLA 100%', async () => {
  const empty = createScreen({ listTickets: async () => ({ data: [] }) }, 'TicketList');
  await new Promise(setImmediate);
  empty.render();
  assert.ok(empty.text().includes('Không có phiếu mở để tính tỷ lệ.'));
  assert.ok(!empty.text().includes('100% phiếu đang mở còn trong hạn.'));
  const error = createScreen({ listTickets: async () => { throw new Error('Network failed'); } }, 'TicketList');
  await new Promise(setImmediate);
  error.render();
  assert.ok(error.text().includes('Chưa có số liệu để tính tỷ lệ.'));
});

async function selectCustomer(screen) {
  screen.change(screen.input(PHONE_INPUT), CUSTOMER.phone);
  await screen.button('Tra cứu').props.onClick();
  screen.render();
}

async function selectDevice(screen) {
  screen.change(screen.input(SERIAL_INPUT), 'SERIAL1');
  await screen.button('Tra cứu thiết bị').props.onClick();
  screen.render();
}

test('QT-15: kết quả tra cứu hồ sơ che SĐT, không đổi số đã nhập trong ô tra cứu', async () => {
  const screen = createScreen({ lookupCustomer: async () => CUSTOMER });
  await selectCustomer(screen);
  const result = screen.nodes().find((node) => node.props.className === 'lookup-result');
  assert.ok(result);
  assert.ok(screen.text(result).includes('0901***567'));
  assert.ok(!screen.text(result).includes(CUSTOMER.phone));
  assert.equal(screen.input(PHONE_INPUT).props.value, CUSTOMER.phone);
});

function fillTicket(screen) {
  screen.change(screen.nodes().find((node) => node.type === 'select'), 'CAT0001');
  screen.change(screen.nodes().find((node) => node.type === 'textarea'), 'Màn hình không hiển thị khi mở máy.');
}

test('intake: sửa SĐT hủy khách/thiết bị, sửa serial hủy thiết bị và chặn lưu chưa xác định', async () => {
  let saved = 0;
  const screen = createScreen({
    lookupCustomer: async () => CUSTOMER,
    lookupDevice: async () => DEVICE,
    createTicket: async () => { saved += 1; }
  });
  await selectCustomer(screen);
  await selectDevice(screen);
  assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, false);
  screen.change(screen.input(SERIAL_INPUT), 'SERIAL2');
  assert.equal(screen.text().includes('Máy đã chọn'), false);
  assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, true);
  await screen.button('Lưu phiếu · trạng thái MOI').props.onClick();
  assert.equal(saved, 0);
  await selectDevice(screen);
  screen.change(screen.input(PHONE_INPUT), '0987654321');
  assert.equal(screen.text().includes('Khách đã chọn'), false);
  assert.equal(screen.text().includes('Máy đã chọn'), false);
  assert.equal(screen.input(SERIAL_INPUT).props.value, '');
  assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, true);
});

test('intake: bỏ qua cả thành công/lỗi của tra cứu khách cũ, không tắt loading của request mới', async () => {
  for (const failOld of [false, true]) {
    const old = deferred();
    const latest = deferred();
    let calls = 0;
    const screen = createScreen({ lookupCustomer: () => (++calls === 1 ? old.promise : latest.promise) });
    screen.change(screen.input(PHONE_INPUT), '0900000001');
    const first = screen.button('Tra cứu').props.onClick();
    screen.render();
    screen.change(screen.input(PHONE_INPUT), CUSTOMER.phone);
    const second = screen.button('Tra cứu').props.onClick();
    screen.render();
    if (failOld) old.reject({ status: 404, message: 'Không có hồ sơ cũ.' });
    else old.resolve({ ...CUSTOMER, full_name: 'Khách cũ' });
    await first;
    screen.render();
    assert.equal(screen.text().includes('Khách cũ'), false);
    assert.equal(screen.text().includes('Tạo hồ sơ khách hàng'), false);
    assert.equal(screen.button('Đang tra cứu...').props.disabled, true);
    latest.resolve(CUSTOMER);
    await second;
    screen.render();
    assert.ok(screen.text().includes('Khách đã chọn'));
  }
});

test('intake: đổi khách trong lúc tra cứu thiết bị bỏ qua kết quả cũ', async () => {
  const result = deferred();
  const screen = createScreen({ lookupCustomer: async () => CUSTOMER, lookupDevice: () => result.promise });
  await selectCustomer(screen);
  screen.change(screen.input(SERIAL_INPUT), 'SERIAL1');
  const pending = screen.button('Tra cứu thiết bị').props.onClick();
  screen.render();
  screen.change(screen.input(PHONE_INPUT), '0987654321');
  result.resolve(DEVICE);
  await pending;
  screen.render();
  assert.equal(screen.text().includes('Máy đã chọn'), false);
  assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, true);
});

test('intake: sửa serial bỏ qua thành công/lỗi cũ và chỉ chọn kết quả mới nhất', async () => {
  for (const failOld of [false, true]) {
    const old = deferred();
    const latest = deferred();
    let calls = 0;
    const screen = createScreen({ lookupCustomer: async () => CUSTOMER, lookupDevice: () => (++calls === 1 ? old.promise : latest.promise) });
    await selectCustomer(screen);
    screen.change(screen.input(SERIAL_INPUT), 'OLD');
    const first = screen.button('Tra cứu thiết bị').props.onClick();
    screen.render();
    screen.change(screen.input(SERIAL_INPUT), 'SERIAL1');
    const second = screen.button('Tra cứu thiết bị').props.onClick();
    screen.render();
    if (failOld) old.reject({ status: 404 });
    else old.resolve({ ...DEVICE, device: { ...DEVICE.device, product_name: 'Máy cũ' } });
    await first;
    screen.render();
    assert.equal(screen.text().includes('Máy cũ'), false);
    assert.equal(screen.text().includes('Tạo thiết bị'), false);
    assert.equal(screen.button('Đang tra cứu...').props.disabled, true);
    latest.resolve(DEVICE);
    await second;
    screen.render();
    assert.ok(screen.text().includes('Máy đã chọn'));
  }
});

test('intake: sửa hồ sơ đang tạo không nhận lại lựa chọn cũ khi request hoàn tất', async () => {
  const result = deferred();
  const screen = createScreen({
    lookupCustomer: async () => { throw { status: 404 }; },
    createCustomer: () => result.promise
  });
  screen.change(screen.input(PHONE_INPUT), CUSTOMER.phone);
  await screen.button('Tra cứu').props.onClick();
  screen.render();
  screen.change(screen.input('Nguyễn Văn A'), 'Tên trước');
  const pending = screen.button('Tạo hồ sơ khách hàng').props.onClick();
  screen.render();
  screen.change(screen.input('Nguyễn Văn A'), 'Tên sau');
  result.resolve(CUSTOMER);
  await pending;
  screen.render();
  assert.equal(screen.text().includes('Khách đã chọn'), false);
  assert.equal(screen.input('Nguyễn Văn A').props.value, 'Tên sau');
  assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, true);
});

test('intake: đổi khách khi đang tạo thiết bị không gắn thiết bị vừa tạo cho khách mới', async () => {
  const result = deferred();
  const screen = createScreen({
    lookupCustomer: async () => CUSTOMER,
    lookupDevice: async () => { throw { status: 404 }; },
    createDevice: () => result.promise
  });
  await selectCustomer(screen);
  screen.change(screen.input(SERIAL_INPUT), 'SERIAL1');
  await screen.button('Tra cứu thiết bị').props.onClick();
  screen.render();
  screen.change(screen.input('Samsung Galaxy A15'), 'Máy mới');
  const pending = screen.button('Tạo thiết bị').props.onClick();
  screen.render();
  screen.change(screen.input(PHONE_INPUT), '0987654321');
  result.resolve(DEVICE);
  await pending;
  screen.render();
  assert.equal(screen.text().includes('Máy đã chọn'), false);
  assert.equal(screen.text().includes('Tạo thiết bị'), false);
  assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, true);
});

test('intake: lookup thất bại không giữ lựa chọn khách hay thiết bị trước đó', async () => {
  for (const field of ['customer', 'device']) {
    let fail = false;
    const screen = createScreen({
      lookupCustomer: async () => { if (fail && field === 'customer') throw { status: 503, message: 'Không tải được khách.' }; return CUSTOMER; },
      lookupDevice: async () => { if (fail && field === 'device') throw { status: 503, message: 'Không tải được máy.' }; return DEVICE; }
    });
    await selectCustomer(screen);
    await selectDevice(screen);
    fail = true;
    await screen.button(field === 'customer' ? 'Tra cứu' : 'Tra cứu thiết bị').props.onClick();
    screen.render();
    assert.equal(screen.text().includes('Máy đã chọn'), false);
    if (field === 'customer') assert.equal(screen.text().includes('Khách đã chọn'), false);
    assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, true);
  }
});

test('intake: chặn lưu trong lúc lookup và chặn gửi lưu lặp, chỉ gửi payload tiếp nhận', async () => {
  const lookup = deferred();
  const save = deferred();
  const bodies = [];
  const created = [];
  let lookups = 0;
  const screen = createScreen({
    lookupCustomer: async () => CUSTOMER,
    lookupDevice: () => (++lookups === 1 ? Promise.resolve(DEVICE) : lookup.promise),
    createTicket: (body) => { bodies.push(body); return save.promise; }
  }, 'IntakeScreen', { onCreated: (id) => created.push(id) });
  await selectCustomer(screen);
  await selectDevice(screen);
  fillTicket(screen);
  const oldSaveHandler = screen.button('Lưu phiếu · trạng thái MOI').props.onClick;
  const pending = screen.button('Tra cứu thiết bị').props.onClick();
  // Kể cả handler từ render trước cũng không được lưu lựa chọn đang xác minh lại.
  await oldSaveHandler();
  assert.equal(bodies.length, 0);
  lookup.resolve(DEVICE);
  await pending;
  screen.render();
  const saveHandler = screen.button('Lưu phiếu · trạng thái MOI').props.onClick;
  const saving = saveHandler();
  await saveHandler();
  screen.render();
  assert.equal(bodies.length, 1);
  assert.equal(screen.button('Đang lưu...').props.disabled, true);
  assert.equal(screen.nodes().find((node) => node.type === 'fieldset').props.disabled, true);
  assert.equal(bodies[0].customer_id, CUSTOMER.customer_id);
  assert.equal(bodies[0].device_id, DEVICE.device.device_id);
  assert.equal(Object.hasOwn(bodies[0], 'status'), false);
  assert.equal(Object.hasOwn(bodies[0], 'to_status'), false);
  save.resolve({ ticket: { ticketId: 'TCK0001', trangThai: 'MOI' } });
  await saving;
  assert.deepEqual(created, ['TCK0001']);
});

test('intake: thiết bị khác chủ không được lưu', async () => {
  let saved = false;
  const screen = createScreen({
    lookupCustomer: async () => CUSTOMER,
    lookupDevice: async () => ({ ...DEVICE, device: { ...DEVICE.device, customer_id: 'CUS0002' } }),
    createTicket: async () => { saved = true; }
  });
  await selectCustomer(screen);
  await selectDevice(screen);
  fillTicket(screen);
  assert.equal(screen.button('Lưu phiếu · trạng thái MOI').props.disabled, true);
  await screen.button('Lưu phiếu · trạng thái MOI').props.onClick();
  assert.equal(saved, false);
});

test('intake: không lưu từ handler cũ sau khi đổi input, không điều hướng sau khi rời màn hình', async () => {
  const result = deferred();
  let saves = 0;
  let navigated = false;
  const screen = createScreen({
    lookupCustomer: async () => CUSTOMER, lookupDevice: async () => DEVICE,
    createTicket: () => { saves += 1; return result.promise; }
  }, 'IntakeScreen', { onCreated: () => { navigated = true; } });
  await selectCustomer(screen);
  await selectDevice(screen);
  fillTicket(screen);
  const oldSave = screen.button('Lưu phiếu · trạng thái MOI').props.onClick;
  screen.input(PHONE_INPUT).props.onChange({ target: { value: '0987654321' } });
  await oldSave();
  assert.equal(saves, 0);
  screen.render();
  await selectCustomer(screen);
  await selectDevice(screen);
  const pending = screen.button('Lưu phiếu · trạng thái MOI').props.onClick();
  screen.unmount();
  result.resolve({ ticket: { ticketId: 'TCK0001' } });
  await pending;
  assert.equal(saves, 1);
  assert.equal(navigated, false);
});

test('intake: lỗi lưu chưa rõ kết quả hiển thị requestId thật và hướng dẫn tra cứu trước khi tạo lại', async () => {
  const screen = createScreen({
    lookupCustomer: async () => CUSTOMER, lookupDevice: async () => DEVICE,
    createTicket: async () => { throw { status: 0, code: 'HET_THOI_GIAN_CHO', message: 'Quá thời gian chờ.', requestId: 'server-save-id' }; }
  });
  await selectCustomer(screen);
  await selectDevice(screen);
  fillTicket(screen);
  await screen.button('Lưu phiếu · trạng thái MOI').props.onClick();
  screen.render();
  assert.match(screen.text(), /tra cứu lại trước khi tạo lại/);
  const requestId = screen.nodes().find((node) => typeof node.type === 'function' && node.type.name === 'RequestId' && node.props.value);
  assert.equal(requestId.props.value, 'server-save-id');
  assert.equal(screen.screens.toUiError({ status: 0 }, 'Lỗi mạng').code, null);
  assert.equal(screen.screens.toUiError({ status: 503, requestId: 'server-id' }, 'Lỗi máy chủ').code, 'server-id');
});

test('chi tiết: giữ trạng thái/lịch sử cũ chỉ đọc dù máy chủ trả bước trạng thái kế tiếp', async () => {
  const loaded = deferred();
  const screen = createScreen({ getTicket: () => loaded.promise }, 'TicketDetail', { ticketId: 'TCK0001' });
  loaded.resolve({
    ticket: { ticketId: 'TCK0001', trangThai: 'DANG_XU_LY' },
    lichSuTrangThai: [{ logId: 'LOG1', fromStatus: 'MOI', toStatus: 'DANG_XU_LY', note: 'Lịch sử cũ' }],
    trangThaiKeTiep: ['HOAN_TAT']
  });
  await loaded.promise;
  await new Promise(setImmediate);
  screen.render();
  assert.ok(screen.text().includes('Lịch sử cũ'));
  assert.ok(screen.nodes().some((node) => node.props.status === 'DANG_XU_LY'));
  assert.equal(screen.nodes().filter((node) => node.type === 'button').length, 1);
  assert.equal(screen.nodes().some((node) => node.type === 'textarea'), false);
  assert.match(screen.text(), /chỉ để tra cứu/);
});

test('chi tiết: phản hồi phiếu cũ không ghi đè phiếu vừa chọn', async () => {
  const old = deferred();
  const latest = deferred();
  const screen = createScreen({ getTicket: (id) => id === 'TCK0001' ? old.promise : latest.promise }, 'TicketDetail', { ticketId: 'TCK0001' });
  screen.render({ ticketId: 'TCK0002' });
  latest.resolve({ ticket: { ticketId: 'TCK0002', ticketCode: 'Phiếu mới', trangThai: 'MOI' }, lichSuTrangThai: [] });
  await new Promise(setImmediate);
  screen.render();
  assert.ok(screen.text().includes('Phiếu mới'));
  old.resolve({ ticket: { ticketId: 'TCK0001', ticketCode: 'Phiếu cũ', trangThai: 'DA_DONG' }, lichSuTrangThai: [] });
  await new Promise(setImmediate);
  screen.render();
  assert.ok(screen.text().includes('Phiếu mới'));
  assert.equal(screen.text().includes('Phiếu cũ'), false);
});

test('intake: chỉ nhân viên tiếp nhận được dùng form và placeholder tìm kiếm đúng phạm vi backend', () => {
  const screen = createScreen({}, 'IntakeScreen', { session: { user: { role: 'QUAN_LY' } } });
  assert.equal(screen.nodes().some((node) => node.type === 'input'), false);
  assert.match(screen.text(), /Chỉ nhân viên tiếp nhận/);
  const source = readText('src/public/app.js');
  assert.ok(source.includes('placeholder="Mã phiếu hoặc SĐT khách hàng"'));
  for (const name of ['updateTicket', 'changeStatus', 'deleteTicket']) assert.ok(!source.includes(`api.${name}`));
});
