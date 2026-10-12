import path from 'path';
import { fileURLToPath } from 'url';
import db from '../../models/index.js';
import { validateIngredientPayload } from '../../services/ingredientValidationService.js';
import {
  normalizeIngredientQuery,
  buildIngredientWhere,
  serializeIngredient,
} from '../../services/ingredientQueryService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ruta absoluta al layout privado
const privateLayout = path.join(__dirname, '../../views/layouts/private');

const buildFilterConfig = (query) => [
  {
    id: 'filter-tipo',
    label: 'Tipo: Todos',
    options: [
      { value: 'herbicida', text: 'Herbicida' },
      { value: 'insecticida', text: 'Insecticida' },
      { value: 'fungicida', text: 'Fungicida' },
      { value: 'acaricida', text: 'Acaricida' },
      { value: 'nematicida', text: 'Nematicida' },
      { value: 'bactericida', text: 'Bactericida' },
    ].map((opt) => ({ ...opt, selected: opt.value === query.tipo })),
  },
  {
    id: 'filter-toxicidad',
    label: 'Toxicidad OMS: Todas',
    options: [
      { value: 'clase-i', text: 'Clase I — Extremadamente tóxico' },
      { value: 'clase-ii', text: 'Clase II — Altamente tóxico' },
      { value: 'clase-iii', text: 'Clase III — Moderadamente tóxico' },
      { value: 'clase-iv', text: 'Clase IV — Ligeramente tóxico' },
    ].map((opt) => ({ ...opt, selected: opt.value === query.toxicidad })),
  },
  {
    id: 'filter-status',
    label: 'Estatus: Todos',
    options: [
      { value: 'aprobado', text: 'Aprobado' },
      { value: 'pendiente', text: 'Pendiente' },
      { value: 'restringido', text: 'Restringido' },
    ],
  },
];

const renderBaseConfig = (query) => ({
  layout: privateLayout,
  pageTitle: 'Ingredientes Activos',
  activePage: 'ingredients',
  searchId: 'ingredient-search',
  searchPlaceholder:
    'Buscar por nombre, grupo químico o mecanismo de acción...',
  searchFilters: buildFilterConfig(query),
  ctaLabel: 'Añadir Ingrediente',
  ctaIcon: 'science',
  ctaBtnId: 'btn-add-ingredient',
  showViewToggle: true,
});

export const ingredientsPrivate = async (req = {}, res = {}) => {
  const query = normalizeIngredientQuery(req.query);
  const baseConfig = renderBaseConfig(query);

  try {
    const where = buildIngredientWhere(db.Sequelize, query);

    const result = await db.ActiveIngredient.findAndCountAll({
      where,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
      order: [['createdAt', 'DESC']],
    });

    const serializedIngredients = (result.rows || []).map(serializeIngredient);
    const totalPages = Math.ceil(result.count / query.limit) || 1;

    return res.render('private/catalog/ingredients', {
      ...baseConfig,
      ingredients: serializedIngredients,
      totalCount: result.count,
      currentPage: query.page,
      totalPages,
    });
  } catch (error) {
    console.error('Error al consultar ingredientes activos:', error);
    return res.render('private/catalog/ingredients', {
      ...baseConfig,
      ingredients: [],
      totalCount: 0,
      currentPage: 1,
      totalPages: 1,
      error: 'No fue posible cargar el listado desde la base de datos.',
    });
  }
};

export const createIngredient = async (req, res) => {
  try {
    const validation = validateIngredientPayload(req.body);
    if (!validation.isValid) {
      const errorMsg = encodeURIComponent(validation.errors[0]);
      return res.redirect(`/private/ingredients?error=${errorMsg}`);
    }

    const transaction = await db.sequelize.transaction();
    try {
      const newIngredient = await db.ActiveIngredient.create(
        validation.sanitized,
        { transaction },
      );

      if (db.AuditLog) {
        await db.AuditLog.create(
          {
            user_id: req.user?.id || null,
            action: 'create',
            table_name: 'ActiveIngredients',
            record_id: newIngredient.id,
            new_values: validation.sanitized,
          },
          { transaction },
        );
      }

      await transaction.commit();
      return res.redirect('/private/ingredients?success=creado');
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error al registrar ingrediente activo:', error);
    return res.redirect('/private/ingredients?error=creacion_fallida');
  }
};

export const updateIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const validation = validateIngredientPayload(req.body);
    if (!validation.isValid) {
      const errorMsg = encodeURIComponent(validation.errors[0]);
      return res.redirect(`/private/ingredients?error=${errorMsg}`);
    }

    const ingredient = await db.ActiveIngredient.findByPk(id);
    if (!ingredient) {
      return res.redirect('/private/ingredients?error=no_encontrado');
    }

    const oldValues =
      typeof ingredient.toJSON === 'function'
        ? ingredient.toJSON()
        : { ...ingredient };
    const transaction = await db.sequelize.transaction();
    try {
      await ingredient.update(validation.sanitized, { transaction });

      if (db.AuditLog) {
        await db.AuditLog.create(
          {
            user_id: req.user?.id || null,
            action: 'update',
            table_name: 'ActiveIngredients',
            record_id: ingredient.id,
            old_values: oldValues,
            new_values: validation.sanitized,
          },
          { transaction },
        );
      }

      await transaction.commit();
      return res.redirect('/private/ingredients?success=actualizado');
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error al actualizar ingrediente activo:', error);
    return res.redirect('/private/ingredients?error=actualizacion_fallida');
  }
};

export const deleteIngredient = async (req, res) => {
  try {
    const { id } = req.params;
    const ingredient = await db.ActiveIngredient.findByPk(id);
    if (!ingredient) {
      return res.redirect('/private/ingredients?error=no_encontrado');
    }

    const oldValues =
      typeof ingredient.toJSON === 'function'
        ? ingredient.toJSON()
        : { ...ingredient };
    const transaction = await db.sequelize.transaction();
    try {
      await ingredient.destroy({ transaction });

      if (db.AuditLog) {
        await db.AuditLog.create(
          {
            user_id: req.user?.id || null,
            action: 'delete',
            table_name: 'ActiveIngredients',
            record_id: id,
            old_values: oldValues,
          },
          { transaction },
        );
      }

      await transaction.commit();
      return res.redirect('/private/ingredients?success=eliminado');
    } catch (txError) {
      await transaction.rollback();
      throw txError;
    }
  } catch (error) {
    console.error('Error al eliminar ingrediente activo:', error);
    return res.redirect('/private/ingredients?error=eliminacion_fallida');
  }
};
