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
  ['name', 'nombre común', 150, true],
  ['scientific_name', 'nombre científico', 150, true],
  ['family', 'familia botánica', 100],
  ['genus', 'género', 100],
  ['variety', 'variedad', 150],
  ['region', 'región', 100],
  ['state', 'estado o zona productora', 150],
  ['climate', 'clima', 100],
  ['humidity', 'humedad', 50],
  ['soil_type', 'tipo de suelo', 100],
  ['ph_range', 'rango de pH', 50],
  ['drainage', 'drenaje', 50],
  ['organic_matter', 'materia orgánica', 50],
  ['season', 'temporada', 100],
  ['cycle', 'ciclo', 50],
  ['average_yield', 'rendimiento promedio', 100],
  ['planting_density', 'densidad de siembra', 100],
  ['planting_depth', 'profundidad de siembra', 100],
  ['water_requirement', 'requerimiento hídrico', 50],
  ['irrigation_type', 'tipo de riego', 100],
  ['sunlight_requirement', 'requerimiento de luz', 100],
  ['nutrients', 'nutrientes', 5000],
  ['fertilization', 'fertilización', 5000],
  ['pollination_type', 'tipo de polinización', 100],
  ['description', 'descripción', 10000],
  ['observations', 'observaciones', 10000],
]);

const numericFields = Object.freeze([
  ['min_altitude', 'altitud mínima', 0, 10000, true],
  ['max_altitude', 'altitud máxima', 0, 10000, true],
  ['min_temperature', 'temperatura mínima', -100, 100, false],
  ['max_temperature', 'temperatura máxima', -100, 100, false],
  ['min_rainfall', 'precipitación mínima', 0, 100000, true],
  ['max_rainfall', 'precipitación máxima', 0, 100000, true],
  ['harvest_days', 'días a cosecha', 1, 10000, true],
]);

const normalizeText = (value) => {
  if (value === undefined || value === null) return '';
  return String(value).replaceAll('\0', '').trim();
};

const readText = (input, errors, [field, label, maxLength, required]) => {
  const value = normalizeText(input[field]);

  if (required && !value) {
    errors.push(`El ${label} es obligatorio.`);
  } else if (value.length > maxLength) {
    errors.push(`El ${label} no puede exceder ${maxLength} caracteres.`);
  }

  return value || null;
};

const readNumber = (input, errors, [field, label, min, max, integer]) => {
  const rawValue = normalizeText(input[field]);
  if (!rawValue) return null;

  const value = Number(rawValue);
  const validType =
    Number.isFinite(value) && (!integer || Number.isInteger(value));

  if (!validType || value < min || value > max) {
    errors.push(
      `La ${label} debe ser un número${integer ? ' entero' : ''} entre ${min} y ${max}.`,
    );
    return null;
  }

  return value;
};

const validateRange = (value, errors, minField, maxField, label) => {
  if (
    value[minField] !== null &&
    value[maxField] !== null &&
    value[minField] > value[maxField]
  ) {
    errors.push(
      `La ${label} mínima no puede ser mayor que la ${label} máxima.`,
    );
  }
};

const readPruning = (input, errors) => {
  const value = normalizeText(input.requires_pruning).toLowerCase();
  if (!value) return null;
  if (value === 'true') return true;
  if (value === 'false') return false;
  errors.push('La opción de poda no es válida.');
  return null;
};

export const validateCropInput = (input = {}) => {
  const errors = [];
  const value = Object.fromEntries(
    textFields.map((definition) => [
      definition[0],
      readText(input, errors, definition),
    ]),
  );
  const categoryInput = normalizeText(input.category);
  const category = categoryAliases.get(categoryInput.toLowerCase()) || null;

  if (!categoryInput) {
    errors.push('La categoría es obligatoria.');
  } else if (!category) {
    errors.push('La categoría seleccionada no es válida.');
  }

  value.category = category;

  for (const definition of numericFields) {
    value[definition[0]] = readNumber(input, errors, definition);
  }

  value.requires_pruning = readPruning(input, errors);

  validateRange(value, errors, 'min_altitude', 'max_altitude', 'altitud');
  validateRange(
    value,
    errors,
    'min_temperature',
    'max_temperature',
    'temperatura',
  );
  validateRange(value, errors, 'min_rainfall', 'max_rainfall', 'precipitación');

  return { isValid: errors.length === 0, errors, value };
};
