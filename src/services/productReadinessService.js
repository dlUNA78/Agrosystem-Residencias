import { PRODUCT_WORKFLOW_ACTIONS } from './productWorkflowService.js';

const readinessActions = new Set([
  PRODUCT_WORKFLOW_ACTIONS.SUBMIT_REVIEW,
  PRODUCT_WORKFLOW_ACTIONS.VERIFY,
  PRODUCT_WORKFLOW_ACTIONS.PUBLISH,
]);
const hasText = (value) => String(value || '').trim().length > 0;

export const buildProductPublicationReadiness = (
  product = {},
  { imageCount } = {},
) => {
  const count = Number.isSafeInteger(Number(imageCount))
    ? Number(imageCount)
    : Array.isArray(product.images)
      ? product.images.length
      : 0;
  const items = [
    ['identity', 'Identificación comercial', hasText(product.name)],
    ['category', 'Categoría', hasText(product.category)],
    ['ingredient', 'Ingrediente activo', hasText(product.active_ingredient)],
    ['registration', 'Registro oficial', hasText(product.registration_code)],
    ['manufacturer', 'Fabricante', hasText(product.manufacturer)],
    ['description', 'Descripción técnica', hasText(product.description)],
    ['action', 'Modo de acción', hasText(product.mode_of_action)],
    ['dosage', 'Dosis sugerida', hasText(product.suggested_dosage)],
    [
      'safety',
      'Intervalo de seguridad',
      Number.isInteger(Number(product.safety_interval_days)) &&
        Number(product.safety_interval_days) >= 0 &&
        Number(product.safety_interval_days) <= 3650,
    ],
    ['images', 'Evidencia fotográfica', count > 0],
  ].map(([key, label, complete]) => ({ key, label, complete }));
  const missingItems = items
    .filter((item) => !item.complete)
    .map((item) => item.label);

  return {
    items,
    completeCount: items.length - missingItems.length,
    totalCount: items.length,
    missingItems,
    isReady: missingItems.length === 0,
  };
};

export const requiresProductReadiness = (action) =>
  readinessActions.has(action);
