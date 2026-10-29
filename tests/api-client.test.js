const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SCRIPTS = [
  'src/api/client.js',
  'src/api/ticket.api.js',
  'src/public/apiClient.js'
].map((filename) => ({
  filename,
  source: fs.readFileSync(path.join(__dirname, '..', filename), 'utf8')
}));

/** Tải các script như trình duyệt, chỉ dùng fetch giả và localStorage trong RAM. */
function createBrowser(...responses) {
  const requests = [];
  const events = [];
  const signals = [];
  const storage = new Map();
  const window = {
    URLSearchParams,
    AbortController,
    setTimeout,
    clearTimeout,
    CustomEvent: class CustomEvent {
      constructor(type) {
        this.type = type;
      }
    },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, String(value)),
      removeItem: (key) => storage.delete(key)
    },
    dispatchEvent(event) {
      // Ghi lại storage ngay khi phát sự kiện để kiểm tra thứ tự xóa phiên.
      events.push({ type: event.type, storage: Object.fromEntries(storage) });
      return true;
    },
    async fetch(url, options) {
      signals.push(options.signal);
      requests.push({
        url,
        method: options.method,
        headers: { ...options.headers },
        body: options.body
      });
      assert.ok(responses.length, `Không dự kiến request ${options.method} ${url}`);
      const response = responses.shift();
      if (response instanceof Error) throw response;
      return typeof response === 'function' ? response(options) : response;
    }
  };
  window.window = window;
  const context = vm.createContext(window);
  for (const { filename, source } of SCRIPTS) {
    vm.runInContext(source, context, { filename });
  }
  return { api: window.apiClient, window, requests, events, storage, signals };
}

test('login gửi JSON không Bearer, lưu phiên mới và dùng token đó cho request tiếp theo', async () => {
  const session = { token: 'new-token', user: { username: 'nhanvien', role: 'NHAN_VIEN' } };
  const { api, requests, storage, events } = createBrowser(
    Response.json({ data: session }),
    Response.json({ data: session.user })
  );
  api.setSession('old-token', { username: 'old-user' });

  assert.deepEqual(await api.login('nhanvien', 'test-password'), session);
  assert.deepEqual(requests[0], {
    url: '/api/auth/login',
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'nhanvien', password: 'test-password' })
  });
  assert.equal(storage.get('mekong_crm_token'), session.token);
  assert.deepEqual(JSON.parse(storage.get('mekong_crm_user')), session.user);
  assert.deepEqual(structuredClone(api.getSession()), session);

  assert.deepEqual(await api.me(), session.user);
  assert.deepEqual(requests[1], {
    url: '/api/auth/me',
    method: 'GET',
    headers: { Accept: 'application/json', Authorization: 'Bearer new-token' },
    body: undefined
  });
  assert.equal(requests.length, 2);
  assert.deepEqual(events, []);
});

test('401 của API bảo vệ xóa token và user trước auth:unauthorized, request sau không dùng token cũ', async () => {
  const { api, requests, storage, events } = createBrowser(
    Response.json({ error: 'CHUA_DANG_NHAP', message: 'Phiên đăng nhập hết hạn.' }, { status: 401 }),
    Response.json({ data: [], total: 0 })
  );
  storage.set('mekong_crm_token', 'expired-token');
  storage.set('mekong_crm_user', JSON.stringify({ username: 'nhanvien' }));
  storage.set('theme', 'dark');

  await assert.rejects(api.getTicket('TCK0001'), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.name, 'ApiError');
    assert.equal(error.code, 'CHUA_DANG_NHAP');
    assert.equal(error.message, 'Phiên đăng nhập hết hạn.');
    assert.equal(error.status, 401);
    return true;
  });

  assert.equal(requests[0].headers.Authorization, 'Bearer expired-token');
  assert.equal(storage.has('mekong_crm_token'), false);
  assert.equal(storage.has('mekong_crm_user'), false);
  assert.equal(api.getSession(), null);
  assert.deepEqual(events, [{ type: 'auth:unauthorized', storage: { theme: 'dark' } }]);

  await api.listTickets();
  assert.equal(requests.length, 2);
  assert.equal(Object.hasOwn(requests[1].headers, 'Authorization'), false);
});

