const { randomUUID } = require('node:crypto');
const { logger: defaultLogger } = require('../logger');

function requestIdMiddleware(req, res, next) {
  // Never reflect a caller-controlled header into response headers or logs.
  req.requestId = randomUUID();
  res.setHeader('X-Request-ID', req.requestId);
  next();
}

function createRequestLogger(logger = defaultLogger) {
  return function requestLogger(req, res, next) {
    const started = process.hrtime.bigint();
    res.once('finish', () => {
      logger.info('http.request.completed', {
        requestId: req.requestId,
        method: req.method,
        statusCode: res.statusCode,
        durationMs: Number(process.hrtime.bigint() - started) / 1e6
      });
    });
    next();
  };
}

module.exports = { requestIdMiddleware, createRequestLogger };
