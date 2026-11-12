import db from '../models/index.js';

const countModel = async (model, where, transaction) => {
  if (typeof model?.count !== 'function') {
    return 0;
  }
  return model.count({ where, transaction });
};

const countRaw = async (sql, replacements, transaction) => {
  if (typeof db.sequelize?.query !== 'function') {
    return 0;
  }
  const [rows] = await db.sequelize.query(sql, { replacements, transaction });
  return rows?.[0]?.count || 0;
};

/**
 * Evalúa el impacto operativo y agronómico antes de dar de baja un cultivo.
 */
export const getCropDeactivationImpact = async (cropId, transaction) => {
  const activeFarmCrops = await countModel(
    db.FarmCrop,
    { crop_id: cropId, is_active: true },
    transaction,
  );

  const plaguesCount = await countRaw(
    'SELECT COUNT(*)::int AS count FROM "CropPlagues" WHERE crop_id = :cropId',
    { cropId },
    transaction,
  );

  const productsCount = await countRaw(
    'SELECT COUNT(*)::int AS count FROM "CropProducts" WHERE crop_id = :cropId',
    { cropId },
    transaction,
  );

  const hasBlockingDependencies = activeFarmCrops > 0;
  const message = hasBlockingDependencies
    ? `No se puede dar de baja este cultivo: actualmente se encuentra sembrado en ${activeFarmCrops} lote(s)/predio(s) activo(s).`
    : null;

  return {
    hasBlockingDependencies,
    activeFarmCrops,
    plaguesCount,
    productsCount,
    message,
  };
};

/**
 * Evalúa el impacto fitosanitario antes de dar de baja una plaga o patógeno.
 */
export const getPlagueDeactivationImpact = async (plagueId, transaction) => {
  const openHealthReports = await countModel(
    db.FarmHealthReport,
    { plague_id: plagueId, status: 'open' },
    transaction,
  );

  const cropsCount = await countRaw(
    'SELECT COUNT(*)::int AS count FROM "CropPlagues" WHERE plague_id = :plagueId',
    { plagueId },
    transaction,
  );

  const productsCount = await countRaw(
    'SELECT COUNT(*)::int AS count FROM "PlagueProducts" WHERE plague_id = :plagueId',
    { plagueId },
    transaction,
  );

  const hasBlockingDependencies = openHealthReports > 0;
  const message = hasBlockingDependencies
    ? `No se puede dar de baja esta plaga: existen ${openHealthReports} alerta(s) o reporte(s) fitosanitario(s) abierto(s) en predios.`
    : null;

  return {
    hasBlockingDependencies,
    openHealthReports,
    cropsCount,
    productsCount,
    message,
  };
};

/**
 * Evalúa el impacto antes de dar de baja un producto agroquímico.
 */
export const getProductDeactivationImpact = async (productId, transaction) => {
  const applicationsCount = await countModel(
    db.FarmApplication,
    { product_id: productId },
    transaction,
  );

  const cropsCount = await countRaw(
    'SELECT COUNT(*)::int AS count FROM "CropProducts" WHERE product_id = :productId',
    { productId },
    transaction,
  );

  const plaguesCount = await countRaw(
    'SELECT COUNT(*)::int AS count FROM "PlagueProducts" WHERE product_id = :productId',
    { productId },
    transaction,
  );

  return {
    hasBlockingDependencies: false,
    applicationsCount,
    cropsCount,
    plaguesCount,
    message: null,
  };
};

/**
 * Evalúa el impacto de dar de baja un ingrediente activo sobre los productos comerciales registrados.
 */
export const getIngredientDeactivationImpact = async (
  ingredientName,
  transaction,
) => {
  if (!ingredientName) {
    return {
      hasBlockingDependencies: false,
      activeProductsCount: 0,
      message: null,
    };
  }

  const activeProductsCount = await countModel(
    db.Product,
    { active_ingredient: ingredientName, status: true },
    transaction,
  );

  const hasBlockingDependencies = activeProductsCount > 0;
  const message = hasBlockingDependencies
    ? `No se puede dar de baja este ingrediente activo: está formulado en ${activeProductsCount} producto(s) comercial(es) activo(s).`
    : null;

  return {
    hasBlockingDependencies,
    activeProductsCount,
    message,
  };
};
