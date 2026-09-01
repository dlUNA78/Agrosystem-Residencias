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

  const rawCycle = normalizeText(input.biological_cycle);
  const biologicalCycle = rawCycle
    ? rawCycle
        .split(/\r?\n/)
        .map((stage) => stage.trim())
        .filter(Boolean)
    : [];

  if (biologicalCycle.length > 20) {
    errors.push('El ciclo biológico no puede exceder 20 etapas.');
  }

  if (biologicalCycle.some((stage) => stage.length > 500)) {
    errors.push('Cada etapa del ciclo debe tener máximo 500 caracteres.');
  }

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
