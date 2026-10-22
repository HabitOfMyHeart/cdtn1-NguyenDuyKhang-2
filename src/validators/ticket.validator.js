const { invalid } = require('../services/errors');
const { normalizePhone } = require('../services/customer.service');
const { normalizeSerial } = require('../services/warrantyCheck.service');

const PRIORITIES = ['CAO', 'TRUNG_BINH', 'THAP'];
const STATUSES = ['MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT', 'DA_DONG'];
const ACCESSORIES = ['SAC', 'TAI_NGHE', 'HOP', 'KHAC'];
const SEGMENTS = ['VIP', 'THUONG', 'MOI'];
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Kiểm tra một giá trị có phải ngày hợp lệ.
 *
 * @param {unknown} value Giá trị cần kiểm tra.
 * @returns {boolean} true nếu chuyển được sang Date hợp lệ.
 */
function isValidDate(value) {
  return value !== null && value !== undefined && value !== '' && !Number.isNaN(new Date(value).getTime());
}

/**
 * Kiểm tra dữ liệu tạo phiếu tại ranh giới trước khi vào service (Buổi 9).
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateCreateTicket(body = {}) {
  const fields = {};

  if (!String(body.customer_id || '').trim()) fields.customer_id = 'Chọn khách hàng.';
  if (!String(body.device_id || '').trim()) fields.device_id = 'Chọn thiết bị.';
  if (!String(body.center_id || '').trim()) fields.center_id = 'Chọn trung tâm tiếp nhận.';
  if (!String(body.category_id || '').trim()) fields.category_id = 'Chọn nhóm sự cố.';

  const issueDesc = String(body.issue_desc || '').trim();
  if (issueDesc.length < 10) {
    fields.issue_desc = 'Mô tả lỗi phải có ít nhất 10 ký tự.';
  } else if (issueDesc.length > 2000) {
    fields.issue_desc = 'Mô tả lỗi không vượt quá 2000 ký tự.';
  }

  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    fields.priority = 'Mức ưu tiên chỉ nhận CAO, TRUNG_BINH hoặc THAP.';
  }
  if (body.priority_reason !== undefined && String(body.priority_reason).length > 300) {
    fields.priority_reason = 'Lý do đổi ưu tiên không vượt quá 300 ký tự.';
  }
  if (body.accessories !== undefined) {
    if (!Array.isArray(body.accessories)) {
      fields.accessories = 'Phụ kiện phải là một mảng.';
    } else if (body.accessories.some((item) => !ACCESSORIES.includes(item))) {
      fields.accessories = 'Chỉ nhận SAC, TAI_NGHE, HOP hoặc KHAC.';
    }
  }
  if (body.exterior_note !== undefined && String(body.exterior_note).length > 500) {
    fields.exterior_note = 'Tình trạng ngoại quan không vượt quá 500 ký tự.';
  }
  if (body.received_at !== undefined && !isValidDate(body.received_at)) {
    fields.received_at = 'Cần ngày giờ hợp lệ theo ISO 8601.';
  }

  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra dữ liệu cập nhật phiếu tại ranh giới.
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateUpdateTicket(body = {}) {
  const fields = {};
  if (body.issue_desc !== undefined) {
    const issueDesc = String(body.issue_desc || '').trim();
    if (issueDesc.length < 10 || issueDesc.length > 2000) {
      fields.issue_desc = 'Mô tả lỗi phải có từ 10 đến 2000 ký tự.';
    }
  }
  if (body.priority !== undefined && !PRIORITIES.includes(body.priority)) {
    fields.priority = 'Mức ưu tiên chỉ nhận CAO, TRUNG_BINH hoặc THAP.';
  }
  if (body.priority_reason !== undefined && String(body.priority_reason).length > 300) {
    fields.priority_reason = 'Lý do đổi ưu tiên không vượt quá 300 ký tự.';
  }
  if (body.accessories !== undefined) {
    if (!Array.isArray(body.accessories)) {
      fields.accessories = 'Phụ kiện phải là một mảng.';
    } else if (body.accessories.some((item) => !ACCESSORIES.includes(item))) {
      fields.accessories = 'Chỉ nhận SAC, TAI_NGHE, HOP hoặc KHAC.';
    }
  }
  if (body.exterior_note !== undefined && String(body.exterior_note).length > 500) {
    fields.exterior_note = 'Tình trạng ngoại quan không vượt quá 500 ký tự.';
  }
  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra dữ liệu tạo khách hàng tại ranh giới (QT-01, QT-02).
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateCreateCustomer(body = {}) {
  const fields = {};
  const fullName = String(body.full_name || '').trim();
  if (!fullName || fullName.length > 120) {
    fields.full_name = 'Họ tên là bắt buộc và không vượt quá 120 ký tự.';
  }

  try {
    normalizePhone(body.phone);
  } catch (error) {
    fields.phone = error.fields?.phone || 'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0.';
  }

  if (body.email) {
    if (!EMAIL_PATTERN.test(String(body.email).trim())) {
      fields.email = 'Email phải đúng định dạng.';
    }
  }
  if (body.address && String(body.address).length > 255) {
    fields.address = 'Địa chỉ không vượt quá 255 ký tự.';
  }
  if (body.segment !== undefined && !SEGMENTS.includes(body.segment)) {
    fields.segment = 'Chỉ nhận VIP, THUONG hoặc MOI.';
  }

  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra dữ liệu cập nhật khách hàng tại ranh giới.
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateUpdateCustomer(body = {}) {
  const fields = {};
  if (body.full_name !== undefined) {
    const fullName = String(body.full_name || '').trim();
    if (!fullName || fullName.length > 120) {
      fields.full_name = 'Họ tên là bắt buộc và không vượt quá 120 ký tự.';
    }
  }
  if (body.phone !== undefined) {
    try {
      normalizePhone(body.phone);
    } catch (error) {
      fields.phone = error.fields?.phone || 'Số điện thoại phải gồm 10 chữ số bắt đầu bằng 0.';
    }
  }
  if (body.email) {
    if (!EMAIL_PATTERN.test(String(body.email).trim())) {
      fields.email = 'Email phải đúng định dạng.';
    }
  }
  if (body.address !== undefined && String(body.address).length > 255) {
    fields.address = 'Địa chỉ không vượt quá 255 ký tự.';
  }
  if (body.segment !== undefined && !SEGMENTS.includes(body.segment)) {
    fields.segment = 'Chỉ nhận VIP, THUONG hoặc MOI.';
  }
  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra dữ liệu tạo thiết bị tại ranh giới (QT-03, QT-05).
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateCreateDevice(body = {}) {
  const fields = {};
  if (!String(body.customer_id || '').trim()) fields.customer_id = 'Chọn khách hàng.';

  const productName = String(body.product_name || '').trim();
  if (!productName || productName.length > 120) {
    fields.product_name = 'Tên thiết bị là bắt buộc và không vượt quá 120 ký tự.';
  }

  try {
    normalizeSerial(body.serial_no);
  } catch (error) {
    fields.serial_no = error.fields?.serial_no || 'Serial gồm 8–40 ký tự chữ, số hoặc dấu gạch.';
  }

  if (body.warranty_months !== undefined && body.warranty_months !== null && body.warranty_months !== '') {
    const months = Number(body.warranty_months);
    if (!Number.isInteger(months) || months < 0 || months > 120) {
      fields.warranty_months = 'Số tháng phải là số nguyên từ 0 đến 120.';
    }
  }
  if (body.purchase_date !== undefined && body.purchase_date !== null && body.purchase_date !== '') {
    if (!isValidDate(body.purchase_date)) {
      fields.purchase_date = 'Cần ngày hợp lệ hoặc để trống nếu chưa xác minh (QT-05).';
    }
  }

  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra dữ liệu cập nhật thiết bị tại ranh giới.
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateUpdateDevice(body = {}) {
  const fields = {};
  if (body.product_name !== undefined) {
    const productName = String(body.product_name || '').trim();
    if (!productName || productName.length > 120) {
      fields.product_name = 'Tên thiết bị là bắt buộc và không vượt quá 120 ký tự.';
    }
  }
  if (body.serial_no !== undefined) {
    try {
      normalizeSerial(body.serial_no);
    } catch (error) {
      fields.serial_no = error.fields?.serial_no || 'Serial gồm 8–40 ký tự chữ, số hoặc dấu gạch.';
    }
  }
  if (body.warranty_months !== undefined) {
    const months = Number(body.warranty_months);
    if (!Number.isInteger(months) || months < 0 || months > 120) {
      fields.warranty_months = 'Số tháng phải là số nguyên từ 0 đến 120.';
    }
  }
  if (body.purchase_date !== undefined && body.purchase_date !== null && body.purchase_date !== '') {
    if (!isValidDate(body.purchase_date)) {
      fields.purchase_date = 'Cần ngày hợp lệ hoặc null nếu chưa xác minh (QT-05).';
    }
  }
  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra yêu cầu chuyển trạng thái tại ranh giới (QT-06).
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateStatusChange(body = {}) {
  const fields = {};
  const toStatus = body.to_status || body.status;
  if (!STATUSES.includes(toStatus)) {
    fields.to_status = `Chỉ nhận ${STATUSES.join(', ')}.`;
  }
  if (body.note !== undefined && String(body.note).length > 300) {
    fields.note = 'Ghi chú không vượt quá 300 ký tự.';
  }
  if (body.changed_at !== undefined && !isValidDate(body.changed_at)) {
    fields.changed_at = 'Cần ngày giờ hợp lệ theo ISO 8601.';
  }
  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra dữ liệu đăng nhập.
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validateLogin(body = {}) {
  const fields = {};
  if (!String(body.username || '').trim()) fields.username = 'Nhập tên đăng nhập.';
  if (!String(body.password || '').trim()) fields.password = 'Nhập mật khẩu.';
  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Kiểm tra yêu cầu xem trước hạn cam kết.
 *
 * @param {object} body Body từ HTTP request.
 * @returns {{valid: boolean, fields: Record<string,string>}} Kết quả kiểm tra.
 */
