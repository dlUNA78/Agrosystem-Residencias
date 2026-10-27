import {
  MAP_HEIGHT,
  MAP_WIDTH,
  getStatePaths,
  projectMexicoPoint,
} from './mexicoGeo.js';
import {
  buildEnrichedBiologicalCycle,
  extractBiologicalAgents,
  splitTextClauses,
} from './plagueCycleFormatter.js';

const riskThemes = Object.freeze({
  alto: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    gradientClass: 'bg-linear-to-br from-error-container to-error',
    alertBgClass: 'bg-rose-50 border border-rose-200 text-rose-950',
    alertIcon: 'warning',
    alertIconClass: 'text-rose-600',
    alertBarClass: 'bg-rose-600 w-[85%]',
    alertText:
      'Nivel de riesgo alto registrado. Requiere atención prioritaria.',
    kpiTextClass: 'text-rose-600',
    bannerClass: 'bg-rose-50 border border-rose-200 text-rose-950',
    bannerTagClass: 'text-rose-700',
  },
  critico: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    gradientClass: 'bg-linear-to-br from-error-container to-error',
    alertBgClass: 'bg-rose-50 border border-rose-200 text-rose-950',
    alertIcon: 'warning',
    alertIconClass: 'text-rose-600',
    alertBarClass: 'bg-rose-600 w-[85%]',
    alertText:
      'Nivel de riesgo crítico registrado. Requiere atención prioritaria.',
    kpiTextClass: 'text-rose-600',
    bannerClass: 'bg-rose-50 border border-rose-200 text-rose-950',
    bannerTagClass: 'text-rose-700',
  },
  medio: {
    label: 'Moderado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    gradientClass: 'bg-linear-to-br from-primary-container to-primary',
    alertBgClass: 'bg-amber-50 border border-amber-200 text-amber-950',
    alertIcon: 'warning_amber',
    alertIconClass: 'text-amber-600',
    alertBarClass: 'bg-amber-500 w-[50%]',
    alertText: 'Nivel de riesgo moderado registrado. Requiere seguimiento.',
    kpiTextClass: 'text-amber-600',
    bannerClass: 'bg-amber-50 border border-amber-200 text-amber-950',
    bannerTagClass: 'text-amber-700',
  },
  moderado: {
    label: 'Moderado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    gradientClass: 'bg-linear-to-br from-primary-container to-primary',
    alertBgClass: 'bg-amber-50 border border-amber-200 text-amber-950',
    alertIcon: 'warning_amber',
    alertIconClass: 'text-amber-600',
    alertBarClass: 'bg-amber-500 w-[50%]',
    alertText: 'Nivel de riesgo moderado registrado. Requiere seguimiento.',
    kpiTextClass: 'text-amber-600',
    bannerClass: 'bg-amber-50 border border-amber-200 text-amber-950',
    bannerTagClass: 'text-amber-700',
  },
  bajo: {
    label: 'Bajo',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    gradientClass: 'bg-surface-container-high',
    alertBgClass: 'bg-emerald-50 border border-emerald-200 text-emerald-950',
    alertIcon: 'check_circle',
    alertIconClass: 'text-emerald-600',
    alertBarClass: 'bg-emerald-500 w-[20%]',
    alertText: 'Nivel de riesgo bajo registrado.',
    kpiTextClass: 'text-emerald-600',
    bannerClass: 'bg-emerald-50 border border-emerald-200 text-emerald-950',
    bannerTagClass: 'text-emerald-700',
  },
});

const unknownRiskTheme = Object.freeze({
  label: 'No especificado',
  badgeClass: 'bg-slate-50 text-slate-700 border-slate-200',
  gradientClass: 'bg-surface-container-high',
  alertBgClass: 'bg-slate-50 border border-slate-200 text-slate-900',
  alertIcon: 'info',
  alertIconClass: 'text-slate-600',
  alertBarClass: 'bg-slate-400 w-0',
  alertText: 'No se ha registrado un nivel de riesgo.',
  kpiTextClass: 'text-slate-600',
  bannerClass: 'bg-slate-50 border border-slate-200 text-slate-900',
  bannerTagClass: 'text-slate-600',
});

