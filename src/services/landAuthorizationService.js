export const getLandPermissions = (role) => {
  const isAdmin = role === 'admin';
  const isInifap = role === 'inifap';
  const hasPrivateAccess = isAdmin || isInifap;

  return {
    canViewPrivate: hasPrivateAccess,
    canCreate: hasPrivateAccess,
    canViewAll: isAdmin,
    canEditOwn: isInifap,
    canArchiveOwn: isInifap,
    canRestoreOwn: isInifap,
    canManageAll: isAdmin,
  };
};

export const getLandListWhere = (user, { status = 'active' } = {}) => {
  const permissions = getLandPermissions(user?.role);
  const where = {};

  if (status === 'active') where.status = true;
  if (status === 'archived') where.status = false;
  if (!permissions.canViewAll) where.user_id = user?.id;

  return where;
};

export const getContextualLandPermissions = ({
  role,
  userId,
  ownerUserId,
  isActive,
}) => {
  const permissions = getLandPermissions(role);
  const isOwner = Number(userId) === Number(ownerUserId);
  const canManage = permissions.canManageAll || isOwner;

  return {
    canView: permissions.canViewAll || (permissions.canViewPrivate && isOwner),
    canEdit: canManage && Boolean(isActive),
    canArchive: canManage && Boolean(isActive),
    canRestore: canManage && !isActive,
  };
};
