const { Device } = require('../models/schemas');

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
 * Tạo thiết bị mới trong collection device.
 *
 * @param {object} data Dữ liệu đã chuẩn hóa.
 * @returns {Promise<object>} Bản ghi vừa tạo dạng plain object.
 * @throws {Error} Khi validation hoặc unique index thất bại.
 */
async function create(data) {
  const document = await Device.create(data);
  return document.toObject();
}

/**
 * Liệt kê thiết bị chưa xóa mềm theo khách hàng hoặc từ khóa.
 *
 * @param {{customer_id?: string, q?: string}} [filters] Bộ lọc.
 * @returns {Promise<Array<object>>} Danh sách thiết bị.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findAll({ customer_id = '', q = '' } = {}) {
  const query = { is_deleted: false };
  if (customer_id) query.customer_id = customer_id;
  if (q) {
    const regex = new RegExp(escapeRegex(q), 'i');
    query.$or = [{ device_id: regex }, { serial_no: regex }, { product_name: regex }];
  }
  return Device.find(query).sort({ device_id: 1 }).lean();
}

/**
 * Tìm thiết bị theo mã nghiệp vụ.
 *
 * @param {string} deviceId Mã DEVxxxx.
 * @returns {Promise<object|null>} Thiết bị hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findById(deviceId) {
  return Device.findOne({ device_id: deviceId, is_deleted: false }).lean();
}

/**
 * Tìm thiết bị theo serial/IMEI duy nhất (QT-03).
 *
 * @param {string} serialNo Serial đã chuẩn hóa.
 * @returns {Promise<object|null>} Thiết bị hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findBySerial(serialNo) {
  return Device.findOne({ serial_no: serialNo, is_deleted: false }).lean();
}

function findBySerialIncludingDeleted(serialNo) {
  return Device.findOne({ serial_no: serialNo }).lean();
}

function findByCustomerIncludingDeleted(customerId) {
  return Device.findOne({ customer_id: customerId }).lean();
}

/**
 * Cập nhật thiết bị theo mã nghiệp vụ.
 *
 * @param {string} deviceId Mã DEVxxxx.
 * @param {object} patch Các trường cần cập nhật.
 * @returns {Promise<object|null>} Bản ghi sau cập nhật.
 * @throws {Error} Khi validation hoặc unique index thất bại.
 */
function update(deviceId, patch) {
  return Device.findOneAndUpdate(
    { device_id: deviceId, is_deleted: false },
    { $set: patch },
    { new: true, runValidators: true }
  ).lean();
}

/**
 * Xóa mềm thiết bị (QT-13).
 *
 * @param {string} deviceId Mã DEVxxxx.
 * @returns {Promise<object|null>} Bản ghi đã đánh dấu xóa.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function softDelete(deviceId) {
  return Device.findOneAndUpdate(
    { device_id: deviceId, is_deleted: false },
    { $set: { is_deleted: true } },
    { new: true }
  ).lean();
}

/**
 * Sinh mã thiết bị kế tiếp dạng DEVxxxx.
 *
 * @returns {Promise<string>} Mã mới.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
async function nextId() {
  const rows = await Device.find({ device_id: /^DEV\d+$/ }).select('device_id').lean();
  const max = rows.reduce(
    (acc, row) => Math.max(acc, Number.parseInt(row.device_id.slice(3), 10) || 0),
    0
  );
  return `DEV${String(max + 1).padStart(4, '0')}`;
}

module.exports = {
  create,
  findAll,
  findById,
  findBySerial,
  findBySerialIncludingDeleted,
  findByCustomerIncludingDeleted,
  update,
  softDelete,
  nextId
};
