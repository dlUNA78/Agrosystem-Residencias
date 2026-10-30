const allowedCategories = new Set([
  'Insecto',
  'Insectos',
  'Hongo',
  'Hongos',
  'Bacteria',
  'Virus',
  'Ácaro',
  'Ácaros',
]);

const allowedRiskLevels = new Set([
  'Bajo',
  'Medio',
  'Moderado',
  'Alto',
  'Crítico',
]);

const allowedStageDamageLevels = new Set([
  'Sin daño directo',
  'Bajo',
  'Moderado',
  'Severo',
]);

const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).replaceAll('\0', '').trim();
};

const toArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const readStageArray = (input, field) =>
  toArray(input[field] ?? input[`${field}[]`]);

const isControlWindowChecked = (value) => {
  if (value === true) return true;
  const normalized = normalizeText(value).toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'on';
};

const buildLegacyBiologicalCycle = (input, errors) => {
  const rawCycle = normalizeText(input.biological_cycle);
  const legacyCycle = rawCycle
    ? rawCycle
        .split(/\r?\n/)
        .map((stage) => stage.trim())
        .filter(Boolean)
    : [];

  if (legacyCycle.length > 20) {
    errors.push('El ciclo biológico no puede exceder 20 etapas.');
  }

  if (legacyCycle.some((stage) => stage.length > 500)) {
    errors.push('Cada etapa del ciclo debe tener máximo 500 caracteres.');
  }

  return legacyCycle;
};

const validateStageFields = (stage, errors) => {
  if (!stage.title) {
    errors.push('Cada etapa del ciclo biológico requiere un título.');
  } else if (stage.title.length > 150) {
    errors.push('El título de cada etapa no puede exceder 150 caracteres.');
  }

  if (stage.description.length > 500) {
    errors.push(
      'La descripción de cada etapa no puede exceder 500 caracteres.',
    );
  }

  if (stage.duration.length > 100) {
    errors.push('La duración de cada etapa no puede exceder 100 caracteres.');
  }
};

const validateOptionalStageMeta = (stage, errors) => {
  if (stage.plantZone.length > 150) {
    errors.push(
      'La ubicación en planta de cada etapa no puede exceder 150 caracteres.',
    );
  }

  if (stage.damageLevel && !allowedStageDamageLevels.has(stage.damageLevel)) {
    errors.push('La severidad de daño de la etapa no es válida.');
  }

  if (stage.recommendedAction.length > 300) {
    errors.push(
      'La acción recomendada de cada etapa no puede exceder 300 caracteres.',
    );
  }
};

const formatStageRecord = (stage) => {
  const record = {
    title: stage.title,
    description: stage.description || null,
    duration: stage.duration || null,
  };

  if (stage.plantZone) record.plantZone = stage.plantZone;
  if (stage.damageLevel) record.damageLevel = stage.damageLevel;
  if (stage.recommendedAction) {
    record.recommendedAction = stage.recommendedAction;
  }
  if (stage.isControlWindow) record.isControlWindow = true;

  return record;
};

const isStageBlank = (stage) =>
  !stage.title &&
  !stage.description &&
  !stage.duration &&
  !stage.plantZone &&
  !stage.recommendedAction;

const buildBiologicalCycle = (input, errors) => {
  const structuredFields = [
    'biological_cycle_title',
    'biological_cycle_description',
    'biological_cycle_duration',
    'biological_cycle_zone',
    'biological_cycle_damage',
    'biological_cycle_action',
    'biological_cycle_control_window',
  ];
  const hasStructuredCycle = structuredFields.some(
    (field) => input[field] !== undefined || input[`${field}[]`] !== undefined,
  );

  if (!hasStructuredCycle) {
    return buildLegacyBiologicalCycle(input, errors);
  }

  const titles = readStageArray(input, 'biological_cycle_title');
  const descriptions = readStageArray(input, 'biological_cycle_description');
  const durations = readStageArray(input, 'biological_cycle_duration');
  const zones = readStageArray(input, 'biological_cycle_zone');
  const damages = readStageArray(input, 'biological_cycle_damage');
  const actions = readStageArray(input, 'biological_cycle_action');
  const controlWindows = readStageArray(
    input,
    'biological_cycle_control_window',
  );

  const stageCount = Math.max(
    titles.length,
    descriptions.length,
    durations.length,
    zones.length,
    actions.length,
  );
  const stages = [];

  for (let index = 0; index < stageCount; index += 1) {
    const rawStage = {
      title: normalizeText(titles[index]),
      description: normalizeText(descriptions[index]),
      duration: normalizeText(durations[index]),
      plantZone: normalizeText(zones[index]),
      damageLevel: normalizeText(damages[index]),
      recommendedAction: normalizeText(actions[index]),
      isControlWindow: isControlWindowChecked(controlWindows[index]),
    };

    if (isStageBlank(rawStage)) continue;

    validateStageFields(rawStage, errors);
    validateOptionalStageMeta(rawStage, errors);
    stages.push(formatStageRecord(rawStage));
  }

  if (stages.length > 20) {
    errors.push('El ciclo biológico no puede exceder 20 etapas.');
  }

  return stages;
};

export const validatePlagueInput = (input = {}) => {
  const errors = [];

  const readText = (field, label, maxLength, required = false) => {
    const value = normalizeText(input[field]);

    if (required && !value) {
      errors.push(`El ${label} es obligatorio.`);
    } else if (value.length > maxLength) {
      errors.push(`El ${label} no puede exceder ${maxLength} caracteres.`);
    }

    return value || null;
  };

  const name = readText('name', 'nombre común', 150, true);
  const scientificName = readText(
    'scientific_name',
    'nombre científico',
    200,
    true,
  );
  const category = readText('category', 'categoría', 100);
  const riskLevel = readText('risk_level', 'nivel de riesgo', 50);

  if (category && !allowedCategories.has(category)) {
    errors.push('La categoría seleccionada no es válida.');
  }

  if (riskLevel && !allowedRiskLevels.has(riskLevel)) {
    errors.push('El nivel de riesgo seleccionado no es válido.');
  }

  const biologicalCycle = buildBiologicalCycle(input, errors);

  const description = readText('description', 'descripción', 5000);
  const region = readText('region', 'región', 250);
  const symptoms = readText('symptoms', 'síntomas', 5000);
  const controlMethods = readText(
    'control_methods',
    'métodos de control',
    5000,
  );
  const biologicalControl = readText(
    'biological_control',
    'control biológico',
    5000,
  );

  return {
    isValid: errors.length === 0,
    errors,
    value: {
      name,
      scientific_name: scientificName,
      category,
      description,
      risk_level: riskLevel,
      region,
      symptoms,
      control_methods: controlMethods,
      biological_control: biologicalControl,
      biological_cycle: biologicalCycle.length ? biologicalCycle : null,
    },
  };
};
