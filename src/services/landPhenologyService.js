const LAND_CROP_STAGES = [
  { order: 1, name: 'Siembra / Trasplante', ratio: 0 },
  { order: 2, name: 'Germinación / Brote', ratio: 0.15 },
  { order: 3, name: 'Desarrollo vegetativo', ratio: 0.4 },
  { order: 4, name: 'Floración / Amarre de fruto', ratio: 0.75 },
  { order: 5, name: 'Maduración y cosecha', ratio: 1 },
];

const FINISHED_STATUSES = new Set(['completed', 'archived']);

const parseDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('La fecha de siembra no es válida.');
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
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

const resolveReferenceDate = (referenceDate, plantingDate) => {
  if (!referenceDate) return plantingDate;
  if (referenceDate instanceof Date) {
    return referenceDate.toISOString().slice(0, 10);
  }
  if (
    typeof referenceDate === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(referenceDate)
  ) {
    return referenceDate;
  }
  return plantingDate;
};

const buildStageSeed = (stage, startDate, duration) => ({
  stage_name: stage.name,
  stage_order: stage.order,
  estimated_date: addDays(startDate, Math.round(stage.ratio * duration)),
  actual_date: null,
  status: 'pending',
  notes: null,
});

const applyStageStatusByDate = (stages, refDateStr) => {
  stages.forEach((stage) => {
    if (stage.stage_order === 1) {
      stage.status = 'completed';
      stage.actual_date = stage.estimated_date;
      stage.notes = 'Siembra registrada en el sistema.';
    } else if (stage.estimated_date <= refDateStr) {
      stage.status = 'completed';
      stage.actual_date = stage.estimated_date;
    }
  });

  const firstPending = stages.find((stage) => stage.status === 'pending');
  if (firstPending) {
    firstPending.status = 'in_progress';
  } else if (stages.length > 0) {
    stages[stages.length - 1].status = 'in_progress';
  }
};

export const generateLandCropStages = (
  plantingDate,
  harvestDays,
  referenceDate = null,
) => {
  const startDate = parseDateOnly(plantingDate);
  const duration = validateDuration(harvestDays);
  const refDateStr = resolveReferenceDate(referenceDate, plantingDate);

  const stages = LAND_CROP_STAGES.map((stage) =>
    buildStageSeed(stage, startDate, duration),
  );
  applyStageStatusByDate(stages, refDateStr);
  return stages;
};

const calculateTimeProgress = ({
  plantingDate,
  estimatedHarvestDate,
  todayStr,
  isFinished,
  completedCount,
  totalStages,
}) => {
  if (isFinished) return 100;
  if (!plantingDate || !estimatedHarvestDate || totalStages === 0) {
    return totalStages === 0
      ? 0
      : Math.round((completedCount / totalStages) * 100);
  }
  const pTime = new Date(`${plantingDate}T00:00:00.000Z`).getTime();
  const hTime = new Date(`${estimatedHarvestDate}T00:00:00.000Z`).getTime();
  const tTime = new Date(`${todayStr}T00:00:00.000Z`).getTime();
  const totalDuration = Math.max(1, hTime - pTime);
  const elapsed = Math.max(0, tTime - pTime);

  if (tTime < pTime) return 0;
  const timePercent = Math.min(
    100,
    Math.round((elapsed / totalDuration) * 100),
  );
  const stagePercent = Math.round((completedCount / totalStages) * 100);
  return Math.max(stagePercent, timePercent);
};

const checkIsCycleFinished = (options = {}) =>
  options.isCycleActive === false || FINISHED_STATUSES.has(options.cycleStatus);

const extractCycleDates = (orderedStages, todayOption) => {
  const todayStr = todayOption || new Date().toISOString().slice(0, 10);
  if (orderedStages.length === 0) {
    return {
      plantingDate: null,
      estimatedHarvestDate: null,
      harvestDays: null,
      elapsedDays: null,
      todayStr,
    };
  }
  const stage1 = orderedStages[0];
  const stage5 = orderedStages[orderedStages.length - 1];
  const plantingDate = stage1.actual_date || stage1.estimated_date || null;
  const estimatedHarvestDate = stage5.estimated_date || null;

  if (!plantingDate || !estimatedHarvestDate) {
    return {
      plantingDate,
      estimatedHarvestDate,
      harvestDays: null,
      elapsedDays: null,
      todayStr,
    };
  }
  const pTime = new Date(`${plantingDate}T00:00:00.000Z`).getTime();
  const hTime = new Date(`${estimatedHarvestDate}T00:00:00.000Z`).getTime();
  const tTime = new Date(`${todayStr}T00:00:00.000Z`).getTime();
  const harvestDays = Math.max(1, Math.round((hTime - pTime) / 86400000));
  const elapsedDays = Math.max(0, Math.round((tTime - pTime) / 86400000));
  return {
    plantingDate,
    estimatedHarvestDate,
    harvestDays,
    elapsedDays,
    todayStr,
  };
};

const formatStageItem = (stage, isFinished) => {
  if (isFinished) {
    return {
      ...stage,
      isCompleted: true,
      isInProgress: false,
      isPending: false,
    };
  }
  return {
    ...stage,
    isCompleted: stage.status === 'completed',
    isInProgress: stage.status === 'in_progress',
    isPending: stage.status === 'pending',
  };
};

const resolveCurrentStage = (orderedStages) => {
  if (orderedStages.length === 0) return null;
  const inProgress = orderedStages.find(
    (stage) => stage.status === 'in_progress',
  );
  return inProgress || orderedStages[orderedStages.length - 1];
};

const calculateProgress = (
  orderedStages,
  completed,
  options,
  dateInfo,
  isFinished,
) => {
  if (orderedStages.length === 0) return 0;
  if (options.useTimeProgress) {
    return calculateTimeProgress({
      plantingDate: dateInfo.plantingDate,
      estimatedHarvestDate: dateInfo.estimatedHarvestDate,
      todayStr: dateInfo.todayStr,
      isFinished,
      completedCount: completed,
      totalStages: orderedStages.length,
    });
  }
  return Math.round((completed / orderedStages.length) * 100);
};

export const summarizeLandCropStages = (stages = [], options = {}) => {
  const orderedStages = [...stages].sort(
    (left, right) => left.stage_order - right.stage_order,
  );
  const isFinished = checkIsCycleFinished(options);
  const completed = orderedStages.filter(
    (stage) => stage.status === 'completed',
  ).length;
  const dateInfo = extractCycleDates(orderedStages, options.today);
  const progressPercent = calculateProgress(
    orderedStages,
    completed,
    options,
    dateInfo,
    isFinished,
  );

  return {
    stages: orderedStages.map((stage) => formatStageItem(stage, isFinished)),
    currentStage: resolveCurrentStage(orderedStages),
    estimatedHarvestDate: dateInfo.estimatedHarvestDate,
    harvestDays: dateInfo.harvestDays,
    elapsedDays: dateInfo.elapsedDays,
    progressPercent,
  };
};
