import { PLAGUE_WORKFLOW_ACTIONS } from './plagueWorkflowService.js';

const readinessActions = new Set([
  PLAGUE_WORKFLOW_ACTIONS.SUBMIT_REVIEW,
  PLAGUE_WORKFLOW_ACTIONS.VERIFY,
  PLAGUE_WORKFLOW_ACTIONS.PUBLISH,
]);

const hasText = (value) => String(value || '').trim().length > 0;

const hasBiologicalCycle = (cycle) => {
  if (Array.isArray(cycle)) {
    return cycle.some((stage) => {
      if (typeof stage === 'string') return hasText(stage);
      return (
        hasText(stage?.title) ||
        hasText(stage?.description) ||
        hasText(stage?.duration)
      );
    });
  }

  if (cycle && typeof cycle === 'object') {
    return Object.keys(cycle).length > 0;
  }

  if (!hasText(cycle)) {
    return false;
  }

  try {
    return hasBiologicalCycle(JSON.parse(cycle));
  } catch {
    return true;
  }
};

const resolveCount = (explicitCount, records) => {
  if (explicitCount === undefined || explicitCount === null) {
    return Array.isArray(records) ? records.length : 0;
  }

  const count = Number(explicitCount);

  if (Number.isSafeInteger(count) && count >= 0) {
    return count;
  }

  return 0;
};

export const buildPlaguePublicationReadiness = (
  plagueData = {},
  counts = {},
) => {
  const imageCount = resolveCount(counts.imageCount, plagueData.images);
  const cropCount = resolveCount(counts.cropCount, plagueData.crops);
  const regionCount = resolveCount(counts.regionCount, plagueData.regions);
  const items = [
    {
      key: 'identity',
      label: 'Identificación taxonómica',
      hint: 'Nombre común y nombre científico.',
      complete: hasText(plagueData.name) && hasText(plagueData.scientific_name),
    },
    {
      key: 'classification',
      label: 'Clasificación y riesgo',
      hint: 'Categoría y nivel de riesgo general.',
      complete: hasText(plagueData.category) && hasText(plagueData.risk_level),
    },
    {
      key: 'description',
      label: 'Descripción técnica',
      hint: 'Características morfológicas o biológicas.',
      complete: hasText(plagueData.description),
    },
    {
      key: 'symptoms',
      label: 'Síntomas observables',
      hint: 'Daños o señales detectables en el cultivo.',
      complete: hasText(plagueData.symptoms),
    },
    {
      key: 'control',
      label: 'Estrategia de control',
      hint: 'Al menos un método de control o control biológico.',
      complete:
        hasText(plagueData.control_methods) ||
        hasText(plagueData.biological_control),
    },
    {
      key: 'cycle',
      label: 'Ciclo biológico',
      hint: 'Al menos una etapa documentada.',
      complete: hasBiologicalCycle(plagueData.biological_cycle),
    },
    {
      key: 'images',
      label: 'Evidencia fotográfica',
      hint: 'Al menos una imagen de referencia.',
      complete: imageCount > 0,
    },
    {
      key: 'crops',
      label: 'Cultivo hospedero',
      hint: 'Al menos un cultivo afectado relacionado.',
      complete: cropCount > 0,
    },
    {
      key: 'regions',
      label: 'Región de incidencia',
      hint: 'Al menos una región relacionada.',
      complete: regionCount > 0,
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

export const requiresPlagueReadiness = (action) => readinessActions.has(action);
