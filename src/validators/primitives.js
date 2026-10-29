// Kiểm tra thuần dữ liệu, dùng chung cho ranh giới HTTP và lớp nghiệp vụ.
function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date);
}

function isValidDate(value) {
  if (value instanceof Date) return Number.isFinite(value.getTime());
  if (typeof value !== 'string') return false;
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(Z|[+-]\d{2}:\d{2}))?$/.exec(value);
  if (!match) return false;
  const [, year, month, day, hour, minute, second] = match;
  const y = Number(year), m = Number(month), d = Number(day);
  const leap = y % 4 === 0 && (y % 100 !== 0 || y % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return y > 0 && m >= 1 && m <= 12 && d >= 1 && d <= days[m - 1] &&
    (hour === undefined || (Number(hour) < 24 && Number(minute) < 60 && Number(second || 0) < 60)) &&
    Number.isFinite(new Date(value).getTime());
}

const TICKET_FIELDS = { customer_id: 'text', device_id: 'text', center_id: 'text',
  category_id: 'text', issue_desc: 'text', priority: 'text', priority_reason: 'text',
  exterior_note: 'text', accessories: 'array', received_at: 'date' };
const CUSTOMER_FIELDS = { full_name: 'text', phone: 'text', email: 'nullableText',
  address: 'text', segment: 'text', created_at: 'date' };
const DEVICE_FIELDS = { customer_id: 'text', product_name: 'text', serial_no: 'text',
  product_id: 'nullableInteger', product_code: 'text', purchase_date: 'nullableDate',
  warranty_months: 'integer' };

function inputFields(body, types) {
  if (!isRecord(body)) return { body: 'Nội dung yêu cầu phải là một object JSON.' };
  const fields = {};
  for (const [key, type] of Object.entries(types)) {
    const value = body[key];
    if (value === undefined) continue;
    if (type.startsWith('nullable') && (value === null || value === '')) continue;
    let valid;
    if (type === 'text' || type === 'nullableText') valid = typeof value === 'string';
    else if (type === 'date' || type === 'nullableDate') valid = isValidDate(value);
    else if (type === 'array') valid = Array.isArray(value);
    else valid = (typeof value === 'number' || typeof value === 'string') &&
      String(value).trim() !== '' && Number.isSafeInteger(Number(value));
    if (!valid) fields[key] = type.toLowerCase().includes('date')
      ? 'Cần ngày lịch có thật theo ISO 8601; ngày giờ phải có múi giờ.'
      : 'Giá trị không đúng kiểu dữ liệu của trường.';
  }
  return fields;
}

module.exports = { isRecord, isValidDate, inputFields, TICKET_FIELDS, CUSTOMER_FIELDS, DEVICE_FIELDS };
