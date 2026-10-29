const test = require('node:test');
const assert = require('node:assert/strict');
const { buildFixture } = require('./helpers/inMemoryRepositories');
const { calculateExpiryDate, checkWarranty } = require('../src/services/warrantyCheck.service');
const { addWorkingHours } = require('../src/services/slaCalculator.service');

const isConflict = (error) => error.code === 'TRUNG_DU_LIEU';

test('referenced customers and devices cannot be deleted, including closed tickets', async () => {
  const f = buildFixture({ withOpenTicket: true });
  await f.ticketRepository.update('TCK0001', { status: 'DA_DONG' });
  await assert.rejects(f.customerService.deleteCustomer('CUS0001'), isConflict);
  await assert.rejects(f.warrantyService.deleteDevice('DEV0001'), isConflict);
  assert.ok(await f.customerRepository.findById('CUS0001'));
  assert.ok(await f.deviceRepository.findById('DEV0001'));
});

test('customers with devices cannot be deleted; unrelated CRUD remains available', async () => {
  const f = buildFixture();
  await assert.rejects(f.customerService.deleteCustomer('CUS0002'), isConflict);
  await f.warrantyService.deleteDevice('DEV0002');
  await assert.rejects(f.customerService.deleteCustomer('CUS0002'), isConflict);
  const customer = await f.customerService.createCustomer({ full_name: 'Test', phone: '0987654321' });
  await f.customerService.updateCustomer(customer.customer_id, { full_name: 'Updated' });
  assert.equal((await f.customerService.getCustomer(customer.customer_id)).full_name, 'Updated');
  await f.customerService.deleteCustomer(customer.customer_id);
});

test('archived phone and serial remain reserved on create and update', async () => {
  const f = buildFixture();
  await f.customerRepository.softDelete('CUS0002');
  await f.deviceRepository.softDelete('DEV0002');
  await assert.rejects(f.customerService.createCustomer({ full_name: 'Test', phone: '0912345678' }), isConflict);
  await assert.rejects(f.customerService.updateCustomer('CUS0001', { phone: '0912345678' }), isConflict);
  await assert.rejects(f.warrantyService.createDevice({ customer_id: 'CUS0001', serial_no: 'SN000000000002', product_name: 'Test' }), isConflict);
  await assert.rejects(f.warrantyService.updateDevice('DEV0001', { serial_no: 'SN000000000002' }), isConflict);
});

test('warranty month addition follows Vietnam calendar with end-of-month clamping', () => {
  assert.equal(calculateExpiryDate('2024-01-31T00:00:00+07:00', 1).toISOString(), '2024-02-28T17:00:00.000Z');
  assert.equal(calculateExpiryDate('2023-01-31T00:00:00+07:00', 1).toISOString(), '2023-02-27T17:00:00.000Z');
  assert.equal(checkWarranty({ purchase_date: '2024-01-31T00:00:00+07:00', warranty_months: 1 }, '2024-02-29T23:59:00+07:00').conBaoHanh, true);
  assert.equal(checkWarranty({ purchase_date: '2024-01-31T00:00:00+07:00', warranty_months: 1 }, '2024-03-01T00:00:00+07:00').conBaoHanh, false);
});

test('SLA excludes Vietnam Sunday even when UTC is still Saturday', () => {
  assert.equal(addWorkingHours('2026-10-24T23:00:00+07:00', 2).toISOString(), '2026-10-25T18:00:00.000Z');
  assert.equal(addWorkingHours('2026-10-25T01:00:00+07:00', 1).toISOString(), '2026-10-25T19:00:00.000Z');
  assert.equal(addWorkingHours('2026-10-24T09:00:00+07:00', 24).toISOString(), '2026-10-26T02:00:00.000Z');
});
