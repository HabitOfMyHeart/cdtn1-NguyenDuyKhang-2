require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const {
  Customer,
  Device,
  ServiceCenter,
  IssueCategory,
  Ticket,
  TicketStatusLog
} = require('../src/models/schemas');
const mongoose = require('mongoose');

const SAMPLE_DIR = path.join(__dirname, '..', 'data', 'sample');

/**
 * Đọc và parse một tệp JSON mẫu.
 *
 * @param {string} filename Tên tệp trong data/sample.
 * @returns {unknown} Dữ liệu JSON.
 * @throws {Error} Khi không đọc hoặc parse được.
 */
function readSample(filename) {
  const fullPath = path.join(SAMPLE_DIR, filename);
  return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
}

/**
 * Kiểm tra khóa nghiệp vụ không trùng trước khi upsert để tránh lỗi khó hiểu.
 *
 * @param {Array<object>} rows Danh sách bản ghi.
 * @param {string} key Tên khóa nghiệp vụ.
 * @param {string} label Nhãn để in lỗi.
 * @returns {void}
 * @throws {Error} Khi có khóa trùng.
 */
function assertUnique(rows, key, label) {
  const seen = new Set();
  for (const row of rows) {
    if (!row[key]) throw new Error(`${label}: thiếu khóa ${key}.`);
    if (seen.has(row[key])) throw new Error(`${label}: trùng khóa ${key}=${row[key]}.`);
    seen.add(row[key]);
  }
}

// Pure read-only planner. Existing documents must match every supplied field,
// including purchase_date; a business key alone is never proof of identity.
function planSafe(sample, existing) {
  const definitions = {
    centers: [ServiceCenter, 'center_id', ['center_id', 'center_code', 'center_name']],
    categories: [IssueCategory, 'category_id', ['category_id', 'category_name']],
    customers: [Customer, 'customer_id', ['customer_id', 'phone']],
    devices: [Device, 'device_id', ['device_id', 'serial_no']],
    tickets: [Ticket, 'ticket_id', ['ticket_id', 'ticket_code']],
    status_logs: [TicketStatusLog, 'log_id', ['log_id']]
  };
  const state = {};
  const maps = {};
  const issues = [];
  for (const [name, [Model, key, unique]] of Object.entries(definitions)) {
    state[name] = new Map();
    maps[name] = new Map(sample[name].map((row) => [row[key], row]));
    if (maps[name].size !== sample[name].length) throw new Error(`Duplicate sample key in ${name}`);
    for (const field of unique) {
      if (new Set(sample[name].map((row) => row[field])).size !== sample[name].length)
        throw new Error(`Duplicate sample unique field ${name}.${field}`);
    }
    for (const row of sample[name]) {
      const instance = new Model(row);
      const validation = instance.validateSync();
      if (validation) throw new Error(`Invalid sample ${name} ${row[key]}: ${Object.keys(validation.errors).join(', ')}`);
      const expected = instance.toObject();
      const matches = existing[name].filter((doc) => unique.some((field) => doc[field] === expected[field]));
      let kind = 'new';
      let reason = '';
      if (matches.length) {
        const fields = Object.keys(row).filter((field) => {
          const a = expected[field], b = matches[0][field];
          if (a instanceof Date) return !(b instanceof Date) || a.getTime() !== b.getTime();
          return JSON.stringify(a) !== JSON.stringify(b);
        });
        if (matches.length !== 1 || fields.length) {
          kind = 'conflict';
          reason = matches.length !== 1 ? 'multiple unique-key matches' : `different fields: ${fields.join(', ')}`;
        } else kind = 'match';
      }
      state[name].set(row[key], { kind, row, reason });
      if (kind === 'conflict') issues.push({ collection: name, id: row[key], reason });
    }
  }
  const additions = Object.fromEntries(Object.keys(definitions).map((key) => [key, new Map()]));
  const eligible = new Set();
  const open = new Set(['MOI', 'DA_PHAN_CONG', 'DANG_XU_LY', 'CHO_LINH_KIEN', 'HOAN_TAT']);
  const occupied = new Set(existing.tickets.filter((t) => t.is_deleted === false && open.has(t.status)).map((t) => t.device_id));
  for (const ticket of sample.tickets) {
    const refs = [['centers', ticket.center_id], ['categories', ticket.category_id],
      ['customers', ticket.customer_id], ['devices', ticket.device_id], ['tickets', ticket.ticket_id]];
    const bad = refs.filter(([group, id]) => !state[group].has(id) || state[group].get(id).kind === 'conflict');
    const device = maps.devices.get(ticket.device_id);
    if (device && device.customer_id !== ticket.customer_id) bad.push(['devices', ticket.device_id]);
    const ticketState = state.tickets.get(ticket.ticket_id);
    if (ticketState.kind === 'new' && ticket.is_deleted === false && open.has(ticket.status) && occupied.has(ticket.device_id)) {
      bad.push(['tickets', ticket.ticket_id]);
    }
    if (bad.length) {
      issues.push({ collection: 'tickets', id: ticket.ticket_id, reason: `blocked references/index: ${bad.map(([group]) => group).join(', ')}` });
      continue;
    }
    eligible.add(ticket.ticket_id);
    for (const [group, id] of refs) {
      const entry = state[group].get(id);
      if (entry.kind === 'new') additions[group].set(id, entry.row);
    }
    if (ticketState.kind === 'new' && ticket.is_deleted === false && open.has(ticket.status)) occupied.add(ticket.device_id);
  }
  for (const log of sample.status_logs) {
    if (!eligible.has(log.ticket_id)) {
      issues.push({ collection: 'status_logs', id: log.log_id, reason: 'parent ticket not eligible' });
    } else if (state.status_logs.get(log.log_id).kind === 'new') {
      additions.status_logs.set(log.log_id, log);
    }
  }
  const summary = {};
  for (const name of Object.keys(definitions)) {
    summary[name] = {
      existing_total: existing[name].length,
      sample_identical: [...state[name].values()].filter((entry) => entry.kind === 'match').length,
      sample_conflicts: [...state[name].values()].filter((entry) => entry.kind === 'conflict').length,
      proposed_additions: additions[name].size,
      projected_total: existing[name].length + additions[name].size
    };
  }
  const compatibleLogs = sample.status_logs.filter((log) => eligible.has(log.ticket_id) && state.status_logs.get(log.log_id).kind !== 'conflict');
  const eligibleTickets = sample.tickets.filter((ticket) => eligible.has(ticket.ticket_id));
  const compatibleSource = { tickets: eligible.size, status_logs: compatibleLogs.length,
    customers: new Set(eligibleTickets.map((ticket) => ticket.customer_id)).size,
    centers: new Set(eligibleTickets.map((ticket) => ticket.center_id)).size,
    categories: new Set(eligibleTickets.map((ticket) => ticket.category_id)).size };
  return { summary, compatible_source: compatibleSource, issues,
    additions: Object.fromEntries(Object.entries(additions).map(([key, rows]) => [key, [...rows.values()]])) };
}

