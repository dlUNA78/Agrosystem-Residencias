import { Router } from 'express';

import {
  uploadProductImages,
  uploadPlagueImages,
  uploadCropImages,
} from '../../middlewares/upload.js';
import {
  requireCropPermission,
  requireCropWorkflowPermission,
} from '../../middlewares/cropAuthorizationMiddleware.js';
import { CROP_PERMISSIONS } from '../../services/cropAuthorizationService.js';
import {
  requirePlaguePermission,
  requirePlagueWorkflowPermission,
} from '../../middlewares/plagueAuthorizationMiddleware.js';
import { PLAGUE_PERMISSIONS } from '../../services/plagueAuthorizationService.js';
import {
  requireProductPermission,
  requireProductWorkflowPermission,
} from '../../middlewares/productAuthorizationMiddleware.js';
import { PRODUCT_PERMISSIONS } from '../../services/productAuthorizationService.js';

import {
  cropsPrivate,
  getCropDetail,
  createCrop,
  updateCrop,
  deleteCrop,
  updateCropWorkflow,
} from '../../controllers/private/cropsController.js';
import {
  plaguesPrivate,
  getPlagueDetail,
  createPlague,
  updatePlague,
  deletePlague,
  updatePlagueWorkflow,
  updatePlagueRelations,
} from '../../controllers/private/plagueController.js';
import {
  productsPrivate,
  getProductDetail,
  createProduct,
  updateProduct,
  deleteProduct,
  updateProductWorkflow,
} from '../../controllers/private/productsController.js';
import { ingredientsPrivate } from '../../controllers/private/ingredientsController.js';

const catalogRouter = Router();

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: CULTIVOS
// ══════════════════════════════════════════════════════════════════════════════
catalogRouter.get(
  '/private/crops',
  requireCropPermission(CROP_PERMISSIONS.VIEW_PRIVATE),
  cropsPrivate,
);
catalogRouter.get(
  '/private/catalog/crops',
  requireCropPermission(CROP_PERMISSIONS.VIEW_PRIVATE),
  cropsPrivate,
);
catalogRouter.get(
  '/private/crops/:id',
  requireCropPermission(CROP_PERMISSIONS.VIEW_PRIVATE),
  getCropDetail,
);
catalogRouter.post(
  '/private/crops/create',
  requireCropPermission(CROP_PERMISSIONS.CREATE),
  uploadCropImages,
  createCrop,
);
catalogRouter.post(
  '/private/crops/update/:id',
  requireCropPermission(CROP_PERMISSIONS.EDIT),
  uploadCropImages,
  updateCrop,
);
catalogRouter.post(
  '/private/crops/delete/:id',
  requireCropPermission(CROP_PERMISSIONS.DELETE),
  deleteCrop,
);
catalogRouter.post(
  '/private/crops/:id/workflow',
  requireCropWorkflowPermission,
  updateCropWorkflow,
);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PLAGAS
// ══════════════════════════════════════════════════════════════════════════════
catalogRouter.get(
  '/private/plagues',
  requirePlaguePermission(PLAGUE_PERMISSIONS.VIEW_PRIVATE),
  plaguesPrivate,
);
catalogRouter.get(
  '/private/catalog/plagues',
  requirePlaguePermission(PLAGUE_PERMISSIONS.VIEW_PRIVATE),
  plaguesPrivate,
);
catalogRouter.get(
  '/private/plagues/:id',
  requirePlaguePermission(PLAGUE_PERMISSIONS.VIEW_PRIVATE),
  getPlagueDetail,
);
catalogRouter.post(
  '/private/plagues/create',
  requirePlaguePermission(PLAGUE_PERMISSIONS.CREATE),
  uploadPlagueImages,
  createPlague,
);
catalogRouter.post(
  '/private/plagues/update/:id',
  requirePlaguePermission(PLAGUE_PERMISSIONS.EDIT),
  uploadPlagueImages,
  updatePlague,
);
catalogRouter.post(
  '/private/plagues/delete/:id',
  requirePlaguePermission(PLAGUE_PERMISSIONS.DELETE),
  deletePlague,
);
catalogRouter.post(
  '/private/plagues/:id/workflow',
  requirePlagueWorkflowPermission,
  updatePlagueWorkflow,
);
catalogRouter.post(
  '/private/plagues/:id/relations',
  requirePlaguePermission(PLAGUE_PERMISSIONS.MANAGE_RELATIONS),
  updatePlagueRelations,
);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PRODUCTOS AGROQUÍMICOS
// ══════════════════════════════════════════════════════════════════════════════
catalogRouter.get(
  '/private/products',
  requireProductPermission(PRODUCT_PERMISSIONS.VIEW_PRIVATE),
  productsPrivate,
);
catalogRouter.get(
  '/private/catalog/products',
  requireProductPermission(PRODUCT_PERMISSIONS.VIEW_PRIVATE),
  productsPrivate,
);
catalogRouter.get(
  '/private/products/:id',
  requireProductPermission(PRODUCT_PERMISSIONS.VIEW_PRIVATE),
  getProductDetail,
);
catalogRouter.post(
  '/private/products/create',
  requireProductPermission(PRODUCT_PERMISSIONS.CREATE),
  uploadProductImages,
  createProduct,
);
catalogRouter.post(
  '/private/products/update/:id',
  requireProductPermission(PRODUCT_PERMISSIONS.EDIT),
  uploadProductImages,
  updateProduct,
);
catalogRouter.post(
  '/private/products/delete/:id',
  requireProductPermission(PRODUCT_PERMISSIONS.DELETE),
  deleteProduct,
);
catalogRouter.post(
  '/private/products/:id/workflow',
  requireProductWorkflowPermission,
  updateProductWorkflow,
);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: INGREDIENTES
// ══════════════════════════════════════════════════════════════════════════════
catalogRouter.get('/private/ingredients', ingredientsPrivate);

export default catalogRouter;
