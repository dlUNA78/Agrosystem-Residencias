import { Router } from 'express';

import {
  renderLandsPrivate,
  landDetail,
  createFarmPrivate,
  updateFarmPrivate,
  archiveFarmPrivate,
  restoreFarmPrivate,
  createLandCropCycle,
  advanceLandCropStage,
  finishLandCropCycle,
  createFarmHealthReport,
  createFarmApplication,
} from '../../controllers/private/landsController.js';

const landRouter = Router();

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PARCELAS / GRANJAS
// ══════════════════════════════════════════════════════════════════════════════
landRouter.get('/private/lands', renderLandsPrivate);
landRouter.get('/private/lands/:id/expediente', landDetail);
landRouter.post('/private/lands/create', createFarmPrivate);
landRouter.post('/private/lands/update/:id', updateFarmPrivate);
landRouter.post('/private/lands/archive/:id', archiveFarmPrivate);
landRouter.post('/private/lands/restore/:id', restoreFarmPrivate);
landRouter.post('/private/lands/:id/cycles', createLandCropCycle);
landRouter.post('/private/lands/:id/cycles/advance', advanceLandCropStage);
landRouter.post('/private/lands/:id/cycles/finish', finishLandCropCycle);
landRouter.post('/private/lands/:id/health-reports', createFarmHealthReport);
landRouter.post('/private/lands/:id/applications', createFarmApplication);

export default landRouter;
