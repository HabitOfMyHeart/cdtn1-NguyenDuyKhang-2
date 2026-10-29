(function (global) {
  'use strict';

  const { request, buildQuery } = global.apiTransport;

  /**
   * Lấy danh sách phiếu theo bộ lọc.
   *
   * @param {object} [filters] Bộ lọc trạng thái, nhóm, ưu tiên, từ khóa.
   * @returns {Promise<{data: Array<object>, total: number}>} Danh sách.
   */
  async function listTickets(filters) {
    return request(`/api/tickets${buildQuery(filters)}`);
  }

  /**
   * Lấy chi tiết phiếu.
   *
   * @param {string} ticketId Mã TCKxxxx.
   * @returns {Promise<{ticket: object, lichSuTrangThai: Array<object>}>} Chi tiết chỉ đọc.
   */
  async function getTicket(ticketId) {
    const payload = await request(`/api/tickets/${encodeURIComponent(ticketId)}`);
    return payload.data;
  }

  /**
   * Tạo phiếu mới.
   *
   * @param {object} data Dữ liệu tiếp nhận.
   * @returns {Promise<object>} Chi tiết phiếu vừa tạo.
   */
  async function createTicket(data) {
    const payload = await request('/api/tickets', { method: 'POST', body: data });
    return payload.data;
  }

  /**
   * Tính trước hạn cam kết theo QT-04.
   *
   * @param {string} priority Mức ưu tiên.
   * @param {string} receivedAt Thời điểm tiếp nhận.
   * @returns {Promise<{priority: string, received_at: string, due_date: string, sla_hours: number}>} Kết quả.
   */
  async function previewDueDate(priority, receivedAt) {
    const payload = await request('/api/tickets/preview', {
      method: 'POST',
      body: { priority, received_at: receivedAt }
    });
    return payload.data;
  }

  global.ticketApi = {
    listTickets,
    getTicket,
    createTicket,
    previewDueDate
  };
})(window);
