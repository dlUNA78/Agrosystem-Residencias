/**
 * Normaliza los parámetros de búsqueda y paginación para ingredientes activos
 */
export const normalizeIngredientQuery = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const rawLimit = parseInt(query.limit, 10) || 15;
  const limit = Math.min(100, Math.max(1, rawLimit));

  return {
    page,
    limit,
    search: typeof query.search === 'string' ? query.search.trim() : '',
    tipo: typeof query.tipo === 'string' ? query.tipo.trim().toLowerCase() : '',
    toxicidad:
      typeof query.toxicidad === 'string'
        ? query.toxicidad.trim().toLowerCase()
        : '',
  };
};

/**
 * Construye la cláusula WHERE de Sequelize según los filtros aplicados
 */
export const buildIngredientWhere = (Sequelize, query = {}) => {
  const { Op } = Sequelize;
  const where = {};

  if (query.tipo) {
    where.action_type = { [Op.like]: `%${query.tipo}%` };
  }

  if (query.toxicidad) {
    where.toxicological_category = query.toxicidad;
  }

  if (query.search) {
    const term = `%${query.search.toLowerCase()}%`;
    where[Op.or] = [
      Sequelize.where(Sequelize.fn('lower', Sequelize.col('name')), {
        [Op.like]: term,
      }),
      Sequelize.where(
        Sequelize.fn(
          'lower',
          Sequelize.fn('coalesce', Sequelize.col('chemical_group'), ''),
        ),
        { [Op.like]: term },
      ),
    ];
  }

  return where;
};

const TOXICITY_LABELS = {
  'clase-i': 'Clase I — Extremadamente tóxico',
  'clase-ii': 'Clase II — Altamente tóxico',
  'clase-iii': 'Clase III — Moderadamente tóxico',
  'clase-iv': 'Clase IV — Ligeramente tóxico',
  u: 'U — Poco probable',
};

/**
 * Serializa un registro de ActiveIngredient para el renderizado
 */
export const serializeIngredient = (raw) => {
  const plain = typeof raw.toJSON === 'function' ? raw.toJSON() : { ...raw };
  const toxicityKey = (plain.toxicological_category || '').toLowerCase();

  return {
    id: plain.id,
    name: plain.name || 'Sin nombre',
    chemical_group: plain.chemical_group || 'No especificado',
    action_type: plain.action_type || 'General',
    toxicological_category: plain.toxicological_category || 'N/A',
    toxicityLabel:
      TOXICITY_LABELS[toxicityKey] ||
      plain.toxicological_category ||
      'No clasificado',
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};
