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
const { connectDatabase, disconnectDatabase } = require('../src/config/db');

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

/**
 * Upsert một mảng bản ghi theo khóa nghiệp vụ bằng bulkWrite.
 *
 * @param {import('mongoose').Model} Model Mongoose model.
 * @param {Array<object>} rows Bản ghi mẫu.
 * @param {string} key Khóa nghiệp vụ.
 * @param {string} label Nhãn log.
 * @returns {Promise<{matched: number, upserted: number, total: number}>} Thống kê.
 * @throws {Error} Khi bulkWrite thất bại.
 */
async function upsertByKey(Model, rows, key, label) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { matched: 0, upserted: 0, total: 0 };
  }

  const operations = rows.map((row) => ({
    updateOne: {
      filter: { [key]: row[key] },
      update: { $set: row },
      upsert: true
    }
  }));

  const result = await Model.bulkWrite(operations, { ordered: false });
  const total = await Model.countDocuments();
  console.log(
    `  ${label}: ${rows.length} mẫu, matched=${result.matchedCount}, upserted=${result.upsertedCount}, tổng=${total}`
  );
  return {
    matched: result.matchedCount,
    upserted: result.upsertedCount,
    total
  };
}

/**
 * Nạp toàn bộ dữ liệu mẫu L2 vào 6 collection theo cơ chế idempotent.
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

  await connectDatabase();
  console.log('Bắt đầu nạp dữ liệu mẫu L2...');

  await upsertByKey(ServiceCenter, centers, 'center_id', 'service_center');
  await upsertByKey(IssueCategory, categories, 'category_id', 'issue_category');
  await upsertByKey(Customer, seedData.customers, 'customer_id', 'customer');
  await upsertByKey(Device, seedData.devices, 'device_id', 'device');
  await upsertByKey(Ticket, seedData.tickets, 'ticket_id', 'ticket');
  await upsertByKey(TicketStatusLog, seedData.status_logs, 'log_id', 'ticket_status_log');

  console.log('Seed hoàn tất. Chạy lại lệnh này không nhân đôi dữ liệu.');
}

seed()
  .then(async () => {
    await disconnectDatabase();
  })
  .catch(async (error) => {
    console.error('Seed thất bại:', error.message);
    process.exitCode = 1;
    await disconnectDatabase();
  });
