require('dotenv').config();

const app = require('./app');
const { connectDatabase, disconnectDatabase } = require('./config/db');

const PORT = Number(process.env.PORT || 3000);

const server = app.listen(PORT, () => {
  console.log(`Smart CRM – Mekong Mobile đang chạy tại http://localhost:${PORT}`);
});

// Không chặn việc mở giao diện nếu MongoDB tạm tắt: API sẽ trả lỗi 500 có
// mã tra cứu để giao diện hiển thị đúng trạng thái LỖI.
connectDatabase()
  .then(() => {
    console.log('Đã kết nối MongoDB.');
  })
  .catch((error) => {
    console.error('Chưa kết nối được MongoDB:', error.message);
    console.error('Giao diện vẫn mở được; hãy bật MongoDB rồi khởi động lại để dùng API.');
  });

/**
 * Đóng HTTP server và kết nối MongoDB khi nhận tín hiệu dừng.
 *
 * @param {string} signal Tín hiệu nhận được.
 * @returns {Promise<void>}
 */
async function shutdown(signal) {
  console.log(`\nNhận ${signal}, đang dừng ứng dụng...`);
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
