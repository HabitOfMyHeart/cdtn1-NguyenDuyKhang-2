/** Semantic application errors. Transport status belongs exclusively to middleware. */
class AppError extends Error {
  constructor(code, message, kind = 'internal', fields = {}, options = {}) {
    super(message, options);
    this.name = 'AppError';
    this.kind = kind;
    this.code = code;
    this.fields = fields;
    Error.captureStackTrace?.(this, this.constructor);
  }
}

function badRequest(message, fields = {}) {
  return new AppError('DU_LIEU_KHONG_HOP_LE', message, 'bad_request', fields);
}
function invalid(message, fields = {}) {
  return new AppError('DU_LIEU_KHONG_HOP_LE', message, 'validation', fields);
}
function notFound(message, fields = {}) {
  return new AppError('KHONG_TIM_THAY', message, 'not_found', fields);
}
function conflict(code, message, fields = {}) {
  return new AppError(code, message, 'conflict', fields);
}
function unauthorized(message = 'Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn.') {
  return new AppError('CHUA_DANG_NHAP', message, 'unauthorized');
}
function forbidden(message = 'Bạn không đủ quyền thực hiện thao tác này.') {
  return new AppError('KHONG_DU_QUYEN', message, 'forbidden');
}
function internal(message = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.') {
  return new AppError('LOI_HE_THONG', message, 'internal');
}

/** Repository adapters can preserve the private cause without exposing its message. */
class DataAccessError extends AppError {
  constructor(message = 'Dịch vụ dữ liệu tạm thời không sẵn sàng.', { cause } = {}) {
    super('DICH_VU_KHONG_SAN_SANG', message, 'unavailable', {}, { cause });
    this.name = 'DataAccessError';
  }
}

class DuplicateKeyError extends AppError {
  constructor(fields = {}, { cause } = {}) {
    super('TRUNG_DU_LIEU', 'Dữ liệu đã tồn tại trong hệ thống.', 'conflict', fields, { cause });
    this.name = 'DuplicateKeyError';
  }
}

function isAppError(error) {
  return error instanceof AppError;
}

module.exports = {
  AppError, DataAccessError, DuplicateKeyError,
  badRequest, invalid, notFound, conflict, unauthorized, forbidden, internal, isAppError
};