function validatePreview(body = {}) {
  const fields = {};
  if (!PRIORITIES.includes(body.priority)) {
    fields.priority = 'Mức ưu tiên chỉ nhận CAO, TRUNG_BINH hoặc THAP.';
  }
  if (body.received_at !== undefined && !isValidDate(body.received_at)) {
    fields.received_at = 'Cần ngày giờ hợp lệ theo ISO 8601.';
  }
  return { valid: Object.keys(fields).length === 0, fields };
}

/**
 * Ném lỗi 422 thống nhất nếu kết quả kiểm tra không hợp lệ.
 *
 * @param {{valid: boolean, fields: Record<string,string>}} result Kết quả validator.
 * @returns {void}
 * @throws {import('../services/errors').AppError} DU_LIEU_KHONG_HOP_LE kèm fields.
 */
function assertValid(result) {
  if (!result.valid) {
    throw invalid('Dữ liệu không hợp lệ. Vui lòng kiểm tra các trường được đánh dấu.', result.fields);
  }
}

module.exports = {
  isValidDate,
  validateCreateTicket,
  validateUpdateTicket,
  validateCreateCustomer,
  validateUpdateCustomer,
  validateCreateDevice,
  validateUpdateDevice,
  validateStatusChange,
  validateLogin,
  validatePreview,
  assertValid,
  PRIORITIES,
  STATUSES,
  ACCESSORIES,
  SEGMENTS
};
