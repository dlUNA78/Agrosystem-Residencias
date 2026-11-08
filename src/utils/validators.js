/**
 * validators.js — Utilidades Centralizadas de Validación, Sanitización y Normalización
 * Agrosystem INIFAP
 */

const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
const NAME_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s.'-]{2,120}$/;
const PHONE_DIGITS_REGEX = /^\d{10,15}$/;
const RSCO_CODE_REGEX = /^[A-Z0-9-]{4,40}$/i;

const ACCENT_CHARACTER_CLASSES = Object.freeze({
  a: '[aáàäâAÁÀÄÂ]',
  e: '[eéèëêEÉÈËÊ]',
  i: '[iíìïîIÍÌÏÎ]',
  o: '[oóòöôOÓÒÖÔ]',
  u: '[uúùüûUÚÙÜÛ]',
  n: '[nñNÑ]',
});

const stripControlChars = (str) =>
  Array.from(str)
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return (
        code === 9 || code === 10 || code === 13 || (code >= 32 && code !== 127)
      );
    })
    .join('');

/**
 * Limpia cadenas eliminando etiquetas HTML/scripts, caracteres de control y espacios redundantes.
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
export const sanitizeText = (value, maxLength = 500) => {
  if (value === null || value === undefined) return '';
  const raw = stripControlChars(String(value).replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
  return maxLength > 0 ? raw.slice(0, maxLength) : raw;
};

/**
 * Sanitiza texto multilínea conservando saltos de línea legítimos.
 * @param {unknown} value
 * @param {number} maxLength
 * @returns {string}
 */
export const sanitizeMultilineText = (value, maxLength = 5000) => {
  if (value === null || value === undefined) return '';
  const raw = stripControlChars(String(value).replace(/<[^>]*>/g, '')).trim();
  return maxLength > 0 ? raw.slice(0, maxLength) : raw;
};

/**
 * Valida formato estricto de correo electrónico.
 * @param {unknown} email
 * @returns {boolean}
 */
export const isValidEmail = (email) => {
  const clean = sanitizeText(email, 150).toLowerCase();
  if (!clean || clean.length < 5 || clean.length > 150) return false;
  return EMAIL_REGEX.test(clean);
};

/**
 * Evalúa la política de seguridad de una contraseña institucional.
 * Requisitos:
 * - Entre 8 y 72 caracteres
 * - Al menos una letra mayúscula
 * - Al menos una letra minúscula
 * - Al menos un número
 * @param {unknown} password
 * @returns {{ valid: boolean, errors: string[] }}
 */
export const validatePasswordPolicy = (password) => {
  const raw = typeof password === 'string' ? password : '';
  const errors = [];

  if (raw.length < 8) {
    errors.push('Debe contener al menos 8 caracteres.');
  }
  if (raw.length > 72) {
    errors.push('No debe exceder 72 caracteres.');
  }
  if (!/[A-ZÁÉÍÓÚÑ]/.test(raw)) {
    errors.push('Debe incluir al menos una letra mayúscula.');
  }
  if (!/[a-záéíóúñ]/.test(raw)) {
    errors.push('Debe incluir al menos una letra minúscula.');
  }
  if (!/\d/.test(raw)) {
    errors.push('Debe incluir al menos un número.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

/**
 * Valida nombres de personas o denominaciones sin símbolos especiales inválidos.
 * @param {unknown} name
 * @returns {boolean}
 */
export const isValidPersonName = (name) => {
  const clean = sanitizeText(name, 120);
  return NAME_REGEX.test(clean);
};

/**
 * Normaliza y valida números telefónicos (10 a 15 dígitos).
 * @param {unknown} phone
 * @returns {{ valid: boolean, normalized: string }}
 */
export const validatePhone = (phone) => {
  const raw = sanitizeText(phone, 30);
  if (!raw) return { valid: true, normalized: '' };
  const digits = raw.replace(/[\s()-+]/g, '');
  const valid = PHONE_DIGITS_REGEX.test(digits);
  return { valid, normalized: valid ? digits : raw };
};

const isBlankValue = (val) => val === '' || val === null || val === undefined;

const isCoordPairInRange = (numLat, numLng) =>
  Number.isFinite(numLat) &&
  Number.isFinite(numLng) &&
  Math.abs(numLat) <= 90 &&
  Math.abs(numLng) <= 180;

/**
 * Valida coordenadas geográficas para el territorio nacional / global.
 * @param {unknown} lat
 * @param {unknown} lng
 * @returns {{ valid: boolean, lat: number|null, lng: number|null }}
 */
export const validateCoordinates = (lat, lng) => {
  if (isBlankValue(lat) && isBlankValue(lng)) {
    return { valid: true, lat: null, lng: null };
  }
  const numLat = Number.parseFloat(lat);
  const numLng = Number.parseFloat(lng);
  const valid = isCoordPairInRange(numLat, numLng);
  return {
    valid,
    lat: valid ? Number(numLat.toFixed(7)) : null,
    lng: valid ? Number(numLng.toFixed(7)) : null,
  };
};

/**
 * Valida código de registro sanitario RSCO / COFEPRIS.
 * @param {unknown} code
 * @returns {boolean}
 */
export const isValidRscoCode = (code) => {
  const clean = sanitizeText(code, 40);
  if (!clean) return true;
  return RSCO_CODE_REGEX.test(clean);
};

/**
 * Normaliza un texto quitando acentos/diacríticos y pasando a minúsculas
 * para comparaciones en memoria.
 * @param {unknown} text
 * @returns {string}
 */
export const normalizeSearchText = (text) =>
  String(text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const escapeRegexChar = (char) => {
  const lower = char
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (ACCENT_CHARACTER_CLASSES[lower]) {
    return ACCENT_CHARACTER_CLASSES[lower];
  }
  return char.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

/**
 * Construye una expresión regular POSIX para PostgreSQL (~*) que coincide
 * con o sin tildes/diacríticos (ej. "Maiz" coincide con "Maíz" y viceversa).
 * @param {unknown} term
 * @returns {string}
 */
export const buildAccentInsensitiveRegex = (term) => {
  const clean = sanitizeText(term, 100);
  if (!clean) return '';
  return Array.from(clean).map(escapeRegexChar).join('');
};
