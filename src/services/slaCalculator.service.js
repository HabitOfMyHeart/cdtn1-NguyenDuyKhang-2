const { invalid } = require('./errors');
const { isValidDate } = require('../validators/primitives');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
const VN_OFFSET_MS = 7 * HOUR_MS;

const SLA_HOURS = Object.freeze({
  CAO: 24,
  TRUNG_BINH: 72,
  THAP: 120
});

/**
 * Lấy số giờ cam kết theo mức ưu tiên (QT-04).
 *
 * @param {'CAO'|'TRUNG_BINH'|'THAP'} priority Mức ưu tiên.
 * @returns {number} 24, 72 hoặc 120 giờ làm việc.
 * @throws {AppError} DU_LIEU_KHONG_HOP_LE khi mức ưu tiên không hợp lệ.
 */
function getSlaHours(priority) {
  const hours = SLA_HOURS[priority];
  if (!hours) {
    throw invalid('Mức ưu tiên không hợp lệ.', {
      priority: 'Chỉ nhận CAO, TRUNG_BINH hoặc THAP.'
    });
  }
  return hours;
}

/**
 * Thứ Hai – Thứ Bảy là ngày làm việc; Chủ Nhật bị bỏ qua (QT-04).
 *
 * @param {Date} date Ngày cần kiểm tra.
 * @returns {boolean} true nếu không phải Chủ Nhật.
 */
function isWorkingDay(date) {
  return new Date(date.getTime() + VN_OFFSET_MS).getUTCDay() !== 0;
}

/**
 * Dời một thời điểm rơi vào Chủ Nhật sang Thứ Hai cùng giờ.
 *
 * @param {Date} date Thời điểm đầu vào.
 * @returns {Date} Thời điểm đã dời (hoặc giữ nguyên nếu không phải Chủ Nhật).
 */
function moveOffSunday(date) {
  const result = new Date(date);
  if (!isWorkingDay(result)) {
    result.setTime(result.getTime() + DAY_MS);
  }
  return result;
}

/**
 * Cộng số giờ làm việc, bỏ qua trọn ngày Chủ Nhật (QT-04).
 * Mỗi ngày làm việc tương ứng 24 giờ; khi mốc cộng rơi vào Chủ Nhật,
 * mốc được dời sang Thứ Hai cùng giờ. Đây là cách hiểu bám sát câu
 * "chỉ tính ngày làm việc từ thứ Hai đến thứ Bảy" và được kiểm thử ở
 * biên Thứ Bảy + 24 giờ.
 *
 * @param {Date|string} receivedAt Thời điểm tiếp nhận.
 * @param {number} hours Số giờ làm việc cần cộng.
 * @returns {Date} Hạn cam kết.
 * @throws {AppError} DU_LIEU_KHONG_HOP_LE khi đầu vào không hợp lệ.
 */
function addWorkingHours(receivedAt, hours) {
  if (!isValidDate(receivedAt)) {
    throw invalid('Thời điểm tiếp nhận không hợp lệ.', {
      received_at: 'Cần ngày giờ hợp lệ theo ISO 8601.'
    });
  }
  if (!Number.isFinite(hours) || hours < 0) {
    throw invalid('Số giờ cam kết không hợp lệ.', { priority: 'Số giờ phải là số không âm.' });
  }

  let cursor = moveOffSunday(new Date(receivedAt));
  let remaining = hours;

  while (remaining > 0) {
    const vn = new Date(cursor.getTime() + VN_OFFSET_MS);
    const untilMidnight = DAY_MS - (vn.getUTCHours() * HOUR_MS + vn.getUTCMinutes() * 60000 + vn.getUTCSeconds() * 1000 + vn.getUTCMilliseconds());
    const step = Math.min(remaining * HOUR_MS, untilMidnight);
    cursor = moveOffSunday(new Date(cursor.getTime() + step));
    remaining -= step / HOUR_MS;
  }

  return cursor;
}

/**
 * Tính hạn cam kết trả máy từ thời điểm tiếp nhận và mức ưu tiên (QT-04).
 *
 * @param {Date|string} receivedAt Thời điểm tiếp nhận.
 * @param {'CAO'|'TRUNG_BINH'|'THAP'} priority Mức ưu tiên.
 * @returns {Date} Hạn cam kết (Date).
 * @throws {AppError} DU_LIEU_KHONG_HOP_LE khi ngày hoặc mức ưu tiên sai.
 */
function calculateDueDate(receivedAt, priority) {
  return addWorkingHours(receivedAt, getSlaHours(priority));
}

module.exports = {
  SLA_HOURS,
  DAY_MS,
  HOUR_MS,
  addWorkingHours,
  calculateDueDate,
  getSlaHours,
  isWorkingDay,
  isValidDate,
  moveOffSunday
};
