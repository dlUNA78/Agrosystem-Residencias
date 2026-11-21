import { Op } from 'sequelize';
import db from '../models/index.js';

const { Notification, User, Crop, Plague, Product, Farm, FarmHealthReport } =
  db;

const PANEL_ROLES = new Set(['admin', 'inifap']);
const ADMIN_ONLY_PRIVATE_PREFIXES = Object.freeze([
  '/private/users',
  '/private/audit',
  '/private/rbac',
  '/private/codes',
]);

const CATALOG_ROUTE_PATTERNS = Object.freeze([
  {
    regex: /^\/private\/(?:catalog\/)?crops(?:\/(\d+))?\/?$/,
    publicBase: '/crops',
  },
  {
    regex: /^\/private\/(?:catalog\/)?plagues(?:\/(\d+))?\/?$/,
    publicBase: '/plagues',
  },
  {
    regex: /^\/private\/(?:catalog\/)?products(?:\/(\d+))?\/?$/,
    publicBase: '/products',
  },
]);

const INTERNAL_URL_BASE = 'http://agrosystem.internal';

const getDefaultActionUrlForRole = (userRole) =>
  PANEL_ROLES.has(userRole) ? '/dashboard' : '/profile';

const hasControlCharacters = (value) => {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
};

const parseSafeInternalUrl = (rawUrl) => {
  if (!rawUrl || typeof rawUrl !== 'string') return null;
  const trimmed = rawUrl.trim();
  if (
    !trimmed.startsWith('/') ||
    trimmed.startsWith('//') ||
    trimmed.includes('\\') ||
    hasControlCharacters(trimmed)
  ) {
    return null;
  }

  try {
    const parsed = new URL(trimmed, INTERNAL_URL_BASE);
    if (parsed.origin !== INTERNAL_URL_BASE) {
      return null;
    }
    return {
      pathname: parsed.pathname,
      suffix: `${parsed.search}${parsed.hash}`,
      normalized: `${parsed.pathname}${parsed.search}${parsed.hash}`,
    };
  } catch {
    return null;
  }
};

const isPathPrefixMatch = (lowerPathname, prefix) =>
  lowerPathname === prefix || lowerPathname.startsWith(`${prefix}/`);

const mapPrivateCatalogPathForPublic = (lowerPathname, workflowStatus) => {
  for (const { regex, publicBase } of CATALOG_ROUTE_PATTERNS) {
    const match = lowerPathname.match(regex);
    if (match) {
      const entityId = match[1];
      if (entityId && workflowStatus === 'published') {
        return `${publicBase}/${entityId}`;
      }
      return publicBase;
    }
  }
  return null;
};

const resolveNonPanelActionUrl = (parsed, workflowStatus) => {
  const lowerPathname = parsed.pathname.toLowerCase();
  const isRestrictedPanelPath =
    isPathPrefixMatch(lowerPathname, '/private') ||
    isPathPrefixMatch(lowerPathname, '/dashboard');
  if (!isRestrictedPanelPath) {
    return parsed.normalized;
  }

  if (
    lowerPathname === '/private/profile' ||
    lowerPathname === '/private/profile/'
  ) {
    return `/profile${parsed.suffix}`;
  }

  if (
    isPathPrefixMatch(lowerPathname, '/private/lands') ||
    isPathPrefixMatch(lowerPathname, '/private/bulletins')
  ) {
    return '/lands';
  }

  const mappedCatalog = mapPrivateCatalogPathForPublic(
    lowerPathname,
    workflowStatus,
  );
  return mappedCatalog || '/profile';
};

const isAdminOnlyPrivatePath = (lowerPathname) =>
  ADMIN_ONLY_PRIVATE_PREFIXES.some((prefix) =>
    isPathPrefixMatch(lowerPathname, prefix),
  );

export const resolveNotificationActionUrl = (
  actionUrl,
  userRole,
  options = {},
) => {
  const fallback = getDefaultActionUrlForRole(userRole);
  const parsed = parseSafeInternalUrl(actionUrl);
  if (!parsed) {
    return fallback;
  }

  if (!PANEL_ROLES.has(userRole)) {
    return resolveNonPanelActionUrl(parsed, options.workflowStatus);
  }

  const lowerPathname = parsed.pathname.toLowerCase();
  if (userRole !== 'admin' && isAdminOnlyPrivatePath(lowerPathname)) {
    return '/dashboard';
  }

  return parsed.normalized;
};

const lookupUserRole = async (userId) => {
  if (!User || typeof User.findByPk !== 'function' || !userId) return null;
  try {
    const user = await User.findByPk(Number(userId), {
      attributes: ['id', 'role'],
    });
    return user?.role || null;
  } catch (error) {
    console.warn(
      '[notificationService] Error al consultar rol del destinatario:',
      error.message,
    );
    return null;
  }
};

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
  authorRole = null,
  actorId,
  entityName,
  moduleTitle,
  workflowStatus,
  actionUrl,
}) => {
  if (!authorId || Number(authorId) === Number(actorId)) return;
  const resolvedRole = authorRole || (await lookupUserRole(authorId));
  const resolvedActionUrl =
    actionUrl && resolvedRole
      ? resolveNotificationActionUrl(actionUrl, resolvedRole, {
          workflowStatus,
        })
      : actionUrl;

  await createNotification({
    userId: authorId,
    actorId,
    category: 'editorial',
    severity: workflowStatus === 'published' ? 'success' : 'info',
    title: `Actualización de ${moduleTitle}`,
    message: `La ficha "${entityName}" ha cambiado a estado "${workflowStatus}".`,
    actionUrl: resolvedActionUrl,
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
  const numericNotificationId = Number(notificationId);
  const numericUserId = Number(userId);
  if (
    !Notification ||
    !Number.isInteger(numericNotificationId) ||
    numericNotificationId <= 0 ||
    !Number.isInteger(numericUserId) ||
    numericUserId <= 0
  ) {
    return null;
  }

  const notification = await Notification.findOne({
    where: {
      id: numericNotificationId,
      user_id: numericUserId,
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
