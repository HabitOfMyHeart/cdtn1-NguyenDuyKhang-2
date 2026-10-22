(function (global) {
  'use strict';

  const TOKEN_KEY = 'mekong_crm_token';
  const USER_KEY = 'mekong_crm_user';

  /**
   * Lỗi API có mã đọc được, HTTP status và fields để giao diện hiển thị.
   */
  class ApiError extends Error {
    /**
     * @param {string} code Mã lỗi từ máy chủ.
     * @param {string} message Câu thông báo tiếng Việt.
     * @param {number} status HTTP status, 0 nếu mất kết nối.
     * @param {Record<string, string>} [fields] Chi tiết trường sai.
     */
    constructor(code, message, status, fields) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
      this.fields = fields || {};
    }
  }

  /**
   * Lấy base URL linh hoạt: cùng origin mặc định, có thể override qua window.API_BASE_URL.
   *
   * @returns {string} Base URL không có dấu / cuối.
   */
  function getBaseUrl() {
    return String(global.API_BASE_URL || '').replace(/\/$/, '');
  }

  /**
   * Đọc token đã lưu trong localStorage.
   *
   * @returns {string|null} Token hoặc null.
   */
  function getToken() {
    try {
      return global.localStorage.getItem(TOKEN_KEY);
    } catch (error) {
      return null;
    }
  }

  /**
   * Đọc phiên đăng nhập đã lưu.
   *
   * @returns {{token: string, user: object}|null} Phiên hoặc null.
   */
  function getSession() {
    const token = getToken();
    if (!token) return null;
    try {
      const raw = global.localStorage.getItem(USER_KEY);
      return { token, user: raw ? JSON.parse(raw) : null };
    } catch (error) {
      return { token, user: null };
    }
  }

  /**
   * Lưu token và người dùng sau khi đăng nhập thành công.
   *
   * @param {string} token JWT.
   * @param {object} user Người dùng công khai.
   * @returns {void}
   */
  function setSession(token, user) {
    try {
      global.localStorage.setItem(TOKEN_KEY, token);
      global.localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch (error) {
      // localStorage có thể bị chặn ở chế độ riêng tư; phiên chỉ sống trong RAM.
    }
  }

  /**
   * Xóa phiên đăng nhập khỏi localStorage.
   *
   * @returns {void}
   */
  function clearSession() {
    try {
      global.localStorage.removeItem(TOKEN_KEY);
      global.localStorage.removeItem(USER_KEY);
    } catch (error) {
      // Bỏ qua lỗi lưu trữ.
    }
  }

  /**
   * Tạo query string từ object, bỏ giá trị rỗng.
   *
   * @param {Record<string, unknown>} params Tham số.
   * @returns {string} Chuỗi bắt đầu bằng ? hoặc rỗng.
   */
  function buildQuery(params) {
    const search = new URLSearchParams();
    Object.entries(params || {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && String(value).trim() !== '') {
        search.set(key, String(value));
      }
    });
    const query = search.toString();
    return query ? `?${query}` : '';
  }

  /**
   * Gọi API duy nhất của toàn bộ giao diện. Mọi fetch/axios khác đều bị cấm
   * trong app.js để giữ một điểm giao tiếp duy nhất.
   *
   * @param {string} path Đường dẫn API.
   * @param {{method?: string, body?: object, auth?: boolean}} [options] Tùy chọn.
   * @returns {Promise<object>} Payload JSON.
   * @throws {ApiError} Khi mất kết nối hoặc máy chủ trả lỗi.
   */
  async function request(path, options) {
    const config = options || {};
    const method = config.method || 'GET';
    const auth = config.auth !== false;
    const headers = { Accept: 'application/json' };
    const token = getToken();

    if (auth && token) {
      headers.Authorization = `Bearer ${token}`;
    }

    let body;
    if (config.body !== undefined) {
      headers['Content-Type'] = 'application/json';
      body = JSON.stringify(config.body);
    }

    let response;
    try {
      response = await fetch(`${getBaseUrl()}${path}`, { method, headers, body });
    } catch (error) {
      throw new ApiError(
        'MAT_KET_NOI',
        'Mất kết nối tới máy chủ hệ thống.',
        0,
        { cause: error.message }
      );
    }

    let payload = null;
    const contentType = response.headers.get('content-type') || '';
    try {
      if (contentType.includes('application/json')) {
        payload = await response.json();
      } else {
        const text = await response.text();
        payload = text ? { message: text } : null;
      }
    } catch (error) {
      payload = null;
    }

    if (!response.ok) {
      if (response.status === 401 && auth) {
        clearSession();
        global.dispatchEvent(new CustomEvent('auth:unauthorized'));
      }
      const fallback =
        response.status >= 500
          ? 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.'
          : 'Yêu cầu không thực hiện được.';
      throw new ApiError(
        payload && payload.error ? payload.error : 'LOI_HE_THONG',
        payload && payload.message ? payload.message : fallback,
        response.status,
        payload && payload.fields ? payload.fields : {}
      );
    }

    return payload || {};
  }

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
   * Lấy danh sách phiếu theo bộ lọc.
   *
   * @param {object} [filters] Bộ lọc trạng thái, nhóm, ưu tiên, từ khóa.
   * @returns {Promise<{data: Array<object>, total: number}>} Danh sách.
   */
  async function listTickets(filters) {
    return request(`/api/tickets${buildQuery(filters)}`);
  }

  /**
   * Lấy chi tiết phiếu.
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @returns {Promise<{ticket: object, lichSuTrangThai: Array<object>, trangThaiKeTiep: string[]}>} Chi tiết.
   */
  async function getTicket(ticketId) {
    const payload = await request(`/api/tickets/${encodeURIComponent(ticketId)}`);
    return payload.data;
  }

  /**
   * Tạo phiếu mới.
   *
   * @param {object} data Dữ liệu tiếp nhận.
   * @returns {Promise<object>} Chi tiết phiếu vừa tạo.
   */
  async function createTicket(data) {
    const payload = await request('/api/tickets', { method: 'POST', body: data });
    return payload.data;
  }

  /**
   * Cập nhật phiếu.
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @param {object} data Trường cần cập nhật.
   * @returns {Promise<object>} Chi tiết sau cập nhật.
   */
  async function updateTicket(ticketId, data) {
    const payload = await request(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'PUT',
      body: data
    });
    return payload.data;
  }

  /**
   * Chuyển trạng thái phiếu theo QT-06.
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @param {string} toStatus Trạng thái đích.
   * @param {string} [note] Ghi chú.
   * @returns {Promise<object>} Chi tiết sau chuyển.
   */
  async function changeStatus(ticketId, toStatus, note) {
    const payload = await request(`/api/tickets/${encodeURIComponent(ticketId)}/status`, {
      method: 'PATCH',
      body: { to_status: toStatus, note: note || '' }
    });
    return payload.data;
  }

  /**
   * Xóa mềm phiếu.
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @returns {Promise<{ticketId: string, deleted: boolean}>} Kết quả.
   */
  async function deleteTicket(ticketId) {
    const payload = await request(`/api/tickets/${encodeURIComponent(ticketId)}`, {
      method: 'DELETE'
    });
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
    return Array.isArray(payload.data) ? payload.data[0] : payload.data;
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
   * Cập nhật khách hàng.
   *
   * @param {string} customerId Mã CUSxxxx.
   * @param {object} data Dữ liệu cần cập nhật.
   * @returns {Promise<object>} Khách hàng sau cập nhật.
   */
  async function updateCustomer(customerId, data) {
    const payload = await request(`/api/customers/${encodeURIComponent(customerId)}`, {
      method: 'PUT',
      body: data
    });
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
   * Tính trước hạn cam kết theo QT-04.
   *
   * @param {string} priority Mức ưu tiên.
   * @param {string} receivedAt Thời điểm tiếp nhận.
   * @returns {Promise<{priority: string, received_at: string, due_date: string, sla_hours: number}>} Kết quả.
   */
  async function previewDueDate(priority, receivedAt) {
    const payload = await request('/api/tickets/preview', {
      method: 'POST',
      body: { priority, received_at: receivedAt }
    });
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
    updateTicket,
    changeStatus,
    deleteTicket,
    lookupCustomer,
    createCustomer,
    updateCustomer,
    lookupDevice,
    createDevice,
    previewDueDate,
    health
  };
})(window);
