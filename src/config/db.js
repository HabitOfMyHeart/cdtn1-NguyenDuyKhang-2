const mongoose = require('mongoose');
const { getConfig } = require('./index');

/** Injectable driver keeps infrastructure tests entirely independent of MongoDB. */
function createDatabase({ driver = mongoose, config } = {}) {
  let connecting;
  async function connectDatabase(uri) {
    const settings = config || getConfig();
    driver.set('strictQuery', true);
    driver.set('bufferCommands', false);
    if (driver.connection.readyState === 1) return driver.connection;
    if (!connecting) {
      connecting = Promise.resolve().then(() => driver.connect(uri || settings.mongodbUri, {
        serverSelectionTimeoutMS: settings.dbServerSelectionTimeoutMs,
        connectTimeoutMS: settings.dbConnectTimeoutMs,
        socketTimeoutMS: settings.dbSocketTimeoutMs,
        bufferCommands: false
      })).then(() => driver.connection).finally(() => { connecting = undefined; });
    }
    return connecting;
  }
  async function disconnectDatabase() {
    if (driver.connection.readyState !== 0) await driver.disconnect();
  }
  function getDatabaseState() {
    return ['disconnected', 'connected', 'connecting', 'disconnecting'][driver.connection.readyState] || 'unknown';
  }
  return { connectDatabase, disconnectDatabase, getDatabaseState };
}

module.exports = { createDatabase, ...createDatabase() };
