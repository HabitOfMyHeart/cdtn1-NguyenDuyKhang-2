const { conflict, invalid, notFound } = require('./errors');
const { MAX_ATTEMPTS, duplicateField } = require('./duplicateKey');
const { isValidDate, inputFields, DEVICE_FIELDS } = require('../validators/primitives');

const SERIAL_PATTERN = /^[A-Z0-9-]{8,40}$/;
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Chuẩn hóa serial/IMEI: trim, bỏ khoảng trắng, chuyển chữ hoa (QT-03).
 *
 * @param {string} raw Serial người dùng nhập.
 * @returns {string} Serial đã chuẩn hóa.
 * @throws {import('./errors').AppError} DU_LIEU_KHONG_HOP_LE khi sai định dạng.
 */
function normalizeSerial(raw) {
  const serial = typeof raw === 'string' ? raw.trim().replace(/\s+/g, '').toUpperCase() : '';
  if (!SERIAL_PATTERN.test(serial)) {
    throw invalid('Serial/IMEI không hợp lệ.', {
      serial_no: 'Serial gồm 8–40 ký tự chữ, số hoặc dấu gạch.'
    });
  }
  return serial;
}

/**
 * Cộng số tháng theo lịch, tự kẹp ngày cuối tháng (31/01 + 1 tháng = 28/02).
 *
 * @param {Date|string} value Ngày bắt đầu.
 * @param {number} months Số tháng bảo hành.
 * @returns {Date} Ngày hết hạn.
 */
function addMonths(value, months) {
  const date = new Date(new Date(value).getTime() + VN_OFFSET_MS);
  const day = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + Number(months));
  const lastDay = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)
  ).getUTCDate();
  date.setUTCDate(Math.min(day, lastDay));
  return new Date(date.getTime() - VN_OFFSET_MS);
}

/**
 * Lấy khóa ngày theo lịch Việt Nam (YYYY-MM-DD) để so sánh bảo hành theo ngày.
 *
 * @param {Date|string} value Giá trị ngày.
 * @returns {string} Khóa ngày theo múi giờ +07:00.
 */