async function planSafeFromDatabase(sample, writeClean = false) {
  const models = { centers: ServiceCenter, categories: IssueCategory, customers: Customer,
    devices: Device, tickets: Ticket, status_logs: TicketStatusLog };
  // Native driver avoids Mongoose model initialization, collection creation and indexes.
  const uri = process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/mekong_warranty');
  if (!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(uri)) throw new Error('Invalid MONGODB_URI');
  const client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000
  });
  try {
    await client.connect();
    const db = client.db();
    const entries = await Promise.all(Object.entries(models).map(async ([name, Model]) =>
      [name, await db.collection(Model.collection.name).find({}).toArray()]));
    const existing = Object.fromEntries(entries);
    const plan = planSafe(sample, existing);
    if (writeClean) {
      const invalid = Object.entries(plan.summary).some(([, stats]) =>
        stats.sample_conflicts !== 0 || stats.existing_total !== stats.sample_identical);
      const complete = plan.compatible_source.tickets === sample.tickets.length &&
        plan.compatible_source.status_logs === sample.status_logs.length;
      if (invalid || !complete || plan.issues.length) {
        throw new Error('Chỉ nạp trên CSDL trống hoặc đã chứa đúng mẫu này; phát hiện dữ liệu khác hoặc xung đột, không ghi.');
      }
      for (const [name, Model] of Object.entries(models)) {
        const rows = plan.additions[name];
        if (rows.length) {
          const cast = rows.map((row) => {
            const document = new Model(row).toObject();
            delete document._id;
            return document;
          });
          await db.collection(Model.collection.name).insertMany(cast, { ordered: true });
        }
      }
      console.log('Đã nạp mẫu vào CSDL được xác định là trống hoặc khớp mẫu; không cập nhật dữ liệu có sẵn.');
      return;
    }
    const keys = { centers: 'center_id', categories: 'category_id', customers: 'customer_id', devices: 'device_id', tickets: 'ticket_id', status_logs: 'log_id' };
    const proposed_ids = Object.fromEntries(Object.entries(plan.additions).map(([name, rows]) => [name, rows.map((row) => row[keys[name]])]));
    console.log(JSON.stringify({ summary: plan.summary, compatible_source: plan.compatible_source, proposed_ids, issues: plan.issues }, null, 2));
    console.log('Chỉ kiểm tra đọc; không thay đổi dữ liệu.');
  } finally {
    await client.close();
  }
}

