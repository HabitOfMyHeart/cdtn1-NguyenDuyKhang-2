const express = require('express');
const bcrypt = require('bcryptjs');
const { signAccessToken, requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { unauthorized } = require('../services/errors');
const { validateLogin, assertValid } = require('../validators/ticket.validator');
const { getConfig } = require('../config');

const router = express.Router();

// Hash giả cố định để nhánh "không tìm thấy user" vẫn tốn thời gian tương đương
// bcrypt.compare, giảm khả năng dò tên đăng nhập qua thời gian phản hồi.
const DUMMY_HASH = '$2b$10$rKiLnQadUqQWTYaiqRLZtO8FOlklbWldzgYsIcnh1EYKEk8qgz39i';

/**
 * So khớp mật khẩu bằng bcrypt. Nhánh không tìm thấy tài khoản vẫn so với hash
 * giả để thời gian phản hồi không tiết lộ tên đăng nhập có tồn tại hay không.
 *
 * @param {object|null} user Tài khoản demo.
 * @param {string} candidate Mật khẩu người dùng nhập.
 * @returns {Promise<boolean>} Đúng hay sai.
 */
async function verifyPassword(user, candidate) {
  if (!user) {
    await bcrypt.compare(candidate, DUMMY_HASH);
    return false;
  }
  return bcrypt.compare(candidate, user.passwordHash);
}

/**
 * Danh sách tài khoản demo, đọc từ biến môi trường để không hard-code mật khẩu thật.
 *
 * @returns {Array<{username: string, passwordHash: string, fullName: string, role: string, center_id: string}>} Tài khoản demo.
 */
function getDemoUsers() {
  return [getConfig().demoStaff];
}

/**
 * Chuyển tài khoản nội bộ sang dữ liệu an toàn để trả về client.
 *
 * @param {object} user Tài khoản demo.
 * @returns {{username: string, fullName: string, role: string, center_id: string}} Người dùng công khai.
 */
function toPublicUser(user) {
  return {
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    center_id: user.center_id
  };
}

router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const validation = validateLogin(req.body);
    assertValid(validation);

    const username = String(req.body.username || '').trim();
    const password = String(req.body.password || '');
    const candidate = getDemoUsers().find((user) => user.username === username);
    const authenticated = await verifyPassword(candidate, password);

    if (!candidate || !authenticated) {
      // 401 dùng đúng mã CHUA_DANG_NHAP theo hợp đồng lỗi thống nhất.
      throw unauthorized('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    res.json({
      data: {
        token: signAccessToken(candidate),
        user: toPublicUser(candidate)
      }
    });
  })
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user });
});

module.exports = router;
