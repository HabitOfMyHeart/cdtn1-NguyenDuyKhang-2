(function (global) {
  'use strict';

  const TOKEN_KEY = 'mekong_crm_token';
  const USER_KEY = 'mekong_crm_user';
  const REQUEST_TIMEOUT_MS = 15000;

  /**
   * Lỗi API có mã đọc được, HTTP status và fields để giao diện hiển thị.
   */
  class ApiError extends Error {
    /**
     * @param {string} code Mã lỗi từ máy chủ.
     * @param {string} message Câu thông báo tiếng Việt.
     * @param {number} status HTTP status, 0 nếu mất kết nối.
     * @param {Record<string, string>} [fields] Chi tiết trường sai.
     * @param {string|null} [requestId] Mã yêu cầu do máy chủ cung cấp.
     */
    constructor(code, message, status, fields, requestId) {
      super(message);
      this.name = 'ApiError';
      this.code = code;
      this.status = status;
      this.fields = fields || {};
      this.requestId = requestId || null;
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
      // localStorage có thể bị chặn ở chế độ riêng tư.
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
   * Transport dùng chung: URL, JSON, Bearer token và chuẩn hóa lỗi.
   * Các module *.api.js và facade apiClient đều gọi qua hàm này.
   *
   * @param {string} path Đường dẫn API.
   * @param {{method?: string, body?: object, auth?: boolean, timeoutMs?: number}} [options] Tùy chọn.
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

    const controller = new global.AbortController();
    const timeoutMs = Number.isFinite(config.timeoutMs) && config.timeoutMs > 0
      ? config.timeoutMs : REQUEST_TIMEOUT_MS;
    let requestId = null;
    let timer;
    const timeout = new Promise((resolve, reject) => {
      timer = global.setTimeout(() => {
        controller.abort();
        reject(new ApiError(
          'HET_THOI_GIAN_CHO',
          'Yêu cầu quá thời gian chờ. Nếu đang lưu dữ liệu, hãy tra cứu lại trước khi gửi lại.',
          0, {}, requestId
        ));
      }, timeoutMs);
    });

    async function performRequest() {
      let response;
      try {
        response = await global.fetch(`${getBaseUrl()}${path}`, {
          method, headers, body, signal: controller.signal
        });
      } catch (error) {
        if (controller.signal.aborted) throw error;
        throw new ApiError('MAT_KET_NOI', 'Mất kết nối tới máy chủ hệ thống.', 0, { cause: error.message });
      }
      if (controller.signal.aborted) return {};
      requestId = response.headers.get('x-request-id') || null;
      // Xử lý 401 ngay khi nhận headers, kể cả khi body bị treo/hỏng.
      if (response.status === 401 && auth && token === getToken()) {
        clearSession();
        global.dispatchEvent(new global.CustomEvent('auth:unauthorized'));
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
        if (controller.signal.aborted) throw error;
        if (response.ok) {
          throw new ApiError('PHAN_HOI_KHONG_HOP_LE',
            'Máy chủ trả dữ liệu không đọc được. Vui lòng thử lại.', response.status, {}, requestId);
        }
      }
      requestId = (payload && payload.requestId) || requestId;
      if (response.ok && response.status !== 204 && !contentType.includes('application/json')) {
        throw new ApiError('PHAN_HOI_KHONG_HOP_LE',
          'Máy chủ trả sai định dạng dữ liệu. Vui lòng thử lại.', response.status, {}, requestId);
      }
      if (!response.ok) {
        const fallback = response.status >= 500
          ? 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.' : 'Yêu cầu không thực hiện được.';
        throw new ApiError(
          payload && payload.error ? payload.error : 'LOI_HE_THONG',
          payload && payload.message ? payload.message : fallback,
          response.status,
          payload && payload.fields ? payload.fields : {},
          requestId
        );
      }
      return payload || {};
    }

    // Không tự thử lại, đặc biệt với các thao tác tạo dữ liệu chưa rõ kết quả.
    try {
      return await Promise.race([timeout, performRequest()]);
    } finally {
      global.clearTimeout(timer);
    }
  }

  // Script thuần, tải trước ticket.api.js và facade /apiClient.js.
  global.apiTransport = {
    ApiError,
    TOKEN_KEY,
    USER_KEY,
    request,
    getSession,
    setSession,
    clearSession,
    buildQuery
  };
})(window);
