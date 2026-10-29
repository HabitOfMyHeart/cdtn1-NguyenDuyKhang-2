const { conflict, invalid, notFound } = require('./errors');
const { MAX_ATTEMPTS, duplicateField } = require('./duplicateKey');
const { inputFields, CUSTOMER_FIELDS } = require('../validators/primitives');

const SEGMENTS = Object.freeze(['VIP', 'THUONG', 'MOI']);
const PHONE_PATTERN = /^0\d{9}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Chuẩn hóa số điện thoại về 10 chữ số bắt đầu bằng 0 (QT-02).
 * Chấp nhận +84..., 84..., khoảng trắng, dấu chấm, dấu gạch và ngoặc.
 *
 * @param {string} raw Số điện thoại người dùng nhập.
 * @returns {string} Số đã chuẩn hóa dạng 0xxxxxxxxx.
 * @throws {import('./errors').AppError} DU_LIEU_KHONG_HOP_LE khi không đủ 10 số.
 */
function normalizePhone(raw) {
  if (typeof raw !== 'string') {
    throw invalid('Số điện thoại không hợp lệ.', {
      phone: 'Số điện thoại là bắt buộc và phải có 10 chữ số.'
    });
  }

  let phone = raw.trim().replace(/[\s.\-()]/g, '');
  if (phone.startsWith('0084')) {
    phone = `0${phone.slice(4)}`;
  } else if (phone.startsWith('+84')) {
    phone = `0${phone.slice(3)}`;
  } else if (phone.startsWith('84') && phone.length === 11) {
    phone = `0${phone.slice(2)}`;
  }

  if (!PHONE_PATTERN.test(phone)) {
    throw invalid('Số điện thoại phải gồm 10 chữ số và bắt đầu bằng 0 (QT-02).', {
      phone: 'Ví dụ hợp lệ: 0901234567, +84 90 123 4567.'
    });
  }
  return phone;
}

/**
 * Kiểm tra và chuẩn hóa họ tên khách hàng.
 *
 * @param {string} value Họ tên người dùng nhập.
 * @returns {string} Họ tên đã trim.
 * @throws {import('./errors').AppError} DU_LIEU_KHONG_HOP_LE khi rỗng hoặc quá dài.
 */
function normalizeFullName(value) {
  const fullName = typeof value === 'string' ? value.trim() : '';
  if (!fullName || fullName.length > 120) {
    throw invalid('Họ tên khách hàng không hợp lệ.', {
      full_name: 'Họ tên là bắt buộc và không vượt quá 120 ký tự.'
    });
  }
  return fullName;
}

/**
 * Tạo lớp nghiệp vụ khách hàng, nhận repository qua tham số để test độc lập.
 *
 * @param {{customerRepository: object, now?: () => Date}} deps Phụ thuộc.
 * @returns {object} Các hàm nghiệp vụ khách hàng.
 */
