const { conflict, forbidden, invalid, notFound } = require('./errors');
const { calculateDueDate, getSlaHours } = require('./slaCalculator.service');
const { checkWarranty } = require('./warrantyCheck.service');
const { toTicketView, toStatusLogView, toVietnamIso } = require('./ticket.contract');
const { MAX_ATTEMPTS, duplicateField } = require('./duplicateKey');
const { inputFields, TICKET_FIELDS } = require('../validators/primitives');

const PRIORITIES = Object.freeze(['CAO', 'TRUNG_BINH', 'THAP']);
const ACCESSORIES = Object.freeze(['SAC', 'TAI_NGHE', 'HOP', 'KHAC']);
const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * Lấy năm theo lịch Việt Nam để sinh mã phiếu BH-xxxxxx/năm.
 *
 * @param {Date} date Thời điểm tiếp nhận.
 * @returns {number} Năm theo múi giờ +07:00.
 */
function vietnamYear(date) {
  return new Date(date.getTime() + VN_OFFSET_MS).getUTCFullYear();
}

/**
 * Tạo lớp nghiệp vụ phiếu bảo hành, nhận repository để chạy test không cần MongoDB.
 *
 * @param {{
 *   ticketRepository: object,
 *   customerRepository: object,
 *   deviceRepository: object,
 *   catalogRepository: object,
 *   now?: () => Date
 * }} deps Phụ thuộc.
 * @returns {object} Các hàm nghiệp vụ phiếu bảo hành.
 */
