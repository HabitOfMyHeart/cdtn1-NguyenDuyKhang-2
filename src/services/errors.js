/**
 * Lỗi nghiệp vụ có mã đọc được, HTTP status và fields để lớp route trả về
 * đúng định dạng { error, message, fields }.
 */
class AppError extends Error {
  /**
   * @param {string} code Mã lỗi máy đọc, ví dụ KHONG_TIM_THAY.
   * @param {string} message Câu thông báo tiếng Việt cho người dùng.
   * @param {number} [statusCode=500] HTTP status tương ứng.
   * @param {Record<string, string>} [fields={}] Chi tiết từng trường sai.
   */
  constructor(code, message, statusCode = 500, fields = {}) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.fields = fields;
    Error.captureStackTrace?.(this, AppError);
  }
}

/** @param {string} message @param {Record<string,string>} [fields] @returns {AppError} */
function badRequest(message, fields = {}) {
  return new AppError('DU_LIEU_KHONG_HOP_LE', message, 400, fields);
}

/** @param {string} message @param {Record<string,string>} [fields] @returns {AppError} */
function invalid(message, fields = {}) {
  return new AppError('DU_LIEU_KHONG_HOP_LE', message, 422, fields);
}

/** @param {string} message @param {Record<string,string>} [fields] @returns {AppError} */
function notFound(message, fields = {}) {
  return new AppError('KHONG_TIM_THAY', message, 404, fields);
}

/**
 * @param {'PHIEU_DANG_MO'|'TRUNG_DU_LIEU'|'CHUYEN_TRANG_THAI_KHONG_HOP_LE'} code Mã xung đột.
 * @param {string} message Câu thông báo nghiệp vụ.
 * @param {Record<string,string>} [fields] Trường liên quan.
 * @returns {AppError}
 */
function conflict(code, message, fields = {}) {
  return new AppError(code, message, 409, fields);
}

/** @param {string} [message] @returns {AppError} */
function unauthorized(message = 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.') {
  return new AppError('CHUA_DANG_NHAP', message, 401);
}

/** @param {string} [message] @returns {AppError} */
function forbidden(message = 'Bạn không đủ quyền thực hiện thao tác này.') {
  return new AppError('KHONG_DU_QUYEN', message, 403);
}

/** @param {string} [message] @returns {AppError} */
function internal(message = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.') {
  return new AppError('LOI_HE_THONG', message, 500);
}

/** @param {unknown} error @returns {error is AppError} */
function isAppError(error) {
  return error instanceof AppError;
}

module.exports = {
  AppError,
  badRequest,
  invalid,
  notFound,
  conflict,
  unauthorized,
  forbidden,
  internal,
  isAppError
};
