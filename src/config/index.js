require('dotenv').config();

class ConfigError extends Error {
  constructor(fields) {
    super(`Cấu hình không hợp lệ: ${Object.keys(fields).join(', ')}.`);
    this.name = 'ConfigError';
    this.fields = Object.freeze(fields);
  }
}

/** Validate without exposing environment values (especially credentials) in errors. */
function loadConfig(env = process.env) {
  const fields = {};
  const text = (key, fallback = '') => String(env[key] ?? fallback).trim();
  const integer = (key, fallback, min, max) => {
    const value = text(key, fallback);
    const number = Number(value);
    if (!/^\d+$/.test(value) || !Number.isSafeInteger(number) || number < min || number > max) {
      fields[key] = `Cần số nguyên từ ${min} đến ${max}.`;
    }
    return number;
  };
  const nodeEnv = text('NODE_ENV', 'development');
  if (!['development', 'test', 'production'].includes(nodeEnv)) fields.NODE_ENV = 'Môi trường không hợp lệ.';
  const production = nodeEnv === 'production';
  const port = integer('PORT', 3000, 1, 65535);
  const mongodbUri = text('MONGODB_URI', production ? '' : 'mongodb://127.0.0.1:27017/mekong_warranty');
  if (!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(mongodbUri)) fields.MONGODB_URI = 'Cần URI MongoDB hợp lệ.';
  const jwtSecret = text('JWT_SECRET');
  if (!jwtSecret || (production && (jwtSecret.length < 32 || /^(?:dev-only|change-me|example|mekong-mobile-dev)/i.test(jwtSecret)))) {
    fields.JWT_SECRET = production
      ? 'Production cần khóa riêng ít nhất 32 ký tự, không dùng khóa mẫu.'
      : 'Cần khai báo JWT_SECRET trong .env để ký phiên đăng nhập demo.';
  }
  const jwtExpiresIn = text('JWT_EXPIRES_IN', '8h');
  const lifetime = /^([1-9]\d*)(s|m|h|d)$/.exec(jwtExpiresIn);
  const seconds = lifetime && Number(lifetime[1]) * ({ s: 1, m: 60, h: 3600, d: 86400 }[lifetime[2]]);
  if (!seconds || seconds > 30 * 86400) fields.JWT_EXPIRES_IN = 'Cần thời hạn từ 1s đến 30d, có đơn vị s/m/h/d.';
  const username = text('DEMO_STAFF_USERNAME', production ? '' : 'nhanvien');
  if (!/^[A-Za-z0-9_.-]{1,24}$/.test(username)) fields.DEMO_STAFF_USERNAME = 'Cần tên đăng nhập 1–24 ký tự hợp lệ.';
  // Credentials are always explicit; in production the sample password is rejected.
  const password = String(env.DEMO_STAFF_PASSWORD ?? '');
  if (password.length < (production ? 12 : 8) || password.length > 128 || !password.trim() ||
      (production && ['nhanvien123', 'dev-only-password-change-me'].includes(password))) {
    fields.DEMO_STAFF_PASSWORD = 'Cần mật khẩu riêng đủ độ dài, không dùng mật khẩu mẫu khi triển khai.';
  }
  const fullName = text('DEMO_STAFF_NAME', production ? '' : 'Nhân viên tiếp nhận');
  if (!fullName || fullName.length > 120 || /[\x00-\x1f\x7f]/.test(fullName)) fields.DEMO_STAFF_NAME = 'Cần tên hiển thị hợp lệ, tối đa 120 ký tự.';
  const centerId = text('DEMO_STAFF_CENTER', production ? '' : '1');
  if (!/^[A-Za-z0-9_-]{1,24}$/.test(centerId)) fields.DEMO_STAFF_CENTER = 'Cần mã trung tâm 1–24 ký tự hợp lệ.';
  const logLevel = text('LOG_LEVEL', 'info');
  if (!['debug', 'info', 'warn', 'error', 'silent'].includes(logLevel)) fields.LOG_LEVEL = 'Mức log không hợp lệ.';
  const dbServerSelectionTimeoutMs = integer('DB_SERVER_SELECTION_TIMEOUT_MS', 3000, 100, 60000);
  const dbConnectTimeoutMs = integer('DB_CONNECT_TIMEOUT_MS', 3000, 100, 60000);
  const dbSocketTimeoutMs = integer('DB_SOCKET_TIMEOUT_MS', 10000, 100, 120000);
  const httpRequestTimeoutMs = integer('HTTP_REQUEST_TIMEOUT_MS', 30000, 100, 120000);
  const httpHeadersTimeoutMs = integer('HTTP_HEADERS_TIMEOUT_MS', 10000, 100, 120000);
  if (httpHeadersTimeoutMs > httpRequestTimeoutMs) fields.HTTP_HEADERS_TIMEOUT_MS = 'Không được vượt thời gian chờ request.';
  const shutdownTimeoutMs = integer('SHUTDOWN_TIMEOUT_MS', 10000, 100, 30000);
  if (Object.keys(fields).length) throw new ConfigError(fields);
  return Object.freeze({
    nodeEnv, port, mongodbUri, jwtSecret, jwtExpiresIn, logLevel,
    demoStaff: Object.freeze({ username, password, fullName, role: 'NHAN_VIEN', center_id: centerId }),
    dbServerSelectionTimeoutMs, dbConnectTimeoutMs, dbSocketTimeoutMs,
    httpRequestTimeoutMs, httpHeadersTimeoutMs, shutdownTimeoutMs
  });
}

let cachedConfig;
function getConfig() {
  if (!cachedConfig) cachedConfig = loadConfig();
  return cachedConfig;
}

module.exports = { ConfigError, loadConfig, getConfig };
