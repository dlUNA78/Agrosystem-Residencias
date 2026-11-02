const ACTION_LABELS = Object.freeze({
  herbicida: 'Herbicida',
  insecticida: 'Insecticida',
  fungicida: 'Fungicida',
  acaricida: 'Acaricida',
  nematicida: 'Nematicida',
  bactericida: 'Bactericida',
});

const TOXICITY_LABELS = Object.freeze({
  'clase-i': 'Clase I — Extremadamente tóxico',
  'clase-ii': 'Clase II — Altamente tóxico',
  'clase-iii': 'Clase III — Moderadamente tóxico',
  'clase-iv': 'Clase IV — Ligeramente tóxico',
  u: 'U — Poco probable',
});

const TOXICITY_THEMES = Object.freeze({
  'clase-i': {
    shortLabel: 'Clase I · OMS',
    badgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
    dotClass: 'bg-rose-500',
  },
  'clase-ii': {
    shortLabel: 'Clase II · OMS',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
    dotClass: 'bg-amber-500',
  },
  'clase-iii': {
    shortLabel: 'Clase III · OMS',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-800',
    dotClass: 'bg-sky-500',
  },
  'clase-iv': {
    shortLabel: 'Clase IV · OMS',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClass: 'bg-emerald-500',
  },
  u: {
    shortLabel: 'Clase U · OMS',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    dotClass: 'bg-emerald-500',
  },
});

const DEFAULT_TOXICITY_THEME = Object.freeze({
  shortLabel: 'Sin clasificar',
  badgeClass: 'border-slate-200 bg-slate-100 text-slate-600',
  dotClass: 'bg-slate-400',
});

const cleanParam = (val) =>
  typeof val === 'string' ? val.trim().toLowerCase() : '';

/**
 * Normaliza los parámetros de búsqueda y paginación para ingredientes activos
 */
export const normalizeIngredientQuery = (query = {}) => {
  const page = Math.max(1, Number.parseInt(query.page, 10) || 1);
  const rawLimit = Number.parseInt(query.limit, 10) || 12;
  const limit = Math.min(100, Math.max(1, rawLimit));

  return {
    page,
    limit,
    search: typeof query.search === 'string' ? query.search.trim() : '',
    tipo: cleanParam(query.tipo),
    toxicidad: cleanParam(query.toxicidad),
    status: cleanParam(query.status),
  };
};

const applyStatusWhere = (Op, where, status) => {
  if (!status || where.toxicological_category) return;
  if (status === 'restringido') {
    where.toxicological_category = 'clase-i';
    return;
  }
  if (status === 'aprobado' && Op.in) {
    where.toxicological_category = {
      [Op.in]: ['clase-ii', 'clase-iii', 'clase-iv', 'u'],
    };
    return;
  }
  if (status === 'pendiente') {
    where.toxicological_category = null;
  }
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

  applyStatusWhere(Op, where, query.status);

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

const resolveRegulatoryBadge = (toxicityKey) => {
  if (toxicityKey === 'clase-i') {
    return {
      statusKey: 'restringido',
      regulatoryLabel: 'Restringido',
      regulatoryBadgeClass: 'border-rose-200 bg-rose-50 text-rose-800',
    };
  }
  if (toxicityKey) {
    return {
      statusKey: 'aprobado',
      regulatoryLabel: 'Aprobado',
      regulatoryBadgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-800',
    };
  }
  return {
    statusKey: 'pendiente',
    regulatoryLabel: 'Pendiente OMS',
    regulatoryBadgeClass: 'border-amber-200 bg-amber-50 text-amber-800',
  };
};

const toPlainIngredient = (raw) =>
  typeof raw?.toJSON === 'function' ? raw.toJSON() : { ...raw };

const formatIngredientCode = (id) => `IA-${String(id || 0).padStart(4, '0')}`;

const resolveActionLabel = (actionKey, rawAction) =>
  ACTION_LABELS[actionKey] || rawAction || 'General';

const resolveToxicityLabel = (toxicityKey, rawTox) =>
  TOXICITY_LABELS[toxicityKey] || rawTox || 'No clasificado';

/**
 * Serializa un registro de ActiveIngredient para el renderizado
 */
export const serializeIngredient = (raw) => {
  const plain = toPlainIngredient(raw);
  const actionKey = (plain.action_type || '').toLowerCase();
  const toxicityKey = (plain.toxicological_category || '').toLowerCase();
  const toxicityTheme = TOXICITY_THEMES[toxicityKey] || DEFAULT_TOXICITY_THEME;
  const regulatory = resolveRegulatoryBadge(toxicityKey);

  return {
    id: plain.id,
    code: formatIngredientCode(plain.id),
    name: plain.name || 'Sin nombre',
    chemical_group: plain.chemical_group || 'No especificado',
    rawChemicalGroup: plain.chemical_group || '',
    action_type: plain.action_type || 'General',
    rawActionType: actionKey,
    actionLabel: resolveActionLabel(actionKey, plain.action_type),
    toxicological_category: plain.toxicological_category || 'N/A',
    rawToxicity: toxicityKey,
    toxicityLabel: resolveToxicityLabel(
      toxicityKey,
      plain.toxicological_category,
    ),
    toxicityShortLabel: toxicityTheme.shortLabel,
    toxicityBadgeClass: toxicityTheme.badgeClass,
    toxicityDotClass: toxicityTheme.dotClass,
    ...regulatory,
    createdAt: plain.createdAt,
    updatedAt: plain.updatedAt,
  };
};

/**
 * Calcula indicadores ejecutivos en tiempo real sobre el catálogo químico
 */
export const computeIngredientStats = (rows = [], fallbackTotal = 0) => {
  const list = Array.isArray(rows) ? rows : [];
  let approvedCount = 0;
  let pendingCount = 0;
  let restrictedCount = 0;
  const groups = new Set();

  list.forEach((item) => {
    const plain = typeof item?.toJSON === 'function' ? item.toJSON() : item;
    const tox = String(plain?.toxicological_category || '')
      .trim()
      .toLowerCase();
    const grp = String(plain?.chemical_group || '')
      .trim()
      .toLowerCase();

    if (grp) groups.add(grp);
    if (tox === 'clase-i') {
      restrictedCount += 1;
    } else if (tox) {
      approvedCount += 1;
    } else {
      pendingCount += 1;
    }
  });

  return {
    total: list.length || fallbackTotal,
    approvedCount,
    pendingCount,
    restrictedCount,
    distinctGroups: groups.size,
  };
};
