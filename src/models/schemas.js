const mongoose = require('mongoose');

const PRIORITIES = Object.freeze(['CAO', 'TRUNG_BINH', 'THAP']);
const TICKET_STATUSES = Object.freeze([
  'MOI',
  'DA_PHAN_CONG',
  'DANG_XU_LY',
  'CHO_LINH_KIEN',
  'HOAN_TAT',
  'DA_DONG'
]);
const OPEN_TICKET_STATUSES = Object.freeze([
  'MOI',
  'DA_PHAN_CONG',
  'DANG_XU_LY',
  'CHO_LINH_KIEN',
  'HOAN_TAT'
]);
const CATEGORY_NAMES = Object.freeze([
  'MAN_HINH',
  'PIN',
  'SAC',
  'PHAN_MEM',
  'NUOC_VAO',
  'KHAC'
]);
const ACCESSORIES = Object.freeze(['SAC', 'TAI_NGHE', 'HOP', 'KHAC']);
const SEGMENTS = Object.freeze(['VIP', 'THUONG', 'MOI']);

const baseOptions = { versionKey: false };

const customerSchema = new mongoose.Schema(
  {
    customer_id: { type: String, required: true, unique: true, trim: true },
    full_name: { type: String, required: true, trim: true, maxlength: 120 },
    // QT-01, QT-02: khóa nghiệp vụ duy nhất, đã chuẩn hóa 10 chữ số.
    phone: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      match: /^0\d{9}$/
    },
    email: { type: String, trim: true, maxlength: 120, default: null },
    address: { type: String, trim: true, maxlength: 255, default: '' },
    segment: { type: String, enum: SEGMENTS, default: 'THUONG' },
    created_at: { type: Date, required: true, default: Date.now },
    is_deleted: { type: Boolean, default: false, index: true }
  },
  { ...baseOptions, collection: 'customer' }
);

const deviceSchema = new mongoose.Schema(
  {
    device_id: { type: String, required: true, unique: true, trim: true },
    customer_id: { type: String, required: true, trim: true, index: true },
    product_id: { type: Number, default: null },
    product_code: { type: String, trim: true, maxlength: 30, default: '' },
    product_name: { type: String, required: true, trim: true, maxlength: 120 },
    // QT-03: serial/IMEI là duy nhất.
    serial_no: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: 40
    },
    // QT-05: null = chưa xác minh ngày mua, không phải hết bảo hành.
    purchase_date: { type: Date, default: null },
    warranty_months: { type: Number, required: true, min: 0, max: 120, default: 12 },
    is_deleted: { type: Boolean, default: false, index: true }
  },
  { ...baseOptions, collection: 'device' }
);

const serviceCenterSchema = new mongoose.Schema(
  {
    center_id: { type: String, required: true, unique: true, trim: true },
    center_code: { type: String, required: true, unique: true, trim: true, maxlength: 20 },
    center_name: { type: String, required: true, unique: true, trim: true, maxlength: 120 },
    city: { type: String, required: true, trim: true, maxlength: 60 },
    is_active: { type: Boolean, required: true, default: true }
  },
  { ...baseOptions, collection: 'service_center' }
);

const issueCategorySchema = new mongoose.Schema(
  {
    category_id: { type: String, required: true, unique: true, trim: true },
    category_name: { type: String, required: true, unique: true, enum: CATEGORY_NAMES },
    default_priority: { type: String, required: true, enum: PRIORITIES },
    is_active: { type: Boolean, required: true, default: true }
  },
  { ...baseOptions, collection: 'issue_category' }
);

const ticketSchema = new mongoose.Schema(
  {
    ticket_id: { type: String, required: true, unique: true, trim: true },
    ticket_code: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      maxlength: 20
    },
    customer_id: { type: String, required: true, trim: true, index: true },
    device_id: { type: String, required: true, trim: true, index: true },
    center_id: { type: String, required: true, trim: true, index: true },
    category_id: { type: String, required: true, trim: true, index: true },
    issue_desc: { type: String, required: true, trim: true, minlength: 10, maxlength: 2000 },
    accessories: { type: [String], enum: ACCESSORIES, default: [] },
    exterior_note: { type: String, trim: true, maxlength: 500, default: '' },
    priority: { type: String, required: true, enum: PRIORITIES },
    priority_reason: { type: String, trim: true, maxlength: 300, default: '' },
    status: { type: String, required: true, enum: TICKET_STATUSES, default: 'MOI', index: true },
    // true = còn bảo hành, false = hết bảo hành, null = chưa xác minh (QT-05).
    is_warranty: { type: Boolean, default: null },
    received_at: { type: Date, required: true, default: Date.now },
    due_date: { type: Date, required: true, index: true },
    closed_at: { type: Date, default: null },
    is_deleted: { type: Boolean, default: false, index: true }
  },
  { ...baseOptions, collection: 'ticket' }
);

// QT-03: chống mở trùng phiếu trên cùng thiết bị ở tầng CSDL.
ticketSchema.index(
  { device_id: 1 },
  {
    unique: true,
    partialFilterExpression: {
      is_deleted: false,
      status: { $in: OPEN_TICKET_STATUSES }
    },
    name: 'one_open_ticket_per_device'
  }
);

const ticketStatusLogSchema = new mongoose.Schema(
  {
    log_id: { type: String, required: true, unique: true, trim: true },
    ticket_id: { type: String, required: true, trim: true, index: true },
    from_status: { type: String, enum: TICKET_STATUSES, default: null },
    to_status: { type: String, required: true, enum: TICKET_STATUSES },
    changed_at: { type: Date, required: true, default: Date.now },
    changed_by: { type: String, required: true, trim: true, maxlength: 24 },
    note: { type: String, trim: true, maxlength: 300, default: '' }
  },
  { ...baseOptions, collection: 'ticket_status_log' }
);

const Customer = mongoose.models.Customer || mongoose.model('Customer', customerSchema);
const Device = mongoose.models.Device || mongoose.model('Device', deviceSchema);
const ServiceCenter =
  mongoose.models.ServiceCenter || mongoose.model('ServiceCenter', serviceCenterSchema);
const IssueCategory =
  mongoose.models.IssueCategory || mongoose.model('IssueCategory', issueCategorySchema);
const Ticket = mongoose.models.Ticket || mongoose.model('Ticket', ticketSchema);
const TicketStatusLog =
  mongoose.models.TicketStatusLog || mongoose.model('TicketStatusLog', ticketStatusLogSchema);

module.exports = {
  Customer,
  Device,
  ServiceCenter,
  IssueCategory,
  Ticket,
  TicketStatusLog,
  PRIORITIES,
  TICKET_STATUSES,
  OPEN_TICKET_STATUSES,
  CATEGORY_NAMES,
  ACCESSORIES,
  SEGMENTS
};
