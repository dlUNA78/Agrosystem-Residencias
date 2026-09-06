import { CROP_WORKFLOW_ACTIONS } from './cropWorkflowService.js';

const readinessActions = new Set([
  CROP_WORKFLOW_ACTIONS.SUBMIT_REVIEW,
  CROP_WORKFLOW_ACTIONS.VERIFY,
  CROP_WORKFLOW_ACTIONS.PUBLISH,
]);

const hasText = (value) => String(value || '').trim().length > 0;

const hasEither = (record, ...fields) =>
  fields.some((field) => hasText(record[field]));

const resolveImageCount = (cropData, explicitCount) => {
  if (explicitCount !== undefined && explicitCount !== null) {
    const count = Number(explicitCount);
    return Number.isSafeInteger(count) && count >= 0 ? count : 0;
  }

  return Array.isArray(cropData.images) ? cropData.images.length : 0;
};

export const buildCropPublicationReadiness = (cropData = {}, counts = {}) => {
  const imageCount = resolveImageCount(cropData, counts.imageCount);
  const items = [
    {
      key: 'identity',
      label: 'Identificación taxonómica',
      hint: 'Nombre común y nombre científico.',
      complete: hasText(cropData.name) && hasText(cropData.scientific_name),
    },
    {
      key: 'classification',
      label: 'Clasificación',
      hint: 'Categoría agronómica del cultivo.',
      complete: hasText(cropData.category),
    },
    {
      key: 'description',
      label: 'Descripción técnica',
      hint: 'Descripción agronómica del cultivo.',
      complete: hasText(cropData.description),
    },
    {
      key: 'region',
      label: 'Región productiva',
      hint: 'Región o zona principal de producción.',
      complete: hasText(cropData.region),
    },
    {
      key: 'climate',
      label: 'Condiciones climáticas',
      hint: 'Clima u óptimo climático documentado.',
      complete: hasEither(cropData, 'climate', 'optimal_climate'),
    },
    {
      key: 'soil',
      label: 'Requisitos de suelo',
      hint: 'Tipo o requisitos de suelo documentados.',
      complete: hasEither(cropData, 'soil_type', 'soil_requirements'),
    },
    {
      key: 'cycle',
      label: 'Ciclo agrícola',
      hint: 'Ciclo y temporada de siembra.',
      complete:
        hasEither(cropData, 'cycle', 'growth_cycle') &&
        hasEither(cropData, 'season', 'planting_season'),
    },
    {
      key: 'water',
      label: 'Requerimiento hídrico',
      hint: 'Necesidades o nivel de agua documentado.',
      complete: hasEither(cropData, 'water_requirement', 'water_requirements'),
    },
    {
      key: 'images',
      label: 'Evidencia fotográfica',
      hint: 'Al menos una imagen de referencia.',
      complete: imageCount > 0,
    },
  ];
  const completeCount = items.filter((item) => item.complete).length;
  const missingItems = items
    .filter((item) => !item.complete)
    .map((item) => item.label);

  return {
    items,
    completeCount,
    totalCount: items.length,
    missingItems,
    isReady: missingItems.length === 0,
  };
};

export const requiresCropReadiness = (action) => readinessActions.has(action);
