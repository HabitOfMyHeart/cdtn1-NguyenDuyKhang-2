const http = require('node:http');
const { getConfig } = require('./config');
const { createLogger, logger: fallbackLogger } = require('./logger');

/** UI may remain available while MongoDB is down; /health reports readiness. */
async function startServer({
  config = getConfig(), logger = createLogger({ level: config.logLevel }),
  database = require('./config/db'), app,
  createHttpServer = http.createServer, processRef = process
} = {}) {
  const server = createHttpServer(app || require('./app').createApp({ database, logger }));
  server.requestTimeout = config.httpRequestTimeoutMs;
  server.headersTimeout = config.httpHeadersTimeoutMs;
  server.keepAliveTimeout = Math.min(5000, config.httpHeadersTimeoutMs);
  let shutdownPromise;
  let connectionPromise = Promise.resolve();
  let exitRequested = false;
  let forcedExitCode;

  function removeSignals() {
    processRef.removeListener('SIGINT', onSignal);
    processRef.removeListener('SIGTERM', onSignal);
  }

  function shutdown(signal = 'manual') {
    if (shutdownPromise) return shutdownPromise;
    logger.info('server.stopping', { signal });
    shutdownPromise = (async () => {
      let timer;
      let failed = false;
      const cleanup = async () => {
        const httpClosed = new Promise((resolve) => {
          try {
            server.close((error) => {
              if (error && error.code !== 'ERR_SERVER_NOT_RUNNING') failed = true;
              resolve();
            });
            server.closeIdleConnections?.();
          } catch { failed = true; resolve(); }
        });
        const dbClosed = connectionPromise.then(() => database.disconnectDatabase()).catch((error) => {
          failed = true;
          logger.error('server.shutdown_failed', { error });
        });
        await Promise.all([httpClosed, dbClosed]);
        return false;
      };
      const timedOut = await Promise.race([
        cleanup(),
        new Promise((resolve) => { timer = setTimeout(() => resolve(true), config.shutdownTimeoutMs); })
      ]);
      clearTimeout(timer);
      if (timedOut) {
        failed = true;
        try { server.closeAllConnections?.(); } catch { /* bounded best effort */ }
        // Cancel a still-connecting driver; cleanup also disconnects if it resolves later.
        Promise.resolve().then(() => database.disconnectDatabase()).catch((error) => {
          logger.error('server.shutdown_failed', { error });
        });
      }
      removeSignals();
      server.removeListener('error', onServerError);
      logger.info('server.stopped', { timedOut, exitCode: failed ? 1 : 0 });
      return { timedOut, exitCode: failed ? 1 : 0 };
    })();
    return shutdownPromise;
  }

  function requestExit(signal, forceCode) {
    if (forceCode !== undefined) forcedExitCode = forceCode;
    if (exitRequested) return;
    exitRequested = true;
    shutdown(signal).then(({ exitCode }) => processRef.exit(forcedExitCode ?? exitCode));
  }
  function onSignal(signal) {
    requestExit(signal);
  }
  function onServerError(error) {
    logger.error('server.listen_failed', { error });
    requestExit('server_error', 1);
  }

  try {
    await new Promise((resolve, reject) => {
      const onError = (error) => { server.removeListener('listening', onListening); reject(error); };
      const onListening = () => { server.removeListener('error', onError); resolve(); };
      server.once('error', onError);
      server.once('listening', onListening);
      try { server.listen(config.port); } catch (error) {
        server.removeListener('error', onError);
        server.removeListener('listening', onListening);
        reject(error);
      }
    });
  } catch (error) {
    logger.error('server.listen_failed', { error });
    throw error;
  }

  server.on('error', onServerError);
  processRef.on('SIGINT', onSignal);
  processRef.on('SIGTERM', onSignal);
  logger.info('server.listening', { port: config.port });
  connectionPromise = Promise.resolve().then(() => database.connectDatabase()).then(() => {
    logger.info('database.connected');
  }).catch((error) => {
    logger.warn('database.unavailable', { error });
  });
  return { server, shutdown, databaseReady: connectionPromise };
}

if (require.main === module) {
  startServer().catch((error) => {
    fallbackLogger.error('server.startup_failed', { error });
    process.exitCode = 1;
  });
}

module.exports = { startServer };
