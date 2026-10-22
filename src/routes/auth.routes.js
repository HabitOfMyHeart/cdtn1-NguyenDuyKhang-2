const express = require('express');
const { signAccessToken, requireAuth } = require('../middlewares/auth.middleware');
const { asyncHandler } = require('../middlewares/error.middleware');
const { unauthorized } = require('../services/errors');
const { validateLogin, assertValid } = require('../validators/ticket.validator');

const router = express.Router();

/**
 * Danh sách tài khoản demo, đọc từ biến môi trường để không hard-code mật khẩu thật.
 *
 * @returns {Array<{username: string, password: string, fullName: string, role: string, center_id: string}>} Tài khoản demo.
 */
function getDemoUsers() {
  return [
    {
      username: process.env.DEMO_STAFF_USERNAME || 'nhanvien',
      password: process.env.DEMO_STAFF_PASSWORD || 'nhanvien123',
      fullName: process.env.DEMO_STAFF_NAME || 'Nguyễn Duy Khang',
      role: 'NHAN_VIEN',
      center_id: process.env.DEMO_STAFF_CENTER || '1'
    },
    {
      username: process.env.DEMO_MANAGER_USERNAME || 'quanly',
      password: process.env.DEMO_MANAGER_PASSWORD || 'quanly123',
      fullName: process.env.DEMO_MANAGER_NAME || 'Quản lý trung tâm',
      role: 'QUAN_LY',
      center_id: process.env.DEMO_MANAGER_CENTER || '1'
    }
  ];
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
