import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../models/index.js';
import { validateIngredientPayload } from '../../services/ingredientValidationService.js';
import {
  normalizeIngredientQuery,
  buildIngredientWhere,
  serializeIngredient,
  computeIngredientStats,
} from '../../services/ingredientQueryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateLayout = path.join(__dirname, '../../views/layouts/private');

const ACTION_FILTER_OPTIONS = [
  { value: 'herbicida', text: 'Herbicida' },
  { value: 'insecticida', text: 'Insecticida' },
  { value: 'fungicida', text: 'Fungicida' },
  { value: 'acaricida', text: 'Acaricida' },
  { value: 'nematicida', text: 'Nematicida' },
  { value: 'bactericida', text: 'Bactericida' },
];

const TOXICITY_FILTER_OPTIONS = [
  { value: 'clase-i', text: 'Clase I — Extremadamente tóxico' },
  { value: 'clase-ii', text: 'Clase II — Altamente tóxico' },
  { value: 'clase-iii', text: 'Clase III — Moderadamente tóxico' },
  { value: 'clase-iv', text: 'Clase IV — Ligeramente tóxico' },
  { value: 'u', text: 'Clase U — Poco probable' },
];

const STATUS_FILTER_OPTIONS = [
  { value: 'aprobado', text: 'Aprobado (OMS II–U)' },
  { value: 'pendiente', text: 'Pendiente de clasificar' },
  { value: 'restringido', text: 'Restringido (Clase I)' },
];

const buildFilterConfig = (query) => [
  {
    id: 'filter-tipo',
    name: 'tipo',
    label: 'Tipo: Todos',
    options: ACTION_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      selected: opt.value === query.tipo,
    })),
  },
  {
    id: 'filter-toxicidad',
    name: 'toxicidad',
    label: 'Toxicidad OMS: Todas',
    options: TOXICITY_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      selected: opt.value === query.toxicidad,
    })),
  },
  {
    id: 'filter-status',
    name: 'status',
    label: 'Estatus: Todos',
    options: STATUS_FILTER_OPTIONS.map((opt) => ({
      ...opt,
      selected: opt.value === query.status,
    })),
  },
];

const countActiveFilters = (query) =>
  [query.tipo, query.toxicidad, query.status].filter(Boolean).length;

const renderBaseConfig = (query, user) => {
  const activeFilterCount = countActiveFilters(query);
  return {
    layout: privateLayout,
    pageTitle: 'Ingredientes Activos',
    activePage: 'ingredients',
    searchId: 'ingredient-search',
    searchPlaceholder:
      'Buscar por molécula, grupo químico o categoría toxicológica...',
    searchFilters: buildFilterConfig(query),
    ctaLabel: 'Añadir Ingrediente',
    ctaIcon: 'science',
    ctaBtnId: 'btn-add-ingredient',
    showViewToggle: true,
    canManage: user?.role === 'admin',
    query,
    activeFilterCount,
    hasActiveFilters: Boolean(query.search || activeFilterCount > 0),
    quickTypes: ACTION_FILTER_OPTIONS.slice(0, 4).map((opt) => ({
      ...opt,
      selected: opt.value === query.tipo,
    })),
  };
};

const buildPaginationMeta = (count, page, limit) => {
  const totalPages = Math.max(1, Math.ceil(count / limit));
  const safePage = Math.min(page, totalPages);
  const startItem = count === 0 ? 0 : (safePage - 1) * limit + 1;
  const endItem = Math.min(count, safePage * limit);

  return {
    totalPages,
    currentPage: safePage,
    hasPrev: safePage > 1,
    hasNext: safePage < totalPages,
    prevPage: Math.max(1, safePage - 1),
    nextPage: Math.min(totalPages, safePage + 1),
    startItem,
    endItem,
  };
};

const fetchGlobalStats = async (fallbackRows, fallbackCount) => {
  if (typeof db.ActiveIngredient.findAll === 'function') {
    const allRows = await db.ActiveIngredient.findAll({
      attributes: [
        'id',
        'chemical_group',
        'action_type',
        'toxicological_category',
      ],
    });
    return computeIngredientStats(allRows, fallbackCount);
  }
  return computeIngredientStats(fallbackRows, fallbackCount);
};

