const { notFound } = require('./errors');
const { getSlaHours } = require('./slaCalculator.service');

/**
 * Tạo lớp nghiệp vụ danh mục (trung tâm, nhóm sự cố) và gợi ý mức ưu tiên (FR5, UC5).
 *
 * @param {{catalogRepository: object}} deps Phụ thuộc repository danh mục.
 * @returns {object} Các hàm nghiệp vụ danh mục.
 */
function createCategoryService({ catalogRepository }) {
  if (!catalogRepository) {
    throw new Error('createCategoryService cần catalogRepository.');
  }

  /**
   * Lấy toàn bộ danh mục đang hoạt động để giao diện dựng bộ lọc và form.
   *
   * @returns {Promise<{centers: Array<object>, categories: Array<object>}>} Danh mục.
   * @throws {Error} Khi repository không trả được dữ liệu.
   */
  async function listCatalogs() {
    const [centers, categories] = await Promise.all([
      catalogRepository.listCenters(),
      catalogRepository.listCategories()
    ]);
    return { centers, categories };
  }

  /**
   * Lấy một nhóm sự cố đang hoạt động.
   *
   * @param {string} categoryId Mã nhóm sự cố.
   * @returns {Promise<object>} Nhóm sự cố.
   * @throws {import('./errors').AppError} KHONG_TIM_THAY khi không có.
   */
  async function getCategory(categoryId) {
    const category = await catalogRepository.findCategoryById(categoryId);
    if (!category || category.is_active === false) {
      throw notFound('Không tìm thấy nhóm sự cố.');
    }
    return category;
  }

  /**
   * Lấy một trung tâm bảo hành đang hoạt động.
   *
   * @param {string} centerId Mã trung tâm.
   * @returns {Promise<object>} Trung tâm.
   * @throws {import('./errors').AppError} KHONG_TIM_THAY khi không có.
   */
  async function getCenter(centerId) {
    const center = await catalogRepository.findCenterById(centerId);
    if (!center || center.is_active === false) {
      throw notFound('Không tìm thấy trung tâm bảo hành.');
    }
    return center;
  }

  /**
   * Gợi ý mức ưu tiên mặc định và số giờ SLA theo nhóm sự cố (UC5, FR5, QT-04).
   *
   * @param {string} categoryId Mã nhóm sự cố.
   * @returns {Promise<{category: object, suggestedPriority: string, slaHours: number}>} Gợi ý.
   * @throws {import('./errors').AppError} KHONG_TIM_THAY hoặc DU_LIEU_KHONG_HOP_LE.
   */
  async function suggestPriority(categoryId) {
    const category = await getCategory(categoryId);
    return {
      category,
      suggestedPriority: category.default_priority,
      slaHours: getSlaHours(category.default_priority)
    };
  }

  return {
    listCatalogs,
    getCategory,
    getCenter,
    suggestPriority
  };
}

const catalogRepository = require('../repositories/catalog.repository');

module.exports = {
  createCategoryService,
  ...createCategoryService({ catalogRepository })
};
