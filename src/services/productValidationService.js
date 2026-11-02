export const PRODUCT_CATEGORIES = Object.freeze([
  'Herbicida',
  'Insecticida',
  'Fungicida',
  'Fertilizante',
  'Bioinsumo',
  'Acaricida',
  'Bactericida',
  'Nematicida',
  'Coadyuvante',
]);

export const PRODUCT_HAZARD_CATEGORIES = Object.freeze([
  'Categoría IV — Precaución (Banda Verde)',
  'Categoría III — Ligeramente Peligroso (Banda Azul)',
  'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
  'Categoría I — Altamente Peligroso (Banda Roja)',
]);

export const PRODUCT_HAZARD_BANDS = Object.freeze([
  {
    code: 'verde',
    value: 'Categoría IV — Precaución (Banda Verde)',
    shortLabel: 'Banda Verde · Cat. IV',
    chipLabel: 'Banda Verde (Cat. IV)',
  },
  {
    code: 'azul',
    value: 'Categoría III — Ligeramente Peligroso (Banda Azul)',
    shortLabel: 'Banda Azul · Cat. III',
    chipLabel: 'Banda Azul (Cat. III)',
  },
  {
    code: 'amarilla',
    value: 'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
    shortLabel: 'Banda Amarilla · Cat. II',
    chipLabel: 'Banda Amarilla (Cat. II)',
  },
  {
    code: 'roja',
    value: 'Categoría I — Altamente Peligroso (Banda Roja)',
    shortLabel: 'Banda Roja · Cat. I',
    chipLabel: 'Banda Roja (Cat. I)',
  },
]);

const legacyHazardAliases = new Map([
  ['categoria 5 - precaucion', 'Categoría IV — Precaución (Banda Verde)'],
  ['categoria iv - precaucion', 'Categoría IV — Precaución (Banda Verde)'],
  [
    'categoria iv — precaucion (banda verde)',
    'Categoría IV — Precaución (Banda Verde)',
  ],
  ['verde', 'Categoría IV — Precaución (Banda Verde)'],
  [
    'categoria 4 - precaucion',
    'Categoría III — Ligeramente Peligroso (Banda Azul)',
  ],
  [
    'categoria iii - ligeramente peligroso',
    'Categoría III — Ligeramente Peligroso (Banda Azul)',
  ],
  [
    'categoria iii — ligeramente peligroso (banda azul)',
    'Categoría III — Ligeramente Peligroso (Banda Azul)',
  ],
  ['azul', 'Categoría III — Ligeramente Peligroso (Banda Azul)'],
  [
    'categoria 3 - peligro',
    'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
  ],
  [
    'categoria ii - moderadamente peligroso',
    'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
  ],
  [
    'categoria ii — moderadamente peligroso (banda amarilla)',
    'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
  ],
  ['amarilla', 'Categoría II — Moderadamente Peligroso (Banda Amarilla)'],
  ['categoria 2 - peligro', 'Categoría I — Altamente Peligroso (Banda Roja)'],
  ['categoria 1 - peligro', 'Categoría I — Altamente Peligroso (Banda Roja)'],
  [
    'categoria i - altamente peligroso',
    'Categoría I — Altamente Peligroso (Banda Roja)',
  ],
  [
    'categoria i — altamente peligroso (banda roja)',
    'Categoría I — Altamente Peligroso (Banda Roja)',
  ],
  ['roja', 'Categoría I — Altamente Peligroso (Banda Roja)'],
]);

