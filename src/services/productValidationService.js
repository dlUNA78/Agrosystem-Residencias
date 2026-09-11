export const PRODUCT_CATEGORIES = Object.freeze([
  'Herbicida',
  'Insecticida',
  'Fungicida',
  'Fertilizante',
  'Acaricida',
  'Bactericida',
  'Coadyuvante',
]);

export const PRODUCT_HAZARD_CATEGORIES = Object.freeze([
  'Categoría IV — Precaución (Banda Verde)',
  'Categoría III — Ligeramente Peligroso (Banda Azul)',
  'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
  'Categoría I — Altamente Peligroso (Banda Roja)',
]);

const textFields = Object.freeze([
  ['name', 'El nombre', 150, true],
  ['active_ingredient', 'El ingrediente activo', 200, true],
  ['registration_code', 'El registro', 100, true],
  ['manufacturer', 'El fabricante', 150, true],
  ['target_crops', 'Los cultivos objetivo', 1000],
  ['description', 'La descripción', 5000],
  ['mode_of_action', 'El modo de acción', 200],
  ['suggested_dosage', 'La dosis sugerida', 100],
  ['formulation_type', 'El tipo de formulación', 100],
]);

const clean = (value) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim();
const addError = (errors, fieldErrors, field, message) => {
  errors.push(message);
  fieldErrors[field] ??= [];
  fieldErrors[field].push(message);
};

const readTextFields = (input, errors, fieldErrors) =>
  Object.fromEntries(
    textFields.map(([field, label, max, required]) => {
      const normalized = clean(input[field]);
      if (required && !normalized) {
        addError(errors, fieldErrors, field, `${label} es obligatorio.`);
      } else if (normalized.length > max) {
        addError(
          errors,
          fieldErrors,
          field,
          `${label} no puede exceder ${max} caracteres.`,
        );
      }
      return [field, normalized || null];
    }),
  );

const readCategory = (input, errors, fieldErrors) => {
  const category = clean(input.category);
  if (!PRODUCT_CATEGORIES.includes(category)) {
    addError(
      errors,
      fieldErrors,
      'category',
      'Selecciona una categoría válida.',
    );
  }
  return category || null;
};

const readHazardCategory = (input, errors, fieldErrors) => {
  const value = clean(input.hazard_category);
  if (value && !PRODUCT_HAZARD_CATEGORIES.includes(value)) {
    addError(
      errors,
      fieldErrors,
      'hazard_category',
      'Selecciona una categoría toxicológica válida.',
    );
  }
  return value || null;
};

const readDate = (input, errors, fieldErrors) => {
  const date = clean(input.expiration_date);
  const parsed = date ? new Date(`${date}T00:00:00.000Z`) : null;
  const isValid =
    !date ||
    (/^\d{4}-\d{2}-\d{2}$/.test(date) &&
      !Number.isNaN(parsed.getTime()) &&
      parsed.toISOString().slice(0, 10) === date);
  if (!isValid) {
    addError(
      errors,
      fieldErrors,
      'expiration_date',
      'La fecha de vencimiento no es válida.',
    );
  }
  return date || null;
};

const readSafetyInterval = (input, errors, fieldErrors) => {
  const rawValue = clean(input.safety_interval_days);
  if (!rawValue) return null;
  const value = Number(rawValue);
  if (!Number.isInteger(value) || value < 0 || value > 3650) {
    addError(
      errors,
      fieldErrors,
      'safety_interval_days',
      'El intervalo de seguridad debe estar entre 0 y 3650 días.',
    );
  }
  return value;
};

const isSafeHttpUrl = (value) => {
  try {
    const url = new URL(value);
    return ['http:', 'https:'].includes(url.protocol) && value.length <= 2048;
  } catch {
    return false;
  }
};

const readSafetySheetUrl = (input, errors, fieldErrors) => {
  const value = clean(input.safety_sheet_url);
  if (value && !isSafeHttpUrl(value)) {
    addError(
      errors,
      fieldErrors,
      'safety_sheet_url',
      'La ficha de seguridad debe ser una URL HTTP o HTTPS válida.',
    );
  }
  return value || null;
};

export const validateProductInput = (input = {}) => {
  const errors = [];
  const fieldErrors = {};
  const value = readTextFields(input, errors, fieldErrors);
  value.category = readCategory(input, errors, fieldErrors);
  value.hazard_category = readHazardCategory(input, errors, fieldErrors);
  value.expiration_date = readDate(input, errors, fieldErrors);
  value.safety_interval_days = readSafetyInterval(input, errors, fieldErrors);
  value.safety_sheet_url = readSafetySheetUrl(input, errors, fieldErrors);

  return { isValid: errors.length === 0, errors, fieldErrors, value };
};