test('401 vẫn xóa phiên và phát sự kiện khi body JSON bị hỏng', async () => {
  const { api, storage, events } = createBrowser(new Response('{broken', {
    status: 401,
    headers: { 'Content-Type': 'application/json' }
  }));
  api.setSession('expired-token', { username: 'nhanvien' });

  await assert.rejects(api.me(), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, 'LOI_HE_THONG');
    return true;
  });
  assert.equal(storage.size, 0);
  assert.deepEqual(events, [{ type: 'auth:unauthorized', storage: {} }]);
});

test('login 401 với auth:false giữ phiên hiện tại và không phát auth:unauthorized', async () => {
  const session = { token: 'existing-token', user: { username: 'nhanvien' } };
  const { api, requests, storage, events } = createBrowser(Response.json({
    error: 'SAI_THONG_TIN_DANG_NHAP',
    message: 'Sai tên đăng nhập hoặc mật khẩu.'
  }, { status: 401 }));
  api.setSession(session.token, session.user);

  await assert.rejects(api.login('nhanvien', 'wrong-password'), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 401);
    assert.equal(error.code, 'SAI_THONG_TIN_DANG_NHAP');
    assert.equal(error.message, 'Sai tên đăng nhập hoặc mật khẩu.');
    return true;
  });
  assert.equal(Object.hasOwn(requests[0].headers, 'Authorization'), false);
  assert.deepEqual(structuredClone(api.getSession()), session);
  assert.equal(storage.get('mekong_crm_token'), session.token);
  assert.deepEqual(JSON.parse(storage.get('mekong_crm_user')), session.user);
  assert.deepEqual(events, []);
});

test('401 của request cũ không xóa phiên vừa đăng nhập lại', async () => {
  const { api, events } = createBrowser(Response.json({ error: 'CHUA_DANG_NHAP' }, { status: 401 }));
  api.setSession('old-token', { username: 'old-user' });
  const pending = api.me();
  api.setSession('new-token', { username: 'new-user' });

  await assert.rejects(pending, (error) => error.status === 401);
  assert.equal(api.getSession().token, 'new-token');
  assert.equal(api.getSession().user.username, 'new-user');
  assert.deepEqual(events, []);
});

for (const contentType of ['application/json', 'text/html']) {
  test(`HTTP 200 với ${contentType} sai định dạng báo lỗi thay vì giả thành danh sách rỗng`, async () => {
    const { api } = createBrowser(new Response('<html>Gateway error</html>', {
      status: 200,
      headers: { 'Content-Type': contentType }
    }));
    await assert.rejects(api.listTickets(), (error) => {
      assert.ok(error instanceof api.ApiError);
      assert.equal(error.code, 'PHAN_HOI_KHONG_HOP_LE');
      return true;
    });
  });
}

test('lỗi mạng trở thành ApiError MAT_KET_NOI status 0 và không đăng xuất', async () => {
  const { api, events } = createBrowser(new TypeError('Failed to fetch'));
  const session = { token: 'existing-token', user: { username: 'nhanvien' } };
  api.setSession(session.token, session.user);

  await assert.rejects(api.listTickets(), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.name, 'ApiError');
    assert.equal(error.code, 'MAT_KET_NOI');
    assert.equal(error.status, 0);
    assert.equal(error.message, 'Mất kết nối tới máy chủ hệ thống.');
    assert.deepEqual(structuredClone(error.fields), { cause: 'Failed to fetch' });
    return true;
  });
  assert.deepEqual(structuredClone(api.getSession()), session);
  assert.deepEqual(events, []);
});

