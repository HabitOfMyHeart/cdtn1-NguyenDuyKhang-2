const {
  Ticket,
  TicketStatusLog,
  OPEN_TICKET_STATUSES
} = require('../models/schemas');

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
 * Tạo phiếu bảo hành mới.
 *
 * @param {object} data Dữ liệu phiếu đã kiểm tra.
 * @returns {Promise<object>} Phiếu vừa tạo dạng plain object.
 * @throws {Error} Khi validation hoặc unique index (một phiếu mở/thiết bị) thất bại.
 */
async function create(data) {
  const document = await Ticket.create(data);
  return document.toObject();
}

// Only remove the exact, unchanged document returned by an acknowledged insert.
async function removeUnchangedCreated(ticket) {
  if (!ticket._id) return false;
  const fields = ['ticket_id', 'ticket_code', 'customer_id', 'device_id', 'center_id',
    'category_id', 'issue_desc', 'accessories', 'exterior_note', 'priority',
    'priority_reason', 'status', 'is_warranty', 'received_at', 'due_date', 'closed_at', 'is_deleted'];
  const query = { _id: ticket._id };
  for (const field of fields) query[field] = ticket[field];
  const result = await Ticket.deleteOne(query);
  return result.acknowledged && result.deletedCount === 1;
}

/**
 * Liệt kê phiếu chưa xóa mềm theo bộ lọc nghiệp vụ, sắp xếp theo hạn cam kết.
 *
 * @param {{
 *   center_id?: string,
 *   status?: string,
 *   category_id?: string,
 *   priority?: string,
 *   q?: string,
 *   customerIds?: string[]
 * }} [filter] Bộ lọc.
 * @returns {Promise<Array<object>>} Danh sách phiếu.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findAll(filter = {}) {
  const query = { is_deleted: false };
  if (filter.center_id) query.center_id = filter.center_id;
  if (filter.status) query.status = filter.status;
  if (filter.category_id) query.category_id = filter.category_id;
  if (filter.priority) query.priority = filter.priority;

  const or = [];
  if (filter.q) {
    const regex = new RegExp(escapeRegex(filter.q), 'i');
    or.push({ ticket_code: regex }, { ticket_id: regex });
  }
  if (Array.isArray(filter.customerIds) && filter.customerIds.length > 0) {
    or.push({ customer_id: { $in: filter.customerIds } });
  }
  if (or.length > 0) query.$or = or;

  return Ticket.find(query).sort({ due_date: 1, ticket_code: 1 }).lean();
}

/**
 * Tìm phiếu theo mã nghiệp vụ.
 *
 * @param {string} ticketId Mã TCKxxxx.
 * @returns {Promise<object|null>} Phiếu hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findById(ticketId) {
  return Ticket.findOne({ ticket_id: ticketId, is_deleted: false }).lean();
}

/**
 * Tìm phiếu chưa đóng của thiết bị (QT-03).
 *
 * @param {string} deviceId Mã DEVxxxx.
 * @returns {Promise<object|null>} Phiếu đang mở hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findOpenByDevice(deviceId) {
  return Ticket.findOne({
    device_id: deviceId,
    is_deleted: false,
    status: { $in: OPEN_TICKET_STATUSES }
  }).lean();
}

function findByCustomer(customerId) {
  return Ticket.findOne({ customer_id: customerId, is_deleted: false }).lean();
}

function findByDevice(deviceId) {
  return Ticket.findOne({ device_id: deviceId, is_deleted: false }).lean();
}

/**
 * Cập nhật phiếu theo mã nghiệp vụ.
 *
 * @param {string} ticketId Mã TCKxxxx.
 * @param {object} patch Các trường cần cập nhật.
 * @returns {Promise<object|null>} Phiếu sau cập nhật.
 * @throws {Error} Khi validation hoặc unique index thất bại.
 */
function update(ticketId, patch) {
  return Ticket.findOneAndUpdate(
    { ticket_id: ticketId, is_deleted: false, status: 'MOI' },
    { $set: patch },
    { new: true, runValidators: true }
  ).lean();
}

/**
 * Xóa mềm phiếu, giữ nguyên dữ liệu lịch sử (QT-13).
 *
 * @param {string} ticketId Mã TCKxxxx.
 * @returns {Promise<object|null>} Phiếu đã đánh dấu xóa.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function softDelete(ticketId) {
  return Ticket.findOneAndUpdate(
    { ticket_id: ticketId, is_deleted: false, status: 'MOI' },
    { $set: { is_deleted: true } },
    { new: true }
  ).lean();
}

/**
 * Sinh mã phiếu kế tiếp dạng TCKxxxx.
 *
 * @returns {Promise<string>} Mã mới.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
async function nextId() {
  const rows = await Ticket.find({ ticket_id: /^TCK\d+$/ }).select('ticket_id').lean();
  const max = rows.reduce(
    (acc, row) => Math.max(acc, Number.parseInt(row.ticket_id.slice(3), 10) || 0),
    0
  );
  return `TCK${String(max + 1).padStart(4, '0')}`;
}

/**
 * Sinh mã phiếu BH-xxxxxx/năm theo số thứ tự lớn nhất của năm.
 *
 * @param {number} year Năm theo lịch Việt Nam.
 * @returns {Promise<string>} Mã phiếu mới.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
async function nextTicketCode(year) {
  const rows = await Ticket.find({
    ticket_code: new RegExp(`^BH-\\d{6}/${year}$`)
  })
    .select('ticket_code')
    .lean();
  const max = rows.reduce((acc, row) => {
    const match = /^BH-(\d{6})\//.exec(row.ticket_code);
    return match ? Math.max(acc, Number.parseInt(match[1], 10)) : acc;
  }, 0);
  return `BH-${String(max + 1).padStart(6, '0')}/${year}`;
}

/**
 * Thêm một bản ghi lịch sử trạng thái (QT-06).
 *
 * @param {object} data Dữ liệu log.
 * @returns {Promise<object>} Log vừa tạo dạng plain object.
 * @throws {Error} Khi validation hoặc unique index thất bại.
 */
async function addStatusLog(data) {
  const document = await TicketStatusLog.create(data);
  return document.toObject();
}

/**
 * Lấy lịch sử trạng thái của phiếu theo thứ tự thời gian.
 *
 * @param {string} ticketId Mã TCKxxxx.
 * @returns {Promise<Array<object>>} Danh sách log.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function listStatusLogs(ticketId) {
  return TicketStatusLog.find({ ticket_id: ticketId })
    .sort({ changed_at: 1, log_id: 1 })
    .lean();
}

/**
 * Sinh mã log kế tiếp dạng LOG000001.
 *
 * @returns {Promise<string>} Mã log mới.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
async function nextLogId() {
  const rows = await TicketStatusLog.find({ log_id: /^LOG\d+$/ }).select('log_id').lean();
  const max = rows.reduce(
    (acc, row) => Math.max(acc, Number.parseInt(row.log_id.slice(3), 10) || 0),
    0
  );
  return `LOG${String(max + 1).padStart(6, '0')}`;
}

module.exports = {
  create,
  removeUnchangedCreated,
  findAll,
  findById,
  findOpenByDevice,
  findByCustomer,
  findByDevice,
  update,
  softDelete,
  nextId,
  nextTicketCode,
  addStatusLog,
  listStatusLogs,
  nextLogId
};
