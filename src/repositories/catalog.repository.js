const { ServiceCenter, IssueCategory } = require('../models/schemas');

/**
 * Lấy các trung tâm bảo hành đang hoạt động.
 *
 * @returns {Promise<Array<object>>} Danh sách trung tâm.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function listCenters() {
  return ServiceCenter.find({ is_active: true }).sort({ center_id: 1 }).lean();
}

/**
 * Tìm trung tâm bảo hành theo mã.
 *
 * @param {string} centerId Mã trung tâm.
 * @returns {Promise<object|null>} Trung tâm hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findCenterById(centerId) {
  return ServiceCenter.findOne({ center_id: centerId }).lean();
}

/**
 * Lấy các nhóm sự cố đang hoạt động.
 *
 * @returns {Promise<Array<object>>} Danh sách nhóm sự cố.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function listCategories() {
  return IssueCategory.find({ is_active: true }).sort({ category_id: 1 }).lean();
}

/**
 * Tìm nhóm sự cố theo mã.
 *
 * @param {string} categoryId Mã nhóm sự cố.
 * @returns {Promise<object|null>} Nhóm sự cố hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findCategoryById(categoryId) {
  return IssueCategory.findOne({ category_id: categoryId }).lean();
}

/**
 * Tìm nhóm sự cố theo tên chuẩn hóa.
 *
 * @param {string} categoryName Một trong MAN_HINH, PIN, SAC, PHAN_MEM, NUOC_VAO, KHAC.
 * @returns {Promise<object|null>} Nhóm sự cố hoặc null.
 * @throws {Error} Khi truy vấn CSDL thất bại.
 */
function findCategoryByName(categoryName) {
  return IssueCategory.findOne({ category_name: categoryName, is_active: true }).lean();
}

module.exports = {
  listCenters,
  findCenterById,
  listCategories,
  findCategoryById,
  findCategoryByName
};
