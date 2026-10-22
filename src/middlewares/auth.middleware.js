const jwt = require('jsonwebtoken');
const { forbidden, unauthorized } = require('../services/errors');

/**
 * Lấy khóa ký JWT từ biến môi trường; giá trị mặc định chỉ dùng cho prototype.
 *
 * @returns {string} Khóa bí mật.
 */
function getJwtSecret() {
  return process.env.JWT_SECRET || 'mekong-mobile-dev-secret-2026';
}

/**
 * Ký access token cho người dùng demo.
 *
 * @param {{username: string, role: string, center_id: string, fullName: string}} user Người dùng.
 * @returns {string} JWT đã ký.
 * @throws {Error} Khi không ký được token.
 */
function signAccessToken(user) {
  return jwt.sign(
    {
      sub: user.username,
      role: user.role,
      center_id: user.center_id,
      fullName: user.fullName
    },
    getJwtSecret(),
    { expiresIn: process.env.JWT_EXPIRES_IN || '8h' }
  );
}

/**
 * Đọc Bearer token từ header Authorization.
 *
 * @param {import('express').Request} req Request Express.
 * @returns {string|null} Token hoặc null.
 */
function getBearerToken(req) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  return token;
}

/**
 * Middleware xác thực JWT và gắn req.user cho các route bảo vệ.
 *
 * @param {import('express').Request} req Request Express.
 * @param {import('express').Response} res Response Express.
 * @param {import('express').NextFunction} next Hàm next.
 * @returns {void}
 * @throws {import('../services/errors').AppError} CHUA_DANG_NHAP khi thiếu/sai token.
 */
function requireAuth(req, res, next) {
  const token = getBearerToken(req);
  if (!token) {
    return next(unauthorized());
  }
  try {
    const payload = jwt.verify(token, getJwtSecret());
    req.user = {
      username: payload.sub,
      role: payload.role,
      center_id: payload.center_id,
      fullName: payload.fullName
    };
    return next();
  } catch (error) {
    return next(unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
  }
}

/**
 * Middleware phân quyền theo vai trò.
 *
 * @param {...string} roles Danh sách vai trò được phép.
 * @returns {import('express').RequestHandler} Middleware kiểm tra quyền.
 * @throws {import('../services/errors').AppError} KHONG_DU_QUYEN khi sai vai trò.
 */
function requireRole(...roles) {
  return function roleGuard(req, res, next) {
    if (!req.user) return next(unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(forbidden('Bạn không đủ quyền thực hiện thao tác này.'));
    }
    return next();
  };
}

module.exports = {
  getJwtSecret,
  signAccessToken,
  getBearerToken,
  requireAuth,
  requireRole
};
