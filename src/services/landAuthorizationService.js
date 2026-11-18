export const getLandPermissions = (role) => {
  const isAdmin = role === 'admin';
  const isInifap = role === 'inifap';
  const isAgricultor = role === 'agricultor';
  const hasPrivateAccess = isAdmin || isInifap || isAgricultor;

  return {
    canViewPrivate: hasPrivateAccess,
    canCreate: hasPrivateAccess,
    canViewAll: false, // Por privacidad estricta, cada usuario solo ve y gestiona sus propios predios
    canEditOwn: hasPrivateAccess,
    canArchiveOwn: hasPrivateAccess,
    canRestoreOwn: hasPrivateAccess,
    canDeleteOwn: hasPrivateAccess,
    canManageAll: false,
  };
};

export const getLandListWhere = (user, { status = 'active' } = {}) => {
  const where = {};

  if (status === 'active') where.status = true;
  if (status === 'archived') where.status = false;

  // Regla estricta de privacidad: todo usuario autenticado (incluido admin) ve únicamente sus propios predios
  if (user?.id) {
    where.user_id = user.id;
  }

  return where;
};

export const getContextualLandPermissions = ({
  role: _role,
  userId,
  ownerUserId,
  isActive,
}) => {
  const isOwner = Number(userId) === Number(ownerUserId);

  return {
    canView: isOwner,
    canEdit: isOwner && Boolean(isActive),
    canArchive: isOwner && Boolean(isActive),
    canRestore: isOwner && !isActive,
    canDelete: isOwner && !isActive,
  };
};
