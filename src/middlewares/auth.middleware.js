const jwt = require('jsonwebtoken');
const { forbidden, unauthorized } = require('../services/errors');
const { getConfig } = require('../config');

/**
 * Lấy khóa ký JWT từ cấu hình đã kiểm tra, không dùng khóa mặc định.
 *
 * @returns {string} Khóa bí mật.
 */
function getJwtSecret() {
  return getConfig().jwtSecret;
}

function createAuthMiddleware({ config, tokenProvider = jwt } = {}) {
  const settings = () => config || getConfig();
  const validIdentity = (user) => user && user.role === 'NHAN_VIEN' &&
    typeof user.username === 'string' && /^[A-Za-z0-9_.-]{1,24}$/.test(user.username) &&
    typeof user.center_id === 'string' && /^[A-Za-z0-9_-]{1,24}$/.test(user.center_id) &&
    (user.fullName === undefined || (typeof user.fullName === 'string' && user.fullName.length <= 120 && !/[\x00-\x1f\x7f]/.test(user.fullName)));

  function signAccessToken(user) {
    if (!validIdentity(user)) throw unauthorized('Thông tin phiên đăng nhập không hợp lệ.');
    const { jwtSecret, jwtExpiresIn } = settings();
    return tokenProvider.sign({ sub: user.username, role: user.role, center_id: user.center_id, fullName: user.fullName },
      jwtSecret, { algorithm: 'HS256', expiresIn: jwtExpiresIn });
  }

  function requireAuth(req, res, next) {
    const token = getBearerToken(req);
    if (!token) return next(unauthorized());
    // Configuration faults must reach the internal-error boundary, not become 401s.
    let jwtSecret;
    try { jwtSecret = settings().jwtSecret; } catch (error) { return next(error); }
    try {
      const payload = tokenProvider.verify(token, jwtSecret, { algorithms: ['HS256'] });
      const user = payload && typeof payload === 'object' ? {
        username: payload.sub, role: payload.role, center_id: payload.center_id, fullName: payload.fullName
      } : null;
      if (!validIdentity(user) || !Number.isFinite(payload.exp) || payload.exp <= Math.floor(Date.now() / 1000)) {
        return next(unauthorized('Phiên đăng nhập không còn thuộc phạm vi tiếp nhận. Vui lòng đăng nhập lại.'));
      }
      req.user = user;
      return next();
    } catch {
      return next(unauthorized('Phiên đăng nhập không hợp lệ hoặc đã hết hạn.'));
    }
  }
  return { signAccessToken, requireAuth, getBearerToken, requireRole };
}

const defaultAuth = createAuthMiddleware();

/**
 * Ký access token cho người dùng demo.
 *
 * @param {{username: string, role: string, center_id: string, fullName: string}} user Người dùng.
 * @returns {string} JWT đã ký.
 * @throws {Error} Khi không ký được token.
 */
function signAccessToken(user) {
  return defaultAuth.signAccessToken(user);
}

/**
 * Đọc Bearer token từ header Authorization.
 *
 * @param {import('express').Request} req Request Express.
 * @returns {string|null} Token hoặc null.
 */
function getBearerToken(req) {
  const header = req.headers?.authorization;
  if (typeof header !== 'string' || header.length > 8192) return null;
  return /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(header)?.[1] || null;
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
  return defaultAuth.requireAuth(req, res, next);
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
  createAuthMiddleware,
  getJwtSecret,
  signAccessToken,
  getBearerToken,
  requireAuth,
  requireRole
};
