require('dotenv').config();

const mongoose = require('mongoose');
const { connectDatabase, disconnectDatabase } = require('../src/config/db');
const {
  Customer,
  Device,
  ServiceCenter,
  IssueCategory,
  Ticket,
  TicketStatusLog
} = require('../src/models/schemas');

const COLLECTIONS = [
  { name: 'customer', model: Customer },
  { name: 'device', model: Device },
  { name: 'service_center', model: ServiceCenter },
  { name: 'issue_category', model: IssueCategory },
  { name: 'ticket', model: Ticket },
  { name: 'ticket_status_log', model: TicketStatusLog }
];

/**
 * Tạo 6 collection nếu chưa có và đồng bộ index từ Mongoose schema.
 * Lệnh có thể chạy lặp mà không làm mất dữ liệu.
 *
 * @returns {Promise<void>}
 * @throws {Error} Khi kết nối hoặc đồng bộ index thất bại.
 */
async function migrate() {
  await connectDatabase();
  const db = mongoose.connection.db;
  const existing = new Set((await db.listCollections().toArray()).map((item) => item.name));

  for (const { name } of COLLECTIONS) {
    if (!existing.has(name)) {
      await db.createCollection(name);
      console.log(`+ Tạo collection ${name}`);
    } else {
      console.log(`= Collection ${name} đã tồn tại`);
    }
  }

  for (const { name, model } of COLLECTIONS) {
    await model.syncIndexes();
    const count = await model.countDocuments();
    console.log(`  ${name}: ${count} bản ghi, index đã đồng bộ`);
  }
}

migrate()
  .then(async () => {
    console.log('Migration 001 hoàn tất.');
    await disconnectDatabase();
  })
  .catch(async (error) => {
    console.error('Migration thất bại:', error.message);
    process.exitCode = 1;
    await disconnectDatabase();
  });
