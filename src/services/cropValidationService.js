export const CROP_TEXT_LIMITS = Object.freeze({
  name: 150,
  scientific_name: 150,
  family: 100,
  genus: 100,
  variety: 150,
  state: 150,
  ph_range: 20,
  average_yield: 100,
  planting_density: 100,
  planting_depth: 100,
  nutrients: 500,
  fertilization: 500,
  description: 5000,
  observations: 3000,
});

export const CROP_NUMERIC_LIMITS = Object.freeze({
  min_altitude: Object.freeze({
    label: 'La altitud mínima',
    min: 0,
    max: 5000,
    integer: true,
  }),
  max_altitude: Object.freeze({
    label: 'La altitud máxima',
    min: 0,
    max: 5000,
    integer: true,
  }),
  min_temperature: Object.freeze({
    label: 'La temperatura mínima',
    min: -20,
    max: 60,
    integer: false,
  }),
  max_temperature: Object.freeze({
    label: 'La temperatura máxima',
    min: -20,
    max: 60,
    integer: false,
  }),
  min_rainfall: Object.freeze({
    label: 'La precipitación mínima',
    min: 0,
    max: 10000,
    integer: true,
  }),
  max_rainfall: Object.freeze({
    label: 'La precipitación máxima',
    min: 0,
    max: 10000,
    integer: true,
  }),
  harvest_days: Object.freeze({
    label: 'Los días a cosecha',
    min: 1,
    max: 3650,
    integer: true,
  }),
});

export const CROP_SELECT_OPTIONS = Object.freeze({
  region: Object.freeze([
    'norte',
    'centro',
    'occidente',
    'sur',
    'sureste',
    'todo-mexico',
    'internacional',
  ]),
  climate: Object.freeze([
    'tropical',
    'subtropical',
    'templado',
    'seco',
    'semiarido',
    'humedo',
    'frio',
  ]),
  humidity: Object.freeze(['baja', 'media', 'alta']),
  soil_type: Object.freeze([
    'arenoso',
    'arcilloso',
    'franco',
    'franco-arenoso',
    'franco-arcilloso',
    'limoso',
  ]),
  drainage: Object.freeze(['bajo', 'medio', 'alto']),
  organic_matter: Object.freeze(['baja', 'media', 'alta']),
  season: Object.freeze([
    'primavera',
    'verano',
    'otoño',
    'invierno',
    'primavera-verano',
    'otoño-invierno',
    'todo-el-año',
  ]),
  cycle: Object.freeze(['corto', 'medio', 'largo', 'perenne']),
  water_requirement: Object.freeze(['bajo', 'medio', 'alto']),
  irrigation_type: Object.freeze([
    'lluvia',
    'goteo',
    'aspersion',
    'gravedad',
    'microaspersion',
    'otro',
  ]),
  sunlight_requirement: Object.freeze([
    'sombra',
    'media-sombra',
    'sol-directo',
  ]),
  pollination_type: Object.freeze([
    'autopolinización',
    'cruzada',
    'viento',
    'insectos',
    'otro',
  ]),
});

const categoryAliases = new Map([
  ['cereal', 'Granos y Cereales'],
  ['granos y cereales', 'Granos y Cereales'],
  ['frutal', 'Frutales'],
  ['frutales', 'Frutales'],
  ['hortaliza', 'Hortalizas'],
  ['hortalizas', 'Hortalizas'],
  ['leguminosa', 'Leguminosas'],
  ['leguminosas', 'Leguminosas'],
  ['oleaginosa', 'Oleaginosas'],
  ['oleaginosas', 'Oleaginosas'],
  ['tuberculo', 'Tubérculos'],
  ['tubérculo', 'Tubérculos'],
  ['tubérculos', 'Tubérculos'],
  ['forrajera', 'Forrajeras'],
  ['forrajeras', 'Forrajeras'],
  ['ornamental', 'Ornamentales'],
  ['ornamentales', 'Ornamentales'],
  ['industrial', 'Industriales'],
  ['industriales', 'Industriales'],
  ['otro', 'Otro'],
]);

