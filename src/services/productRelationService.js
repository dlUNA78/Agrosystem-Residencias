const toArray = (value) => {
  if (value === undefined || value === null || value === '') return [];
  return Array.isArray(value) ? value : [value];
};

const normalizeIds = (value, label, errors) => {
  const ids = [];
  for (const candidate of toArray(value)) {
    const normalized = String(candidate).trim();
    if (!/^[1-9]\d*$/.test(normalized)) {
      errors.push(
        `La selección de ${label} contiene un identificador inválido.`,
      );
      continue;
    }
    const id = Number(normalized);
    if (!Number.isSafeInteger(id)) {
      errors.push(
        `La selección de ${label} contiene un identificador inválido.`,
      );
      continue;
    }
    ids.push(id);
  }
  return [...new Set(ids)];
};

export const validateProductRelationsInput = (body = {}) => {
  const errors = [];
  const cropIds = normalizeIds(body.crop_ids, 'cultivos', errors);
  const plagueIds = normalizeIds(body.plague_ids, 'plagas', errors);
  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    value: { cropIds, plagueIds },
  };
};