function vietnamDateKey(value) {
  const date = new Date(value);
  return new Date(date.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Tính ngày hết hạn bảo hành từ ngày mua và số tháng.
 *
 * @param {Date|string} purchaseDate Ngày mua.
 * @param {number} warrantyMonths Số tháng bảo hành.
 * @returns {Date} Ngày hết hạn.
 * @throws {import('./errors').AppError} DU_LIEU_KHONG_HOP_LE khi đầu vào sai.
 */
function calculateExpiryDate(purchaseDate, warrantyMonths) {
  if (!isValidDate(purchaseDate)) {
    throw invalid('Ngày mua không hợp lệ.', { purchase_date: 'Cần ngày lịch có thật.' });
  }
  const purchase = new Date(purchaseDate);
  if (Number.isNaN(purchase.getTime())) {
    throw invalid('Ngày mua không hợp lệ.', { purchase_date: 'Cần ngày hợp lệ.' });
  }
  if (!Number.isInteger(Number(warrantyMonths)) || Number(warrantyMonths) < 0) {
    throw invalid('Số tháng bảo hành không hợp lệ.', {
      warranty_months: 'Số tháng bảo hành phải là số nguyên không âm.'
    });
  }
  return addMonths(purchase, Number(warrantyMonths));
}

/**
 * Kiểm tra bảo hành theo QT-05: so sánh theo ngày, ngày hết hạn vẫn còn bảo hành.
 * Thiếu ngày mua trả null (chưa xác minh), không trả false.
 *
 * @param {object} device Thiết bị có purchase_date và warranty_months.
 * @param {Date|string} [receivedAt] Ngày tiếp nhận; mặc định hiện tại.
 * @returns {{conBaoHanh: boolean|null, ketLuanBaoHanh: string, ngayHetHan: Date|null}} Kết luận.
 * @throws {import('./errors').AppError} DU_LIEU_KHONG_HOP_LE khi ngày tiếp nhận sai.
 */
function checkWarranty(device, receivedAt = new Date()) {
  if (!isValidDate(receivedAt)) {
    throw invalid('Ngày tiếp nhận không hợp lệ.', { received_at: 'Cần ngày lịch có thật.' });
  }
  const received = new Date(receivedAt);
  if (Number.isNaN(received.getTime())) {
    throw invalid('Ngày tiếp nhận không hợp lệ.', {
      received_at: 'Cần ngày giờ hợp lệ theo ISO 8601.'
    });
  }

  if (!device || !device.purchase_date) {
    return {
      conBaoHanh: null,
      ketLuanBaoHanh: 'Chưa xác minh bảo hành',
      ngayHetHan: null
    };
  }

  const expiry = calculateExpiryDate(device.purchase_date, device.warranty_months ?? 0);
  const conBaoHanh = vietnamDateKey(received) <= vietnamDateKey(expiry);

  return {
    conBaoHanh,
    ketLuanBaoHanh: conBaoHanh ? 'Còn bảo hành' : 'Hết bảo hành',
    ngayHetHan: expiry
  };
}

/**
 * Tạo lớp nghiệp vụ thiết bị và kiểm tra bảo hành; nhận repository để test độc lập.
 *
 * @param {{deviceRepository: object, customerRepository: object, now?: () => Date}} deps Phụ thuộc.
 * @returns {object} Các hàm nghiệp vụ thiết bị.
 */
function createWarrantyCheckService({ deviceRepository, customerRepository, ticketRepository, now = () => new Date() }) {
  if (!deviceRepository || !customerRepository || !ticketRepository) {
    throw new Error('createWarrantyCheckService cần deviceRepository, customerRepository và ticketRepository.');
  }

  function assertInput(input) {
    const fields = inputFields(input, DEVICE_FIELDS);
    if (Object.keys(fields).length) throw invalid('Dữ liệu thiết bị không hợp lệ.', fields);
  }

  /**
   * Tạo thiết bị mới; kiểm tra khách hàng và serial duy nhất (QT-03).
   *
   * @param {object} input Dữ liệu thiết bị.
   * @returns {Promise<object>} Thiết bị vừa tạo kèm kết luận bảo hành.
   * @throws {import('./errors').AppError} 404, 409 hoặc 422.
   */
  async function createDevice(input = {}) {
    assertInput(input);
    const customerId = typeof input.customer_id === 'string' ? input.customer_id.trim() : '';
    if (!customerId) {
      throw invalid('Thiếu khách hàng của thiết bị.', {
        customer_id: 'Chọn khách hàng trước khi tạo thiết bị.'
      });
    }
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw notFound('Không tìm thấy khách hàng của thiết bị.', {
        customer_id: 'Khách hàng không tồn tại hoặc đã bị xóa.'
      });
    }

    const serialNo = normalizeSerial(input.serial_no);
    const existing = await deviceRepository.findBySerialIncludingDeleted(serialNo);
    if (existing) {
      // QT-03: serial/IMEI xác định duy nhất một thiết bị.
      throw conflict('TRUNG_DU_LIEU', 'Serial/IMEI đã tồn tại trong hệ thống (QT-03).', {
        serial_no: 'Hãy tra cứu thiết bị có sẵn.'
      });
    }

    const productName =
      typeof input.product_name === 'string' ? input.product_name.trim() : '';
    if (!productName || productName.length > 120) {
      throw invalid('Tên thiết bị không hợp lệ.', {
        product_name: 'Tên thiết bị là bắt buộc và không vượt quá 120 ký tự.'
      });
    }

    let purchaseDate = null;
    if (input.purchase_date !== null && input.purchase_date !== undefined && input.purchase_date !== '') {
      purchaseDate = new Date(input.purchase_date);
      if (Number.isNaN(purchaseDate.getTime())) {
        throw invalid('Ngày mua không hợp lệ.', {
          purchase_date: 'Để trống nếu chưa xác minh ngày mua (QT-05).'
        });
      }
    }

    const warrantyMonths =
      input.warranty_months === undefined || input.warranty_months === null || input.warranty_months === ''
        ? 12
        : Number(input.warranty_months);
    if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 120) {
      throw invalid('Số tháng bảo hành không hợp lệ.', {
        warranty_months: 'Số tháng phải là số nguyên từ 0 đến 120.'
      });
    }

    const data = {
      customer_id: customerId,
      product_id: input.product_id ?? null,
      product_code: input.product_code ? String(input.product_code).trim() : '',
      product_name: productName,
      serial_no: serialNo,
      purchase_date: purchaseDate,
      warranty_months: warrantyMonths,
      is_deleted: false
    };
    let device;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const deviceId = await deviceRepository.nextId();
      try {
        device = await deviceRepository.create({ ...data, device_id: deviceId });
        break;
      } catch (error) {
        if (duplicateField(error, 'serial_no')) {
          throw conflict('TRUNG_DU_LIEU', 'Serial/IMEI đã tồn tại trong hệ thống (QT-03).', { serial_no: 'Hãy tra cứu thiết bị có sẵn.' });
        }
        if (!duplicateField(error, 'device_id') || attempt === MAX_ATTEMPTS - 1) throw error;
      }
    }

    return buildWarrantyResult(device, customer);
  }

  /**
   * Tra cứu thiết bị theo serial/IMEI và trả kết luận bảo hành (QT-03, QT-05).
   *
   * @param {string} rawSerial Serial người dùng nhập.
   * @param {Date|string} [receivedAt] Ngày tiếp nhận dự kiến.
   * @returns {Promise<object>} Thiết bị, khách hàng và kết luận bảo hành.
   * @throws {import('./errors').AppError} 404 hoặc 422.
   */
  async function lookupBySerial(rawSerial, receivedAt = now()) {
    const serialNo = normalizeSerial(rawSerial);
    const device = await deviceRepository.findBySerial(serialNo);
    if (!device) {
      throw notFound('Không tìm thấy thiết bị với serial/IMEI này.', {
        serial_no: 'Có thể tạo thiết bị mới cho khách hàng.'
      });
    }
    const customer = await customerRepository.findById(device.customer_id);
    return buildWarrantyResult(device, customer, receivedAt);
  }

  /**
   * Liệt kê thiết bị chưa xóa mềm, lọc theo khách hàng hoặc từ khóa.
   *
   * @param {{customer_id?: string, q?: string}} [filters] Bộ lọc.
   * @returns {Promise<Array<object>>} Danh sách thiết bị.
   */
  async function listDevices(filters = {}) {
    return deviceRepository.findAll({
      customer_id: filters.customer_id || '',
      q: filters.q || ''
    });
  }

  /**
   * Lấy thiết bị theo mã nghiệp vụ.
   *
   * @param {string} deviceId Mã DEVxxxx.
   * @returns {Promise<object>} Thiết bị.
   * @throws {import('./errors').AppError} 404 khi không tìm thấy.
   */
  async function getDevice(deviceId) {
    const device = await deviceRepository.findById(deviceId);
    if (!device) throw notFound('Không tìm thấy thiết bị.');
    return device;
  }

  /**
   * Cập nhật thông tin thiết bị; không cho đổi khách hàng để giữ QT-03.
   *
   * @param {string} deviceId Mã DEVxxxx.
   * @param {object} input Các trường được phép sửa.
   * @returns {Promise<object>} Thiết bị sau cập nhật.
   * @throws {import('./errors').AppError} 404, 409 hoặc 422.
   */
  async function updateDevice(deviceId, input = {}) {
    assertInput(input);
    const current = await getDevice(deviceId);
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(input, 'product_name')) {
      const productName = typeof input.product_name === 'string' ? input.product_name.trim() : '';
      if (!productName || productName.length > 120) {
        throw invalid('Tên thiết bị không hợp lệ.', {
          product_name: 'Tên thiết bị là bắt buộc và không vượt quá 120 ký tự.'
        });
      }
      patch.product_name = productName;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'serial_no')) {
      const serialNo = normalizeSerial(input.serial_no);
      const duplicate = await deviceRepository.findBySerialIncludingDeleted(serialNo);
      if (duplicate && duplicate.device_id !== current.device_id) {
        throw conflict('TRUNG_DU_LIEU', 'Serial/IMEI đã thuộc thiết bị khác (QT-03).', {
          serial_no: 'Chọn serial khác.'
        });
      }
      patch.serial_no = serialNo;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'purchase_date')) {
      if (input.purchase_date === null || input.purchase_date === '') {
        patch.purchase_date = null;
      } else {
        const purchaseDate = new Date(input.purchase_date);
        if (Number.isNaN(purchaseDate.getTime())) {
          throw invalid('Ngày mua không hợp lệ.', { purchase_date: 'Cần ngày hợp lệ.' });
        }
        patch.purchase_date = purchaseDate;
      }
    }

    if (Object.prototype.hasOwnProperty.call(input, 'warranty_months')) {
      const warrantyMonths = Number(input.warranty_months);
      if (!Number.isInteger(warrantyMonths) || warrantyMonths < 0 || warrantyMonths > 120) {
        throw invalid('Số tháng bảo hành không hợp lệ.', {
          warranty_months: 'Số tháng phải là số nguyên từ 0 đến 120.'
        });
      }
      patch.warranty_months = warrantyMonths;
    }

    const updated = await deviceRepository.update(deviceId, patch);
    const customer = await customerRepository.findById(updated.customer_id);
    return buildWarrantyResult(updated, customer);
  }

  /**
   * Xóa mềm thiết bị.
   *
   * @param {string} deviceId Mã DEVxxxx.
   * @returns {Promise<{deviceId: string, deleted: boolean}>} Kết quả.
   * @throws {import('./errors').AppError} 404 khi không tìm thấy.
   */
  async function deleteDevice(deviceId) {
    await getDevice(deviceId);
    if (await ticketRepository.findByDevice(deviceId)) {
      throw conflict('TRUNG_DU_LIEU', 'Không thể xóa thiết bị đang được tham chiếu bởi phiếu.');
    }
    await deviceRepository.softDelete(deviceId);
    return { deviceId, deleted: true };
  }

  /**
   * Kiểm tra bảo hành của một thiết bị theo mã.
   *
   * @param {string} deviceId Mã DEVxxxx.
   * @param {Date|string} [receivedAt] Ngày tiếp nhận.
   * @returns {Promise<object>} Thiết bị và kết luận bảo hành.
   * @throws {import('./errors').AppError} 404 hoặc 422.
   */
  async function checkWarrantyForDevice(deviceId, receivedAt = now()) {
    const device = await getDevice(deviceId);
    const customer = await customerRepository.findById(device.customer_id);
    return buildWarrantyResult(device, customer, receivedAt);
  }

  /**
   * Gắn kết luận bảo hành vào thiết bị để route trả về một khối thống nhất.
   *
   * @param {object} device Thiết bị.
   * @param {object|null} customer Khách hàng.
   * @param {Date|string} [receivedAt] Ngày tiếp nhận.
   * @returns {object} Dữ liệu thiết bị kèm kết luận.
   */
  function buildWarrantyResult(device, customer, receivedAt = now()) {
    const warranty = checkWarranty(device, receivedAt);
    return {
      device,
      customer: customer || null,
      conBaoHanh: warranty.conBaoHanh,
      ketLuanBaoHanh: warranty.ketLuanBaoHanh,
      ngayHetHan: warranty.ngayHetHan
    };
  }

  return {
    createDevice,
    lookupBySerial,
    listDevices,
    getDevice,
    updateDevice,
    deleteDevice,
    checkWarrantyForDevice
  };
}

const deviceRepository = require('../repositories/device.repository');
const customerRepository = require('../repositories/customer.repository');
const ticketRepository = require('../repositories/ticket.repository');

module.exports = {
  createWarrantyCheckService,
  normalizeSerial,
  calculateExpiryDate,
  checkWarranty,
  ...createWarrantyCheckService({ deviceRepository, customerRepository, ticketRepository })
};