const textFields = Object.freeze([
  ['name', 'El nombre común', CROP_TEXT_LIMITS.name, true],
  [
    'scientific_name',
    'El nombre científico',
    CROP_TEXT_LIMITS.scientific_name,
    true,
  ],
  ['family', 'La familia botánica', CROP_TEXT_LIMITS.family],
  ['genus', 'El género', CROP_TEXT_LIMITS.genus],
  ['variety', 'La variedad', CROP_TEXT_LIMITS.variety],
  ['state', 'El estado o zona productora', CROP_TEXT_LIMITS.state],
  ['average_yield', 'El rendimiento promedio', CROP_TEXT_LIMITS.average_yield],
  [
    'planting_density',
    'La densidad de siembra',
    CROP_TEXT_LIMITS.planting_density,
  ],
  [
    'planting_depth',
    'La profundidad de siembra',
    CROP_TEXT_LIMITS.planting_depth,
  ],
  ['nutrients', 'Los nutrientes', CROP_TEXT_LIMITS.nutrients],
  ['fertilization', 'La fertilización', CROP_TEXT_LIMITS.fertilization],
  ['description', 'La descripción', CROP_TEXT_LIMITS.description],
  ['observations', 'Las observaciones', CROP_TEXT_LIMITS.observations],
]);

const selectLabels = Object.freeze({
  region: 'La región',
  climate: 'El tipo de clima',
  humidity: 'La humedad relativa',
  soil_type: 'El tipo de suelo',
  drainage: 'El drenaje',
  organic_matter: 'La materia orgánica',
  season: 'La temporada',
  cycle: 'El ciclo',
  water_requirement: 'El requerimiento de agua',
  irrigation_type: 'El tipo de riego',
  sunlight_requirement: 'El requerimiento de luz',
  pollination_type: 'El tipo de polinización',
});
const requiredSelectFields = new Set(['region']);

const quantityLabels = Object.freeze({
  average_yield: 'El rendimiento promedio',
  planting_density: 'La densidad de siembra',
  planting_depth: 'La profundidad de siembra',
});
const quantityFields = Object.freeze(Object.keys(quantityLabels));
const scientificNamePattern = /^[\p{L}\p{M}][\p{L}\p{M}\s.'’()×-]*$/u;
const quantityPattern = /^(?=.*\d)(?=.*[\p{L}])[\p{L}\p{M}\d\s.,/()%+²³-]+$/u;
const phPattern =
  /^(\d{1,2}(?:[.,]\d{1,2})?)(?:\s*(?:-|–|a)\s*(\d{1,2}(?:[.,]\d{1,2})?))?$/iu;

const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).replaceAll('\0', '').trim();
};

const normalizeOptionKey = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

const addError = (errors, fieldErrors, field, message) => {
  errors.push(message);
  fieldErrors[field] ??= [];
  fieldErrors[field].push(message);
};

const readText = (
  input,
  errors,
  fieldErrors,
  [field, label, maxLength, required],
) => {
  const value = normalizeText(input[field]);

  if (required && !value) {
    addError(errors, fieldErrors, field, `${label} es obligatorio.`);
  } else if (value.length > maxLength) {
    addError(
      errors,
      fieldErrors,
      field,
      `${label} no puede exceder ${maxLength} caracteres.`,
    );
  }

  return value || null;
};

const readNumber = (input, errors, fieldErrors, field, definition) => {
  const rawValue = normalizeText(input[field]);
  if (!rawValue) return null;

  const value = Number(rawValue);
  const validType =
    Number.isFinite(value) && (!definition.integer || Number.isInteger(value));

  if (!validType || value < definition.min || value > definition.max) {
    addError(
      errors,
      fieldErrors,
      field,
      `${definition.label} debe ser un número${definition.integer ? ' entero' : ''} entre ${definition.min} y ${definition.max}.`,
    );
    return null;
  }

  return value;
};

const readSelect = (input, errors, fieldErrors, field, options) => {
  const value = normalizeText(input[field]);
  if (!value) {
    if (requiredSelectFields.has(field)) {
      addError(
        errors,
        fieldErrors,
        field,
        `${selectLabels[field]} es obligatoria.`,
      );
    }
    return null;
  }

  const normalizedOptions = new Map(
    options.map((option) => [normalizeOptionKey(option), option]),
  );
  const canonicalValue = normalizedOptions.get(normalizeOptionKey(value));

  if (!canonicalValue) {
    addError(
      errors,
      fieldErrors,
      field,
      `${selectLabels[field]} no tiene una opción válida.`,
    );
    return null;
  }

  return canonicalValue;
};

