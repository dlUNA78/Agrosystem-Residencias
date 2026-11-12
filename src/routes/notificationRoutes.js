import { Router } from 'express';
import {
  isAuthenticated,
  requirePanelAccess,
} from '../middlewares/authMiddleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  openNotification,
} from '../controllers/notificationController.js';
import { submitCatalogSuggestion } from '../controllers/public/catalogSuggestionController.js';
import { createRegionalBulletinHandler } from '../controllers/private/landsController.js';

const notificationRouter = Router();

notificationRouter.use(
  [
    '/api/notifications',
    '/notifications',
    '/suggestions',
    '/private/lands/bulletins',
    '/private/bulletins',
    '/private/suggestions',
  ],
  isAuthenticated,
);

notificationRouter.get('/api/notifications', getNotifications);
notificationRouter.post('/api/notifications/:id/read', markAsRead);
notificationRouter.post('/api/notifications/read-all', markAllAsRead);
notificationRouter.get('/notifications/:id/open', openNotification);

// Colaboración ciudadana y boletines regionales
notificationRouter.post('/suggestions/:catalog', submitCatalogSuggestion);
notificationRouter.post(
  '/private/lands/bulletins',
  requirePanelAccess,
  createRegionalBulletinHandler,
);
notificationRouter.get('/private/bulletins', requirePanelAccess, (_req, res) =>
  res.redirect('/lands#boletines-regionales'),
);
notificationRouter.get(
  '/private/suggestions',
  requirePanelAccess,
  (_req, res) => res.redirect('/private/plagues?workflow=in_review'),
);

export default notificationRouter;
