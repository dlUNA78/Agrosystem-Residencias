export const PLAGUE_RELATION_RISK_LEVELS = Object.freeze([
  'Bajo',
  'Medio',
  'Alto',
  'Crítico',
]);

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

const getRegionRisk = (region) => {
  const data = toPlain(region);

  return (
    data.PlagueRegions?.risk_level || data.PlagueRegion?.risk_level || 'Medio'
  );
};

export const validatePlagueRelationsInput = (body = {}) => {
  const errors = [];
  const productIds = normalizeIds(body.product_ids, 'productos', errors);
  const cropIds = normalizeIds(body.crop_ids, 'cultivos', errors);
  const regionIds = normalizeIds(body.region_ids, 'regiones', errors);

  const regions = regionIds.flatMap((regionId) => {
    const riskLevel = String(body[`region_risk_${regionId}`] || '').trim();

    if (!PLAGUE_RELATION_RISK_LEVELS.includes(riskLevel)) {
      errors.push(
        `La región ${regionId} requiere un nivel de riesgo permitido.`,
      );
      return [];
    }

    return [{ region_id: regionId, risk_level: riskLevel }];
  });

  return {
    isValid: errors.length === 0,
    errors: [...new Set(errors)],
    value: { productIds, cropIds, regions },
  };
};

export const buildPlagueRelationEditor = ({
  products = [],
  crops = [],
  regions = [],
  selectedProducts = [],
  selectedCrops = [],
  selectedRegions = [],
}) => {
  const selectedProductIds = new Set(
    selectedProducts.map((record) => Number(toPlain(record).id)),
  );
  const selectedCropIds = new Set(
    selectedCrops.map((record) => Number(toPlain(record).id)),
  );
  const selectedRegionsById = new Map(
    selectedRegions.map((record) => {
      const data = toPlain(record);
      return [Number(data.id), getRegionRisk(data)];
    }),
  );

  return {
    products: products.map((record) => {
      const data = toPlain(record);
      return {
        id: data.id,
        name: data.name,
        activeIngredient: data.active_ingredient || null,
        isSelected: selectedProductIds.has(Number(data.id)),
      };
    }),
    crops: crops.map((record) => {
      const data = toPlain(record);
      return {
        id: data.id,
        name: data.name,
        scientificName: data.scientific_name || null,
        isSelected: selectedCropIds.has(Number(data.id)),
      };
    }),
    regions: regions.map((record) => {
      const data = toPlain(record);
      const selectedRisk = selectedRegionsById.get(Number(data.id)) || 'Medio';

      return {
        id: data.id,
        name: data.name,
        isSelected: selectedRegionsById.has(Number(data.id)),
        selectedRisk,
        isRiskLow: selectedRisk === 'Bajo',
        isRiskMedium: selectedRisk === 'Medio',
        isRiskHigh: selectedRisk === 'Alto',
        isRiskCritical: selectedRisk === 'Crítico',
      };
    }),
    riskLevels: PLAGUE_RELATION_RISK_LEVELS,
  };
};
