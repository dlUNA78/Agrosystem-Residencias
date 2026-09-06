import db from '../../../models/index.js';
import {
  normalizePublicImagePath,
  parsePublicCropId,
} from '../../../services/cropPublicQueryService.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';

const { Crop, CropImage } = db;

const riskThemes = {
  Alto: {
    badgeClass: 'bg-rose-50 text-rose-800 border-rose-200',
    textClass: 'text-rose-600',
    label: 'Crítico',
  },
  Medio: {
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    textClass: 'text-amber-600',
    label: 'Moderado',
  },
  Bajo: {
    badgeClass: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    textClass: 'text-emerald-600',
    label: 'Bajo',
  },
};

const plagueFallbackImages = {
  'Pulgón Verde': '/images/plagas/pulgon-verde.webp',
  'Gusano Cogollero': '/images/plagas/gusano-cogollero.webp',
  Cenicilla: '/images/plagas/cenicilla.webp',
  'Mosca del Mediterráneo': '/images/plagas/mosca-mediterraneo.webp',
  'Psílido Asiático': '/images/plagas/psilido-asiatico.webp',
  'Roya Amarilla': '/images/plagas/roya-amarilla.webp',
  'Tizón Tardío': '/images/plagas/tizon-tardio.webp',
  'Trips Oriental': '/images/plagas/trips-oriental.webp',
};

const renderNotFound = (res) =>
  res.status(404).render('public/crops', {
    pageTitle: 'Cultivo No Encontrado',
    activePage: 'crops',
    error: 'El cultivo solicitado no existe o no se encuentra disponible.',
    crops: [],
    totalCount: 0,
    totalPages: 1,
    currentPage: 1,
  });

const findPrimaryImage = (images = []) =>
  images.find((image) => image.is_primary) || images[0] || null;

const resolvePlagueImage = (plague) => {
  const primaryImage = findPrimaryImage(plague.images);
  const storedImage =
    primaryImage?.image_url || primaryImage?.url || plague.image_url;

  return (
    normalizePublicImagePath(storedImage) ||
    plagueFallbackImages[plague.name] ||
    '/images/plagas/pulgon-verde.webp'
  );
};

const resolveProductImage = (product) => {
  const primaryImage = findPrimaryImage(product.images);
  return (
    normalizePublicImagePath(primaryImage?.image_url || product.image_url) ||
    '/images/products/confidor-350-sc.webp'
  );
};

const enrichPlagues = (plagues = []) =>
  plagues.map((plague) => {
    const theme = riskThemes[plague.risk_level] || riskThemes.Bajo;

    return {
      id: plague.id,
      name: plague.name,
      scientific_name: plague.scientific_name,
      category: plague.category,
      description: plague.description,
      risk_level: plague.risk_level,
      image_url: resolvePlagueImage(plague),
      riskTheme: theme,
      riskLabel: theme.label,
    };
  });

const enrichProducts = (products = []) =>
  products.map((product) => ({
    id: product.id,
    name: product.name,
    category: product.category,
    active_ingredient: product.active_ingredient,
    manufacturer: product.manufacturer,
    image_url: resolveProductImage(product),
  }));

const buildPublicCropDetail = ({ crop, primaryImage, carouselImages }) => ({
  id: crop.id,
  name: crop.name,
  common_name: crop.common_name,
  scientific_name: crop.scientific_name,
  category: crop.category,
  family: crop.family,
  botanical_family: crop.botanical_family,
  description: crop.description,
  growth_cycle: crop.growth_cycle,
  cycle: crop.cycle,
  planting_season: crop.planting_season,
  season: crop.season,
  optimal_climate: crop.optimal_climate,
  climate: crop.climate,
  min_temperature: crop.min_temperature,
  max_temperature: crop.max_temperature,
  min_rainfall: crop.min_rainfall,
  max_rainfall: crop.max_rainfall,
  soil_requirements: crop.soil_requirements,
  soil_type: crop.soil_type,
  ph_range: crop.ph_range,
  organic_matter: crop.organic_matter,
  water_requirements: crop.water_requirements,
  water_requirement: crop.water_requirement,
  irrigation_type: crop.irrigation_type,
  harvest_days: crop.harvest_days,
  average_yield: crop.average_yield,
  planting_density: crop.planting_density,
  planting_depth: crop.planting_depth,
  image_url: primaryImage,
  images: carouselImages,
  plagues: enrichPlagues(crop.plagues),
  products: enrichProducts(crop.products),
});

const cropDetailIncludes = [
  { model: CropImage, as: 'images', required: false },
  {
    model: db.Plague,
    as: 'plagues',
    required: false,
    where: {
      status: true,
      workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
    },
    include: [{ model: db.PlagueImage, as: 'images', required: false }],
  },
  {
    model: db.Product,
    as: 'products',
    required: false,
    where: { status: true },
    include: [{ model: db.ProductImage, as: 'images', required: false }],
  },
];

const findPublishedCrop = (cropId) =>
  Crop.findOne({
    where: {
      id: cropId,
      status: 'aprobado',
      workflow_status: CROP_WORKFLOW_STATUSES.PUBLISHED,
    },
    include: cropDetailIncludes,
  });

const buildPublicDetailContext = (cropRecord) => {
  const crop = cropRecord.toJSON();
  const primaryImageRecord = findPrimaryImage(crop.images);
  const primaryImage = normalizePublicImagePath(
    primaryImageRecord?.image_url || crop.image_url,
  );
  const carouselImages = (crop.images || []).map((image) => ({
    image_url: normalizePublicImagePath(image.image_url),
  }));

  return {
    primaryImage,
    carouselImages,
    crop: buildPublicCropDetail({ crop, primaryImage, carouselImages }),
  };
};

const renderPublicDetail = (res, context) =>
  res.render('shared/crop-detail', {
    pageTitle: context.crop.name || context.crop.common_name,
    activePage: 'crops',
    isPrivate: false,
    crop: context.crop,
    primaryImage: context.primaryImage,
    carouselImages: context.carouselImages,
  });

export const renderCropDetail = async (req, res) => {
  const cropId = parsePublicCropId(req.params.id);
  if (!cropId) return renderNotFound(res);

  try {
    const cropRecord = await findPublishedCrop(cropId);

    if (!cropRecord) return renderNotFound(res);
    return renderPublicDetail(res, buildPublicDetailContext(cropRecord));
  } catch (error) {
    console.error('Error en renderCropDetail:', error);
    return res.status(500).send('Error al cargar la información del cultivo');
  }
};
