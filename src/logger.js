const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: Infinity };
const REDACTED = '[REDACTED]';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EVENTS = new Set([
  'http.request.completed', 'http.request.failed', 'database.connected',
  'database.unavailable', 'server.listening', 'server.listen_failed',
  'server.startup_failed', 'server.stopping', 'server.stopped', 'server.shutdown_failed'
]);
const KINDS = new Set(['bad_request', 'validation', 'not_found', 'conflict', 'unauthorized', 'forbidden', 'internal', 'unavailable', 'payload_too_large']);
const CODES = new Set(['DU_LIEU_KHONG_HOP_LE', 'KHONG_TIM_THAY', 'TRUNG_DU_LIEU', 'PHIEU_DANG_MO', 'CHUYEN_TRANG_THAI_KHONG_HOP_LE', 'CHUA_DANG_NHAP', 'KHONG_DU_QUYEN', 'LOI_HE_THONG', 'DICH_VU_KHONG_SAN_SANG', 'NOI_DUNG_QUA_LON']);
const ERROR_NAMES = new Set(['Error', 'AppError', 'DataAccessError', 'DuplicateKeyError', 'ConfigError', 'SyntaxError', 'ValidationError', 'CastError', 'PayloadTooLargeError', 'MongoServerError', 'MongoNetworkError', 'MongoServerSelectionError', 'MongooseServerSelectionError']);
const PRIVATE_KEY = /password|secret|token|authorization|cookie|phone|sdt|email|address|name|username|serial|imei|body|query|headers|url|stack|message/i;

/**
 * Deny free-form strings by default. Regex replacement cannot reliably identify
 * names, addresses or secrets in error messages, so only bounded operational
 * metadata is retained. No request body/query/header or error message is logged.
 */
function redact(value, key = '', seen = new WeakSet(), depth = 0) {
  if (depth > 6) return REDACTED;
  if (value instanceof Error) {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    return {
      name: ERROR_NAMES.has(value.name) ? value.name : 'Error',
      kind: KINDS.has(value.kind) ? value.kind : undefined,
      code: CODES.has(value.code) ? value.code : undefined,
      message: REDACTED,
      ...(value.cause ? { cause: redact(value.cause, 'cause', seen, depth + 1) } : {})
    };
  }
  if (PRIVATE_KEY.test(key)) return REDACTED;
  if (value && typeof value === 'object') {
    if (seen.has(value)) return REDACTED;
    seen.add(value);
    if (Array.isArray(value)) return value.slice(0, 30).map((entry) => redact(entry, '', seen, depth + 1));
    return Object.fromEntries(Object.entries(value).slice(0, 30).map(([childKey, child]) => [childKey, redact(child, childKey, seen, depth + 1)]));
  }
  if (key === 'requestId' && typeof value === 'string' && UUID.test(value)) return value;
  if (key === 'method' && ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(value)) return value;
  if (key === 'kind' && KINDS.has(value)) return value;
  if (key === 'code' && CODES.has(value)) return value;
  if (key === 'signal' && ['SIGINT', 'SIGTERM', 'manual', 'server_error'].includes(value)) return value;
  if (['statusCode', 'durationMs', 'port', 'exitCode'].includes(key) && typeof value === 'number' && Number.isFinite(value) && value >= 0 && value < 1000000) return value;
  if (key === 'timedOut' && typeof value === 'boolean') return value;
  return REDACTED;
}

function createLogger({ level = 'info', stream = process.stdout, now = () => new Date() } = {}) {
  if (!Object.hasOwn(LEVELS, level)) throw new TypeError('Invalid log level.');
  const logger = {};
  for (const name of ['debug', 'info', 'warn', 'error']) {
    logger[name] = (event, metadata = {}) => {
      if (LEVELS[name] < LEVELS[level]) return;
      try {
        stream.write(`${JSON.stringify({
          time: now().toISOString(), level: name,
          event: EVENTS.has(event) ? event : 'application.event',
          data: redact(metadata)
        })}\n`);
      } catch {
        // Diagnostics must never cause a request or shutdown to fail.
      }
    };
  }
  return Object.freeze(logger);
}

module.exports = { createLogger, redact, logger: createLogger() };
