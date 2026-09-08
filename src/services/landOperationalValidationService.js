import { parseLandId } from './landValidationService.js';

const SEVERITIES = new Set(['low', 'medium', 'high']);
const DOSE_UNITS = new Set(['L/ha', 'kg/ha', 'ml/ha', 'g/ha']);

const cleanText = (value) => {
  if (typeof value !== 'string') return '';
  return [...value]
    .filter((character) => {
      const code = character.charCodeAt(0);
      return code > 31 && code !== 127;
    })
    .join('')
    .trim();
};

const addError = (fieldErrors, field, message) => {
  fieldErrors[field] ??= [];
  fieldErrors[field].push(message);
};

const isDateOnly = (value) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }
  const date = new Date(`${value}T00:00:00.000Z`);
  return (
    !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
};

const setRequiredId = (input, field, value, fieldErrors) => {
  const parsed = parseLandId(input[field]);
  if (!parsed) {
    addError(fieldErrors, field, 'Selecciona un registro válido del catálogo.');
    return;
  }
  value[field] = parsed;
};

const setOptionalId = (input, field, value, fieldErrors) => {
  if (input[field] === undefined || input[field] === '') return;
  const parsed = parseLandId(input[field]);
  if (!parsed) {
    addError(fieldErrors, field, 'El registro relacionado no es válido.');
    return;
  }
  value[field] = parsed;
};

const setDate = (input, field, value, fieldErrors, label) => {
  if (!isDateOnly(input[field])) {
    addError(fieldErrors, field, `${label} no es válida.`);
    return;
  }
  value[field] = input[field];
};

const setOptionalText = (input, field, value, fieldErrors, { max, label }) => {
  const normalized = cleanText(input[field]);
  if (normalized.length > max) {
    addError(
      fieldErrors,
      field,
      `${label} no puede exceder ${max} caracteres.`,
    );
    return;
  }
  if (normalized) value[field] = normalized;
};

const buildResult = (value, fieldErrors) => {
  const errors = Object.values(fieldErrors).flat();
  return { isValid: errors.length === 0, errors, fieldErrors, value };
};

export const validateFarmCropInput = (input = {}) => {
  const value = {};
  const fieldErrors = {};
  setRequiredId(input, 'crop_id', value, fieldErrors);
  setDate(input, 'planting_date', value, fieldErrors, 'La fecha de siembra');
  setOptionalText(input, 'area_section', value, fieldErrors, {
    max: 100,
    label: 'La sección del terreno',
  });
  return buildResult(value, fieldErrors);
};

export const validateStageAdvanceInput = (input = {}) => {
  const value = {};
  const fieldErrors = {};
  setRequiredId(input, 'farm_crop_id', value, fieldErrors);

  const stageOrder = Number(input.stage_order);
  if (!Number.isInteger(stageOrder) || stageOrder < 1 || stageOrder > 5) {
    addError(fieldErrors, 'stage_order', 'La etapa seleccionada no es válida.');
  } else {
    value.stage_order = stageOrder;
  }
  setOptionalText(input, 'notes', value, fieldErrors, {
    max: 1000,
    label: 'Las notas',
  });
  return buildResult(value, fieldErrors);
};

export const validateFarmHealthReportInput = (input = {}) => {
  const value = {};
  const fieldErrors = {};
  setRequiredId(input, 'plague_id', value, fieldErrors);
  setOptionalId(input, 'farm_crop_id', value, fieldErrors);
  setDate(input, 'observed_at', value, fieldErrors, 'La fecha de observación');

  if (!SEVERITIES.has(input.severity)) {
    addError(fieldErrors, 'severity', 'Selecciona una severidad válida.');
  } else {
    value.severity = input.severity;
  }
  setOptionalText(input, 'description', value, fieldErrors, {
    max: 2000,
    label: 'La descripción',
  });
  return buildResult(value, fieldErrors);
};

export const validateFarmApplicationInput = (input = {}) => {
  const value = {};
  const fieldErrors = {};
  setRequiredId(input, 'product_id', value, fieldErrors);
  setOptionalId(input, 'farm_crop_id', value, fieldErrors);
  setDate(input, 'applied_at', value, fieldErrors, 'La fecha de aplicación');

  const rawDose = String(input.dose_value ?? '').trim();
  const doseValue = /^\d{1,7}(?:\.\d{1,3})?$/.test(rawDose)
    ? Number(rawDose)
    : Number.NaN;
  if (!Number.isFinite(doseValue) || doseValue <= 0 || doseValue > 1000000) {
    addError(
      fieldErrors,
      'dose_value',
      'La dosis debe estar entre 0.001 y 1,000,000.',
    );
  } else {
    value.dose_value = doseValue;
  }

  if (!DOSE_UNITS.has(input.dose_unit)) {
    addError(
      fieldErrors,
      'dose_unit',
      'Selecciona una unidad de dosis válida.',
    );
  } else {
    value.dose_unit = input.dose_unit;
  }
  setOptionalText(input, 'notes', value, fieldErrors, {
    max: 2000,
    label: 'Las notas',
  });
  return buildResult(value, fieldErrors);
};
