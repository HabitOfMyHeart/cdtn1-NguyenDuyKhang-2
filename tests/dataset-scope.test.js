const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const data = require('../data/sample/l2_seed_sample.json');
const centers = require('../data/sample/service_centers.json');
const categories = require('../data/sample/issue_categories.json');
const schemas = require('../src/models/schemas');
const { planSafe } = require('../seeds/seed_l2_data');

test('sample scope, unique keys, references, and schema validation', () => {
  assert.ok(data.tickets.length >= 50 && data.tickets.length <= 100);
  assert.ok(data.status_logs.length >= 100 && data.status_logs.length <= 200);
  assert.ok(data.customers.length >= 30 && data.customers.length <= 50);
  assert.equal(centers.length, 6);
  assert.equal(categories.length, 6);
  const groups = [[data.customers, 'customer_id', schemas.Customer], [data.devices, 'device_id', schemas.Device],
    [data.tickets, 'ticket_id', schemas.Ticket], [data.status_logs, 'log_id', schemas.TicketStatusLog],
    [centers, 'center_id', schemas.ServiceCenter], [categories, 'category_id', schemas.IssueCategory]];
  for (const [rows, key, Model] of groups) {
    assert.equal(new Set(rows.map((row) => row[key])).size, rows.length);
    for (const row of rows) assert.equal(new Model(row).validateSync(), undefined, `${Model.modelName} ${row[key]}`);
  }
  const ids = (rows, key) => new Set(rows.map((row) => row[key]));
  const cs = ids(data.customers, 'customer_id'), ds = ids(data.devices, 'device_id');
  const ts = ids(data.tickets, 'ticket_id'), cts = ids(centers, 'center_id'), cats = ids(categories, 'category_id');
  assert.equal(new Set(data.tickets.map((t) => t.center_id)).size, 6);
  assert.equal(new Set(data.tickets.map((t) => t.category_id)).size, 6);
  for (const d of data.devices) assert.ok(cs.has(d.customer_id));
  for (const t of data.tickets) {
    assert.ok(cs.has(t.customer_id) && ds.has(t.device_id) && cts.has(t.center_id) && cats.has(t.category_id));
    assert.equal(data.devices.find((d) => d.device_id === t.device_id).customer_id, t.customer_id);
  }
  for (const l of data.status_logs) assert.ok(ts.has(l.ticket_id));
  for (const [rows, key] of [[data.customers, 'phone'], [data.devices, 'serial_no'], [data.tickets, 'ticket_code']])
    assert.equal(ids(rows, key).size, rows.length);
});

test('safe plan blocks divergent parents and their logs without changing existing documents', () => {
  const sample = { centers, categories, ...data };
  const models = { centers: schemas.ServiceCenter, categories: schemas.IssueCategory,
    customers: schemas.Customer, devices: schemas.Device, tickets: schemas.Ticket, status_logs: schemas.TicketStatusLog };
  const existing = Object.fromEntries(Object.entries(models).map(([name, Model]) =>
    [name, sample[name].map((row) => new Model(row).toObject())]));
  const target = sample.tickets[0];
  existing.devices.find((d) => d.device_id === target.device_id).purchase_date = new Date('2020-01-01');
  existing.tickets.find((t) => t.ticket_id === target.ticket_id).status = 'MOI';
  existing.status_logs = [];
  const before = JSON.stringify(existing);
  const plan = planSafe(sample, existing);
  assert.equal(JSON.stringify(existing), before);
  assert.ok(!plan.additions.status_logs.some((log) => log.ticket_id === target.ticket_id));
  assert.ok(plan.issues.some((issue) => issue.id === target.ticket_id));
  assert.ok(plan.additions.status_logs.some((log) => log.ticket_id !== target.ticket_id));
});

test('safe plan detects alternate unique keys and existing open-ticket device conflicts', () => {
  const sample = { centers, categories, ...data };
  const existing = Object.fromEntries(['centers', 'categories', 'customers', 'devices', 'tickets', 'status_logs'].map((name) => [name, []]));
  const target = sample.tickets.find((ticket) => ticket.status !== 'DA_DONG');
  existing.tickets.push({ ticket_id: 'OTHER', ticket_code: 'OTHER', device_id: target.device_id, status: 'MOI', is_deleted: false });
  const blockedCustomer = sample.customers.find((customer) => customer.customer_id !== target.customer_id);
  existing.customers.push({ customer_id: 'OTHER', phone: blockedCustomer.phone });
  const plan = planSafe(sample, existing);
  assert.ok(!plan.additions.tickets.some((ticket) => ticket.ticket_id === target.ticket_id));
  assert.ok(!plan.additions.tickets.some((ticket) => ticket.customer_id === blockedCustomer.customer_id));
  assert.ok(plan.issues.some((issue) => issue.collection === 'customers' && issue.id === blockedCustomer.customer_id));
});

test('re-extraction reproduces committed sample when source is available', { skip: !process.env.DATASET_SOURCE }, () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'l2-sample-'));
  try {
    const output = path.join(tmp, 'sample.json');
    const result = spawnSync('python', ['scripts/extract_l2_dataset.py', process.env.DATASET_SOURCE, '--output', output], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(fs.readFileSync(output, 'utf8')), data);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
