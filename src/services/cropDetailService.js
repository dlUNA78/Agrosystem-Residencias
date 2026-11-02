import {
  MAP_HEIGHT,
  MAP_WIDTH,
  getStatePaths,
  projectMexicoPoint,
} from './mexicoGeo.js';

const riskThemes = Object.freeze({
  alto: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  critico: {
    label: 'Crítico',
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    dotClass: 'bg-rose-500',
  },
  medio: {
    label: 'Moderado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  moderado: {
    label: 'Moderado',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    dotClass: 'bg-amber-500',
  },
  bajo: {
    label: 'Bajo',
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotClass: 'bg-emerald-500',
  },
});

const defaultRiskTheme = Object.freeze({
  label: 'Bajo',
  badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  dotClass: 'bg-emerald-500',
});

const normalizeUrl = (value) => {
  if (!value) return null;
  const str = String(value).trim();
  if (!str) return null;
  if (/^https?:\/\//i.test(str)) return str;
  return `/${str
    .replaceAll('\\', '/')
    .replace(/^\/+/, '')
    .replace(/^public\/+/, '')}`;
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

const hasValue = (val) => val !== null && val !== undefined && val !== '';

export const formatTemperatureRange = (min, max) => {
  const hasMin = hasValue(min);
  const hasMax = hasValue(max);
  if (hasMin && hasMax) return `${Number(min)}°C – ${Number(max)}°C`;
  if (hasMin) return `Min. ${Number(min)}°C`;
  if (hasMax) return `Max. ${Number(max)}°C`;
  return null;
};

export const formatRainfallRange = (min, max) => {
  const hasMin = hasValue(min);
  const hasMax = hasValue(max);
  if (hasMin && hasMax) return `${Number(min)} – ${Number(max)} mm`;
  if (hasMin) return `> ${Number(min)} mm`;
  if (hasMax) return `< ${Number(max)} mm`;
  return null;
};

export const formatAltitudeRange = (min, max) => {
  const hasMin = hasValue(min);
  const hasMax = hasValue(max);
  if (hasMin && hasMax) {
    return `${Number(min).toLocaleString('es-MX')} – ${Number(max).toLocaleString('es-MX')} msnm`;
  }
  if (hasMin) return `Desde ${Number(min).toLocaleString('es-MX')} msnm`;
  if (hasMax) return `Hasta ${Number(max).toLocaleString('es-MX')} msnm`;
  return null;
};

const compareCropImages = (a, b) => {
  if (a.is_primary && !b.is_primary) return -1;
  if (!a.is_primary && b.is_primary) return 1;
  return (Number(a.display_order) || 0) - (Number(b.display_order) || 0);
};

const mapCropImage = (img) => ({
  id: img.id,
  url: normalizeUrl(img.image_url),
  image_url: normalizeUrl(img.image_url),
  originalName: img.original_name || null,
  isPrimary: Boolean(img.is_primary),
  displayOrder: Number(img.display_order) || 0,
});

const buildCropImages = (rawImages = [], fallbackUrl = null) => {
  const validImages = Array.isArray(rawImages)
    ? [...rawImages]
        .filter((img) => img?.image_url)
        .sort(compareCropImages)
        .map(mapCropImage)
    : [];

  if (validImages.length === 0 && fallbackUrl) {
    const normalizedFallback = normalizeUrl(fallbackUrl);
    if (normalizedFallback) {
      return [
        {
          id: null,
          url: normalizedFallback,
          image_url: normalizedFallback,
          originalName: null,
          isPrimary: true,
          displayOrder: 0,
        },
      ];
    }
  }

  return validImages;
};

const resolvePlagueImage = (plague) => {
  const rawImages = Array.isArray(plague.images) ? plague.images : [];
  const firstImage =
    rawImages.find((img) => img.is_primary === true) || rawImages[0];
  return normalizeUrl(
    firstImage?.image_url || firstImage?.url || plague.image_url,
  );
};

const resolvePlagueTheme = (riskLevel) => {
  const riskKey = String(riskLevel || '')
    .toLowerCase()
    .replace('í', 'i');
  return riskThemes[riskKey] || defaultRiskTheme;
};

const mapAssociatedPlague = (plague) => {
  const imageUrl = resolvePlagueImage(plague);
  const riskTheme = resolvePlagueTheme(plague.risk_level);

  return {
    id: plague.id,
    name: plague.name,
    scientificName: plague.scientific_name || null,
    scientific_name: plague.scientific_name || null,
    category: plague.category || 'Plaga',
    description: plague.description || null,
    riskLevel: plague.risk_level || 'Bajo',
    risk_level: plague.risk_level || 'Bajo',
    riskTheme,
    riskLabel: riskTheme.label,
    imageUrl,
    image_url: imageUrl,
    hasImage: Boolean(imageUrl),
  };
};

const buildAssociatedPlagues = (plagues = []) =>
  Array.isArray(plagues) ? plagues.map(mapAssociatedPlague) : [];

const mapAssociatedProduct = (product) => {
  const rawImages = Array.isArray(product.images) ? product.images : [];
  const firstImage =
    rawImages.find((img) => img.is_primary === true) || rawImages[0];
  const imageUrl = normalizeUrl(firstImage?.image_url || product.image_url);

  return {
    id: product.id,
    name: product.name,
    category: product.category || 'Insumo',
    activeIngredient: product.active_ingredient || null,
    active_ingredient: product.active_ingredient || null,
    manufacturer: product.manufacturer || null,
    imageUrl,
    image_url: imageUrl,
    hasImage: Boolean(imageUrl),
  };
};

const buildAssociatedProducts = (products = []) =>
  Array.isArray(products) ? products.map(mapAssociatedProduct) : [];

const extractFarmCoordinates = (farm) => {
  const rawLat = farm.location_lat;
  const rawLng = farm.location_lng;
  const hasLat =
    rawLat !== null && rawLat !== undefined && Number.isFinite(Number(rawLat));
  const hasLng =
    rawLng !== null && rawLng !== undefined && Number.isFinite(Number(rawLng));

  return {
    hasCoords: hasLat && hasLng,
    lat: hasLat ? Number(rawLat) : null,
    lng: hasLng ? Number(rawLng) : null,
  };
};

const mapAssociatedFarm = (farm) => {
  const coords = extractFarmCoordinates(farm);
  return {
    id: farm.id,
    name: farm.name,
    municipality: farm.municipality || 'Ubicación no especificada',
    farmingType: farm.farming_type || 'Agrícola',
    farming_type: farm.farming_type || 'Agrícola',
    sizeHectares: farm.size_hectares ? Number(farm.size_hectares) : null,
    size_hectares: farm.size_hectares ? Number(farm.size_hectares) : null,
    ...coords,
  };
};

const buildAssociatedFarms = (farms = []) =>
  Array.isArray(farms) ? farms.map(mapAssociatedFarm) : [];

const MONTH_NAMES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
];

const MONTH_FULL_NAMES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
];

