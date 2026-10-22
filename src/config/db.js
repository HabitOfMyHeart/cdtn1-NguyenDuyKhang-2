const mongoose = require('mongoose');

const DEFAULT_URI = 'mongodb://127.0.0.1:27017/mekong_warranty';

/**
 * Mở kết nối MongoDB dùng chung cho migration, seed và Express app.
 * `bufferCommands: false` giúp API báo lỗi nhanh khi CSDL tắt thay vì treo request.
 *
 * @param {string} [uri] Chuỗi kết nối; mặc định lấy MONGODB_URI trong .env.
 * @returns {Promise<import('mongoose').Connection>} Kết nối Mongoose đang mở.
 * @throws {Error} Khi không thể kết nối trong thời gian chờ.
 */
async function connectDatabase(uri = process.env.MONGODB_URI || DEFAULT_URI) {
  mongoose.set('strictQuery', true);
  if (mongoose.connection.readyState === 1) return mongoose.connection;

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000,
    bufferCommands: false
  });
  return mongoose.connection;
}

/**
 * Đóng kết nối MongoDB để tiến trình Node kết thúc sạch.
 *
 * @returns {Promise<void>}
 * @throws {Error} Khi Mongoose không thể đóng kết nối.
 */
async function disconnectDatabase() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
}

/**
 * Trả về trạng thái kết nối hiện tại cho endpoint /health.
 *
 * @returns {'disconnected'|'connected'|'connecting'|'disconnecting'|'unknown'} Trạng thái.
 */
function getDatabaseState() {
  return (
    ['disconnected', 'connected', 'connecting', 'disconnecting'][
      mongoose.connection.readyState
    ] || 'unknown'
  );
}

module.exports = { connectDatabase, disconnectDatabase, getDatabaseState };