function createCustomerService({ customerRepository, deviceRepository, ticketRepository, now = () => new Date() }) {
  if (!customerRepository || !deviceRepository || !ticketRepository) {
    throw new Error('createCustomerService cần customerRepository, deviceRepository và ticketRepository.');
  }

  function assertInput(input) {
    const fields = inputFields(input, CUSTOMER_FIELDS);
    if (Object.keys(fields).length) throw invalid('Dữ liệu khách hàng không hợp lệ.', fields);
  }

  /**
   * Tạo hồ sơ khách hàng mới; chặn trùng số điện thoại (QT-01, QT-02).
   *
   * @param {object} input Dữ liệu khách hàng.
   * @param {string} input.full_name Họ tên.
   * @param {string} input.phone Số điện thoại thô hoặc đã chuẩn hóa.
   * @param {string} [input.email] Email.
   * @param {string} [input.address] Địa chỉ.
   * @param {'VIP'|'THUONG'|'MOI'} [input.segment] Phân khúc.
   * @returns {Promise<object>} Hồ sơ vừa tạo.
   * @throws {import('./errors').AppError} 422 dữ liệu sai, 409 trùng số điện thoại.
   */
  async function createCustomer(input = {}) {
    assertInput(input);
    const phone = normalizePhone(input.phone);
    const fullName = normalizeFullName(input.full_name);

    const existing = await customerRepository.findByPhoneIncludingDeleted(phone);
    if (existing) {
      // QT-01: số điện thoại là duy nhất; API tạo mới phải báo xung đột để
      // giao diện quay về hồ sơ có sẵn thay vì tạo bản ghi thứ hai.
      throw conflict('TRUNG_DU_LIEU', 'Số điện thoại đã tồn tại trong hệ thống (QT-01).', {
        phone: 'Hãy tra cứu hồ sơ có sẵn thay vì tạo mới.'
      });
    }

    const email = input.email ? String(input.email).trim() : null;
    if (email && !EMAIL_PATTERN.test(email)) {
      throw invalid('Email không hợp lệ.', { email: 'Email phải đúng định dạng.' });
    }

    const address = input.address ? String(input.address).trim() : '';
    if (address.length > 255) {
      throw invalid('Địa chỉ quá dài.', { address: 'Địa chỉ không vượt quá 255 ký tự.' });
    }

    const segment = input.segment || 'THUONG';
    if (!SEGMENTS.includes(segment)) {
      throw invalid('Phân khúc khách hàng không hợp lệ.', {
        segment: 'Chỉ nhận VIP, THUONG hoặc MOI.'
      });
    }

    const data = {
      full_name: fullName,
      phone,
      email,
      address,
      segment,
      created_at: input.created_at ? new Date(input.created_at) : now(),
      is_deleted: false
    };
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const customerId = await customerRepository.nextId();
      try {
        return await customerRepository.create({ ...data, customer_id: customerId });
      } catch (error) {
        if (duplicateField(error, 'phone')) {
          throw conflict('TRUNG_DU_LIEU', 'Số điện thoại đã tồn tại trong hệ thống (QT-01).', { phone: 'Hãy tra cứu hồ sơ có sẵn thay vì tạo mới.' });
        }
        if (!duplicateField(error, 'customer_id') || attempt === MAX_ATTEMPTS - 1) throw error;
      }
    }
  }

  /**
   * Tra cứu khách hàng theo số điện thoại đã chuẩn hóa (QT-01, QT-02).
   *
   * @param {string} rawPhone Số điện thoại người dùng nhập.
   * @returns {Promise<object>} Hồ sơ khách hàng.
   * @throws {import('./errors').AppError} 404 khi không tìm thấy, 422 khi số sai.
   */
  async function lookupByPhone(rawPhone) {
    const phone = normalizePhone(rawPhone);
    const customer = await customerRepository.findByPhone(phone);
    if (!customer) {
      throw notFound('Không tìm thấy khách hàng với số điện thoại này.', {
        phone: 'Có thể tạo hồ sơ khách hàng mới.'
      });
    }
    return customer;
  }

  /**
   * Liệt kê khách hàng theo từ khóa họ tên hoặc số điện thoại.
   *
   * @param {{q?: string, phone?: string}} [filters] Bộ lọc.
   * @returns {Promise<Array<object>>} Danh sách khách hàng chưa xóa mềm.
   * @throws {import('./errors').AppError} 422 khi số điện thoại lọc sai định dạng.
   */
  async function listCustomers(filters = {}) {
    if (filters.phone) {
      const customer = await lookupByPhone(filters.phone);
      return [customer];
    }
    return customerRepository.findAll({ q: filters.q || '' });
  }

  /**
   * Lấy một khách hàng theo mã nghiệp vụ.
   *
   * @param {string} customerId Mã CUSxxxx.
   * @returns {Promise<object>} Hồ sơ khách hàng.
   * @throws {import('./errors').AppError} 404 khi không tìm thấy.
   */
  async function getCustomer(customerId) {
    const customer = await customerRepository.findById(customerId);
    if (!customer) {
      throw notFound('Không tìm thấy khách hàng.');
    }
    return customer;
  }

  /**
   * Cập nhật hồ sơ khách hàng; kiểm tra lại số điện thoại duy nhất (QT-01).
   *
   * @param {string} customerId Mã CUSxxxx.
   * @param {object} input Các trường cần cập nhật.
   * @returns {Promise<object>} Hồ sơ sau cập nhật.
   * @throws {import('./errors').AppError} 404, 409 hoặc 422.
   */
  async function updateCustomer(customerId, input = {}) {
    assertInput(input);
    const current = await getCustomer(customerId);
    const patch = {};

    if (Object.prototype.hasOwnProperty.call(input, 'full_name')) {
      patch.full_name = normalizeFullName(input.full_name);
    }
    if (Object.prototype.hasOwnProperty.call(input, 'phone')) {
      const phone = normalizePhone(input.phone);
      const duplicate = await customerRepository.findByPhoneIncludingDeleted(phone);
      if (duplicate && duplicate.customer_id !== current.customer_id) {
        throw conflict('TRUNG_DU_LIEU', 'Số điện thoại đã thuộc khách hàng khác (QT-01).', {
          phone: 'Chọn số điện thoại khác hoặc tra cứu hồ sơ có sẵn.'
        });
      }
      patch.phone = phone;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'email')) {
      const email = input.email ? String(input.email).trim() : null;
      if (email && !EMAIL_PATTERN.test(email)) {
        throw invalid('Email không hợp lệ.', { email: 'Email phải đúng định dạng.' });
      }
      patch.email = email;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'address')) {
      const address = input.address ? String(input.address).trim() : '';
      if (address.length > 255) {
        throw invalid('Địa chỉ quá dài.', { address: 'Địa chỉ không vượt quá 255 ký tự.' });
      }
      patch.address = address;
    }
    if (Object.prototype.hasOwnProperty.call(input, 'segment')) {
      if (!SEGMENTS.includes(input.segment)) {
        throw invalid('Phân khúc khách hàng không hợp lệ.', {
          segment: 'Chỉ nhận VIP, THUONG hoặc MOI.'
        });
      }
      patch.segment = input.segment;
    }

    return customerRepository.update(customerId, patch);
  }

  /**
   * Xóa mềm khách hàng (không xóa vật lý).
   *
   * @param {string} customerId Mã CUSxxxx.
   * @returns {Promise<{customerId: string, deleted: boolean}>} Kết quả.
   * @throws {import('./errors').AppError} 404 khi không tìm thấy.
   */
  async function deleteCustomer(customerId) {
    await getCustomer(customerId);
    if (await ticketRepository.findByCustomer(customerId)) {
      throw conflict('TRUNG_DU_LIEU', 'Không thể xóa khách hàng đang được tham chiếu bởi phiếu.');
    }
    if (await deviceRepository.findByCustomerIncludingDeleted(customerId)) {
      throw conflict('TRUNG_DU_LIEU', 'Không thể xóa khách hàng còn thiết bị.');
    }
    await customerRepository.softDelete(customerId);
    return { customerId, deleted: true };
  }

  return {
    createCustomer,
    lookupByPhone,
    listCustomers,
    getCustomer,
    updateCustomer,
    deleteCustomer
  };
}

const customerRepository = require('../repositories/customer.repository');
const deviceRepository = require('../repositories/device.repository');
const ticketRepository = require('../repositories/ticket.repository');

module.exports = {
  createCustomerService,
  normalizePhone,
  normalizeFullName,
  ...createCustomerService({ customerRepository, deviceRepository, ticketRepository })
};
