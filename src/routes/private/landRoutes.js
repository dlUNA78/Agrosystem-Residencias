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
  archiveLandCropCycle,
  restoreLandCropCycle,
  revertLandCropStage,
  createFarmHealthReport,
  createFarmApplication,
  createLandLot,
  deleteLandLot,
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
landRouter.post('/private/lands/:id/cycles/revert-stage', revertLandCropStage);
landRouter.post('/private/lands/:id/cycles/finish', finishLandCropCycle);
landRouter.post('/private/lands/:id/cycles/archive', archiveLandCropCycle);
landRouter.post('/private/lands/:id/cycles/restore', restoreLandCropCycle);
landRouter.post('/private/lands/:id/lots', createLandLot);
landRouter.post('/private/lands/:id/lots/:lotId/delete', deleteLandLot);
landRouter.post('/private/lands/:id/health-reports', createFarmHealthReport);
landRouter.post('/private/lands/:id/applications', createFarmApplication);

export default landRouter;