test('HTTP 422 giữ nguyên code, message và fields cho giao diện hiển thị lỗi nhập liệu', async () => {
  const payload = {
    error: 'DU_LIEU_KHONG_HOP_LE',
    message: 'Vui lòng kiểm tra các trường được đánh dấu.',
    fields: { priority_reason: 'Phải nhập lý do đổi mức ưu tiên.' }
  };
  const { api, events } = createBrowser(Response.json(payload, { status: 422 }));
  const session = { token: 'existing-token', user: { username: 'nhanvien' } };
  api.setSession(session.token, session.user);

  await assert.rejects(api.createTicket({ priority: 'CAO' }), (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.status, 422);
    assert.equal(error.code, payload.error);
    assert.equal(error.message, payload.message);
    assert.deepEqual(error.fields, payload.fields);
    return true;
  });
  assert.deepEqual(structuredClone(api.getSession()), session);
  assert.deepEqual(events, []);
});

for (const scenario of [
  {
    name: 'HTTP 403 dạng text',
    status: 403,
    body: 'Không có quyền truy cập.',
    contentType: 'text/plain',
    message: 'Không có quyền truy cập.'
  },
  {
    name: 'HTTP 503 với JSON bị hỏng',
    status: 503,
    body: '{broken',
    contentType: 'application/json',
    message: 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'
  }
]) {
  test(`${scenario.name} vẫn trả ApiError có thông báo và không xóa phiên`, async () => {
    const { api, events } = createBrowser(new Response(scenario.body, {
      status: scenario.status,
      headers: { 'Content-Type': scenario.contentType }
    }));
    const session = { token: 'existing-token', user: { username: 'nhanvien' } };
    api.setSession(session.token, session.user);

    await assert.rejects(api.listTickets(), (error) => {
      assert.ok(error instanceof api.ApiError);
      assert.equal(error.status, scenario.status);
      assert.equal(error.code, 'LOI_HE_THONG');
      assert.equal(error.message, scenario.message);
      assert.deepEqual(structuredClone(error.fields), {});
      return true;
    });
    assert.deepEqual(structuredClone(api.getSession()), session);
    assert.deepEqual(events, []);
  });
}

test('request chấp nhận response 204 không có body', async () => {
  const { api } = createBrowser(new Response(null, { status: 204 }));
  assert.deepEqual(structuredClone(await api.request('/api/no-content')), {});
});

test('API_BASE_URL hỗ trợ prefix có dấu / cuối, health không gửi Bearer', async () => {
  const payload = { status: 'ok', database: { connected: false } };
  const { api, window, requests } = createBrowser(Response.json(payload));
  window.API_BASE_URL = 'https://crm.example.test/gateway/';
  api.setSession('existing-token', { username: 'nhanvien' });

  assert.deepEqual(await api.health(), payload);
  assert.deepEqual(requests, [{
    url: 'https://crm.example.test/gateway/health',
    method: 'GET',
    headers: { Accept: 'application/json' },
    body: undefined
  }]);
});

test('listTickets encode bộ lọc, bỏ giá trị rỗng và giữ envelope data/total', async () => {
  const payload = { data: [{ ticketId: 'TCK0001' }], total: 7 };
  const empty = { data: [], total: 0 };
  const { api, requests } = createBrowser(Response.json(payload), Response.json(empty));
  api.setSession('ticket-token', { username: 'nhanvien' });

  assert.deepEqual(await api.listTickets({
    status: 'MOI',
    q: 'Nguyễn + /? &status=DA_DONG',
    category_id: '',
    priority: '  ',
    center_id: null,
    page: undefined
  }), payload);
  const url = new URL(requests[0].url, 'https://crm.example.test');
  assert.equal(url.pathname, '/api/tickets');
  assert.deepEqual([...url.searchParams], [
    ['status', 'MOI'],
    ['q', 'Nguyễn + /? &status=DA_DONG']
  ]);
  assert.equal(requests[0].method, 'GET');
  assert.deepEqual(requests[0].headers, {
    Accept: 'application/json',
    Authorization: 'Bearer ticket-token'
  });
  assert.equal(requests[0].body, undefined);

  assert.deepEqual(await api.listTickets(), empty);
  assert.equal(requests[1].url, '/api/tickets');
  assert.equal(requests.length, 2);
});