function createTicketService({
  ticketRepository,
  customerRepository,
  deviceRepository,
  catalogRepository,
  now = () => new Date()
}) {
  if (!ticketRepository || !customerRepository || !deviceRepository || !catalogRepository) {
    throw new Error(
      'createTicketService cần ticketRepository, customerRepository, deviceRepository, catalogRepository.'
    );
  }

  /**
   * Chặn nhân viên thao tác phiếu ngoài trung tâm của mình (QT-14).
   *
   * @param {object} ticket Phiếu cần kiểm tra.
   * @param {{role?: string, center_id?: string}|null} actor Người dùng đang đăng nhập.
   * @returns {void}
   * @throws {import('./errors').AppError} KHONG_DU_QUYEN khi khác trung tâm.
   */
  function assertCenterAccess(ticket, actor) {
    assertActor(actor);
    if (ticket.center_id !== actor.center_id) {
      throw forbidden('Bạn chỉ được xem và thao tác phiếu thuộc trung tâm của mình (QT-14).');
    }
  }

  function assertActor(actor) {
    if (!actor || actor.role !== 'NHAN_VIEN' || typeof actor.center_id !== 'string' || !actor.center_id.trim() || typeof actor.username !== 'string' || !actor.username.trim()) {
      throw forbidden('Cần nhân viên có tài khoản và trung tâm hợp lệ.');
    }
  }

  function assertIntakeTicket(ticket) {
    if (ticket.status !== 'MOI') {
      throw conflict('PHIEU_CHI_DOC', 'Phiếu sau bước tiếp nhận chỉ được tra cứu; không thể sửa hoặc xóa trong luồng L2.');
    }
  }

  function assertInput(input) {
    const fields = inputFields(input, TICKET_FIELDS);
    if (Object.keys(fields).length) throw invalid('Dữ liệu tiếp nhận không hợp lệ.', fields);
  }

  function integrityError(message, cause, ticketId, compensationError) {
    const error = new Error(message, { cause });
    error.code = 'LOI_TOAN_VEN_PHIEU';
    error.ticketId = ticketId;
    if (compensationError) error.compensationError = compensationError;
    return error;
  }

  /**
   * Gắn các quan hệ customer, device, category, center vào phiếu.
   *
   * @param {object} ticket Phiếu dạng phẳng.
   * @returns {Promise<object>} Phiếu đã gắn quan hệ.
   */
  async function attachRelations(ticket) {
    const [customer, device, category, center] = await Promise.all([
      customerRepository.findById(ticket.customer_id),
      deviceRepository.findById(ticket.device_id),
      catalogRepository.findCategoryById(ticket.category_id),
      catalogRepository.findCenterById(ticket.center_id)
    ]);
    return { ...ticket, customer, device, category, center };
  }

  /**
   * Dựng phản hồi chi tiết gồm hợp đồng 14 khóa, lịch sử trạng thái và bước kế tiếp.
   *
   * Các trường mô tả lỗi/phụ kiện/ngoại quan nằm NGOÀI object `ticket` để giữ đúng
   * hợp đồng 14 khóa của toTicketView; giao diện chi tiết đọc chúng từ envelope.
   *
   * @param {object} ticket Phiếu dạng phẳng.
   * @returns {Promise<{
   *   ticket: object,
   *   moTaLoi: string,
   *   phuKien: string[],
   *   ngoaiQuan: string,
   *   lyDoUuTien: string,
   *   lichSuTrangThai: Array<object>,
   *   trangThaiKeTiep: string[]
   * }>} Chi tiết.
   * @throws {import('./errors').AppError} KHONG_TIM_THAY khi phiếu rỗng.
   */
  async function buildDetail(ticket) {
    const withRelations = await attachRelations(ticket);
    const logs = await ticketRepository.listStatusLogs(ticket.ticket_id);
    return {
      ticket: toTicketView(withRelations),
      moTaLoi: ticket.issue_desc || '',
      phuKien: Array.isArray(ticket.accessories) ? ticket.accessories : [],
      ngoaiQuan: ticket.exterior_note || '',
      lyDoUuTien: ticket.priority_reason || '',
      lichSuTrangThai: logs.map(toStatusLogView),
      trangThaiKeTiep: []
    };
  }

  /**
   * Tạo phiếu bảo hành mới ở trạng thái MOI, sinh mã, tính hạn cam kết và ghi log (FR4, FR6, QT-04, QT-06).
   *
   * @param {object} input Dữ liệu tiếp nhận.
   * @param {{username?: string, role?: string, center_id?: string}|null} [actor] Người tiếp nhận.
   * @returns {Promise<{ticket: object, lichSuTrangThai: Array<object>, trangThaiKeTiep: string[]}>} Phiếu vừa tạo.
   * @throws {import('./errors').AppError} 422 dữ liệu sai, 404 thiếu tham chiếu, 409 phiếu đang mở, 403 sai trung tâm.
   */
  async function createTicket(input = {}, actor = null) {
    assertActor(actor);
    assertInput(input);
    const fields = {};
    const customerId = String(input.customer_id || '').trim();
    const deviceId = String(input.device_id || '').trim();
    const centerId = String(input.center_id || '').trim();
    const categoryId = String(input.category_id || '').trim();
    const issueDesc = String(input.issue_desc || '').trim();

    if (!customerId) fields.customer_id = 'Chọn khách hàng.';
    if (!deviceId) fields.device_id = 'Chọn thiết bị.';
    if (!centerId) fields.center_id = 'Chọn trung tâm tiếp nhận.';
    if (!categoryId) fields.category_id = 'Chọn nhóm sự cố.';
    if (issueDesc.length < 10) {
      fields.issue_desc = 'Mô tả lỗi phải có ít nhất 10 ký tự.';
    } else if (issueDesc.length > 2000) {
      fields.issue_desc = 'Mô tả lỗi không vượt quá 2000 ký tự.';
    }
    if (input.priority && !PRIORITIES.includes(input.priority)) {
      fields.priority = 'Mức ưu tiên chỉ nhận CAO, TRUNG_BINH hoặc THAP.';
    }
    if (Object.keys(fields).length > 0) {
      throw invalid('Dữ liệu tiếp nhận phiếu không hợp lệ.', fields);
    }

    const [customer, device, center, category] = await Promise.all([
      customerRepository.findById(customerId),
      deviceRepository.findById(deviceId),
      catalogRepository.findCenterById(centerId),
      catalogRepository.findCategoryById(categoryId)
    ]);

    if (!customer) throw notFound('Không tìm thấy khách hàng.', { customer_id: 'Kiểm tra lại mã khách hàng.' });
    if (!device) throw notFound('Không tìm thấy thiết bị.', { device_id: 'Kiểm tra lại mã thiết bị.' });
    if (!center || center.is_active === false) {
      throw notFound('Không tìm thấy trung tâm bảo hành.', { center_id: 'Trung tâm không tồn tại hoặc đã ngừng hoạt động.' });
    }
    if (!category || category.is_active === false) {
      throw notFound('Không tìm thấy nhóm sự cố.', { category_id: 'Nhóm sự cố không tồn tại hoặc đã ngừng dùng.' });
    }

    if (device.customer_id !== customer.customer_id) {
      throw invalid('Thiết bị không thuộc khách hàng đã chọn (QT-03).', {
        device_id: 'Chọn đúng thiết bị của khách hàng này.'
      });
    }

    assertCenterAccess({ center_id: center.center_id }, actor);

    const openTicket = await ticketRepository.findOpenByDevice(device.device_id);
    if (openTicket) {
      throw conflict(
        'PHIEU_DANG_MO',
        `Thiết bị đang có phiếu chưa đóng ${openTicket.ticket_code} (QT-03).`,
        { device_id: 'Hãy xử lý hoặc đóng phiếu đang mở trước khi tiếp nhận phiếu mới.' }
      );
    }

    const receivedAt = input.received_at ? new Date(input.received_at) : now();
    if (Number.isNaN(receivedAt.getTime())) {
      throw invalid('Thời điểm tiếp nhận không hợp lệ.', {
        received_at: 'Cần ngày giờ hợp lệ theo ISO 8601.'
      });
    }

    const warranty = checkWarranty(device, receivedAt);
    const priority = input.priority || category.default_priority;
    if (!PRIORITIES.includes(priority)) {
      throw invalid('Mức ưu tiên không hợp lệ.', { priority: 'Chỉ nhận CAO, TRUNG_BINH hoặc THAP.' });
    }

    const priorityReason = String(input.priority_reason || '').trim();
    if (priority !== category.default_priority && !priorityReason) {
      // Ngoại lệ 4a – FR5: đổi khác gợi ý phải giải thích lý do.
      throw invalid('Cần nhập lý do khi đổi mức ưu tiên khác gợi ý của nhóm sự cố.', {
        priority_reason: `Nhóm ${category.category_name} gợi ý ${category.default_priority}.`
      });
    }

    if (Array.isArray(input.accessories)) {
      const badAccessory = input.accessories.find((item) => !ACCESSORIES.includes(item));
      if (badAccessory) {
        throw invalid('Phụ kiện không hợp lệ.', {
          accessories: 'Chỉ nhận SAC, TAI_NGHE, HOP hoặc KHAC.'
        });
      }
    }

    const dueDate = calculateDueDate(receivedAt, priority);
    const data = {
      customer_id: customer.customer_id,
      device_id: device.device_id,
      center_id: center.center_id,
      category_id: category.category_id,
      issue_desc: issueDesc,
      accessories: Array.isArray(input.accessories) ? [...new Set(input.accessories)] : [],
      exterior_note: String(input.exterior_note || '').trim().slice(0, 500),
      priority,
      priority_reason: priorityReason,
      status: 'MOI',
      is_warranty: warranty.conBaoHanh,
      received_at: receivedAt,
      due_date: dueDate,
      closed_at: null,
      is_deleted: false
    };
    let created;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
      const ticketId = await ticketRepository.nextId();
      const ticketCode = await ticketRepository.nextTicketCode(vietnamYear(receivedAt));
      try {
        created = await ticketRepository.create({ ...data, ticket_id: ticketId, ticket_code: ticketCode });
        break;
      } catch (error) {
        if (duplicateField(error, 'device_id')) {
          throw conflict('PHIEU_DANG_MO', 'Thiết bị đang có phiếu chưa đóng (QT-03).', { device_id: 'Hãy xử lý phiếu đang mở trước.' });
        }
        if (duplicateField(error, 'ticket_id') || duplicateField(error, 'ticket_code')) {
          if (attempt === MAX_ATTEMPTS - 1) throw error;
          continue;
        }
        if (error?.code === 11000 || error?.name === 'ValidationError') throw error;
        throw integrityError('Không xác định được kết quả tạo phiếu; cần đối soát trước khi thử lại.', error, ticketId);
      }
    }

    let logWriteAttempted = false;
    try {
      for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
        const logId = await ticketRepository.nextLogId();
        try {
          logWriteAttempted = true;
          await ticketRepository.addStatusLog({
            log_id: logId,
            ticket_id: created.ticket_id,
            from_status: null,
            to_status: 'MOI',
            changed_at: receivedAt,
            changed_by: actor.username,
            note: 'Tạo phiếu tiếp nhận mới.'
          });
          break;
        } catch (error) {
          if (!duplicateField(error, 'log_id') || attempt === MAX_ATTEMPTS - 1) throw error;
          logWriteAttempted = false;
        }
      }
    } catch (error) {
      const definitelyNotWritten = !logWriteAttempted || error?.code === 11000 || error?.name === 'ValidationError';
      let compensationError;
      let removed = false;
      if (definitelyNotWritten && created._id) {
        try {
          removed = await ticketRepository.removeUnchangedCreated(created);
        } catch (failure) {
          compensationError = failure;
        }
      }
      throw integrityError(
        removed ? 'Không ghi được lịch sử khởi tạo; phiếu đã được bù trừ.' : 'Không xác định được tính toàn vẹn phiếu và lịch sử; cần đối soát.',
        error, created.ticket_id, compensationError
      );
    }

    return buildDetail(created);
  }

  /**
   * Liệt kê phiếu theo bộ lọc và phạm vi trung tâm (QT-14), sắp xếp theo hạn cam kết.
   *
   * @param {{status?: string, category_id?: string, priority?: string, q?: string, center_id?: string}} [filters] Bộ lọc.
   * @param {{role?: string, center_id?: string}|null} [actor] Người dùng.
   * @returns {Promise<Array<object>>} Danh sách view 14 khóa.
   * @throws {import('./errors').AppError} Khi tầng dữ liệu lỗi.
   */
  async function listTickets(filters = {}, actor = null) {
    assertActor(actor);
    const query = {
      status: filters.status || '',
      category_id: filters.category_id || '',
      priority: filters.priority || '',
      center_id: filters.center_id || '',
      q: String(filters.q || '').trim()
    };

    if (actor && actor.center_id) {
      query.center_id = actor.center_id;
    }

    if (query.q) {
      const customers = await customerRepository.findAll({ q: query.q });
      query.customerIds = customers.map((customer) => customer.customer_id);
    }

    const tickets = await ticketRepository.findAll(query);
    const withRelations = await Promise.all(tickets.map((ticket) => attachRelations(ticket)));
    return withRelations.map((ticket) => toTicketView(ticket));
  }

  /**
   * Lấy chi tiết phiếu, kiểm tra phạm vi trung tâm và trả lịch sử trạng thái (QT-06, QT-14).
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @param {{role?: string, center_id?: string}|null} [actor] Người dùng.
   * @returns {Promise<{ticket: object, lichSuTrangThai: Array<object>, trangThaiKeTiep: string[]}>} Chi tiết.
   * @throws {import('./errors').AppError} 404 hoặc 403.
   */
  async function getTicket(ticketId, actor = null) {
    assertActor(actor);
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw notFound('Không tìm thấy phiếu bảo hành.');
    assertCenterAccess(ticket, actor);
    return buildDetail(ticket);
  }

  /**
   * Cập nhật mô tả lỗi, phụ kiện, ngoại quan hoặc mức ưu tiên; đổi ưu tiên phải có lý do (FR5).
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @param {object} input Các trường được phép cập nhật.
   * @param {{role?: string, center_id?: string}|null} [actor] Người dùng.
   * @returns {Promise<{ticket: object, lichSuTrangThai: Array<object>, trangThaiKeTiep: string[]}>} Chi tiết sau cập nhật.
   * @throws {import('./errors').AppError} 404, 403, 409 hoặc 422.
   */
  async function updateTicket(ticketId, input = {}, actor = null) {
    assertActor(actor);
    assertInput(input);
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw notFound('Không tìm thấy phiếu bảo hành.');
    assertCenterAccess(ticket, actor);

    const patch = {};
    assertIntakeTicket(ticket);
    if (Object.prototype.hasOwnProperty.call(input, 'issue_desc')) {
      const issueDesc = String(input.issue_desc || '').trim();
      if (issueDesc.length < 10 || issueDesc.length > 2000) {
        throw invalid('Mô tả lỗi không hợp lệ.', {
          issue_desc: 'Mô tả lỗi phải có từ 10 đến 2000 ký tự.'
        });
      }
      patch.issue_desc = issueDesc;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'accessories')) {
      if (!Array.isArray(input.accessories)) {
        throw invalid('Phụ kiện không hợp lệ.', { accessories: 'Phải là một mảng.' });
      }
      const badAccessory = input.accessories.find((item) => !ACCESSORIES.includes(item));
      if (badAccessory) {
        throw invalid('Phụ kiện không hợp lệ.', {
          accessories: 'Chỉ nhận SAC, TAI_NGHE, HOP hoặc KHAC.'
        });
      }
      patch.accessories = [...new Set(input.accessories)];
    }

    if (Object.prototype.hasOwnProperty.call(input, 'exterior_note')) {
      const note = String(input.exterior_note || '').trim();
      if (note.length > 500) {
        throw invalid('Tình trạng ngoại quan quá dài.', {
          exterior_note: 'Không vượt quá 500 ký tự.'
        });
      }
      patch.exterior_note = note;
    }

    if (Object.prototype.hasOwnProperty.call(input, 'priority')) {
      if (!PRIORITIES.includes(input.priority)) {
        throw invalid('Mức ưu tiên không hợp lệ.', {
          priority: 'Chỉ nhận CAO, TRUNG_BINH hoặc THAP.'
        });
      }
      const category = await catalogRepository.findCategoryById(ticket.category_id);
      const reason =
        Object.prototype.hasOwnProperty.call(input, 'priority_reason')
          ? String(input.priority_reason || '').trim()
          : ticket.priority_reason;
      if (category && input.priority !== category.default_priority && !reason) {
        throw invalid('Cần nhập lý do khi đổi mức ưu tiên khác gợi ý của nhóm sự cố.', {
          priority_reason: `Nhóm ${category.category_name} gợi ý ${category.default_priority}.`
        });
      }
      patch.priority = input.priority;
      patch.priority_reason = reason;
      if (input.priority !== ticket.priority) {
        // QT-04: hạn cam kết phải tính lại khi mức ưu tiên thay đổi.
        patch.due_date = calculateDueDate(ticket.received_at, input.priority);
      }
    } else if (Object.prototype.hasOwnProperty.call(input, 'priority_reason')) {
      const reason = String(input.priority_reason || '').trim().slice(0, 300);
      const category = await catalogRepository.findCategoryById(ticket.category_id);
      if (category && ticket.priority !== category.default_priority && !reason) {
        throw invalid('Cần nhập lý do khi đổi mức ưu tiên khác gợi ý của nhóm sự cố.', {
          priority_reason: `Nhóm ${category.category_name} gợi ý ${category.default_priority}.`
        });
      }
      patch.priority_reason = reason;
    }

    const updated = await ticketRepository.update(ticketId, patch);
    if (!updated) throw conflict('PHIEU_CHI_DOC', 'Phiếu đã thay đổi hoặc không còn ở bước tiếp nhận. Hãy tải lại trước khi tiếp tục.');
    return buildDetail(updated);
  }

  /**
   * Xóa mềm phiếu, không xóa vật lý khỏi MongoDB (QT-13).
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @param {{role?: string, center_id?: string}|null} [actor] Người dùng.
   * @returns {Promise<{ticketId: string, deleted: boolean}>} Kết quả.
   * @throws {import('./errors').AppError} 404 hoặc 403.
   */
  async function deleteTicket(ticketId, actor = null) {
    assertActor(actor);
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw notFound('Không tìm thấy phiếu bảo hành.');
    assertCenterAccess(ticket, actor);
    assertIntakeTicket(ticket);
    const deleted = await ticketRepository.softDelete(ticketId);
    if (!deleted) throw conflict('PHIEU_CHI_DOC', 'Phiếu đã thay đổi hoặc không còn ở bước tiếp nhận. Hãy tải lại trước khi tiếp tục.');
    return { ticketId, deleted: true };
  }

  /**
   * Lấy lịch sử trạng thái của một phiếu.
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @param {{role?: string, center_id?: string}|null} [actor] Người dùng.
   * @returns {Promise<Array<object>>} Danh sách log đã chuyển view.
   * @throws {import('./errors').AppError} 404 hoặc 403.
   */
  async function getHistory(ticketId, actor = null) {
    assertActor(actor);
    const ticket = await ticketRepository.findById(ticketId);
    if (!ticket) throw notFound('Không tìm thấy phiếu bảo hành.');
    assertCenterAccess(ticket, actor);
    const logs = await ticketRepository.listStatusLogs(ticketId);
    return logs.map(toStatusLogView);
  }

  /**
   * Tính trước hạn cam kết cho form tiếp nhận mà không lưu phiếu (QT-04).
   *
   * @param {{priority: string, received_at?: string|Date}} input Mức ưu tiên và thời điểm tiếp nhận.
   * @returns {{priority: string, received_at: string|null, due_date: string|null, sla_hours: number}} Kết quả xem trước.
   * @throws {import('./errors').AppError} DU_LIEU_KHONG_HOP_LE khi đầu vào sai.
   */
  async function previewDueDate(input = {}) {
    assertInput(input);
    const priority = input.priority;
    if (!PRIORITIES.includes(priority)) {
      throw invalid('Mức ưu tiên không hợp lệ.', {
        priority: 'Chỉ nhận CAO, TRUNG_BINH hoặc THAP.'
      });
    }
    const receivedAt = input.received_at ? new Date(input.received_at) : now();
    if (Number.isNaN(receivedAt.getTime())) {
      throw invalid('Thời điểm tiếp nhận không hợp lệ.', {
        received_at: 'Cần ngày giờ hợp lệ theo ISO 8601.'
      });
    }
    const dueDate = calculateDueDate(receivedAt, priority);
    return {
      priority,
      received_at: toVietnamIso(receivedAt),
      due_date: toVietnamIso(dueDate),
      sla_hours: getSlaHours(priority)
    };
  }

  return {
    createTicket,
    listTickets,
    getTicket,
    updateTicket,
    deleteTicket,
    getHistory,
    previewDueDate
  };
}

const ticketRepository = require('../repositories/ticket.repository');
const customerRepository = require('../repositories/customer.repository');
const deviceRepository = require('../repositories/device.repository');
const catalogRepository = require('../repositories/catalog.repository');

module.exports = {
  createTicketService,
  ...createTicketService({
    ticketRepository,
    customerRepository,
    deviceRepository,
    catalogRepository
  })
};