const isSpringSummer = (str) =>
  str.includes('primavera') ||
  str.includes('verano') ||
  str === 'p-v' ||
  str === 'pv';

const isAutumnWinter = (str) =>
  str.includes('otono') ||
  str.includes('invierno') ||
  str === 'o-i' ||
  str === 'oi';

const isPerennial = (str) =>
  str.includes('perenne') ||
  str.includes('anual') ||
  str.includes('todo el ano');

const resolveSeasonPattern = (seasonText) => {
  const normalized = normalizeGeoKey(seasonText);
  if (!normalized) return null;
  if (isSpringSummer(normalized)) return 'pv';
  if (isAutumnWinter(normalized)) return 'oi';
  if (isPerennial(normalized)) return 'perenne';
  return null;
};

const getMonthStatusPV = (monthIndex) => {
  if (monthIndex >= 3 && monthIndex <= 5) {
    return {
      status: 'siembra',
      label: 'Siembra',
      badgeClass: 'bg-emerald-500 text-white',
    };
  }
  if (monthIndex >= 8 && monthIndex <= 10) {
    return {
      status: 'cosecha',
      label: 'Cosecha',
      badgeClass: 'bg-amber-500 text-white',
    };
  }
  if (monthIndex >= 6 && monthIndex <= 7) {
    return {
      status: 'desarrollo',
      label: 'Desarrollo',
      badgeClass: 'bg-sky-400 text-white',
    };
  }
  return null;
};

