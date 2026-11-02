import db from '../../../models/index.js';
import { parsePublicCropId } from '../../../services/cropPublicQueryService.js';
import { buildCropDetailView } from '../../../services/cropDetailService.js';
import { sendCropPdfResponse } from '../../../services/cropPdfService.js';
import { CROP_WORKFLOW_STATUSES } from '../../../services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_STATUSES } from '../../../services/plagueWorkflowService.js';
import { PRODUCT_WORKFLOW_STATUSES } from '../../../services/productWorkflowService.js';

const { Crop, CropImage, Plague, PlagueImage, Product, ProductImage, User } =
  db;

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

const cropDetailIncludes = [
  {
    model: CropImage,
    as: 'images',
    required: false,
    separate: true,
    order: [
      ['is_primary', 'DESC'],
      ['display_order', 'ASC'],
    ],
  },
  {
    model: Plague,
    as: 'plagues',
    required: false,
    where: {
      status: true,
      workflow_status: PLAGUE_WORKFLOW_STATUSES.PUBLISHED,
    },
    include: [{ model: PlagueImage, as: 'images', required: false }],
  },
  {
    model: Product,
    as: 'products',
    required: false,
    where: {
      status: true,
      workflow_status: PRODUCT_WORKFLOW_STATUSES.PUBLISHED,
    },
    attributes: ['id', 'name', 'category', 'active_ingredient', 'manufacturer'],
    include: [{ model: ProductImage, as: 'images', required: false }],
  },
  {
    model: User,
    as: 'verifiedBy',
    required: false,
    attributes: ['id', 'full_name'],
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

export const renderCropDetail = async (req, res) => {
  const cropId = parsePublicCropId(req.params.id);
  if (!cropId) return renderNotFound(res);

  try {
    const cropRecord = await findPublishedCrop(cropId);
    if (!cropRecord) return renderNotFound(res);

    const cropData = cropRecord.toJSON();
    const detail = buildCropDetailView(cropData);

    if (req.query?.format === 'pdf') {
      return await sendCropPdfResponse(res, detail, {
        download: req.query.download === '1',
        isPrivate: false,
      });
    }

    return res.render('shared/crop-detail', {
      layout: 'public',
      pageTitle: detail.crop.commonName || detail.crop.name,
      activePage: 'crops',
      isPrivate: false,
      ...detail,
      crop: detail.crop,
      primaryImage: detail.primaryImage?.url || null,
      carouselImages: detail.carouselImages,
      extraScripts:
        '<script type="module" src="/js/shared/crop-detail.js?v=2.0"></script>',
    });
  } catch (error) {
    console.error('Error en renderCropDetail:', error);
    return res.status(500).send('Error al cargar la información del cultivo');
  }
};