const HAZARD_THEMES = Object.freeze({
  'Categoría IV — Precaución (Banda Verde)': {
    code: 'verde',
    bandLabel: 'Banda Verde · Precaución',
    shortLabel: 'Cat. IV · Banda Verde',
    fullLabel: 'Categoría IV — Precaución (Banda Verde)',
    normSubtitle:
      'NOM-232-SSA1-2009 · Ligeramente tóxico / Precaución estándar en campo',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    cardClass: 'border-emerald-200 bg-emerald-50/70 text-emerald-950',
    subtitleClass: 'text-emerald-800/90',
    iconClass: 'text-emerald-700 bg-emerald-100 border-emerald-200',
    dotClass: 'bg-emerald-600',
    barClass: 'bg-emerald-600',
    pdfBg: '#d1fae5',
    pdfInk: '#065f46',
  },
  'Categoría III — Ligeramente Peligroso (Banda Azul)': {
    code: 'azul',
    bandLabel: 'Banda Azul · Ligeramente Peligroso',
    shortLabel: 'Cat. III · Banda Azul',
    fullLabel: 'Categoría III — Ligeramente Peligroso (Banda Azul)',
    normSubtitle:
      'NOM-232-SSA1-2009 · Cuidado: requiere equipo de protección básico',
    badgeClass: 'bg-sky-50 text-sky-800 border-sky-200',
    cardClass: 'border-sky-200 bg-sky-50/70 text-sky-950',
    subtitleClass: 'text-sky-800/90',
    iconClass: 'text-sky-700 bg-sky-100 border-sky-200',
    dotClass: 'bg-sky-600',
    barClass: 'bg-sky-600',
    pdfBg: '#e0f2fe',
    pdfInk: '#075985',
  },
  'Categoría II — Moderadamente Peligroso (Banda Amarilla)': {
    code: 'amarilla',
    bandLabel: 'Banda Amarilla · Moderadamente Peligroso',
    shortLabel: 'Cat. II · Banda Amarilla',
    fullLabel: 'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
    normSubtitle:
      'NOM-232-SSA1-2009 · Nocivo: uso obligatorio de equipo de protección completo',
    badgeClass: 'bg-amber-50 text-amber-900 border-amber-300',
    cardClass: 'border-amber-300 bg-amber-50/80 text-amber-950',
    subtitleClass: 'text-amber-800/90',
    iconClass: 'text-amber-700 bg-amber-100 border-amber-300',
    dotClass: 'bg-amber-500',
    barClass: 'bg-amber-500',
    pdfBg: '#fef3c7',
    pdfInk: '#92400e',
  },
  'Categoría I — Altamente Peligroso (Banda Roja)': {
    code: 'roja',
    bandLabel: 'Banda Roja · Altamente Peligroso',
    shortLabel: 'Cat. I · Banda Roja',
    fullLabel: 'Categoría I — Altamente Peligroso (Banda Roja)',
    normSubtitle:
      'NOM-232-SSA1-2009 · Peligro Veneno: manejo restringido bajo supervisión técnica',
    badgeClass: 'bg-rose-50 text-rose-900 border-rose-300',
    cardClass: 'border-rose-300 bg-rose-50/80 text-rose-950',
    subtitleClass: 'text-rose-800/90',
    iconClass: 'text-rose-700 bg-rose-100 border-rose-300',
    dotClass: 'bg-rose-600',
    barClass: 'bg-rose-600',
    pdfBg: '#ffe4e6',
    pdfInk: '#9f1239',
  },
});

const UNSPECIFIED_HAZARD_THEME = Object.freeze({
  code: 'sin-clasificar',
  bandLabel: 'Sin clasificación capturada',
  shortLabel: 'NOM pendiente',
  fullLabel: 'Clasificación toxicológica pendiente de captura',
  normSubtitle:
    'Verifica la etiqueta oficial COFEPRIS / CICOPLAFEST antes de manipular el insumo',
  badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
  cardClass: 'border-slate-200 bg-slate-50 text-slate-900',
  subtitleClass: 'text-slate-600',
  iconClass: 'text-slate-600 bg-slate-100 border-slate-200',
  dotClass: 'bg-slate-400',
  barClass: 'bg-[#1b4332]',
  pdfBg: '#f3f4f6',
  pdfInk: '#374151',
});

const clean = (value) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim();

const normalizeLookupKey = (value) =>
  clean(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const normalizeHazardCategory = (rawValue) => {
  const trimmed = clean(rawValue);
  if (!trimmed) return null;
  if (PRODUCT_HAZARD_CATEGORIES.includes(trimmed)) return trimmed;
  return legacyHazardAliases.get(normalizeLookupKey(trimmed)) || null;
};

export const resolveProductHazardTheme = (rawValue) => {
  const canonical = normalizeHazardCategory(rawValue);
  return (canonical && HAZARD_THEMES[canonical]) || UNSPECIFIED_HAZARD_THEME;
};

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
  const rawValue = clean(input.hazard_category);
  if (!rawValue) return null;
  const canonical = normalizeHazardCategory(rawValue);
  if (!canonical) {
    addError(
      errors,
      fieldErrors,
      'hazard_category',
      'Selecciona una categoría toxicológica válida.',
    );
    return rawValue;
  }
  return canonical;
};

const isValidIsoDate = (date) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
  );
};

const readDate = (input, errors, fieldErrors) => {
  const date = clean(input.expiration_date);
  if (date && !isValidIsoDate(date)) {
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
