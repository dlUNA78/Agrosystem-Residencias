const toArray = (value) => {
  if (value === undefined || value === null || value === '') {
    return [];
  }
  return Array.isArray(value) ? value : [value];
};

const normalizeIds = (value, label, errors) => {
  const parsed = [];

  for (const candidate of toArray(value)) {
    const normalized = String(candidate).trim();

    if (!/^\d+$/.test(normalized)) {
      errors.push(
        `La selección de ${label} contiene un identificador inválido.`,
      );
      continue;
    }

    const id = Number(normalized);

    if (!Number.isSafeInteger(id) || id <= 0) {
      errors.push(
        `La selección de ${label} contiene un identificador inválido.`,
      );
      continue;
    }

    parsed.push(id);
  }

  return [...new Set(parsed)];
};

const toPlain = (record) => {
  if (record?.toJSON) {
    return record.toJSON();
  }
  return record?.dataValues || record || {};
};

export const validateCropRelationsInput = (body = {}) => {
  const errors = [];
  const plagueIds = normalizeIds(body.plague_ids, 'plagas', errors);
  const productIds = normalizeIds(body.product_ids, 'productos', errors);

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    value: { plagueIds, productIds },
  };
};

export const buildCropRelationEditor = ({
  plagues = [],
  products = [],
  selectedPlagues = [],
  selectedProducts = [],
}) => {
  const selectedPlagueIds = new Set(
    selectedPlagues.map((record) => Number(toPlain(record).id)),
  );
  const selectedProductIds = new Set(
    selectedProducts.map((record) => Number(toPlain(record).id)),
  );

  const availablePlagues = plagues.map((record) => {
    const plain = toPlain(record);
    const id = Number(plain.id);
    return {
      id,
      name: plain.name,
      scientificName: plain.scientific_name || null,
      category: plain.category || null,
      selected: selectedPlagueIds.has(id),
    };
  });

  const availableProducts = products.map((record) => {
    const plain = toPlain(record);
    const id = Number(plain.id);
    return {
      id,
      name: plain.name,
      category: plain.category || null,
      activeIngredient: plain.active_ingredient || null,
      selected: selectedProductIds.has(id),
    };
  });

  return {
    plagues: availablePlagues,
    products: availableProducts,
    selectedPlaguesCount: selectedPlagueIds.size,
    selectedProductsCount: selectedProductIds.size,
  };
};