const TICKET_ID = 'TCK/ 0001?#';
const TICKET_URL = '/api/tickets/TCK%2F%200001%3F%23';
const DETAIL = { ticket: { ticketId: TICKET_ID }, lichSuTrangThai: [], trangThaiKeTiep: [] };
const CREATE_BODY = { customer_id: 'CUS0001', device_id: 'DEV0001', issue_desc: 'Màn hình sọc.' };
const RECEIVED_AT = '2026-10-24T09:00:00+07:00';

for (const scenario of [
  { method: 'getTicket', args: [TICKET_ID], url: TICKET_URL, verb: 'GET', data: DETAIL },
  {
    method: 'createTicket', args: [CREATE_BODY], url: '/api/tickets', verb: 'POST',
    body: CREATE_BODY, data: DETAIL, status: 201
  },
  {
    method: 'previewDueDate', args: ['CAO', RECEIVED_AT], url: '/api/tickets/preview', verb: 'POST',
    body: { priority: 'CAO', received_at: RECEIVED_AT },
    data: { priority: 'CAO', received_at: RECEIVED_AT, due_date: '2026-10-26T09:00:00+07:00', sla_hours: 24 }
  }
]) {
  test(`${scenario.name || scenario.method}: đúng URL, verb, JSON/Bearer và trả payload.data`, async () => {
    const { api, requests } = createBrowser(Response.json(
      { data: scenario.data },
      { status: scenario.status || 200 }
    ));
    api.setSession('ticket-token', { username: 'nhanvien' });

    assert.deepEqual(await api[scenario.method](...scenario.args), scenario.data);
    assert.equal(requests.length, 1);
    const [request] = requests;
    assert.equal(request.url, scenario.url);
    assert.equal(request.method, scenario.verb);
    assert.deepEqual(request.headers, {
      Accept: 'application/json',
      Authorization: 'Bearer ticket-token',
      ...(scenario.body !== undefined ? { 'Content-Type': 'application/json' } : {})
    });
    if (scenario.body === undefined) {
      assert.equal(request.body, undefined);
    } else {
      assert.deepEqual(JSON.parse(request.body), scenario.body);
    }
  });
}

test('frontend không cung cấp lệnh cập nhật, chuyển trạng thái hay xóa phiếu sau tiếp nhận', () => {
  const { api, window } = createBrowser();
  for (const name of ['updateTicket', 'changeStatus', 'deleteTicket']) {
    assert.equal(Object.hasOwn(api, name), false);
    assert.equal(Object.hasOwn(window.ticketApi, name), false);
  }
});

function controlTimeout(window) {
  let fire;
  let delay;
  let cleared = false;
  window.setTimeout = (callback, milliseconds) => {
    fire = callback;
    delay = milliseconds;
    return 123;
  };
  window.clearTimeout = (id) => {
    assert.equal(id, 123);
    cleared = true;
  };
  return { fire: () => fire(), delay: () => delay, cleared: () => cleared };
}

test('timeout hủy fetch, giữ phiên và không tự gửi lại thao tác tạo phiếu', async () => {
  const { api, window, signals, requests, events } = createBrowser(({ signal }) => new Promise((resolve, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
  }));
  const timeout = controlTimeout(window);
  api.setSession('current-token', { role: 'NHAN_VIEN' });
  const pending = api.createTicket(CREATE_BODY);
  assert.equal(timeout.delay(), 15000);
  timeout.fire();
  await assert.rejects(pending, (error) => {
    assert.ok(error instanceof api.ApiError);
    assert.equal(error.code, 'HET_THOI_GIAN_CHO');
    assert.equal(error.status, 0);
    assert.equal(error.requestId, null);
    assert.match(error.message, /tra cứu lại/);
    return true;
  });
  assert.equal(signals[0].aborted, true);
  assert.equal(requests.length, 1);
  assert.equal(api.getSession().token, 'current-token');
  assert.deepEqual(events, []);
  assert.equal(timeout.cleared(), true);
});