const normalizeUrl = (value) => {
  if (!value) return null;
  if (/^https?:\/\//i.test(value)) return value;
  return `/${String(value).replace(/^\/+/, '')}`;
};

const formatDate = (value) => {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleDateString('es-MX', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
};

const buildImages = (images, plagueName) => {
  if (!Array.isArray(images)) return [];

  return [...images]
    .filter((image) => image?.url)
    .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    .map((image) => ({
      url: normalizeUrl(image.url),
      caption: image.caption || plagueName,
      source: image.source || null,
    }));
};

const buildProducts = (products) => {
  if (!Array.isArray(products)) return [];

  return products.map((product) => {
    const images = Array.isArray(product.images) ? product.images : [];
    const primaryImage =
      images.find((image) => image.is_primary === true) || images[0];
    const imageUrl = normalizeUrl(primaryImage?.image_url);

    return {
      id: product.id,
      name: product.name,
      activeIngredient: product.active_ingredient || null,
      manufacturer: product.manufacturer || null,
      category: product.category || null,
      imageUrl,
      image_url: imageUrl,
      isValidated: product.validation_status === 'Validado',
    };
  });
};

const buildRegions = (regions, defaultRiskLevel) => {
  if (!Array.isArray(regions)) return [];

  const order = { Alto: 1, Crítico: 1, Medio: 2, Moderado: 2, Bajo: 3 };

  return regions
    .map((region) => {
      const riskLevel =
        region.PlagueRegions?.dataValues?.risk_level ||
        region.PlagueRegions?.risk_level ||
        region.PlagueRegion?.risk_level ||
        defaultRiskLevel ||
        null;
      const riskTheme =
        riskThemes[String(riskLevel || '').toLowerCase()] || unknownRiskTheme;
      const hasCoords =
        region.lat !== null &&
        region.lat !== undefined &&
        region.lng !== null &&
        region.lng !== undefined &&
        Number.isFinite(Number(region.lat)) &&
        Number.isFinite(Number(region.lng));

      return {
        name: region.name,
        lat: hasCoords ? Number(region.lat) : null,
        lng: hasCoords ? Number(region.lng) : null,
        hasCoords,
        riskLevel,
        riskLabel: riskTheme.label,
        riskBadgeClass: riskTheme.badgeClass,
      };
    })
    .sort((a, b) => (order[a.riskLevel] || 4) - (order[b.riskLevel] || 4));
};

const buildCrops = (crops) => {
  if (!Array.isArray(crops)) return [];

  return crops.map((crop) => ({
    id: crop.id,
    name: crop.name || crop.common_name,
    scientificName: crop.scientific_name || null,
    category: crop.category || null,
  }));
};

const normalizeGeoKey = (value) =>
  String(value || '')
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim();

const STATE_NAME_ALIASES = Object.freeze({
  'estado de mexico': 'mexico',
  edomex: 'mexico',
  cdmx: 'ciudad de mexico',
  'distrito federal': 'ciudad de mexico',
  'coahuila de zaragoza': 'coahuila',
  'michoacan de ocampo': 'michoacan',
  'veracruz de ignacio de la llave': 'veracruz',
});

const MAP_RISK_STYLES = Object.freeze({
  Crítico: {
    stateClass: 'fill-rose-400/80 stroke-rose-800',
    pinClass: 'fill-rose-600 stroke-white',
    haloClass: 'fill-rose-500/30',
  },
  Moderado: {
    stateClass: 'fill-amber-300/85 stroke-amber-800',
    pinClass: 'fill-amber-500 stroke-white',
    haloClass: 'fill-amber-500/30',
  },
  Bajo: {
    stateClass: 'fill-emerald-400/80 stroke-emerald-800',
    pinClass: 'fill-emerald-600 stroke-white',
    haloClass: 'fill-emerald-500/30',
  },
});

const DEFAULT_MAP_RISK_STYLE = Object.freeze({
  stateClass: 'fill-emerald-400/75 stroke-emerald-800',
  pinClass: 'fill-[#1b4332] stroke-white',
  haloClass: 'fill-emerald-600/25',
});

const getMapRiskStyle = (riskLabel) =>
  MAP_RISK_STYLES[riskLabel] || DEFAULT_MAP_RISK_STYLE;

const buildStateIncidenceLookup = (incidenceRegions) => {
  const byStateKey = new Map();
  incidenceRegions.forEach((region, index) => {
    const rawKey = normalizeGeoKey(region.name);
    const canonicalKey = STATE_NAME_ALIASES[rawKey] || rawKey;
    if (canonicalKey && !byStateKey.has(canonicalKey)) {
      byStateKey.set(canonicalKey, { region, index });
    }
  });
  return byStateKey;
};

const buildMexicoIncidenceMap = (incidenceRegions) => {
  if (!Array.isArray(incidenceRegions) || incidenceRegions.length === 0) {
    return null;
  }

  const byStateKey = buildStateIncidenceLookup(incidenceRegions);
  let matchedStateCount = 0;

  const states = getStatePaths().map((state) => {
    const stateKey = normalizeGeoKey(state.estado);
    const match = byStateKey.get(stateKey);
    if (!match) {
      return {
        ...state,
        isAffected: false,
        regionIndex: null,
        riskLabel: null,
        stateClass: 'fill-slate-200/80 stroke-white',
      };
    }

    matchedStateCount += 1;
    const style = getMapRiskStyle(match.region.riskLabel);
    return {
      ...state,
      isAffected: true,
      regionIndex: match.index,
      riskLabel: match.region.riskLabel,
      stateClass: style.stateClass,
    };
  });

  const markers = incidenceRegions.flatMap((region, index) => {
    if (!region.hasCoords) return [];
    const point = projectMexicoPoint(region.lng, region.lat);
    if (!point) return [];
    const style = getMapRiskStyle(region.riskLabel);
    return [
      {
        regionIndex: index,
        name: region.name,
        riskLabel: region.riskLabel,
        x: point.x,
        y: point.y,
        pinClass: style.pinClass,
        haloClass: style.haloClass,
      },
    ];
  });

  return {
    viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
    states,
    markers,
    matchedStateCount,
  };
};

export const buildPlagueDetailView = (plagueData) => {
  const riskKey = String(plagueData.risk_level || '')
    .toLowerCase()
    .replace('í', 'i');
  const riskTheme = riskThemes[riskKey] || unknownRiskTheme;
  const carouselImages = buildImages(plagueData.images, plagueData.name);
  const relatedProducts = buildProducts(plagueData.products);
  const incidenceRegions = buildRegions(
    plagueData.regions,
    plagueData.risk_level,
  );
  const relatedCrops = buildCrops(plagueData.crops);
  const verifiedBy = plagueData.verified_by || null;
  const verifiedAt = formatDate(plagueData.verified_at);
  const legacyImageUrl = normalizeUrl(plagueData.image_url);
  const mainImageUrl = carouselImages[0]?.url || legacyImageUrl;
  const { stages: biologicalCycle, summary: cycleSummary } =
    buildEnrichedBiologicalCycle(plagueData.biological_cycle);
  const symptomItems = splitTextClauses(plagueData.symptoms);
  const controlMethodItems = splitTextClauses(plagueData.control_methods);
  const biologicalAgents = extractBiologicalAgents(
    plagueData.biological_control,
  );

  return {
    plague: {
      id: plagueData.id,
      name: plagueData.name,
      scientificName: plagueData.scientific_name || null,
      category: plagueData.category || null,
      description: plagueData.description || null,
      image_url: mainImageUrl,
      imageUrl: mainImageUrl,
      symptoms: plagueData.symptoms || null,
      symptomItems,
      controlMethods: plagueData.control_methods || null,
      controlMethodItems,
      biologicalControl: plagueData.biological_control || null,
      biologicalAgents,
      biologicalCycle,
      region: plagueData.region || null,
      riskLabel: riskTheme.label,
      riskBadgeClass: riskTheme.badgeClass,
      riskGradientClass: riskTheme.gradientClass,
      riskLevel: plagueData.risk_level || null,
      riskTheme,
      verifiedBy,
      verifiedAt,
      isVerified: Boolean(verifiedBy),
      updatedAt: formatDate(plagueData.updatedAt),
      workflowStatus: plagueData.workflow_status || null,
      reviewNotes: plagueData.review_notes || null,
    },
    cycleSummary,
    symptomItems,
    controlMethodItems,
    biologicalAgents,
    carouselImages,
    relatedProducts,
    incidenceRegions,
    incidenceRegionsJson: JSON.stringify(incidenceRegions),
    mexicoMap: buildMexicoIncidenceMap(incidenceRegions),
    relatedCrops,
    regionSummary: incidenceRegions.map((region) => region.name).join(', '),
    cropSummary: relatedCrops
      .map((crop) => crop.name)
      .filter(Boolean)
      .join(', '),
  };
};
