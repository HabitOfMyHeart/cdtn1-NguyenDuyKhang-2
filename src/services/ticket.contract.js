const { notFound } = require('./errors');

/**
 * Che 3 chữ số giữa của số điện thoại 10 số (QT-15).
 * Ví dụ: 0901234567 -> 0901***567.
 *
 * @param {string} phone Số điện thoại đã chuẩn hóa 10 chữ số.
 * @returns {string} Chuỗi đã che, hoặc chuỗi rỗng nếu đầu vào không hợp lệ.
 */
function maskPhone(phone) {
  if (typeof phone !== 'string') return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length !== 10) return phone;
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`;
}

/**
 * Chuyển Date/chuỗi ngày sang ISO 8601 kèm múi giờ Việt Nam +07:00.
 *
 * @param {Date|string|number|null|undefined} value Giá trị ngày.
 * @returns {string|null} Chuỗi ISO 8601 dạng YYYY-MM-DDTHH:mm:ss+07:00, hoặc null.
 */
function toVietnamIso(value) {
  if (value === null || value === undefined || value === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const shifted = new Date(date.getTime() + 7 * 60 * 60 * 1000);
  return shifted.toISOString().replace(/\.\d{3}Z$/, '+07:00');
}

/**
 * Diễn giải kết luận bảo hành cho người dùng (QT-05).
 *
 * @param {boolean|null} conBaoHanh Kết quả kiểm tra bảo hành.
 * @returns {string} Câu kết luận tiếng Việt.
 */
function warrantyConclusion(conBaoHanh) {
  if (conBaoHanh === true) return 'Còn bảo hành';
  if (conBaoHanh === false) return 'Hết bảo hành';
  return 'Chưa xác minh bảo hành';
}

/**
 * HỢP ĐỒNG DỮ LIỆU TẠI RANH GIỚI LỚP NGHIỆP VỤ
 *
 * 1. HÌNH DẠNG — trả về đúng 14 khóa, không thêm khóa lịch sử trạng thái:
 *    - ticketId        : string, bắt buộc — mã nghiệp vụ TCKxxxx.
 *    - ticketCode      : string, bắt buộc — mã phiếu BH-xxxxxx/năm.
 *    - tenKhach        : string, bắt buộc — họ tên khách hàng.
 *    - sdtHienThi      : string, bắt buộc — số điện thoại đã che theo QT-15.
 *    - tenThietBi      : string, bắt buộc — tên sản phẩm/thiết bị.
 *    - serialNo        : string, bắt buộc — serial/IMEI.
 *    - nhomSuCo        : string, bắt buộc — tên nhóm sự cố chuẩn hóa.
 *    - mucUuTien       : 'CAO' | 'TRUNG_BINH' | 'THAP', bắt buộc.
 *    - trangThai       : trạng thái trong vòng đời QT-06, bắt buộc.
 *    - conBaoHanh      : boolean | null, bắt buộc — null là CHƯA XÁC MINH.
 *    - ketLuanBaoHanh  : string, bắt buộc — câu diễn giải cho người dùng.
 *    - hanCamKet       : string ISO 8601 +07:00, bắt buộc — hạn trả máy QT-04.
 *    - ngayTiepNhan    : string ISO 8601 +07:00, bắt buộc.
 *    - trungTam        : string, bắt buộc — tên trung tâm bảo hành.
 *
 * 2. Ý NGHĨA:
 *    - conBaoHanh = null nghĩa là CHƯA XÁC MINH do thiếu ngày mua (QT-05),
 *      tuyệt đối không được hiểu là hết bảo hành.
 *    - hanCamKet là chuỗi ISO 8601 kèm múi giờ +07:00, được tính theo ngày
 *      làm việc Thứ Hai – Thứ Bảy và bỏ trọn Chủ Nhật (QT-04).
 *    - sdtHienThi đã che 3 chữ số giữa dạng 0901***567 theo QT-15; không
 *      trả số điện thoại đầy đủ ra ngoài lớp nghiệp vụ.
 *
 * 3. HÀNH VI KHI SAI:
 *    - Không tìm thấy phiếu: ném AppError KHONG_TIM_THAY với HTTP 404.
 *    - Danh sách rỗng: toTicketViewList trả mảng [] thay vì ném lỗi.
 *
 * @param {object|null} ticket Phiếu đã gắn customer, device, category, center.
 * @returns {{
 *   ticketId: string,
 *   ticketCode: string,
 *   tenKhach: string,
 *   sdtHienThi: string,
 *   tenThietBi: string,
 *   serialNo: string,
 *   nhomSuCo: string,
 *   mucUuTien: string,
 *   trangThai: string,
 *   conBaoHanh: boolean|null,
 *   ketLuanBaoHanh: string,
 *   hanCamKet: string|null,
 *   ngayTiepNhan: string|null,
 *   trungTam: string
 * }} View 14 khóa đúng hợp đồng.
 * @throws {import('./errors').AppError} KHONG_TIM_THAY khi ticket rỗng.
 */
function toTicketView(ticket) {
  if (!ticket) {
    throw notFound('Không tìm thấy phiếu bảo hành.');
  }

  const conBaoHanh =
    ticket.is_warranty === true ? true : ticket.is_warranty === false ? false : null;

  return {
    ticketId: ticket.ticket_id,
    ticketCode: ticket.ticket_code,
    tenKhach: ticket.customer?.full_name || '',
    sdtHienThi: maskPhone(ticket.customer?.phone),
    tenThietBi: ticket.device?.product_name || '',
    serialNo: ticket.device?.serial_no || '',
    nhomSuCo: ticket.category?.category_name || '',
    mucUuTien: ticket.priority,
    trangThai: ticket.status,
    conBaoHanh,
    ketLuanBaoHanh: warrantyConclusion(conBaoHanh),
    hanCamKet: toVietnamIso(ticket.due_date),
    ngayTiepNhan: toVietnamIso(ticket.received_at),
    trungTam: ticket.center?.center_name || ''
  };
}

/**
 * Chuyển danh sách phiếu sang danh sách view; danh sách rỗng trả [].
 *
 * @param {Array<object>} tickets Danh sách phiếu đã gắn quan hệ.
 * @returns {Array<ReturnType<typeof toTicketView>>} Danh sách view.
 * @throws {import('./errors').AppError} KHONG_TIM_THAY nếu một phần tử rỗng.
 */
function toTicketViewList(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) return [];
  return tickets.map((ticket) => toTicketView(ticket));
}

/**
 * Chuyển một bản ghi ticket_status_log sang view an toàn cho giao diện.
 *
 * @param {object} log Bản ghi lịch sử trạng thái.
 * @returns {{logId: string, fromStatus: string|null, toStatus: string, changedAt: string|null, changedBy: string, note: string}} Log view.
 */
function toStatusLogView(log) {
  return {
    logId: log.log_id,
    fromStatus: log.from_status || null,
    toStatus: log.to_status,
    changedAt: toVietnamIso(log.changed_at),
    changedBy: log.changed_by || '',
    note: log.note || ''
  };
}

module.exports = {
  maskPhone,
  toVietnamIso,
  warrantyConclusion,
  toTicketView,
  toTicketViewList,
  toStatusLogView
};