const getMonthStatusOI = (monthIndex) => {
  if (monthIndex >= 9 && monthIndex <= 11) {
    return {
      status: 'siembra',
      label: 'Siembra',
      badgeClass: 'bg-emerald-500 text-white',
    };
  }
  if (monthIndex >= 2 && monthIndex <= 4) {
    return {
      status: 'cosecha',
      label: 'Cosecha',
      badgeClass: 'bg-amber-500 text-white',
    };
  }
  if (monthIndex === 0 || monthIndex === 1) {
    return {
      status: 'desarrollo',
      label: 'Desarrollo',
      badgeClass: 'bg-sky-400 text-white',
    };
  }
  return null;
};

const buildMonthStatus = (monthIndex, pattern) => {
  if (pattern === 'pv') {
    return (
      getMonthStatusPV(monthIndex) || {
        status: 'inactivo',
        label: 'Inactivo',
        badgeClass:
          'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      }
    );
  }
  if (pattern === 'oi') {
    return (
      getMonthStatusOI(monthIndex) || {
        status: 'inactivo',
        label: 'Inactivo',
        badgeClass:
          'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
      }
    );
  }
  if (pattern === 'perenne') {
    return {
      status: 'desarrollo',
      label: 'Ciclo activo',
      badgeClass: 'bg-emerald-600 text-white',
    };
  }
  return {
    status: 'inactivo',
    label: 'Inactivo',
    badgeClass:
      'bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400',
  };
};

const SEASON_DESCRIPTIONS = Object.freeze({
  pv: 'Ciclo estimado Primavera–Verano: siembra entre abril y junio; cosecha estimada entre septiembre y noviembre.',
  oi: 'Ciclo estimado Otoño–Invierno: siembra entre octubre y diciembre; cosecha estimada entre marzo y mayo.',
  perenne:
    'Cultivo perenne: desarrollo continuo con mantenimiento fitosanitario a lo largo de todo el año.',
});

export const buildAgriculturalCalendar = (rawSeason) => {
  const pattern = resolveSeasonPattern(rawSeason);
  if (!pattern) {
    return {
      hasCalendar: false,
      patternLabel: rawSeason || 'No documentado',
      description:
        'Temporada no registrada o sin correspondencia estacional estándar.',
      months: [],
    };
  }

  const months = MONTH_NAMES.map((name, index) => {
    const info = buildMonthStatus(index, pattern);
    return {
      index,
      name,
      fullName: MONTH_FULL_NAMES[index],
      status: info.status,
      statusLabel: info.label,
      badgeClass: info.badgeClass,
      isActive: info.status !== 'inactivo',
    };
  });

  return {
    hasCalendar: true,
    pattern,
    patternLabel: rawSeason,
    description:
      SEASON_DESCRIPTIONS[pattern] || 'Calendario agrícola estimado.',
    months,
  };
};

const extractTargetStateNames = (cropData) => {
  const rawList = [cropData.state, cropData.region]
    .filter(Boolean)
    .flatMap((val) => String(val).split(/[,;/]+/))
    .map((str) => str.trim())
    .filter(Boolean);

  const matchedKeys = new Set();
  rawList.forEach((entry) => {
    const key = normalizeGeoKey(entry);
    const canonical = STATE_NAME_ALIASES[key] || key;
    if (canonical) matchedKeys.add(canonical);
  });

  return matchedKeys;
};

const buildCropMexicoMap = (cropData, farms = []) => {
  const targetKeys = extractTargetStateNames(cropData);
  let matchedStateCount = 0;

  const states = getStatePaths().map((state) => {
    const stateKey = normalizeGeoKey(state.estado);
    const isMatched = targetKeys.has(stateKey);
    if (isMatched) matchedStateCount += 1;

    return {
      ...state,
      isAffected: isMatched,
      stateClass: isMatched
        ? 'fill-emerald-400/80 stroke-emerald-800'
        : 'fill-slate-200/80 stroke-white dark:fill-slate-700/60 dark:stroke-slate-900',
    };
  });

  const farmMarkers = farms.flatMap((farm) => {
    if (!farm.hasCoords) return [];
    const point = projectMexicoPoint(farm.lng, farm.lat);
    if (!point) return [];

    return [
      {
        id: farm.id,
        name: farm.name,
        municipality: farm.municipality,
        x: point.x,
        y: point.y,
        pinClass: 'fill-[#1b4332] stroke-white',
        haloClass: 'fill-emerald-600/25',
      },
    ];
  });

  if (matchedStateCount === 0 && farmMarkers.length === 0) {
    return null;
  }

  return {
    viewBox: `0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`,
    states,
    markers: farmMarkers,
    matchedStateCount,
    farmCount: farmMarkers.length,
  };
};

const IDENTITY_OPTIONAL_KEYS = [
  'common_name',
  'scientific_name',
  'family',
  'genus',
  'variety',
  'description',
  'observations',
];

const buildCropIdentity = (cropData, mainImageUrl) => {
  const common = cropData.common_name || cropData.name;
  const botanical = cropData.botanical_family || cropData.family || null;

  const identity = {
    id: cropData.id,
    name: cropData.name,
    commonName: common,
    scientificName: cropData.scientific_name || null,
    category: cropData.category || 'Agrícola',
    botanical_family: botanical,
    botanicalFamily: botanical,
    image_url: mainImageUrl,
    imageUrl: mainImageUrl,
  };

  for (const key of IDENTITY_OPTIONAL_KEYS) {
    identity[key] = cropData[key] || null;
  }

  return identity;
};

const buildCropAgronomy = (cropData) => ({
  growth_cycle: cropData.growth_cycle || null,
  cycle: cropData.cycle || null,
  harvest_days: cropData.harvest_days ?? null,
  average_yield: cropData.average_yield || null,
  planting_density: cropData.planting_density || null,
  planting_depth: cropData.planting_depth || null,
  planting_season: cropData.planting_season || null,
  season: cropData.season || null,
});

const buildCropClimate = (cropData, tempRange, rainRange) => ({
  optimal_climate: cropData.optimal_climate || cropData.climate || null,
  climate: cropData.climate || null,
  min_temperature: cropData.min_temperature ?? null,
  max_temperature: cropData.max_temperature ?? null,
  temperatureRange: tempRange,
  min_rainfall: cropData.min_rainfall ?? null,
  max_rainfall: cropData.max_rainfall ?? null,
  rainfallRange: rainRange,
  humidity: cropData.humidity || null,
});

const buildCropSoil = (cropData) => ({
  soil_requirements: cropData.soil_requirements || null,
  soil_type: cropData.soil_type || null,
  soilSummary: cropData.soil_type || cropData.soil_requirements || null,
  ph_range: cropData.ph_range || null,
  organic_matter: cropData.organic_matter || null,
  drainage: cropData.drainage || null,
});

const buildCropWaterAndLight = (cropData) => ({
  water_requirements: cropData.water_requirements || null,
  water_requirement: cropData.water_requirement || null,
  irrigation_type: cropData.irrigation_type || null,
  sunlight_requirement: cropData.sunlight_requirement || null,
});

const resolvePruningLabel = (requiresPruning) => {
  if (requiresPruning === true) return 'Sí requiere poda de manejo';
  if (requiresPruning === false) return 'No requiere poda sistemática';
  return null;
};

const buildCropManagement = (cropData) => {
  const requiresPruning =
    cropData.requires_pruning === null ||
    cropData.requires_pruning === undefined
      ? null
      : Boolean(cropData.requires_pruning);

  return {
    nutrients: cropData.nutrients || null,
    fertilization: cropData.fertilization || null,
    requires_pruning: requiresPruning,
    requiresPruningLabel: resolvePruningLabel(requiresPruning),
    pollination_type: cropData.pollination_type || null,
  };
};

const buildCropTerritory = (cropData, altRange) => ({
  region: cropData.region || null,
  state: cropData.state || null,
  min_altitude: cropData.min_altitude ?? null,
  max_altitude: cropData.max_altitude ?? null,
  altitudeRange: altRange,
});

const buildCropEditorial = (cropData) => ({
  status: cropData.status || 'pendiente',
  workflow_status: cropData.workflow_status || null,
  workflowStatus: cropData.workflow_status || null,
  review_notes: cropData.review_notes || null,
  reviewNotes: cropData.review_notes || null,
  verifiedBy: cropData.verifiedBy?.full_name || cropData.verified_by || null,
  verifiedAt: formatDate(cropData.verified_at),
  publishedAt: formatDate(cropData.published_at),
  updatedAt: formatDate(cropData.updatedAt),
  isVerified: Boolean(cropData.verified_by_user_id || cropData.verified_at),
  isPublished: cropData.workflow_status === 'published',
});

const buildCropKpis = (cropData, seasonString) => {
  const cycleValue =
    cropData.growth_cycle ||
    (cropData.harvest_days ? `${cropData.harvest_days} días` : null);

  return {
    cycle: cycleValue,
    season: seasonString,
    water: cropData.water_requirements || cropData.water_requirement || null,
    yield: cropData.average_yield || null,
  };
};

const resolveCropSeason = (cropData) =>
  cropData.planting_season || cropData.season || null;

const buildCropRanges = (cropData) => ({
  tempRange: formatTemperatureRange(
    cropData.min_temperature,
    cropData.max_temperature,
  ),
  rainRange: formatRainfallRange(cropData.min_rainfall, cropData.max_rainfall),
  altRange: formatAltitudeRange(cropData.min_altitude, cropData.max_altitude),
});

const assembleCropRecord = (cropData, mainImageUrl, ranges) => {
  const identity = buildCropIdentity(cropData, mainImageUrl);
  const agronomy = buildCropAgronomy(cropData);
  const climate = buildCropClimate(
    cropData,
    ranges.tempRange,
    ranges.rainRange,
  );
  const soil = buildCropSoil(cropData);
  const waterAndLight = buildCropWaterAndLight(cropData);
  const management = buildCropManagement(cropData);
  const territory = buildCropTerritory(cropData, ranges.altRange);
  const editorial = buildCropEditorial(cropData);

  return {
    ...identity,
    ...agronomy,
    ...climate,
    ...soil,
    ...waterAndLight,
    ...management,
    ...territory,
    ...editorial,
  };
};

export const buildCropDetailView = (cropData = {}) => {
  const carouselImages = buildCropImages(cropData.images, cropData.image_url);
  const primaryImage = carouselImages[0] || null;
  const mainImageUrl = primaryImage ? primaryImage.url : null;

  const plagues = buildAssociatedPlagues(cropData.plagues);
  const products = buildAssociatedProducts(cropData.products);
  const farms = buildAssociatedFarms(cropData.farms);

  const seasonString = resolveCropSeason(cropData);
  const calendar = buildAgriculturalCalendar(seasonString);
  const ranges = buildCropRanges(cropData);
  const kpis = buildCropKpis(cropData, seasonString);
  const assembledCrop = assembleCropRecord(cropData, mainImageUrl, ranges);
  const crop = {
    ...assembledCrop,
    images: carouselImages,
  };
  const mexicoMap = buildCropMexicoMap(cropData, farms);

  return {
    crop,
    primaryImage,
    carouselImages,
    images: carouselImages,
    plagues,
    products,
    farms,
    kpis,
    calendar,
    mexicoMap,
    plaguesCount: plagues.length,
    productsCount: products.length,
    farmsCount: farms.length,
  };
};
