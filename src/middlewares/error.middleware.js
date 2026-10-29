const { randomUUID } = require('node:crypto');
const { AppError, notFound } = require('../services/errors');
const { logger: defaultLogger } = require('../logger');

// The only application-error-to-HTTP translation table.
const STATUS = Object.freeze({ bad_request: 400, unauthorized: 401, forbidden: 403,
  not_found: 404, conflict: 409, payload_too_large: 413, validation: 422,
  unavailable: 503, internal: 500 });
const INTERNAL_MESSAGE = 'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.';
const UNAVAILABLE_MESSAGE = 'Dịch vụ dữ liệu tạm thời không sẵn sàng. Vui lòng thử lại sau.';
const DATABASE_ERRORS = new Set(['MongoNetworkError', 'MongoNetworkTimeoutError',
  'MongoServerSelectionError', 'MongooseServerSelectionError', 'MongoNotConnectedError',
  'MongoTopologyClosedError', 'MongoServerClosedError', 'MongoPoolClearedError']);

function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    return Promise.resolve().then(() => handler(req, res, next)).catch(next);
  };
}

function makeRetrievalCode() {
  return randomUUID();
}

function notFoundHandler(req, res, next) {
  next(notFound('Không tìm thấy đường dẫn được yêu cầu.'));
}

function safeFieldKey(key) {
  return typeof key === 'string' && /^[A-Za-z_][A-Za-z0-9_.]{0,63}$/.test(key) &&
    !['__proto__', 'constructor', 'prototype'].includes(key) ? key : 'du_lieu';
}

function normalizeError(error) {
  if (error instanceof AppError) {
    const kind = Object.hasOwn(STATUS, error.kind) ? error.kind : 'internal';
    if (kind === 'internal') return { kind, code: 'LOI_HE_THONG', message: INTERNAL_MESSAGE, fields: {} };
    if (kind === 'unavailable') return { kind, code: 'DICH_VU_KHONG_SAN_SANG', message: UNAVAILABLE_MESSAGE, fields: {} };
    return { kind, code: error.code, message: error.message, fields: error.fields || {} };
  }
  if (error?.type === 'entity.too.large') {
    return { kind: 'payload_too_large', code: 'NOI_DUNG_QUA_LON', message: 'Nội dung yêu cầu vượt quá giới hạn cho phép.', fields: {} };
  }
  if (error instanceof SyntaxError && error.type === 'entity.parse.failed') {
    return { kind: 'bad_request', code: 'DU_LIEU_KHONG_HOP_LE', message: 'Nội dung JSON không hợp lệ.', fields: { body: 'Kiểm tra lại cú pháp JSON.' } };
  }
  if (error?.code === 11000) {
    const key = safeFieldKey(Object.keys(error.keyPattern || error.keyValue || {})[0]);
    return { kind: 'conflict', code: 'TRUNG_DU_LIEU', message: 'Dữ liệu đã tồn tại trong hệ thống.', fields: { [key]: 'Giá trị này đã được sử dụng.' } };
  }
  if (error?.name === 'ValidationError' && error.errors) {
    const fields = Object.fromEntries(Object.keys(error.errors).slice(0, 50).map((key) => [safeFieldKey(key), 'Giá trị không hợp lệ.']));
    return { kind: 'validation', code: 'DU_LIEU_KHONG_HOP_LE', message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.', fields };
  }
  if (error?.name === 'CastError') {
    return { kind: 'validation', code: 'DU_LIEU_KHONG_HOP_LE', message: 'Dữ liệu không đúng định dạng.', fields: { [safeFieldKey(error.path)]: 'Giá trị không hợp lệ.' } };
  }
  if (DATABASE_ERRORS.has(error?.name) || (error?.name === 'MongooseError' &&
      /before initial connection|buffering timed out|connection (?:is )?(?:closed|not open)/i.test(error.message || ''))) {
    return { kind: 'unavailable', code: 'DICH_VU_KHONG_SAN_SANG', message: UNAVAILABLE_MESSAGE, fields: {} };
  }
  return { kind: 'internal', code: 'LOI_HE_THONG', message: INTERNAL_MESSAGE, fields: {} };
}

function createErrorHandler({ logger = defaultLogger } = {}) {
  return function errorHandler(error, req, res, next) {
    if (res.headersSent) return next(error);
    const normalized = normalizeError(error);
    const statusCode = STATUS[normalized.kind];
    const requestId = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.requestId || '') ? req.requestId : makeRetrievalCode();
    req.requestId = requestId;
    res.setHeader('X-Request-ID', requestId);
    logger[statusCode >= 500 ? 'error' : 'warn']('http.request.failed', {
      requestId, statusCode, kind: normalized.kind, code: normalized.code, error
    });
    return res.status(statusCode).json({
      error: normalized.code,
      message: normalized.message,
      fields: { ...normalized.fields, maTraCuu: requestId }
    });
  };
}

module.exports = { asyncHandler, makeRetrievalCode, notFoundHandler,
  normalizeError, createErrorHandler, errorHandler: createErrorHandler() };
