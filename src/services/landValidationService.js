const FARMING_TYPES = new Set([
  'Temporal',
  'Riego',
  'Mixto',
  'Tecnificado',
  'Orgánico',
  'Hidroponía',
]);

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

const parseDecimal = (value, { min, max, decimals = 7 } = {}) => {
  if (value === undefined || value === null || value === '') return null;
  const normalized = String(value).trim();
  const pattern = new RegExp(`^-?\\d{1,7}(?:\\.\\d{1,${decimals}})?$`);
  if (!pattern.test(normalized)) return Number.NaN;

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
    return Number.NaN;
  }
  return parsed;
};

export const parseLandId = (value) => {
  const normalized = String(value ?? '').trim();
  if (!/^\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeIdentity = (input, value, fieldErrors) => {
  const name = cleanText(input.name);
  if (name.length < 2 || name.length > 120) {
    addError(
      fieldErrors,
      'name',
      'El nombre del terreno debe tener entre 2 y 120 caracteres.',
    );
  } else {
    value.name = name;
  }
};

const normalizeSurface = (input, value, fieldErrors) => {
  const sizeHectares = parseDecimal(input.size_hectares, {
    min: 0.01,
    max: 1000000,
    decimals: 2,
  });
  if (sizeHectares === null || Number.isNaN(sizeHectares)) {
    addError(
      fieldErrors,
      'size_hectares',
      'La superficie debe estar entre 0.01 y 1,000,000 de hectáreas.',
    );
  } else {
    value.size_hectares = sizeHectares;
  }
};

const normalizeClassification = (input, value, fieldErrors) => {
  const municipality = cleanText(input.municipality);
  const farmingType = cleanText(input.farming_type);
  if (municipality.length > 100) {
    addError(
      fieldErrors,
      'municipality',
      'El municipio no puede exceder 100 caracteres.',
    );
  } else if (municipality) {
    value.municipality = municipality;
  }

  if (farmingType && !FARMING_TYPES.has(farmingType)) {
    addError(
      fieldErrors,
      'farming_type',
      'Selecciona un tipo de agricultura válido.',
    );
  } else if (farmingType) {
    value.farming_type = farmingType;
  }
};

const normalizeRegion = (input, value, fieldErrors) => {
  if (input.region_id !== undefined && input.region_id !== '') {
    const regionId = parseLandId(input.region_id);
    if (!regionId) {
      addError(fieldErrors, 'region_id', 'Selecciona una región válida.');
    } else {
      value.region_id = regionId;
    }
  }
};

const normalizeCoordinates = (input, value, fieldErrors) => {
  const latitude = parseDecimal(input.location_lat, {
    min: -90,
    max: 90,
  });
  const longitude = parseDecimal(input.location_lng, {
    min: -180,
    max: 180,
  });
  if (Number.isNaN(latitude)) {
    addError(
      fieldErrors,
      'location_lat',
      'La latitud debe estar entre -90 y 90.',
    );
  }
  if (Number.isNaN(longitude)) {
    addError(
      fieldErrors,
      'location_lng',
      'La longitud debe estar entre -180 y 180.',
    );
  }
  if ((latitude === null) !== (longitude === null)) {
    const message = 'La latitud y longitud deben proporcionarse juntas.';
    addError(fieldErrors, 'location_lat', message);
    addError(fieldErrors, 'location_lng', message);
  } else if (
    latitude !== null &&
    longitude !== null &&
    !Number.isNaN(latitude) &&
    !Number.isNaN(longitude)
  ) {
    value.location_lat = latitude;
    value.location_lng = longitude;
  }
};

export const validateLandInput = (input = {}) => {
  const fieldErrors = {};
  const value = {};

  normalizeIdentity(input, value, fieldErrors);
  normalizeSurface(input, value, fieldErrors);
  normalizeClassification(input, value, fieldErrors);
  normalizeRegion(input, value, fieldErrors);
  normalizeCoordinates(input, value, fieldErrors);

  const errors = Object.values(fieldErrors).flat();
  return { isValid: errors.length === 0, errors, fieldErrors, value };
};
