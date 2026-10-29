const { createTicketService } = require('../../src/services/ticket.service');
const { createCustomerService } = require('../../src/services/customer.service');
const { createWarrantyCheckService } = require('../../src/services/warrantyCheck.service');

const FIXED_NOW = new Date('2026-10-21T09:00:00+07:00');
const OPEN_STATUSES = ['MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT'];

/**
 * Sao chép sâu đơn giản, giữ nguyên Date để test không bị lệch múi giờ.
 *
 * @param {unknown} value Giá trị cần sao chép.
 * @returns {unknown} Bản sao.
 */
function clone(value) {
  if (value === null || value === undefined) return value;
  if (value instanceof Date) return new Date(value.getTime());
  if (Array.isArray(value)) return value.map(clone);
  if (typeof value === 'object') {
    const result = {};
    for (const [key, item] of Object.entries(value)) result[key] = clone(item);
    return result;
  }
  return value;
}

/**
 * Tạo repository khách hàng trong bộ nhớ, cùng chữ ký với repository Mongoose.
 *
 * @param {Array<object>} seedCustomers Dữ liệu khởi tạo.
 * @returns {object} Repository.
 */
function makeCustomerRepository(seedCustomers) {
  const rows = seedCustomers.map(clone);

  return {
    async create(data) {
      const row = clone(data);
      rows.push(row);
      return clone(row);
    },
    async findAll({ q = '' } = {}) {
      const keyword = String(q).toLowerCase();
      return clone(
        rows.filter((row) => {
          if (row.is_deleted) return false;
          if (!keyword) return true;
          return [row.customer_id, row.full_name, row.phone]
            .join(' ')
            .toLowerCase()
            .includes(keyword);
        })
      );
    },
    async findById(customerId) {
      return clone(rows.find((row) => row.customer_id === customerId && !row.is_deleted) || null);
    },
    async findByPhone(phone) {
      return clone(rows.find((row) => row.phone === phone && !row.is_deleted) || null);
    },
    async findByPhoneIncludingDeleted(phone) {
      return clone(rows.find((row) => row.phone === phone) || null);
    },
    async update(customerId, patch) {
      const row = rows.find((item) => item.customer_id === customerId && !item.is_deleted);
      if (!row) return null;
      Object.assign(row, clone(patch));
      return clone(row);
    },
    async softDelete(customerId) {
      const row = rows.find((item) => item.customer_id === customerId && !item.is_deleted);
      if (!row) return null;
      row.is_deleted = true;
      return clone(row);
    },
    async nextId() {
      const max = rows.reduce(
        (acc, row) => Math.max(acc, Number.parseInt(String(row.customer_id).slice(3), 10) || 0),
        0
      );
      return `CUS${String(max + 1).padStart(4, '0')}`;
    },
    all() {
      return clone(rows);
    }
  };
}

/**
 * Tạo repository thiết bị trong bộ nhớ.
 *
 * @param {Array<object>} seedDevices Dữ liệu khởi tạo.
 * @returns {object} Repository.
 */
function makeDeviceRepository(seedDevices) {
  const rows = seedDevices.map(clone);

  return {
    async create(data) {
      const row = clone(data);
      rows.push(row);
      return clone(row);
    },
    async findAll({ customer_id = '', q = '' } = {}) {
      const keyword = String(q).toLowerCase();
      return clone(
        rows.filter((row) => {
          if (row.is_deleted) return false;
          if (customer_id && row.customer_id !== customer_id) return false;
          if (!keyword) return true;
          return [row.device_id, row.serial_no, row.product_name]
            .join(' ')
            .toLowerCase()
            .includes(keyword);
        })
      );
    },
    async findById(deviceId) {
      return clone(rows.find((row) => row.device_id === deviceId && !row.is_deleted) || null);
    },
    async findBySerial(serialNo) {
      return clone(rows.find((row) => row.serial_no === serialNo && !row.is_deleted) || null);
    },
    async findBySerialIncludingDeleted(serialNo) {
      return clone(rows.find((row) => row.serial_no === serialNo) || null);
    },
    async findByCustomerIncludingDeleted(customerId) {
      return clone(rows.find((row) => row.customer_id === customerId) || null);
    },
    async update(deviceId, patch) {
      const row = rows.find((item) => item.device_id === deviceId && !item.is_deleted);
      if (!row) return null;
      Object.assign(row, clone(patch));
      return clone(row);
    },
    async softDelete(deviceId) {
      const row = rows.find((item) => item.device_id === deviceId && !item.is_deleted);
      if (!row) return null;
      row.is_deleted = true;
      return clone(row);
    },
    async nextId() {
      const max = rows.reduce(
        (acc, row) => Math.max(acc, Number.parseInt(String(row.device_id).slice(3), 10) || 0),
        0
      );
      return `DEV${String(max + 1).padStart(4, '0')}`;
    },
    all() {
      return clone(rows);
    }
  };
}