export const ingredientsPrivate = async (req = {}, res = {}) => {
  const query = normalizeIngredientQuery(req.query);
  const baseConfig = renderBaseConfig(query, req.user);

  try {
    const where = buildIngredientWhere(db.Sequelize, query);
    const result = await db.ActiveIngredient.findAndCountAll({
      where,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
      order: [['createdAt', 'DESC']],
    });

    const rows = result.rows || [];
    const serializedIngredients = rows.map(serializeIngredient);
    const stats = await fetchGlobalStats(rows, result.count);
    const pagination = buildPaginationMeta(
      result.count,
      query.page,
      query.limit,
    );

    return res.render('private/catalog/ingredients', {
      ...baseConfig,
      ingredients: serializedIngredients,
      totalCount: result.count,
      currentPage: pagination.currentPage,
      totalPages: pagination.totalPages,
      pagination,
      stats,
    });
  } catch (error) {
    console.error('Error al consultar ingredientes activos:', error);
    return res.render('private/catalog/ingredients', {
      ...baseConfig,
      ingredients: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      pagination: buildPaginationMeta(0, 1, query.limit),
      stats: computeIngredientStats([], 0),
      error: 'No fue posible cargar el listado desde la base de datos.',
    });
  }
};

const isAsyncFetch = (req) => req?.headers?.['x-requested-with'] === 'fetch';

const respondMutationSuccess = (req, res, slug, message, statusCode = 200) => {
  if (isAsyncFetch(req)) {
    return res.status(statusCode).json({ success: true, message });
  }
  return res.redirect(`/private/ingredients?success=${slug}`);
};

const respondMutationError = (req, res, slugOrMsg, isEncoded = false) => {
  if (isAsyncFetch(req)) {
    const message = isEncoded ? decodeURIComponent(slugOrMsg) : slugOrMsg;
    return res.status(400).json({ success: false, error: message });
  }
  return res.redirect(`/private/ingredients?error=${slugOrMsg}`);
};

const recordIngredientAudit = async (payload, transaction) => {
  if (!db.AuditLog) return;
  await db.AuditLog.create(
    {
      table_name: 'ActiveIngredients',
      ...payload,
    },
    { transaction },
  );
};

const toPlainValues = (entity) =>
  typeof entity.toJSON === 'function' ? entity.toJSON() : { ...entity };

export const createIngredient = async (req, res) => {
  try {
    const validation = validateIngredientPayload(req.body);
    if (!validation.isValid) {
      const errorMsg = encodeURIComponent(validation.errors[0]);
      return respondMutationError(req, res, errorMsg, true);
    }

    const transaction = await db.sequelize.transaction();
    try {
      const newIngredient = await db.ActiveIngredient.create(
        validation.sanitized,
        { transaction },
      );

      await recordIngredientAudit(
        {
          user_id: req.user?.id || null,
          action: 'create',
          record_id: newIngredient.id,
          new_values: validation.sanitized,
        },
        transaction,
      );

      await transaction.commit();
      return respondMutationSuccess(
        req,
        res,
        'creado',
        'Ingrediente activo registrado correctamente.',
        201,
      );
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error al registrar ingrediente activo:', error);
    return respondMutationError(req, res, 'creacion_fallida');
  }
};

export const updateIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const validation = validateIngredientPayload(req.body);
    if (!validation.isValid) {
      const errorMsg = encodeURIComponent(validation.errors[0]);
      return respondMutationError(req, res, errorMsg, true);
    }

    const ingredient = await db.ActiveIngredient.findByPk(id);
    if (!ingredient) {
      return respondMutationError(req, res, 'no_encontrado');
    }

    const oldValues = toPlainValues(ingredient);
    const transaction = await db.sequelize.transaction();
    try {
      await ingredient.update(validation.sanitized, { transaction });
      await recordIngredientAudit(
        {
          user_id: req.user?.id || null,
          action: 'update',
          record_id: ingredient.id,
          old_values: oldValues,
          new_values: validation.sanitized,
        },
        transaction,
      );

      await transaction.commit();
      return respondMutationSuccess(
        req,
        res,
        'actualizado',
        'Ingrediente activo actualizado.',
      );
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error al actualizar ingrediente activo:', error);
    return respondMutationError(req, res, 'actualizacion_fallida');
  }
};

export const deleteIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const ingredient = await db.ActiveIngredient.findByPk(id);
    if (!ingredient) {
      return respondMutationError(req, res, 'no_encontrado');
    }

    const oldValues = toPlainValues(ingredient);
    const transaction = await db.sequelize.transaction();
    try {
      await ingredient.destroy({ transaction });
      await recordIngredientAudit(
        {
          user_id: req.user?.id || null,
          action: 'delete',
          record_id: id,
          old_values: oldValues,
        },
        transaction,
      );

      await transaction.commit();
      return respondMutationSuccess(
        req,
        res,
        'eliminado',
        'Ingrediente activo eliminado del catálogo.',
      );
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error al eliminar ingrediente activo:', error);
    return respondMutationError(req, res, 'eliminacion_fallida');
  }
};