for (const contentType of ['application/json', 'text/plain']) {
  test(`timeout vẫn hoạt động khi đang đọc body ${contentType}`, async () => {
    let started;
    const reading = new Promise((resolve) => { started = resolve; });
    const consume = () => { started(); return new Promise(() => {}); };
    const { api, window, signals, requests } = createBrowser({
      status: 200,
      ok: true,
      headers: new Headers({ 'content-type': contentType, 'x-request-id': 'server-body-id' }),
      json: consume,
      text: consume
    });
    const timeout = controlTimeout(window);
    const pending = api.request('/api/test', { timeoutMs: 25 });
    await reading;
    assert.equal(timeout.delay(), 25);
    timeout.fire();
    await assert.rejects(pending, (error) => {
      assert.equal(error.code, 'HET_THOI_GIAN_CHO');
      assert.equal(error.requestId, 'server-body-id');
      return true;
    });
    assert.equal(signals[0].aborted, true);
    assert.equal(requests.length, 1);
    assert.equal(timeout.cleared(), true);
  });
}

test('timeout được dọn sau khi đọc body thành công hoặc lỗi HTTP', async () => {
  for (const status of [200, 503]) {
    const { api, window, signals } = createBrowser(Response.json({ data: [] }, { status }));
    const timeout = controlTimeout(window);
    if (status === 200) await api.listTickets();
    else await assert.rejects(api.listTickets(), (error) => error.status === status);
    assert.equal(timeout.cleared(), true);
    assert.equal(signals[0].aborted, false);
  }
});

test('phản hồi 401 tới sau timeout không đăng xuất phiên hiện tại', async () => {
  let respond;
  const { api, window, events } = createBrowser(() => new Promise((resolve) => { respond = resolve; }));
  const timeout = controlTimeout(window);
  api.setSession('old-token', { role: 'NHAN_VIEN' });
  const pending = api.me();
  timeout.fire();
  await assert.rejects(pending, (error) => error.code === 'HET_THOI_GIAN_CHO');
  api.setSession('new-token', { role: 'NHAN_VIEN' });
  respond(Response.json({ error: 'CHUA_DANG_NHAP' }, { status: 401 }));
  await new Promise(setImmediate);
  assert.equal(api.getSession().token, 'new-token');
  assert.deepEqual(events, []);
});

test('requestId từ JSON hoặc header được giữ riêng với mã lỗi và fields', async () => {
  for (const payloadId of [undefined, 'server-json-id']) {
    const { api } = createBrowser(Response.json({
      error: 'LOI_HE_THONG', message: 'Lỗi máy chủ.', fields: { phone: 'Sai số.' }, requestId: payloadId
    }, { status: 503, headers: { 'x-request-id': 'server-header-id' } }));
    await assert.rejects(api.listTickets(), (error) => {
      assert.equal(error.requestId, payloadId || 'server-header-id');
      assert.equal(error.code, 'LOI_HE_THONG');
      assert.deepEqual(error.fields, { phone: 'Sai số.' });
      return true;
    });
  }
});

test('JSON hỏng vẫn giữ requestId từ máy chủ, lỗi mạng không tự sinh mã tra cứu', async () => {
  const { api } = createBrowser(new Response('{broken', {
    headers: { 'content-type': 'application/json', 'x-request-id': 'server-invalid-id' }
  }), new TypeError('Offline'));
  await assert.rejects(api.listTickets(), (error) => error.requestId === 'server-invalid-id');
  await assert.rejects(api.listTickets(), (error) => error.requestId === null);
});

test('lookup khách trả danh sách rỗng là chưa có hồ sơ, không phải chọn thành công', async () => {
  const { api } = createBrowser(Response.json({ data: [] }));
  await assert.rejects(api.lookupCustomer('0901234567'), (error) => error.status === 404);
});
