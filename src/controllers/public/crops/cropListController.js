import db from '../../../models/index.js';
import {
  buildPublicCropCard,
  buildPublishedCropWhere,
  normalizePublicCropQuery,
} from '../../../services/cropPublicQueryService.js';

const { Crop, CropImage } = db;

const findPublishedCrops = async (query) => {
  const normalizedQuery = normalizePublicCropQuery(query);
  const where = buildPublishedCropWhere(db.Sequelize.Op, normalizedQuery);
  const offset = (normalizedQuery.page - 1) * normalizedQuery.limit;
  const result = await Crop.findAndCountAll({
    where,
    include: [
      {
        model: CropImage,
        as: 'images',
        required: false,
      },
    ],
    order: [['createdAt', 'DESC']],
    limit: normalizedQuery.limit,
    offset,
    distinct: true,
  });

  return {
    crops: result.rows.map(buildPublicCropCard),
    totalCount: result.count,
    totalPages: Math.ceil(result.count / normalizedQuery.limit) || 1,
    currentPage: normalizedQuery.page,
    query: normalizedQuery,
  };
};

export const getCropsData = async (req, res) => {
  try {
    const result = await findPublishedCrops(req.query);
    return res.json({
      crops: result.crops,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
    });
  } catch (error) {
    console.error('Error en getCropsData:', error);
    return res.status(500).json({ error: 'Error interno del servidor' });
  }
};

export const renderCropsPublic = async (req, res) => {
  try {
    const result = await findPublishedCrops(req.query);

    return res.render('public/crops', {
      pageTitle: 'Catálogo de Cultivos',
      activePage: 'crops',
      crops: result.crops,
      totalCount: result.totalCount,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      hasMultiplePages: result.totalPages > 1,
      hasPrevPage: result.currentPage > 1,
      hasNextPage: result.currentPage < result.totalPages,
      prevPage: result.currentPage - 1,
      nextPage: result.currentPage + 1,
      search: result.query.search,
      selectedCategory: result.query.category,
    });
  } catch (error) {
    console.error('Error en renderCropsPublic:', error);
    return res.status(500).render('public/crops', {
      pageTitle: 'Catálogo de Cultivos',
      activePage: 'crops',
      crops: [],
      totalCount: 0,
      totalPages: 1,
      currentPage: 1,
      error: 'Error al cargar los cultivos',
    });
  }
};
