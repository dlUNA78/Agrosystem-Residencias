import path from 'node:path';
import { fileURLToPath } from 'node:url';

import db from '../../../models/index.js';
import { getContextualCropPermissions } from '../../../services/cropAuthorizationService.js';
import { buildCropPublicationReadiness } from '../../../services/cropReadinessService.js';
import { isCropEditable } from '../../../services/cropWorkflowService.js';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const privateLayout = path.join(
  currentDirectory,
  '../../../views/layouts/private',
);
const { Crop, CropImage, Plague, Farm, Product } = db;
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
  { model: Plague, as: 'plagues', required: false },
  { model: Farm, as: 'farms', required: false },
  { model: Product, as: 'products', required: false },
];

const parseCropId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

const normalizeImages = (images = []) =>
  images.map((image) => ({
    ...image,
    image_url: image.image_url
      ? `/${String(image.image_url).replace(/^\/+/, '')}`
      : null,
  }));

const buildDetailContext = (cropRecord, user) => {
  const crop = cropRecord.toJSON();
  const images = normalizeImages(crop.images);
  const primaryImage =
    images.find((image) => image.is_primary === true) || images[0] || null;
  const permissions = getContextualCropPermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: crop.created_by_user_id,
  });

  return {
    crop,
    images,
    primaryImage,
    permissions,
    readiness: buildCropPublicationReadiness({ ...crop, images }),
    viewCrop: { ...crop, images, image_url: primaryImage?.image_url },
  };
};

const sendDetailResponse = (req, res, context) => {
  const { crop, images, primaryImage, permissions, readiness, viewCrop } =
    context;
  const wantsJson = req.xhr || req.headers.accept?.includes('application/json');

  if (wantsJson) {
    return res.json({ success: true, crop: viewCrop, permissions, readiness });
  }

  return res.render('shared/crop-detail', {
    layout: privateLayout,
    pageTitle: crop.name,
    activePage: 'crops',
    isPrivate: true,
    crop: viewCrop,
    primaryImage: primaryImage?.image_url,
    carouselImages: images,
    permissions,
    readiness,
    canEditRecord: permissions.canEdit && isCropEditable(crop.workflow_status),
  });
};

export const getCropDetail = async (req, res) => {
  const cropId = parseCropId(req.params.id);
  if (!cropId) return res.status(400).send('ID de cultivo no válido');

  try {
    const cropRecord = await Crop.findByPk(cropId, {
      include: cropDetailIncludes,
    });

    if (!cropRecord) return res.status(404).send('Cultivo no encontrado');
    return sendDetailResponse(
      req,
      res,
      buildDetailContext(cropRecord, req.user),
    );
  } catch (error) {
    console.error('Error al obtener el cultivo:', error);
    return res.status(500).send('Error al obtener el cultivo');
  }
};
