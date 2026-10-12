export const VALID_ACTION_TYPES = Object.freeze([
  'herbicida',
  'insecticida',
  'fungicida',
  'acaricida',
  'nematicida',
  'bactericida',
]);

export const VALID_TOXICITY_CATEGORIES = Object.freeze([
  'clase-i',
  'clase-ii',
  'clase-iii',
  'clase-iv',
  'u',
]);

const cleanString = (val) => (typeof val === 'string' ? val.trim() : '');

const validateName = (name, errors) => {
  if (!name || name.length < 2) {
    errors.push(
      'El nombre del ingrediente activo debe contener al menos 2 caracteres.',
    );
  } else if (name.length > 150) {
    errors.push(
      'El nombre del ingrediente activo no puede superar 150 caracteres.',
    );
  }
};

const validateGroup = (group, errors) => {
  if (group.length > 150) {
    errors.push('El grupo químico no puede superar 150 caracteres.');
  }
};

const validateActionType = (actionType, errors) => {
  if (!actionType) {
    errors.push(
      'El tipo de acción es obligatorio (ej. herbicida, insecticida, fungicida).',
    );
  } else if (!VALID_ACTION_TYPES.includes(actionType)) {
    errors.push(
      `Tipo de acción no válido. Opciones permitidas: ${VALID_ACTION_TYPES.join(', ')}.`,
    );
  }
};

const validateToxicity = (toxicity, errors) => {
  if (toxicity && !VALID_TOXICITY_CATEGORIES.includes(toxicity)) {
    errors.push(
      `Categoría toxicológica OMS no válida. Opciones permitidas: ${VALID_TOXICITY_CATEGORIES.join(', ')}.`,
    );
  }
};

/**
 * Valida y sanitiza datos de un ingrediente activo
 * @param {object} payload
 * @returns {{ isValid: boolean, errors: string[], sanitized: object }}
 */
export const validateIngredientPayload = (payload = {}) => {
  const errors = [];

  const rawName = cleanString(payload.name);
  const rawGroup = cleanString(payload.chemical_group);
  const rawActionType = cleanString(payload.action_type).toLowerCase();
  const rawToxicity = cleanString(payload.toxicological_category).toLowerCase();

  validateName(rawName, errors);
  validateGroup(rawGroup, errors);
  validateActionType(rawActionType, errors);
  validateToxicity(rawToxicity, errors);

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name: rawName,
      chemical_group: rawGroup || null,
      action_type: rawActionType,
      toxicological_category: rawToxicity || null,
    },
  };
};
