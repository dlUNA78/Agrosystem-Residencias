const LAND_CROP_STAGES = [
  { order: 1, name: 'Siembra / Trasplante', ratio: 0 },
  { order: 2, name: 'Germinación / Brote', ratio: 0.15 },
  { order: 3, name: 'Desarrollo vegetativo', ratio: 0.4 },
  { order: 4, name: 'Floración / Amarre de fruto', ratio: 0.75 },
  { order: 5, name: 'Maduración y cosecha', ratio: 1 },
];

const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('La fecha de siembra no es válida.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw new Error('La fecha de siembra no es válida.');
  }
  return date;
};

const validateDuration = (value) => {
  const duration = Number(value);
  if (!Number.isInteger(duration) || duration < 1 || duration > 3650) {
    throw new Error('La duración del cultivo debe estar entre 1 y 3650 días.');
  }
  return duration;
};

const addDays = (date, days) => {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
};

export const generateLandCropStages = (plantingDate, harvestDays) => {
  const startDate = parseDateOnly(plantingDate);
  const duration = validateDuration(harvestDays);

  return LAND_CROP_STAGES.map((stage) => ({
    stage_name: stage.name,
    stage_order: stage.order,
    estimated_date: addDays(startDate, Math.round(stage.ratio * duration)),
    actual_date: stage.order === 1 ? plantingDate : null,
    status:
      stage.order === 1
        ? 'completed'
        : stage.order === 2
          ? 'in_progress'
          : 'pending',
    notes: stage.order === 1 ? 'Siembra registrada en el sistema.' : null,
  }));
};

export const summarizeLandCropStages = (stages = []) => {
  const orderedStages = [...stages].sort(
    (left, right) => left.stage_order - right.stage_order,
  );
  const completed = orderedStages.filter(
    (stage) => stage.status === 'completed',
  ).length;

  return {
    stages: orderedStages.map((stage) => ({
      ...stage,
      isCompleted: stage.status === 'completed',
      isInProgress: stage.status === 'in_progress',
      isPending: stage.status === 'pending',
    })),
    currentStage:
      orderedStages.find((stage) => stage.status === 'in_progress') || null,
    progressPercent:
      orderedStages.length === 0
        ? 0
        : Math.round((completed / orderedStages.length) * 100),
  };
};