const validateRange = (
  value,
  errors,
  fieldErrors,
  minField,
  maxField,
  label,
) => {
  if (
    value[minField] !== null &&
    value[maxField] !== null &&
    value[minField] > value[maxField]
  ) {
    addError(
      errors,
      fieldErrors,
      maxField,
      `La ${label} máxima no puede ser menor que la ${label} mínima.`,
    );
  }
};

const readPruning = (input, errors, fieldErrors) => {
  const value = normalizeText(input.requires_pruning).toLowerCase();
  if (!value) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  addError(
    errors,
    fieldErrors,
    'requires_pruning',
    'La opción de poda no es válida.',
  );
  return null;
};

const validateScientificName = (value, errors, fieldErrors) => {
  if (value && !scientificNamePattern.test(value)) {
    addError(
      errors,
      fieldErrors,
      'scientific_name',
      'El nombre científico sólo puede contener letras y signos taxonómicos.',
    );
  }
};

const validateQuantityFields = (value, errors, fieldErrors) => {
  for (const field of quantityFields) {
    if (value[field] && !quantityPattern.test(value[field])) {
      addError(
        errors,
        fieldErrors,
        field,
        `${quantityLabels[field]} debe incluir una cantidad y su unidad.`,
      );
    }
  }
};

const readPhRange = (input, errors, fieldErrors) => {
  const value = normalizeText(input.ph_range);
  if (!value) return null;

  if (value.length > CROP_TEXT_LIMITS.ph_range) {
    addError(
      errors,
      fieldErrors,
      'ph_range',
      `El rango de pH no puede exceder ${CROP_TEXT_LIMITS.ph_range} caracteres.`,
    );
    return null;
  }

  const match = value.match(phPattern);
  if (!match) {
    addError(
      errors,
      fieldErrors,
      'ph_range',
      'El rango de pH debe tener un formato como 5.5 - 7.0.',
    );
    return null;
  }

  const minimum = Number(match[1].replace(',', '.'));
  const maximum = Number((match[2] || match[1]).replace(',', '.'));
  if (minimum < 0 || maximum > 14 || minimum > maximum) {
    addError(
      errors,
      fieldErrors,
      'ph_range',
      'El pH debe estar entre 0 y 14, ordenado de menor a mayor.',
    );
    return null;
  }

  return value;
};

export const validateCropInput = (input = {}) => {
  const errors = [];
  const fieldErrors = {};
  const value = Object.fromEntries(
    textFields.map((definition) => [
      definition[0],
      readText(input, errors, fieldErrors, definition),
    ]),
  );
  const categoryInput = normalizeText(input.category);
  const category = categoryAliases.get(categoryInput.toLowerCase()) || null;

  if (!categoryInput) {
    addError(errors, fieldErrors, 'category', 'La categoría es obligatoria.');
  } else if (!category) {
    addError(
      errors,
      fieldErrors,
      'category',
      'La categoría seleccionada no es válida.',
    );
  }

  value.category = category;
  value.ph_range = readPhRange(input, errors, fieldErrors);

  for (const [field, definition] of Object.entries(CROP_NUMERIC_LIMITS)) {
    value[field] = readNumber(input, errors, fieldErrors, field, definition);
  }

  for (const [field, options] of Object.entries(CROP_SELECT_OPTIONS)) {
    value[field] = readSelect(input, errors, fieldErrors, field, options);
  }

  value.requires_pruning = readPruning(input, errors, fieldErrors);

  validateScientificName(value.scientific_name, errors, fieldErrors);
  validateQuantityFields(value, errors, fieldErrors);
  validateRange(
    value,
    errors,
    fieldErrors,
    'min_altitude',
    'max_altitude',
    'altitud',
  );
  validateRange(
    value,
    errors,
    fieldErrors,
    'min_temperature',
    'max_temperature',
    'temperatura',
  );
  validateRange(
    value,
    errors,
    fieldErrors,
    'min_rainfall',
    'max_rainfall',
    'precipitación',
  );

  return {
    isValid: errors.length === 0,
    errors,
    fieldErrors,
    value,
  };
};
