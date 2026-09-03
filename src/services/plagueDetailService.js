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

const buildBiologicalCycle = (cycle) => {
  let normalizedCycle = cycle;

  if (typeof normalizedCycle === 'string') {
    try {
      normalizedCycle = JSON.parse(normalizedCycle);
    } catch {
      normalizedCycle = [normalizedCycle];
    }
  }

  if (
    normalizedCycle &&
    typeof normalizedCycle === 'object' &&
    !Array.isArray(normalizedCycle)
  ) {
    normalizedCycle = Object.entries(normalizedCycle).map(([key, value]) => ({
      title: `${key.charAt(0).toUpperCase()}${key.slice(1)}`.replaceAll(
        '_',
        ' ',
      ),
      description:
        value && typeof value === 'object' ? value.description || null : null,
      duration:
        value && typeof value === 'object'
          ? value.duration || null
          : String(value),
    }));
  }

  if (!Array.isArray(normalizedCycle)) return [];

  return normalizedCycle
    .filter(
      (stage) =>
        typeof stage === 'string' || stage?.description || stage?.title,
    )
    .map((stage, index) => {
      const step = String(index + 1).padStart(2, '0');

      if (typeof stage === 'string') {
        return {
          step,
          title: `Etapa ${index + 1}`,
          description: stage,
          duration: null,
          icon: 'pest_control',
          isControlWindow: false,
        };
      }

      return {
        step: stage.step || step,
        title: stage.title || `Etapa ${index + 1}`,
        description: stage.description || null,
        duration: stage.duration || null,
        icon: stage.icon || 'pest_control',
        isControlWindow: stage.isControlWindow === true,
      };
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
      controlMethods: plagueData.control_methods || null,
      biologicalControl: plagueData.biological_control || null,
      biologicalCycle: buildBiologicalCycle(plagueData.biological_cycle),
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
    carouselImages,
    relatedProducts,
    incidenceRegions,
    incidenceRegionsJson: JSON.stringify(incidenceRegions),
    relatedCrops,
    regionSummary: incidenceRegions.map((region) => region.name).join(', '),
    cropSummary: relatedCrops
      .map((crop) => crop.name)
      .filter(Boolean)
      .join(', '),
  };
};
