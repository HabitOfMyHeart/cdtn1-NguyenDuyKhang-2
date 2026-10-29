const express = require('express');
const { signAccessToken, requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { unauthorized } = require('../services/errors');
const { validateLogin, assertValid } = require('../validators/ticket.validator');
const { getConfig } = require('../config');

const router = express.Router();

/**
 * Danh sách tài khoản demo, đọc từ biến môi trường để không hard-code mật khẩu thật.
 *
 * @returns {Array<{username: string, password: string, fullName: string, role: string, center_id: string}>} Tài khoản demo.
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
    const user = getDemoUsers().find(
      (candidate) => candidate.username === username && candidate.password === password
    );

    if (!user) {
      // 401 dùng đúng mã CHUA_DANG_NHAP theo hợp đồng lỗi thống nhất.
      throw unauthorized('Tên đăng nhập hoặc mật khẩu không đúng.');
    }

    res.json({
      data: {
        token: signAccessToken(user),
        user: toPublicUser(user)
      }
    });
  })
);

router.get('/me', requireAuth, (req, res) => {
  res.json({ data: req.user });
});

module.exports = router;
