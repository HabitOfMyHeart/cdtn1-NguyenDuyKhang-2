const express = require('express');
const path = require('path');
const database = require('./config/db');
const { logger: defaultLogger } = require('./logger');
const { requestIdMiddleware, createRequestLogger } = require('./middlewares/request.middleware');
const {
  notFoundHandler,
  createErrorHandler
} = require('./middlewares/error.middleware');
const { notFound } = require('./services/errors');

function mountApiRoutes(app) {
  const authRoutes = require('./routes/auth.routes');
  const customerRoutes = require('./routes/customer.routes');
  const deviceRoutes = require('./routes/device.routes');
  const { router: ticketRoutes, catalogRouter } = require('./routes/ticket.routes');
  app.use('/api/auth', authRoutes);
  app.use('/api/customers', customerRoutes);
  app.use('/api/devices', deviceRoutes);
  app.use('/api/tickets', ticketRoutes);
  app.use('/api/catalogs', catalogRouter);
}

/** Construct without opening a listener or database; dependencies are injectable. */
function createApp({ database: db = database, logger = defaultLogger, mountRoutes = mountApiRoutes } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(requestIdMiddleware);
  app.use(createRequestLogger(logger));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (req, res) => {
    let state;
    try { state = db.getDatabaseState(); } catch { state = 'unknown'; }
    if (!['connected', 'disconnected', 'connecting', 'disconnecting'].includes(state)) state = 'unknown';
    const ready = state === 'connected';
    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      service: 'Smart CRM – Mekong Mobile (Luồng L2)',
      database: state,
      time: new Date().toISOString()
    });
  });

  // React 18 UMD + htm chạy offline, không phụ thuộc CDN/bước build.
  const nodeModules = path.join(__dirname, '..', 'node_modules');
  app.use('/vendor', express.static(path.join(nodeModules, 'react', 'umd')));
  app.use('/vendor', express.static(path.join(nodeModules, 'react-dom', 'umd')));
  app.use('/vendor', express.static(path.join(nodeModules, 'htm', 'dist')));

  // Tách URL tài nguyên giao diện khỏi /api để không trùng router nghiệp vụ.
  app.use('/assets/api', express.static(path.join(__dirname, 'api')));
  mountRoutes(app);

  app.use('/api', (req, res, next) => {
    next(notFound('Không tìm thấy API được yêu cầu.'));
  });

  app.use(express.static(path.join(__dirname, 'public')));

  // SPA một trang: mọi đường dẫn không phải API đều trả index.html.
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  });

  app.use(notFoundHandler);
  app.use(createErrorHandler({ logger }));
  return app;
}

module.exports = createApp();
module.exports.createApp = createApp;
