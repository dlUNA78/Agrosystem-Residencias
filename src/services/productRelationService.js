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

const toIdSet = (records = []) =>
  new Set(
    records
      .map((item) => Number(item?.id ?? item))
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  );

const mapRelationOption = (item, selectedIds, subtitleField) => ({
  id: item.id,
  name: item.name,
  subtitle: item[subtitleField] || null,
  category: item.category || null,
  selected: selectedIds.has(Number(item.id)),
});

export const buildProductRelationEditor = ({
  product = {},
  crops = [],
  plagues = [],
} = {}) => {
  const selectedCropIds = toIdSet(product.crops);
  const selectedPlagueIds = toIdSet(product.plagues);

  return {
    crops: crops.map((crop) =>
      mapRelationOption(crop, selectedCropIds, 'scientific_name'),
    ),
    plagues: plagues.map((plague) =>
      mapRelationOption(plague, selectedPlagueIds, 'scientific_name'),
    ),
    selectedCropsCount: selectedCropIds.size,
    selectedPlaguesCount: selectedPlagueIds.size,
  };
};
