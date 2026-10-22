require('dotenv').config();

const express = require('express');
const path = require('path');
const { getDatabaseState } = require('./config/db');
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const deviceRoutes = require('./routes/device.routes');
const { router: ticketRoutes, catalogRouter } = require('./routes/ticket.routes');
const {
  notFoundHandler,
  errorHandler
} = require('./middlewares/error.middleware');
const { notFound } = require('./services/errors');

const app = express();

app.disable('x-powered-by');
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'Smart CRM – Mekong Mobile (Luồng L2)',
    database: getDatabaseState(),
    time: new Date().toISOString()
  });
});

// React 18 UMD + htm được phục vụ từ node_modules để giao diện chạy offline,
// không phụ thuộc CDN và không cần bước build.
const nodeModules = path.join(__dirname, '..', 'node_modules');
app.use('/vendor', express.static(path.join(nodeModules, 'react', 'umd')));
app.use('/vendor', express.static(path.join(nodeModules, 'react-dom', 'umd')));
app.use('/vendor', express.static(path.join(nodeModules, 'htm', 'dist')));

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/devices', deviceRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/catalogs', catalogRouter);

app.use('/api', (req, res, next) => {
  next(notFound(`Không tìm thấy API ${req.method} ${req.originalUrl}.`));
});

app.use(express.static(path.join(__dirname, 'public')));

// SPA một trang: mọi đường dẫn không phải API đều trả index.html.
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
