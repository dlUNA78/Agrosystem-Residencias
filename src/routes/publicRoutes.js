import express from 'express';
import { renderHomeIndex } from '../controllers/public/homeController.js';
import {
  renderPlaguesPublic,
  renderPlagueDetail,
  getPlaguesData,
} from '../controllers/public/plagueController.js';
import {
  renderCropsPublic,
  renderCropDetail,
  getCropsData,
} from '../controllers/public/cropController.js';
import {
  renderProductsPublic,
  renderProductDetail,
  getProductsData,
} from '../controllers/public/productController.js';
import {
  renderForumPublic,
  renderForumDetailPublic,
  renderForumSpecialistsPublic,
  renderForumMessagesPublic,
} from '../controllers/public/forumController.js';

import { publicRateLimiter } from '../middlewares/rateLimiter.js';
import { publicReadOnlyGuard } from '../middlewares/publicReadOnlyGuard.js';

const publicRouter = express.Router();

// Aplicar middlewares de Rate Limiting y Protección Read-Only a todo el router público
publicRouter.use(publicRateLimiter);
publicRouter.use(publicReadOnlyGuard);

// ── RUTAS PÚBLICAS Y ENDPOINTS API ──────────────────────────────────────────
publicRouter.get('/', renderHomeIndex);

// Plagas
publicRouter.get('/api/plagues', getPlaguesData);
publicRouter.get('/plagues', renderPlaguesPublic);
publicRouter.get('/plagues/:id', renderPlagueDetail);

// Cultivos
publicRouter.get('/api/crops', getCropsData);
publicRouter.get('/crops', renderCropsPublic);
publicRouter.get('/crops/:id', renderCropDetail);

// Productos
publicRouter.get('/api/products', getProductsData);
publicRouter.get('/products', renderProductsPublic);
publicRouter.get('/products/:id', renderProductDetail);

// Foro público
publicRouter.get('/forum', renderForumPublic);
publicRouter.get('/forum/specialists', renderForumSpecialistsPublic);
publicRouter.get('/forum/messages', (req, res) => res.redirect('/forum'));
publicRouter.get('/forum/:id', renderForumDetailPublic);

export default publicRouter;