/**
 * Chỉ chèn các bản ghi nguồn không xung đột vào CSDL đang có.
 * Không cập nhật hoặc xóa bất kỳ bản ghi hiện hữu nào.
 *
 * @param {object} sample Bộ mẫu đã đọc.
 * @returns {Promise<void>}
 * @throws {Error} Khi chưa xác nhận, có xung đột mới hoặc ghi thất bại.
 */
async function addSafeFromDatabase(sample) {
  if (!process.argv.includes('--confirm-add-safe')) {
    throw new Error('Cần --confirm-add-safe sau khi đã sao lưu; không ghi dữ liệu.');
  }
  const models = {
    centers: ServiceCenter, categories: IssueCategory, customers: Customer,
    devices: Device, tickets: Ticket, status_logs: TicketStatusLog
  };
  const uri = process.env.MONGODB_URI || (process.env.NODE_ENV === 'production' ? '' : 'mongodb://127.0.0.1:27017/mekong_warranty');
  if (!/^mongodb(?:\+srv)?:\/\/[^\s]+$/.test(uri)) throw new Error('Invalid MONGODB_URI');
  const client = new mongoose.mongo.MongoClient(uri, {
    serverSelectionTimeoutMS: 3000,
    connectTimeoutMS: 3000
  });
  const inserted = {};
  try {
    await client.connect();
    const db = client.db();
    const entries = await Promise.all(Object.entries(models).map(async ([name, Model]) =>
      [name, await db.collection(Model.collection.name).find({}).toArray()]));
    const plan = planSafe(sample, Object.fromEntries(entries));
    for (const name of ['centers', 'categories', 'customers', 'devices', 'tickets', 'status_logs']) {
      const rows = plan.additions[name];
      if (!rows.length) continue;
      const cast = rows.map((row) => {
        const document = new models[name](row).toObject();
        delete document._id;
        return document;
      });
      const result = await db.collection(models[name].collection.name).insertMany(cast, { ordered: true });
      inserted[name] = result.insertedCount;
      console.log(`  ${name}: chèn ${result.insertedCount}/${rows.length}`);
    }
    console.log(`Hoàn tất chỉ bổ sung. Đã chèn: ${JSON.stringify(inserted)}. Không cập nhật hoặc xóa bản ghi cũ.`);
  } catch (error) {
    if (Object.keys(inserted).length) {
      console.error(`Ghi dở dang; đã chèn: ${JSON.stringify(inserted)}. Dùng bản sao lưu để đối soát.`);
    }
    throw error;
  } finally {
    await client.close();
  }
}

/**
 * Chỉ lập kế hoạch chỉ đọc; không ghi dữ liệu.
 *
 * @returns {Promise<void>}
 * @throws {Error} Khi thiếu tệp mẫu, dữ liệu trùng khóa hoặc MongoDB lỗi.
 */
async function seed() {
  const centers = readSample('service_centers.json');
  const categories = readSample('issue_categories.json');
  const seedData = readSample('l2_seed_sample.json');

  if (!Array.isArray(centers) || centers.length !== 6) {
    throw new Error('service_centers.json phải có đúng 6 trung tâm.');
  }
  if (!Array.isArray(categories) || categories.length !== 6) {
    throw new Error('issue_categories.json phải có đúng 6 nhóm sự cố.');
  }
  if (
    !seedData ||
    !Array.isArray(seedData.customers) ||
    !Array.isArray(seedData.devices) ||
    !Array.isArray(seedData.tickets) ||
    !Array.isArray(seedData.status_logs)
  ) {
    throw new Error('l2_seed_sample.json thiếu customers/devices/tickets/status_logs.');
  }

  assertUnique(centers, 'center_id', 'service_centers');
  assertUnique(categories, 'category_id', 'issue_categories');
  assertUnique(seedData.customers, 'customer_id', 'customers');
  assertUnique(seedData.devices, 'device_id', 'devices');
  assertUnique(seedData.tickets, 'ticket_id', 'tickets');
  assertUnique(seedData.status_logs, 'log_id', 'status_logs');

  if (process.argv.length === 2) {
    await planSafeFromDatabase({ centers, categories, ...seedData }, true);
    return;
  }
  if (process.argv.includes('--plan-safe') || process.argv.includes('--check')) {
    await planSafeFromDatabase({ centers, categories, ...seedData });
    return;
  }
  if (process.argv.includes('--add-safe')) {
    await addSafeFromDatabase({ centers, categories, ...seedData });
    return;
  }
  throw new Error('Use --plan-safe or --check; no writing mode is enabled.');
}

if (require.main === module) seed()
  .catch((error) => {
    console.error('Seed thất bại:', error.message);
    process.exitCode = 1;
  });

module.exports = { planSafe };
