const { randomBytes, randomInt } = require('node:crypto');
const { AppError, notFound } = require('../services/errors');

/**
 * Bọc handler async để mọi Promise rejection đi vào error middleware.
 *
 * @param {Function} handler Hàm xử lý route.
 * @returns {import('express').RequestHandler} Handler đã bọc.
 */
function asyncHandler(handler) {
  return function wrapped(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

/**
 * Sinh mã tra cứu ngắn cho lỗi 500, dạng 7F3A-21.
 *
 * @returns {string} Mã tra cứu.
 */
function makeRetrievalCode() {
  return `${randomBytes(2).toString('hex').toUpperCase()}-${randomInt(10, 100)}`;
}

/**
 * Middleware 404 cho đường dẫn API không tồn tại.
 *
 * @param {import('express').Request} req Request Express.
 * @param {import('express').Response} res Response Express.
 * @param {import('express').NextFunction} next Hàm next.
 * @returns {void}
 * @throws {import('../services/errors').AppError} KHONG_TIM_THAY.
 */
function notFoundHandler(req, res, next) {
  next(notFound(`Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}.`));
}

/**
 * Chuẩn hóa mọi lỗi về đúng ba trường { error, message, fields }.
 * Không trả stack trace, tên collection hay chi tiết kỹ thuật của CSDL ra ngoài.
 *
 * @param {unknown} error Lỗi bắt được.
 * @param {import('express').Request} req Request Express.
 * @param {import('express').Response} res Response Express.
 * @param {import('express').NextFunction} next Hàm next.
 * @returns {void}
 */
function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error);

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      error: error.code,
      message: error.message,
      fields: error.fields || {}
    });
  }

  // Lỗi validation của Mongoose: đưa tên trường vào fields để giao diện tô đỏ.
  if (error?.name === 'ValidationError' && error.errors) {
    const fields = {};
    for (const [key, value] of Object.entries(error.errors)) {
      fields[key] = value.message;
    }
    return res.status(422).json({
      error: 'DU_LIEU_KHONG_HOP_LE',
      message: 'Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.',
      fields
    });
  }

  // Lỗi unique index (ví dụ trùng SĐT, serial, mã phiếu).
  if (error?.code === 11000) {
    const key = Object.keys(error.keyPattern || error.keyValue || { du_lieu: 1 })[0];
    return res.status(409).json({
      error: 'TRUNG_DU_LIEU',
      message: 'Dữ liệu đã tồn tại trong hệ thống.',
      fields: { [key]: 'Giá trị này đã được sử dụng.' }
    });
  }

  // Lỗi ép kiểu của Mongoose (ví dụ ID không đúng dạng).
  if (error?.name === 'CastError') {
    return res.status(422).json({
      error: 'DU_LIEU_KHONG_HOP_LE',
      message: 'Dữ liệu không đúng định dạng.',
      fields: { [error.path || 'du_lieu']: 'Giá trị không hợp lệ.' }
    });
  }

  // Body JSON hỏng do express.json().
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({
      error: 'DU_LIEU_KHONG_HOP_LE',
      message: 'Nội dung JSON không hợp lệ.',
      fields: { body: 'Kiểm tra lại cú pháp JSON.' }
    });
  }

  const retrievalCode = makeRetrievalCode();
  // Chỉ log phía máy chủ; người dùng chỉ nhận mã tra cứu, không nhận stack.
  console.error(`[LOI_HE_THONG ${retrievalCode}]`, error);
  return res.status(500).json({
    error: 'LOI_HE_THONG',
    message: `Hệ thống đang gặp sự cố. Vui lòng thử lại sau. Mã tra cứu: ${retrievalCode}.`,
    fields: { maTraCuu: retrievalCode }
  });
}

module.exports = {
  asyncHandler,
  makeRetrievalCode,
  notFoundHandler,
  errorHandler
};
