const test = require('node:test');
const assert = require('node:assert/strict');
const { createTicketService } = require('../src/services/ticket.service');

test('không thể xóa lý do khi mức ưu tiên vẫn khác gợi ý', async () => {
  const ticket = { ticket_id: 'TCK0001', status: 'MOI', center_id: '1', category_id: '1', priority: 'THAP', priority_reason: 'Khách đồng ý chờ.' };
  const service = createTicketService({
    ticketRepository: { findById: async () => ticket, update: async (_, patch) => ({ ...ticket, ...patch }), listStatusLogs: async () => [] },
    customerRepository: { findById: async () => null },
    deviceRepository: { findById: async () => null },
    catalogRepository: { findCategoryById: async () => ({ default_priority: 'CAO', category_name: 'Màn hình' }), findCenterById: async () => null }
  });
  const actor = { username: 'nhanvien', role: 'NHAN_VIEN', center_id: '1' };
  await assert.rejects(
    () => service.updateTicket(ticket.ticket_id, { priority_reason: '' }, actor),
    (error) => error.code === 'DU_LIEU_KHONG_HOP_LE' && Boolean(error.fields.priority_reason)
  );
});
