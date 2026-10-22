const { Customer } = require('../models/schemas');

/**
 * Thoát ký tự đặc biệt để từ khóa tìm kiếm không bị hiểu là regex.
 *
 * @param {string} value Chuỗi người dùng nhập.
 * @returns {string} Chuỗi an toàn cho RegExp.
 */
function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Tạo khách hàng mới trong collection customer.
 *
 * @param {object} data Dữ liệu đã chuẩn hóa.
 * @returns {Promise<object>} Bản ghi vừa tạo dạng plain object.
 * @throws {Error} Khi Mongoose validation hoặc unique index thất bại.
 */
async function create(data) {
  const document = await Customer.create(data);
  return document.toObject();
}

/**
 * Liệt kê khách hàng chưa xóa mềm, lọc theo từ khóa.
 *
 * @param {{q?: string}} [filters] Bộ lọc.
 * @returns {Promise<Array<object>>} Danh sách khách hàng.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findAll({ q = '' } = {}) {
  const query = { is_deleted: false };
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    query.$or = [{ customer_id: regex }, { full_name: regex }, { phone: regex }];
  }
  return Customer.find(query).sort({ customer_id: 1 }).lean();
}

/**
 * Tìm khách hàng theo mã nghiệp vụ.
 *
 * @param {string} customerId Mã CUSxxxx.
 * @returns {Promise<object|null>} Khách hàng hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findById(customerId) {
  return Customer.findOne({ customer_id: customerId, is_deleted: false }).lean();
}

/**
 * Tìm khách hàng theo số điện thoại đã chuẩn hóa (QT-01).
 *
 * @param {string} phone Số 10 chữ số.
 * @returns {Promise<object|null>} Khách hàng hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findByPhone(phone) {
  return Customer.findOne({ phone, is_deleted: false }).lean();
}

/**
 * Cập nhật khách hàng theo mã nghiệp vụ.
 *
 * @param {string} customerId Mã CUSxxxx.
 * @param {object} patch Các trường cần cập nhật.
 * @returns {Promise<object|null>} Bản ghi sau cập nhật.
 * @throws {Error} Khi validation hoặc unique index thất bại.
 */
function update(customerId, patch) {
  return Customer.findOneAndUpdate(
    { customer_id: customerId, is_deleted: false },
    { $set: patch },
    { new: true, runValidators: true }
  ).lean();
}

/**
 * Xóa mềm khách hàng (QT-13).
 *
 * @param {string} customerId Mã CUSxxxx.
 * @returns {Promise<object|null>} Bản ghi đã đánh dấu xóa.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function softDelete(customerId) {
  return Customer.findOneAndUpdate(
    { customer_id: customerId, is_deleted: false },
    { $set: { is_deleted: true } },
    { new: true }
  ).lean();
}

/**
 * Sinh mã khách hàng kế tiếp dạng CUSxxxx.
 *
 * @returns {Promise<string>} Mã mới.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
async function nextId() {
  const rows = await Customer.find({ customer_id: /^CUS\d+$/ })
    .select('customer_id')
    .lean();
  const max = rows.reduce(
    (acc, row) => Math.max(acc, Number.parseInt(row.customer_id.slice(3), 10) || 0),
    0
  );
  return `CUS${String(max + 1).padStart(4, '0')}`;
}

module.exports = {
  create,
  findAll,
  findById,
  findByPhone,
  update,
  softDelete,
  nextId
};
