import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  resolveOperationalSummary,
} from '../services/notificationService.js';

export const getNotifications = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const [userNotifications, operationalSummary] = await Promise.all([
      getUserNotifications(req.user.id, { limit: req.query.limit }),
      resolveOperationalSummary(req.user),
    ]);

    return res.json({
      success: true,
      unreadCount: userNotifications.unreadCount,
      notifications: userNotifications.notifications,
      operationalSummary,
    });
  } catch (error) {
    console.error('Error al obtener notificaciones:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
};

export const markAsRead = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const notification = await markNotificationAsRead(
      req.params.id,
      req.user.id,
    );
    if (!notification) {
      return res.status(404).json({ error: 'not_found' });
    }

    return res.json({ success: true, id: notification.id });
  } catch (error) {
    console.error('Error al marcar notificación como leída:', error);
    return res.status(500).json({ error: 'internal_error' });
  }
};

export const markAllAsRead = async (req, res) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const result = await markAllNotificationsAsRead(req.user.id);
    return res.json({ success: true, updatedCount: result.updatedCount });
  } catch (error) {
    console.error(
      'Error al marcar todas las notificaciones como leídas:',
      error,
    );
    return res.status(500).json({ error: 'internal_error' });
  }
};

const resolveSafeRedirectUrl = (url, userRole) => {
  if (
    url &&
    typeof url === 'string' &&
    url.startsWith('/') &&
    !url.startsWith('//')
  ) {
    return url;
  }
  return userRole === 'agricultor' ? '/profile' : '/dashboard';
};

export const openNotification = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }

    const notification = await markNotificationAsRead(
      req.params.id,
      req.user.id,
    );
    const redirectUrl = resolveSafeRedirectUrl(
      notification?.action_url,
      req.user.role,
    );
    return res.redirect(redirectUrl);
  } catch (error) {
    console.error('Error al abrir notificación:', error);
    return res.redirect('/dashboard');
  }
};
