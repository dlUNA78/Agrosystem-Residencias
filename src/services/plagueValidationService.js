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

const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).replaceAll('\0', '').trim();
};

const toArray = (value) => {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
};

const buildBiologicalCycle = (input, errors) => {
  const structuredFields = [
    'biological_cycle_title',
    'biological_cycle_description',
    'biological_cycle_duration',
  ];
  const hasStructuredCycle = structuredFields.some(
    (field) => input[field] !== undefined,
  );

  if (!hasStructuredCycle) {
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
  }

  const titles = toArray(input.biological_cycle_title);
  const descriptions = toArray(input.biological_cycle_description);
  const durations = toArray(input.biological_cycle_duration);
  const stageCount = Math.max(
    titles.length,
    descriptions.length,
    durations.length,
  );
  const stages = [];

  for (let index = 0; index < stageCount; index += 1) {
    const title = normalizeText(titles[index]);
    const description = normalizeText(descriptions[index]);
    const duration = normalizeText(durations[index]);

    if (!title && !description && !duration) {
      continue;
    }

    if (!title) {
      errors.push('Cada etapa del ciclo biológico requiere un título.');
    }

    if (title.length > 150) {
      errors.push('El título de cada etapa no puede exceder 150 caracteres.');
    }

    if (description.length > 500) {
      errors.push(
        'La descripción de cada etapa no puede exceder 500 caracteres.',
      );
    }

    if (duration.length > 100) {
      errors.push('La duración de cada etapa no puede exceder 100 caracteres.');
    }

    stages.push({
      title,
      description: description || null,
      duration: duration || null,
    });
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