/**
 * Tạo repository danh mục trong bộ nhớ.
 *
 * @param {Array<object>} centers Trung tâm.
 * @param {Array<object>} categories Nhóm sự cố.
 * @returns {object} Repository.
 */
function makeCatalogRepository(centers, categories) {
  return {
    async listCenters() {
      return clone(centers.filter((center) => center.is_active !== false));
    },
    async findCenterById(centerId) {
      return clone(centers.find((center) => center.center_id === centerId) || null);
    },
    async listCategories() {
      return clone(categories.filter((category) => category.is_active !== false));
    },
    async findCategoryById(categoryId) {
      return clone(categories.find((category) => category.category_id === categoryId) || null);
    },
    async findCategoryByName(categoryName) {
      return clone(
        categories.find(
          (category) => category.category_name === categoryName && category.is_active !== false
        ) || null
      );
    }
  };
}

/**
 * Tạo repository phiếu và log trong bộ nhớ.
 *
 * @param {Array<object>} seedTickets Phiếu khởi tạo.
 * @param {Array<object>} seedLogs Log khởi tạo.
 * @returns {object} Repository.
 */
function makeTicketRepository(seedTickets, seedLogs) {
  const tickets = seedTickets.map(clone);
  const logs = seedLogs.map(clone);

  return {
    async create(data) {
      const row = clone(data);
      tickets.push(row);
      return clone(row);
    },
    async findAll(filter = {}) {
      let rows = tickets.filter((ticket) => !ticket.is_deleted);
      if (filter.center_id) rows = rows.filter((ticket) => ticket.center_id === filter.center_id);
      if (filter.status) rows = rows.filter((ticket) => ticket.status === filter.status);
      if (filter.category_id) {
        rows = rows.filter((ticket) => ticket.category_id === filter.category_id);
      }
      if (filter.priority) rows = rows.filter((ticket) => ticket.priority === filter.priority);

      if (filter.q || (Array.isArray(filter.customerIds) && filter.customerIds.length > 0)) {
        const keyword = String(filter.q || '').toLowerCase();
        rows = rows.filter((ticket) => {
          const matchesKeyword = keyword
            ? ticket.ticket_code.toLowerCase().includes(keyword) ||
              ticket.ticket_id.toLowerCase().includes(keyword)
            : false;
          const matchesCustomer =
            Array.isArray(filter.customerIds) && filter.customerIds.includes(ticket.customer_id);
          return matchesKeyword || matchesCustomer;
        });
      }

      rows = rows.slice().sort((left, right) => {
        const byDue = new Date(left.due_date).getTime() - new Date(right.due_date).getTime();
        return byDue !== 0 ? byDue : String(left.ticket_code).localeCompare(String(right.ticket_code));
      });
      return clone(rows);
    },
    async findById(ticketId) {
      return clone(tickets.find((ticket) => ticket.ticket_id === ticketId && !ticket.is_deleted) || null);
    },
    async findByCustomer(customerId) {
      return clone(tickets.find((ticket) => ticket.customer_id === customerId && !ticket.is_deleted) || null);
    },
    async findByDevice(deviceId) {
      return clone(tickets.find((ticket) => ticket.device_id === deviceId && !ticket.is_deleted) || null);
    },
    async findOpenByDevice(deviceId) {
      return clone(
        tickets.find(
          (ticket) =>
            ticket.device_id === deviceId &&
            !ticket.is_deleted &&
            OPEN_STATUSES.includes(ticket.status)
        ) || null
      );
    },
    async update(ticketId, patch) {
      const row = tickets.find((ticket) => ticket.ticket_id === ticketId && !ticket.is_deleted);
      if (!row) return null;
      Object.assign(row, clone(patch));
      return clone(row);
    },
    async softDelete(ticketId) {
      const row = tickets.find((ticket) => ticket.ticket_id === ticketId && !ticket.is_deleted);
      if (!row) return null;
      row.is_deleted = true;
      return clone(row);
    },
    async nextId() {
      const max = tickets.reduce(
        (acc, row) => Math.max(acc, Number.parseInt(String(row.ticket_id).slice(3), 10) || 0),
        0
      );
      return `TCK${String(max + 1).padStart(4, '0')}`;
    },
    async nextTicketCode(year) {
      const max = tickets.reduce((acc, ticket) => {
        const match = new RegExp(`^BH-(\\d{6})/${year}$`).exec(ticket.ticket_code);
        return match ? Math.max(acc, Number.parseInt(match[1], 10)) : acc;
      }, 0);
      return `BH-${String(max + 1).padStart(6, '0')}/${year}`;
    },
    async addStatusLog(data) {
      const row = clone(data);
      logs.push(row);
      return clone(row);
    },
    async listStatusLogs(ticketId) {
      return clone(
        logs
          .filter((log) => log.ticket_id === ticketId)
          .sort((left, right) => {
            const byTime = new Date(left.changed_at).getTime() - new Date(right.changed_at).getTime();
            return byTime !== 0 ? byTime : String(left.log_id).localeCompare(String(right.log_id));
          })
      );
    },
    async nextLogId() {
      const max = logs.reduce(
        (acc, row) => Math.max(acc, Number.parseInt(String(row.log_id).slice(3), 10) || 0),
        0
      );
      return `LOG${String(max + 1).padStart(6, '0')}`;
    },
    allTickets() {
      return clone(tickets);
    },
    allLogs() {
      return clone(logs);
    }
  };
}

