import { Router } from 'express';
import { isAuthenticated } from '../middlewares/authMiddleware.js';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  openNotification,
} from '../controllers/notificationController.js';

const notificationRouter = Router();

notificationRouter.use(isAuthenticated);

notificationRouter.get('/api/notifications', getNotifications);
notificationRouter.post('/api/notifications/:id/read', markAsRead);
notificationRouter.post('/api/notifications/read-all', markAllAsRead);
notificationRouter.get('/notifications/:id/open', openNotification);

export default notificationRouter;
