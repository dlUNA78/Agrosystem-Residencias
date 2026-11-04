import { Op } from 'sequelize';
import db from '../models/index.js';

const { Notification, User, Crop, Plague, Product, Farm, FarmHealthReport } =
  db;

const sanitizeNotificationInput = ({
  userId,
  actorId = null,
  category = 'sistema',
  severity = 'info',
  title,
  message,
  actionUrl = null,
}) => {
  if (!userId || !title || !message) return null;
  return {
    user_id: Number(userId),
    actor_id: actorId ? Number(actorId) : null,
    category: String(category).slice(0, 50),
    severity: String(severity).slice(0, 20),
    title: String(title).slice(0, 255),
    message: String(message),
    action_url: actionUrl ? String(actionUrl).slice(0, 255) : null,
    is_read: false,
    read_at: null,
  };
};

export const createNotification = async (payload) => {
  if (!Notification || typeof Notification.create !== 'function') return null;
  const sanitized = sanitizeNotificationInput(payload);
  if (!sanitized) return null;

  try {
    const notification = await Notification.create(sanitized);
    return notification;
  } catch (error) {
    console.warn(
      '[notificationService] Error al crear notificación:',
      error.message,
    );
    return null;
  }
};

export const notifyAuthorOnWorkflowChange = async ({
  authorId,
  actorId,
  entityName,
  moduleTitle,
  workflowStatus,
  actionUrl,
}) => {
  if (!authorId || Number(authorId) === Number(actorId)) return;
  await createNotification({
    userId: authorId,
    actorId,
    category: 'editorial',
    severity: workflowStatus === 'published' ? 'success' : 'info',
    title: `Actualización de ${moduleTitle}`,
    message: `La ficha "${entityName}" ha cambiado a estado "${workflowStatus}".`,
    actionUrl,
  });
};

export const notifyAdmins = async ({
  actorId = null,
  category = 'sistema',
  severity = 'info',
  title,
  message,
  actionUrl = null,
}) => {
  if (!User) return;
  try {
    const admins = await User.findAll({
      where: { role: 'admin', status: 'activo' },
      attributes: ['id'],
    });

    await Promise.all(
      admins.map((admin) =>
        createNotification({
          userId: admin.id,
          actorId,
          category,
          severity,
          title,
          message,
          actionUrl,
        }),
      ),
    );
  } catch (error) {
    console.warn(
      '[notificationService] Error al notificar a administradores:',
      error.message,
    );
  }
};

export const getUserNotifications = async (
  userId,
  { limit = 15, unreadOnly = false } = {},
) => {
  if (!Notification || !userId) {
    return { unreadCount: 0, notifications: [] };
  }

  const whereClause = { user_id: Number(userId) };
  if (unreadOnly) {
    whereClause.is_read = false;
  }

  const [unreadCount, notifications] = await Promise.all([
    Notification.count({
      where: { user_id: Number(userId), is_read: false },
    }),
    Notification.findAll({
      where: whereClause,
      order: [
        ['is_read', 'ASC'],
        ['createdAt', 'DESC'],
      ],
      limit: Math.min(Number(limit) || 15, 50),
      include: [
        {
          model: User,
          as: 'actor',
          attributes: ['id', 'full_name', 'photo_url', 'role'],
          required: false,
        },
      ],
    }),
  ]);

  return {
    unreadCount,
    notifications: notifications.map((n) =>
      typeof n.toJSON === 'function' ? n.toJSON() : n,
    ),
  };
};

export const markNotificationAsRead = async (notificationId, userId) => {
  if (!Notification || !notificationId || !userId) return null;

  const notification = await Notification.findOne({
    where: {
      id: Number(notificationId),
      user_id: Number(userId),
    },
  });

  if (!notification) return null;

  notification.is_read = true;
  notification.read_at = new Date();
  await notification.save();

  return notification;
};

export const markAllNotificationsAsRead = async (userId) => {
  if (!Notification || !userId) return { updatedCount: 0 };

  const [updatedCount] = await Notification.update(
    {
      is_read: true,
      read_at: new Date(),
    },
    {
      where: {
        user_id: Number(userId),
        is_read: false,
      },
    },
  );

  return { updatedCount };
};

const resolveFarmerOperationalSummary = async (userId) => {
  if (!FarmHealthReport || !Farm) return { openHealthAlerts: 0 };
  const count = await FarmHealthReport.count({
    where: {
      status: 'open',
      severity: { [Op.in]: ['critical', 'high', 'critica', 'alta'] },
    },
    include: [
      {
        model: Farm,
        as: 'farm',
        where: { user_id: userId },
        required: true,
      },
    ],
  });
  return { openHealthAlerts: count };
};

const resolveInifapOperationalSummary = async () => {
  const [cropsInReview, plaguesInReview, productsInReview] = await Promise.all([
    Crop ? Crop.count({ where: { workflow_status: 'in_review' } }) : 0,
    Plague ? Plague.count({ where: { workflow_status: 'in_review' } }) : 0,
    Product ? Product.count({ where: { workflow_status: 'in_review' } }) : 0,
  ]);

  const itemsInReview = cropsInReview + plaguesInReview + productsInReview;
  return { itemsInReview, cropsInReview, plaguesInReview, productsInReview };
};

const resolveAdminOperationalSummary = async () => {
  const [inifapSummary, pendingUsers] = await Promise.all([
    resolveInifapOperationalSummary(),
    User ? User.count({ where: { status: 'pendiente' } }) : 0,
  ]);

  return {
    ...inifapSummary,
    pendingUsers,
  };
};

export const resolveOperationalSummary = async (user) => {
  if (!user || !user.role) return {};

  try {
    if (user.role === 'agricultor') {
      return await resolveFarmerOperationalSummary(user.id);
    }
    if (user.role === 'inifap') {
      return await resolveInifapOperationalSummary();
    }
    if (user.role === 'admin') {
      return await resolveAdminOperationalSummary();
    }
  } catch (error) {
    console.warn(
      '[notificationService] Error al calcular resumen operativo:',
      error.message,
    );
  }

  return {};
};