/**
 * Dựng bộ dữ liệu và service in-memory dùng chung cho các test.
 *
 * @param {{withOpenTicket?: boolean}} [options] Tùy chọn dữ liệu.
 * @returns {object} Service, repository và dữ liệu mẫu.
 */
function buildFixture(options = {}) {
  const customers = [
    {
      customer_id: 'CUS0001',
      full_name: 'Nguyễn Văn An',
      phone: '0901234567',
      email: 'an@example.com',
      address: '12 Nguyễn Huệ, Quận 1',
      segment: 'VIP',
      created_at: new Date('2025-01-01T08:00:00+07:00'),
      is_deleted: false
    },
    {
      customer_id: 'CUS0002',
      full_name: 'Trần Thị Bình',
      phone: '0912345678',
      email: 'binh@example.com',
      address: '45 Lê Lợi, Quận 1',
      segment: 'THUONG',
      created_at: new Date('2025-02-01T08:00:00+07:00'),
      is_deleted: false
    }
  ];

  const devices = [
    {
      device_id: 'DEV0001',
      customer_id: 'CUS0001',
      product_id: 1,
      product_code: 'SP0001',
      product_name: 'Samsung Galaxy A15',
      serial_no: 'SN000000000001',
      purchase_date: new Date('2025-10-21T00:00:00+07:00'),
      warranty_months: 12,
      is_deleted: false
    },
    {
      device_id: 'DEV0002',
      customer_id: 'CUS0002',
      product_id: 2,
      product_code: 'SP0002',
      product_name: 'Oppo Reno 11',
      serial_no: 'SN000000000002',
      purchase_date: null,
      warranty_months: 12,
      is_deleted: false
    },
    {
      device_id: 'DEV0003',
      customer_id: 'CUS0001',
      product_id: 3,
      product_code: 'SP0003',
      product_name: 'Xiaomi Redmi 12',
      serial_no: 'SN000000000003',
      purchase_date: new Date('2020-01-01T00:00:00+07:00'),
      warranty_months: 12,
      is_deleted: false
    },
    {
      device_id: 'DEV0004',
      customer_id: 'CUS0001',
      product_id: 4,
      product_code: 'SP0004',
      product_name: 'iPhone 13',
      serial_no: 'SN000000000004',
      purchase_date: new Date('2025-10-22T00:00:00+07:00'),
      warranty_months: 12,
      is_deleted: false
    }
  ];

  const centers = [
    {
      center_id: '1',
      center_code: 'TTQ1',
      center_name: 'Trung tâm Bảo hành Quận 1',
      city: 'TP. Hồ Chí Minh',
      is_active: true
    },
    {
      center_id: '2',
      center_code: 'TTQ7',
      center_name: 'Trung tâm Bảo hành Quận 7',
      city: 'TP. Hồ Chí Minh',
      is_active: true
    }
  ];

  const categories = [
    {
      category_id: '1',
      category_name: 'MAN_HINH',
      default_priority: 'CAO',
      is_active: true
    },
    {
      category_id: '2',
      category_name: 'PIN',
      default_priority: 'TRUNG_BINH',
      is_active: true
    },
    {
      category_id: '3',
      category_name: 'SAC',
      default_priority: 'TRUNG_BINH',
      is_active: true
    },
    {
      category_id: '4',
      category_name: 'PHAN_MEM',
      default_priority: 'THAP',
      is_active: true
    },
    {
      category_id: '5',
      category_name: 'NUOC_VAO',
      default_priority: 'CAO',
      is_active: true
    },
    {
      category_id: '6',
      category_name: 'KHAC',
      default_priority: 'THAP',
      is_active: true
    }
  ];

  const seedTickets = [];
  const seedLogs = [];

  if (options.withOpenTicket) {
    seedTickets.push({
      ticket_id: 'TCK0001',
      ticket_code: 'BH-000009/2026',
      customer_id: 'CUS0001',
      device_id: 'DEV0001',
      center_id: '1',
      category_id: '1',
      issue_desc: 'Màn hình bị sọc, cần kiểm tra trước khi tiếp nhận phiếu mới.',
      accessories: ['SAC'],
      exterior_note: 'Trầy nhẹ góc phải.',
      priority: 'CAO',
      priority_reason: '',
      status: 'DANG_XU_LY',
      is_warranty: true,
      received_at: new Date('2026-10-20T09:00:00+07:00'),
      due_date: new Date('2026-10-21T09:00:00+07:00'),
      closed_at: null,
      is_deleted: false
    });
    seedLogs.push({
      log_id: 'LOG000001',
      ticket_id: 'TCK0001',
      from_status: null,
      to_status: 'MOI',
      changed_at: new Date('2026-10-20T09:00:00+07:00'),
      changed_by: 'nhanvien',
      note: 'Tạo phiếu tiếp nhận mới.'
    });
    seedLogs.push({
      log_id: 'LOG000002',
      ticket_id: 'TCK0001',
      from_status: 'MOI',
      to_status: 'DANG_XU_LY',
      changed_at: new Date('2026-10-20T10:00:00+07:00'),
      changed_by: 'nhanvien',
      note: 'Bắt đầu xử lý.'
    });
  }

  const customerRepository = makeCustomerRepository(customers);
  const deviceRepository = makeDeviceRepository(devices);
  const catalogRepository = makeCatalogRepository(centers, categories);
  const ticketRepository = makeTicketRepository(seedTickets, seedLogs);
  const now = () => new Date(FIXED_NOW.getTime());

  const ticketService = createTicketService({
    ticketRepository,
    customerRepository,
    deviceRepository,
    catalogRepository,
    now
  });

  const customerService = createCustomerService({ customerRepository, deviceRepository, ticketRepository, now });
  const warrantyService = createWarrantyCheckService({
    deviceRepository,
    customerRepository,
    ticketRepository,
    now
  });

  return {
    FIXED_NOW,
    customers,
    devices,
    centers,
    categories,
    customerRepository,
    deviceRepository,
    catalogRepository,
    ticketRepository,
    ticketService,
    customerService,
    warrantyService
  };
}

module.exports = {
  FIXED_NOW,
  OPEN_STATUSES,
  buildFixture,
  clone
};
