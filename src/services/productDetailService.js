import { normalizeProductImagePath } from './productPublicQueryService.js';
import { resolveProductHazardTheme } from './productValidationService.js';

const PLAGUE_RISK_THEMES = Object.freeze({
  critico: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  alto: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
  },
  medio: {
    label: 'Moderado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  moderado: {
    label: 'Moderado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  bajo: {
    label: 'Bajo',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
});

const resolvePlagueRiskTheme = (riskLevel) => {
  const key = String(riskLevel || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return PLAGUE_RISK_THEMES[key] || PLAGUE_RISK_THEMES.bajo;
};

const WORKFLOW_LABELS = Object.freeze({
  draft: 'Borrador en edición',
  in_review: 'En revisión técnica',
  changes_requested: 'Cambios solicitados',
  verified: 'Verificado por especialista INIFAP',
  published: 'Publicado en catálogo oficial',
  archived: 'Archivado (fuera de consulta pública)',
});

const hasText = (value) => String(value ?? '').trim().length > 0;

const formatIsoDate = (dateValue) => {
  if (!dateValue) return null;
  const parsed = dateValue instanceof Date ? dateValue : new Date(dateValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString().slice(0, 10);
};

const formatHumanDate = (dateValue) => {
  const iso = formatIsoDate(dateValue);
  if (!iso) return null;
  const [year, month, day] = iso.split('-');
  return `${day}/${month}/${year}`;
};

const evaluateExpirationStatus = (dateValue, now = new Date()) => {
  const iso = formatIsoDate(dateValue);
  if (!iso) {
    return {
      hasDate: false,
      formatted: 'Vigencia indefinida / RSCO activo',
      badgeLabel: 'Registro vigente',
      badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      isExpiringSoon: false,
      isExpired: false,
    };
  }
  const target = new Date(`${iso}T00:00:00.000Z`);
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  if (diffDays < 0) {
    return {
      hasDate: true,
      formatted: formatHumanDate(iso),
      iso,
      badgeLabel: 'Registro vencido',
      badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
      isExpiringSoon: false,
      isExpired: true,
    };
  }
  if (diffDays <= 60) {
    return {
      hasDate: true,
      formatted: formatHumanDate(iso),
      iso,
      badgeLabel: `Vence en ${diffDays} día(s)`,
      badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
      isExpiringSoon: true,
      isExpired: false,
    };
  }
  return {
    hasDate: true,
    formatted: formatHumanDate(iso),
    iso,
    badgeLabel: `Vigente hasta ${formatHumanDate(iso)}`,
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    isExpiringSoon: false,
    isExpired: false,
  };
};

const formatSafetyInterval = (days) => {
  if (days === null || days === undefined || days === '') {
    return { hasValue: false, value: 'No especificado', days: null };
  }
  const num = Number(days);
  if (!Number.isInteger(num) || num < 0) {
    return { hasValue: false, value: 'No especificado', days: null };
  }
  if (num === 0) {
    return {
      hasValue: true,
      value: '0 días (Sin límite a cosecha)',
      days: 0,
    };
  }
  return {
    hasValue: true,
    value: `${num} ${num === 1 ? 'día' : 'días'} pre-cosecha`,
    days: num,
  };
};

const buildGalleryImages = (rawProduct) => {
  const normalized = (rawProduct.images || [])
    .map((img, idx) => ({
      id: img.id || idx + 1,
      image_url: normalizeProductImagePath(img.image_url),
      original_name: img.original_name || null,
      source: img.source || null,
      is_primary: Boolean(img.is_primary),
      display_order: Number(img.display_order) || idx,
    }))
    .filter((img) => img.image_url)
    .sort(
      (a, b) =>
        Number(b.is_primary) - Number(a.is_primary) ||
        a.display_order - b.display_order,
    );

  if (normalized.length > 0) return normalized;

  const fallback =
    normalizeProductImagePath(rawProduct.image_url) ||
    '/images/products/default.png';
  return [
    {
      id: 0,
      image_url: fallback,
      original_name: null,
      is_primary: true,
      display_order: 0,
    },
  ];
};

const resolvePrimaryRelatedImage = (record, fallback) => {
  const images = Array.isArray(record.images) ? record.images : [];
  const candidate = images.find((img) => img.is_primary) || images[0];
  const candidateUrl =
    candidate?.image_url || candidate?.url || record.image_url || record.url;
  return normalizeProductImagePath(candidateUrl) || fallback;
};

const normalizeRelatedPlague = (plague) => ({
  id: plague.id,
  name: plague.name,
  scientific_name: plague.scientific_name || null,
  category: plague.category || 'Organismo plaga',
  description: hasText(plague.description)
    ? plague.description.trim()
    : 'Organismo fitófago o patógeno registrado para manejo con este insumo.',
  risk_level: plague.risk_level || null,
  riskTheme: resolvePlagueRiskTheme(plague.risk_level),
  image_url: resolvePrimaryRelatedImage(
    plague,
    '/images/plagas/pulgon-verde.webp',
  ),
});

const normalizeRelatedCrop = (crop) => ({
  id: crop.id,
  name: crop.common_name || crop.name,
  scientific_name: crop.scientific_name || null,
  category: crop.category || 'Cultivo agrícola',
  description: hasText(crop.description)
    ? crop.description.trim()
    : 'Especie agrícola habilitada dentro del alcance fitosanitario del registro.',
  image_url: resolvePrimaryRelatedImage(crop, '/images/test/default.png'),
});

const parseTargetCropTags = (targetCrops) => {
  if (!hasText(targetCrops)) return [];
  return String(targetCrops)
    .split(/[,;•|]+|\s+y\s+/i)
    .map((token) => token.trim())
    .filter(Boolean)
    .slice(0, 14);
};

const buildTechnicalKpis = (rawProduct, safetyInterval) => [
  {
    key: 'modeOfAction',
    label: 'Mecanismo de acción',
    value: hasText(rawProduct.mode_of_action)
      ? rawProduct.mode_of_action.trim()
      : 'No especificado',
    hasValue: hasText(rawProduct.mode_of_action),
    icon: 'bolt',
    toneClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  {
    key: 'formulation',
    label: 'Formulación física',
    value: hasText(rawProduct.formulation_type)
      ? rawProduct.formulation_type.trim()
      : 'No especificada',
    hasValue: hasText(rawProduct.formulation_type),
    icon: 'science',
    toneClass: 'bg-sky-50 text-sky-700 border-sky-200',
  },
  {
    key: 'dosage',
    label: 'Dosis sugerida',
    value: hasText(rawProduct.suggested_dosage)
      ? rawProduct.suggested_dosage.trim()
      : 'No especificada',
    hasValue: hasText(rawProduct.suggested_dosage),
    isMono: true,
    icon: 'colorize',
    toneClass: 'bg-teal-50 text-teal-700 border-teal-200',
  },
  {
    key: 'safetyInterval',
    label: 'Intervalo de seguridad',
    value: safetyInterval.value,
    hasValue: safetyInterval.hasValue,
    isMono: true,
    icon: 'schedule',
    toneClass: 'bg-amber-50 text-amber-700 border-amber-200',
  },
];

const resolveVerifierLabel = (rawProduct) => {
  if (rawProduct.verifiedBy?.full_name) return rawProduct.verifiedBy.full_name;
  if (rawProduct.publishedBy?.full_name)
    return rawProduct.publishedBy.full_name;
  return 'Comité Técnico INIFAP';
};

const textOrFallback = (value, fallback) =>
  hasText(value) ? String(value).trim() : fallback;

const toPlainRecord = (record) =>
  typeof record?.toJSON === 'function' ? record.toJSON() : record || {};

const toArrayOrEmpty = (list) => (Array.isArray(list) ? list : []);

const buildSyngentaRecommendationRow = ({
  cropName,
  cropSci,
  plagueName,
  plagueSci,
  dosage,
  intervalLabel,
  modeLabel,
}) => ({
  cropName,
  cropSci,
  plagueName,
  plagueSci,
  dosage,
  intervalLabel,
  observation: `Aplicar al detectar primeros síntomas o umbral de acción (${modeLabel}). Realizar máximo 2 aplicaciones por ciclo alternando grupo químico.`,
});

const buildSyngentaRecommendationsMatrix = (
  rawProduct,
  relatedCrops,
  relatedPlagues,
  safetyInterval,
) => {
  const dosage = textOrFallback(
    rawProduct.suggested_dosage,
    '0.5 – 1.0 L o kg / ha',
  );
  const intervalLabel = safetyInterval.hasValue
    ? safetyInterval.value
    : 'Segun etiqueta RSCO';
  const modeLabel = textOrFallback(
    rawProduct.mode_of_action,
    'Manejo preventivo y curativo',
  );

  const crops =
    relatedCrops.length > 0
      ? relatedCrops
      : [
          {
            name: textOrFallback(
              rawProduct.target_crops,
              'Cultivos autorizados en registro RSCO',
            ),
            scientific_name: null,
          },
        ];
  const plagues =
    relatedPlagues.length > 0
      ? relatedPlagues
      : [
          {
            name: 'Complejo de plagas / patógenos de etiqueta',
            scientific_name: null,
          },
        ];

  const rows = [];
  crops.slice(0, 6).forEach((crop) => {
    plagues.slice(0, 4).forEach((plague) => {
      rows.push(
        buildSyngentaRecommendationRow({
          cropName: crop.name,
          cropSci: crop.scientific_name,
          plagueName: plague.name,
          plagueSci: plague.scientific_name,
          dosage,
          intervalLabel,
          modeLabel,
        }),
      );
    });
  });
  return rows.slice(0, 10);
};

export const buildProductDetailView = (record) => {
  const raw = toPlainRecord(record);
  const galleryImages = buildGalleryImages(raw);
  const hazardTheme = resolveProductHazardTheme(raw.hazard_category);
  const safetyInterval = formatSafetyInterval(raw.safety_interval_days);
  const expiration = evaluateExpirationStatus(raw.expiration_date);
  const relatedPlagues = toArrayOrEmpty(raw.plagues).map(
    normalizeRelatedPlague,
  );
  const relatedCrops = toArrayOrEmpty(raw.crops).map(normalizeRelatedCrop);
  const targetCropTags = parseTargetCropTags(raw.target_crops);
  const isVerified = ['verified', 'published'].includes(raw.workflow_status);
  const syngentaRecommendations = buildSyngentaRecommendationsMatrix(
    raw,
    relatedCrops,
    relatedPlagues,
    safetyInterval,
  );

  const product = {
    ...raw,
    category: textOrFallback(raw.category, 'Fitosanitario'),
    active_ingredient: textOrFallback(raw.active_ingredient, 'No especificado'),
    manufacturer: textOrFallback(raw.manufacturer, 'No especificado'),
    registration_code: textOrFallback(raw.registration_code, 'En trámite'),
    hasDescription: hasText(raw.description),
    descriptionText: textOrFallback(
      raw.description,
      'Sin descripción técnica detallada capturada en el expediente.',
    ),
    hazardTheme,
    safetyInterval,
    expiration,
    expirationDateFormatted: expiration.iso,
    workflowLabel:
      WORKFLOW_LABELS[raw.workflow_status] || 'Sin estado editorial',
    isVerified,
    verifiedByLabel: resolveVerifierLabel(raw),
    verifiedAtFormatted: formatHumanDate(raw.verified_at || raw.published_at),
    images: galleryImages,
    image_url: galleryImages[0].image_url,
    plagues: relatedPlagues,
    crops: relatedCrops,
    targetCropTags,
    hdsDownloadUrl: `/products/${raw.id}/hds.pdf`,
  };

  return {
    product,
    galleryImages,
    primaryImage: galleryImages[0],
    hasMultipleImages: galleryImages.length > 1,
    kpis: buildTechnicalKpis(raw, safetyInterval),
    relatedPlagues,
    relatedCrops,
    targetCropTags,
    syngentaRecommendations,
  };
};
