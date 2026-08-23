/**
 * Módulo de Utilidad Fenológica — Agrosystem
 * Calcula y proyecta las etapas fenológicas basadas en la fecha de siembra
 * y la duración proyectada del cultivo (harvest_days).
 */

const STANDARD_STAGE_PROPORTIONS = [
  { order: 1, name: 'Siembra / Trasplante', ratio: 0.0 },
  { order: 2, name: 'Germinación / Brote', ratio: 0.15 },
  { order: 3, name: 'Desarrollo Vegetativo', ratio: 0.40 },
  { order: 4, name: 'Floración / Amarre de Fruto', ratio: 0.75 },
  { order: 5, name: 'Maduración y Cosecha', ratio: 1.0 },
];

/**
 * Genera el arreglo de 5 objetos de etapa fenológica para insertar en la BD
 * @param {Date|string} plantingDate
 * @param {number|null} harvestDays
 * @returns {Array<Object>}
 */
export function generateDefaultStageRecords(plantingDate, harvestDays = 120) {
  const totalDays = harvestDays && harvestDays > 0 ? Number(harvestDays) : 120;
  const startDate = plantingDate ? new Date(plantingDate) : new Date();

  return STANDARD_STAGE_PROPORTIONS.map((stage) => {
    const offsetDays = Math.round(stage.ratio * totalDays);
    const estDate = new Date(startDate);
    estDate.setDate(estDate.getDate() + offsetDays);

    const isFirst = stage.order === 1;
    const isSecond = stage.order === 2;

    return {
      stage_name: stage.name,
      stage_order: stage.order,
      estimated_date: estDate.toISOString().split('T')[0],
      real_date: isFirst ? startDate.toISOString().split('T')[0] : null,
      status: isFirst ? 'Completada' : isSecond ? 'En Progreso' : 'Pendiente',
      notes: isFirst ? 'Siembra registrada en el sistema' : null,
    };
  });
}

/**
 * Procesa las etapas de un cultivo para calcular progreso porcentual y estado activo
 * @param {Array<Object>} stages
 * @returns {Object} { stagesFormatted, currentStage, progressPercent }
 */
export function processStageTimeline(stages = []) {
  if (!stages || stages.length === 0) {
    return { stagesFormatted: [], currentStage: null, progressPercent: 0 };
  }

  const sortedStages = [...stages].sort((a, b) => a.stage_order - b.stage_order);
  const completedCount = sortedStages.filter((s) => s.status === 'Completada').length;

  let progressPercent = Math.round((completedCount / sortedStages.length) * 100);
  if (progressPercent === 0 && completedCount > 0) progressPercent = 20;

  const currentStage =
    sortedStages.find((s) => s.status === 'En Progreso') ||
    sortedStages.find((s) => s.status === 'Completada') ||
    sortedStages[0];

  const stagesFormatted = sortedStages.map((s) => ({
    ...s,
    isCompleted: s.status === 'Completada',
    isInProgress: s.status === 'En Progreso',
    isPending: s.status === 'Pendiente',
    displayDate: s.real_date || s.estimated_date || 'Por definir',
  }));

  return {
    stagesFormatted,
    currentStage,
    progressPercent,
  };
}
