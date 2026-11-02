import db from '../../models/index.js';
import {
  buildNationalRegionCoverageMap,
  buildPublicRegionCard,
  buildPublicRegionWhere,
  normalizePublicLandQuery,
  parsePublicCoverageFilter,
} from '../../services/landPublicQueryService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../services/plagueWorkflowService.js';

const { Plague, Region } = db;

const publishedPlagueInclude = {
  model: Plague,
  as: 'plagues',
  attributes: ['id', 'name', 'scientific_name'],
  through: { attributes: [] },
  where: {
    workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
    status: true,
  },
  required: false,
};

const fetchAllRegionsForMap = async () => {
  if (typeof Region.findAll !== 'function') return [];
  const allRows = await Region.findAll({
    attributes: ['id', 'name'],
    include: [publishedPlagueInclude],
    order: [['name', 'ASC']],
  });
  return allRows.map(buildPublicRegionCard);
};

const filterByCoverage = (cards, coverage) =>
  coverage === 'active' ? cards.filter((card) => card.plagueCount > 0) : cards;

export const renderLandsPublic = async (req, res) => {
  try {
    const query = normalizePublicLandQuery(req.query);
    const coverage = parsePublicCoverageFilter(req.query);
    const [result, allRegionCards] = await Promise.all([
      Region.findAndCountAll({
        where: buildPublicRegionWhere(db.Sequelize.Op, query),
        attributes: ['id', 'name'],
        include: [publishedPlagueInclude],
        order: [['name', 'ASC']],
        limit: query.limit,
        offset: (query.page - 1) * query.limit,
        distinct: true,
      }),
      fetchAllRegionsForMap(),
    ]);

    const mappedCards = result.rows.map(buildPublicRegionCard);
    const filteredCards = filterByCoverage(mappedCards, coverage);
    const effectiveTotal =
      coverage === 'active' ? filteredCards.length : result.count;
    const totalPages = Math.ceil(effectiveTotal / query.limit) || 1;
    const coverageMap = buildNationalRegionCoverageMap(
      allRegionCards.length > 0 ? allRegionCards : mappedCards,
    );

    return res.render('public/lands', {
      pageTitle: 'Regiones agrícolas',
      activePage: 'lands',
      regions: filteredCards,
      totalCount: effectiveTotal,
      currentPage: query.page,
      totalPages,
      hasMultiplePages: totalPages > 1,
      hasPrevPage: query.page > 1,
      hasNextPage: query.page < totalPages,
      prevPage: query.page - 1,
      nextPage: query.page + 1,
      search: query.search,
      selectedCoverage: coverage,
      hasActiveFilters: Boolean(query.search || coverage),
      coverageMap,
      quickRegions: allRegionCards.slice(0, 6).map((r) => r.name),
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
