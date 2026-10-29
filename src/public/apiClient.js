(function (global) {
  'use strict';

  // Facade ổn định cho app.js; tải sau client.js và ticket.api.js.
  const {
    ApiError,
    TOKEN_KEY,
    USER_KEY,
    request,
    getSession,
    setSession,
    clearSession,
    buildQuery
  } = global.apiTransport;
  const {
    listTickets,
    getTicket,
    createTicket,
    previewDueDate
  } = global.ticketApi;

  /**
   * Đăng nhập và lưu phiên.
   *
   * @param {string} username Tên đăng nhập.
   * @param {string} password Mật khẩu.
   * @returns {Promise<{token: string, user: object}>} Phiên đăng nhập.
   */
  async function login(username, password) {
    const payload = await request('/api/auth/login', {
      method: 'POST',
      auth: false,
      body: { username, password }
    });
    const session = payload.data;
    setSession(session.token, session.user);
    return session;
  }

  /**
   * Xóa phiên đăng nhập hiện tại.
   *
   * @returns {void}
   */
  function logout() {
    clearSession();
  }

  /**
   * Lấy thông tin người dùng đang đăng nhập.
   *
   * @returns {Promise<object>} Người dùng.
   */
  async function me() {
    const payload = await request('/api/auth/me');
    return payload.data;
  }

  /**
   * Lấy danh mục trung tâm và nhóm sự cố.
   *
   * @returns {Promise<{centers: Array<object>, categories: Array<object>}>} Danh mục.
   */
  async function getCatalogs() {
    const payload = await request('/api/catalogs');
    return payload.data;
  }

  /**
   * Tra cứu khách hàng theo số điện thoại.
   *
   * @param {string} phone Số điện thoại.
   * @returns {Promise<object>} Khách hàng.
   */
  async function lookupCustomer(phone) {
    const payload = await request(`/api/customers${buildQuery({ phone })}`);
    const customer = Array.isArray(payload.data) ? payload.data[0] : payload.data;
    if (!customer) {
      throw new ApiError('KHONG_TIM_THAY', 'Chưa có hồ sơ với số điện thoại này.', 404, {}, payload.requestId);
    }
    return customer;
  }

  /**
   * Tạo khách hàng mới.
   *
   * @param {object} data Dữ liệu khách hàng.
   * @returns {Promise<object>} Khách hàng vừa tạo.
   */
  async function createCustomer(data) {
    const payload = await request('/api/customers', { method: 'POST', body: data });
    return payload.data;
  }

  /**
   * Tra cứu thiết bị theo serial/IMEI kèm kết luận bảo hành.
   *
   * @param {string} serialNo Serial/IMEI.
   * @param {string} [receivedAt] Ngày tiếp nhận dự kiến.
   * @returns {Promise<object>} Thiết bị và kết luận bảo hành.
   */
  async function lookupDevice(serialNo, receivedAt) {
    const payload = await request(
      `/api/devices/lookup${buildQuery({ serial_no: serialNo, received_at: receivedAt })}`
    );
    return payload.data;
  }

  /**
   * Tạo thiết bị mới.
   *
   * @param {object} data Dữ liệu thiết bị.
   * @returns {Promise<object>} Thiết bị và kết luận bảo hành.
   */
  async function createDevice(data) {
    const payload = await request('/api/devices', { method: 'POST', body: data });
    return payload.data;
  }

  /**
   * Kiểm tra tình trạng máy chủ.
   *
   * @returns {Promise<object>} Health payload.
   */
  async function health() {
    return request('/health', { auth: false });
  }

  global.apiClient = {
    ApiError,
    TOKEN_KEY,
    USER_KEY,
    request,
    login,
    logout,
    me,
    getSession,
    setSession,
    clearSession,
    getCatalogs,
    listTickets,
    getTicket,
    createTicket,
    lookupCustomer,
    createCustomer,
    lookupDevice,
    createDevice,
    previewDueDate,
    health
  };
})(window);
