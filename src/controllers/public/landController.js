import db from '../../models/index.js';
import {
  buildPublicRegionCard,
  buildPublicRegionWhere,
  normalizePublicLandQuery,
} from '../../services/landPublicQueryService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../services/plagueWorkflowService.js';

const { Plague, Region } = db;

export const renderLandsPublic = async (req, res) => {
  try {
    const query = normalizePublicLandQuery(req.query);
    const result = await Region.findAndCountAll({
      where: buildPublicRegionWhere(db.Sequelize.Op, query),
      attributes: ['id', 'name'],
      include: [
        {
          model: Plague,
          as: 'plagues',
          attributes: ['id', 'name', 'scientific_name'],
          through: { attributes: [] },
          where: {
            workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
            status: true,
          },
          required: false,
        },
      ],
      order: [['name', 'ASC']],
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
      distinct: true,
    });
    const totalPages = Math.ceil(result.count / query.limit) || 1;

    return res.render('public/lands', {
      pageTitle: 'Regiones agrícolas',
      activePage: 'lands',
      regions: result.rows.map(buildPublicRegionCard),
      totalCount: result.count,
      currentPage: query.page,
      totalPages,
      hasMultiplePages: totalPages > 1,
      hasPrevPage: query.page > 1,
      hasNextPage: query.page < totalPages,
      prevPage: query.page - 1,
      nextPage: query.page + 1,
      search: query.search,
    });
  } catch (error) {
    console.error('Error al cargar las regiones agrícolas:', error);
    return res.status(500).render('public/lands', {
      pageTitle: 'Regiones agrícolas',
      activePage: 'lands',
      regions: [],
      totalCount: 0,
      error: 'No fue posible cargar la información regional.',
    });
  }
};
