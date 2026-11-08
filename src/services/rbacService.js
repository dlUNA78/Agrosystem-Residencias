// src/services/rbacService.js

export const PANEL_PERMISSIONS = Object.freeze({
  // Cultivos
  CROPS_VIEW_PRIVATE: 'crops.viewPrivate',
  CROPS_CREATE: 'crops.create',
  CROPS_EDIT: 'crops.edit',
  CROPS_MANAGE_RELATIONS: 'crops.manageRelations',
  CROPS_SUBMIT_REVIEW: 'crops.submitReview',
  CROPS_VERIFY: 'crops.verify',
  CROPS_PUBLISH: 'crops.publish',
  CROPS_ARCHIVE: 'crops.archive',
  CROPS_RESTORE: 'crops.restore',
  CROPS_DELETE: 'crops.delete',

  // Plagas
  PLAGUES_VIEW_PRIVATE: 'plagues.viewPrivate',
  PLAGUES_CREATE: 'plagues.create',
  PLAGUES_EDIT: 'plagues.edit',
  PLAGUES_MANAGE_RELATIONS: 'plagues.manageRelations',
  PLAGUES_SUBMIT_REVIEW: 'plagues.submitReview',
  PLAGUES_VERIFY: 'plagues.verify',
  PLAGUES_PUBLISH: 'plagues.publish',
  PLAGUES_ARCHIVE: 'plagues.archive',
  PLAGUES_RESTORE: 'plagues.restore',
  PLAGUES_DELETE: 'plagues.delete',

  // Productos
  PRODUCTS_VIEW_PRIVATE: 'products.viewPrivate',
  PRODUCTS_CREATE: 'products.create',
  PRODUCTS_EDIT: 'products.edit',
  PRODUCTS_MANAGE_RELATIONS: 'products.manageRelations',
  PRODUCTS_SUBMIT_REVIEW: 'products.submitReview',
  PRODUCTS_VERIFY: 'products.verify',
  PRODUCTS_PUBLISH: 'products.publish',
  PRODUCTS_ARCHIVE: 'products.archive',
  PRODUCTS_RESTORE: 'products.restore',
  PRODUCTS_DELETE: 'products.delete',

  // Ingredientes Activos
  INGREDIENTS_VIEW: 'ingredients.view',
  INGREDIENTS_MANAGE: 'ingredients.manage',

  // Proveedores
  SUPPLIERS_VIEW: 'suppliers.view',
  SUPPLIERS_MANAGE: 'suppliers.manage',

  // Parcelas / Granja
  LANDS_VIEW_PRIVATE: 'lands.viewPrivate',
  LANDS_MANAGE: 'lands.manage',
  LANDS_VIEW_DETAILED: 'lands.viewDetailed',

  // Reportes y Analítica
  REPORTS_VIEW: 'reports.view',
  REPORTS_EXPORT: 'reports.export',

  // Auditoría
  AUDIT_VIEW: 'audit.view',

  // Gobernanza (Exclusivo Administrador)
  USERS_MANAGE: 'users.manage',
  RBAC_MANAGE: 'rbac.manage',
  CODES_MANAGE: 'codes.manage',
});

export const ALL_PANEL_PERMISSIONS = Object.freeze(
  Object.values(PANEL_PERMISSIONS),
);

export const DELEGABLE_PERMISSIONS = Object.freeze(
  ALL_PANEL_PERMISSIONS.filter(
    (perm) =>
      perm !== PANEL_PERMISSIONS.USERS_MANAGE &&
      perm !== PANEL_PERMISSIONS.RBAC_MANAGE &&
      perm !== PANEL_PERMISSIONS.CODES_MANAGE,
  ),
);

export const PERMISSION_DEFINITIONS = Object.freeze([
  {
    category: 'Cultivos',
    id: 'crops',
    items: [
      {
        id: PANEL_PERMISSIONS.CROPS_VIEW_PRIVATE,
        label: 'Ver panel de cultivos',
      },
      { id: PANEL_PERMISSIONS.CROPS_CREATE, label: 'Crear fichas de cultivo' },
      {
        id: PANEL_PERMISSIONS.CROPS_EDIT,
        label: 'Editar contenidos de cultivo',
      },
      {
        id: PANEL_PERMISSIONS.CROPS_MANAGE_RELATIONS,
        label: 'Vincular plagas e insumos',
      },
      {
        id: PANEL_PERMISSIONS.CROPS_SUBMIT_REVIEW,
        label: 'Enviar fichas a revisión',
      },
      {
        id: PANEL_PERMISSIONS.CROPS_VERIFY,
        label: 'Verificar y solicitar cambios',
      },
      {
        id: PANEL_PERMISSIONS.CROPS_PUBLISH,
        label: 'Publicar cultivos en portal',
      },
      { id: PANEL_PERMISSIONS.CROPS_ARCHIVE, label: 'Archivar cultivos' },
      {
        id: PANEL_PERMISSIONS.CROPS_RESTORE,
        label: 'Restaurar cultivos archivados',
      },
      { id: PANEL_PERMISSIONS.CROPS_DELETE, label: 'Eliminar cultivos' },
    ],
  },
  {
    category: 'Plagas y Enfermedades',
    id: 'plagues',
    items: [
      {
        id: PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE,
        label: 'Ver panel de plagas',
      },
      { id: PANEL_PERMISSIONS.PLAGUES_CREATE, label: 'Registrar plagas' },
      { id: PANEL_PERMISSIONS.PLAGUES_EDIT, label: 'Editar fichas de plaga' },
      {
        id: PANEL_PERMISSIONS.PLAGUES_MANAGE_RELATIONS,
        label: 'Asociar hospedantes e insumos',
      },
      {
        id: PANEL_PERMISSIONS.PLAGUES_SUBMIT_REVIEW,
        label: 'Enviar plaga a revisión',
      },
      {
        id: PANEL_PERMISSIONS.PLAGUES_VERIFY,
        label: 'Verificar control fitosanitario',
      },
      {
        id: PANEL_PERMISSIONS.PLAGUES_PUBLISH,
        label: 'Publicar plagas en catálogo',
      },
      { id: PANEL_PERMISSIONS.PLAGUES_ARCHIVE, label: 'Archivar plagas' },
      { id: PANEL_PERMISSIONS.PLAGUES_RESTORE, label: 'Restaurar plagas' },
      { id: PANEL_PERMISSIONS.PLAGUES_DELETE, label: 'Eliminar plagas' },
    ],
  },
  {
    category: 'Insumos y Agroquímicos',
    id: 'products',
    items: [
      {
        id: PANEL_PERMISSIONS.PRODUCTS_VIEW_PRIVATE,
        label: 'Ver panel de productos',
      },
      {
        id: PANEL_PERMISSIONS.PRODUCTS_CREATE,
        label: 'Registrar nuevo insumo',
      },
      {
        id: PANEL_PERMISSIONS.PRODUCTS_EDIT,
        label: 'Editar ficha de producto',
      },
      {
        id: PANEL_PERMISSIONS.PRODUCTS_MANAGE_RELATIONS,
        label: 'Vincular ingredientes y plagas',
      },
      {
        id: PANEL_PERMISSIONS.PRODUCTS_SUBMIT_REVIEW,
        label: 'Enviar producto a revisión',
      },
      {
        id: PANEL_PERMISSIONS.PRODUCTS_VERIFY,
        label: 'Validar registro RSCO/COFEPRIS',
      },
      {
        id: PANEL_PERMISSIONS.PRODUCTS_PUBLISH,
        label: 'Publicar producto técnico',
      },
      { id: PANEL_PERMISSIONS.PRODUCTS_ARCHIVE, label: 'Archivar productos' },
      { id: PANEL_PERMISSIONS.PRODUCTS_RESTORE, label: 'Restaurar productos' },
      { id: PANEL_PERMISSIONS.PRODUCTS_DELETE, label: 'Eliminar producto' },
    ],
  },
  {
    category: 'Ingredientes y Proveedores',
    id: 'ingredients_suppliers',
    items: [
      {
        id: PANEL_PERMISSIONS.INGREDIENTS_VIEW,
        label: 'Consultar ingredientes activos',
      },
      {
        id: PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
        label: 'Gestionar ingredientes (CRUD)',
      },
      { id: PANEL_PERMISSIONS.SUPPLIERS_VIEW, label: 'Consultar proveedores' },
      {
        id: PANEL_PERMISSIONS.SUPPLIERS_MANAGE,
        label: 'Gestionar proveedores (CRUD)',
      },
    ],
  },
  {
    category: 'Operaciones de Campo y Reportes',
    id: 'operations',
    items: [
      {
        id: PANEL_PERMISSIONS.LANDS_VIEW_PRIVATE,
        label: 'Ver parcelas y predios',
      },
      {
        id: PANEL_PERMISSIONS.LANDS_MANAGE,
        label: 'Gestionar ciclos, lotes y bitácoras',
      },
      {
        id: PANEL_PERMISSIONS.LANDS_VIEW_DETAILED,
        label: 'Acceso a expediente confidencial',
      },
      {
        id: PANEL_PERMISSIONS.REPORTS_VIEW,
        label: 'Consultar reportes y analítica',
      },
      {
        id: PANEL_PERMISSIONS.REPORTS_EXPORT,
        label: 'Exportar informes oficiales PDF',
      },
      {
        id: PANEL_PERMISSIONS.AUDIT_VIEW,
        label: 'Consultar logs de auditoría',
      },
    ],
  },
]);

const BASE_INIFAP_PERMISSIONS = Object.freeze(
  new Set([
    PANEL_PERMISSIONS.CROPS_VIEW_PRIVATE,
    PANEL_PERMISSIONS.CROPS_CREATE,
    PANEL_PERMISSIONS.CROPS_EDIT,
    PANEL_PERMISSIONS.CROPS_MANAGE_RELATIONS,
    PANEL_PERMISSIONS.CROPS_SUBMIT_REVIEW,
    PANEL_PERMISSIONS.CROPS_VERIFY,
    PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE,
    PANEL_PERMISSIONS.PLAGUES_CREATE,
    PANEL_PERMISSIONS.PLAGUES_EDIT,
    PANEL_PERMISSIONS.PLAGUES_MANAGE_RELATIONS,
    PANEL_PERMISSIONS.PLAGUES_SUBMIT_REVIEW,
    PANEL_PERMISSIONS.PLAGUES_VERIFY,
    PANEL_PERMISSIONS.PRODUCTS_VIEW_PRIVATE,
    PANEL_PERMISSIONS.PRODUCTS_CREATE,
    PANEL_PERMISSIONS.PRODUCTS_EDIT,
    PANEL_PERMISSIONS.PRODUCTS_MANAGE_RELATIONS,
    PANEL_PERMISSIONS.PRODUCTS_SUBMIT_REVIEW,
    PANEL_PERMISSIONS.PRODUCTS_VERIFY,
    PANEL_PERMISSIONS.INGREDIENTS_VIEW,
    PANEL_PERMISSIONS.SUPPLIERS_VIEW,
    PANEL_PERMISSIONS.LANDS_VIEW_PRIVATE,
    PANEL_PERMISSIONS.LANDS_MANAGE,
    PANEL_PERMISSIONS.REPORTS_VIEW,
  ]),
);

const BASE_AGRICULTOR_PERMISSIONS = Object.freeze(
  new Set([
    PANEL_PERMISSIONS.LANDS_VIEW_PRIVATE,
    PANEL_PERMISSIONS.LANDS_MANAGE,
  ]),
);

const parsePermissionsList = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') {
    try {
      const parsed = JSON.parse(val);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
};

const extractCustomOverrides = (user) => {
  const overrides = user?.custom_permissions;
  if (!overrides || typeof overrides !== 'object') {
    return { allow: [], deny: [] };
  }
  return {
    allow: parsePermissionsList(overrides.allow),
    deny: parsePermissionsList(overrides.deny),
  };
};

const getBasePermissionsForRole = (role) => {
  if (role === 'inifap') {
    return new Set(BASE_INIFAP_PERMISSIONS);
  }
  if (role === 'agricultor') {
    return new Set(BASE_AGRICULTOR_PERMISSIONS);
  }
  return new Set();
};

export const resolveEffectivePermissions = (user) => {
  if (!user || user.status === 'suspendido') {
    return new Set();
  }

  if (user.role === 'admin') {
    return new Set(ALL_PANEL_PERMISSIONS);
  }

  const effective = getBasePermissionsForRole(user.role);

  const subRole = user.rbacRole || user.RbacRole;
  if (subRole?.permissions) {
    const subPerms = parsePermissionsList(subRole.permissions);
    subPerms.forEach((perm) => effective.add(perm));
  }

  const { allow, deny } = extractCustomOverrides(user);
  allow.forEach((perm) => effective.add(perm));
  deny.forEach((perm) => effective.delete(perm));

  return effective;
};

export const hasEffectivePermission = (user, permission) => {
  if (!permission || !user) return false;
  const effective = resolveEffectivePermissions(user);
  return effective.has(permission);
};

export const canModifyUserRoleOrStatus = ({
  actor,
  targetUserId,
  _targetCurrentRole,
  newRole,
  newStatus,
}) => {
  if (!actor || actor.role !== 'admin') {
    return {
      allowed: false,
      reason: 'Solo un administrador puede alterar roles o estatus.',
    };
  }

  const isSelf = Number(actor.id) === Number(targetUserId);

  if (isSelf && newRole && newRole !== 'admin') {
    return {
      allowed: false,
      reason:
        'Por seguridad no puedes retirar tus propios privilegios de administrador.',
    };
  }

  if (!isSelf && newRole === 'admin') {
    return {
      allowed: false,
      reason:
        'Por gobernanza institucional, el rol de Administrador General es único y no transferible.',
    };
  }

  if (isSelf && newStatus === 'suspendido') {
    return {
      allowed: false,
      reason: 'Por seguridad no puedes auto-suspender tu propia cuenta activa.',
    };
  }

  return { allowed: true };
};

const resolveRoleBadgeDetails = (role, subRole) => {
  if (role === 'admin') {
    return {
      title: 'Administrador General',
      badgeColor: 'purple',
      subTitle: 'Control Total del Sistema',
    };
  }
  if (subRole?.name) {
    return {
      title: subRole.name,
      badgeColor: subRole.badge_color || 'emerald',
      subTitle: `Personal INIFAP · ${subRole.name}`,
    };
  }
  if (role === 'inifap') {
    return {
      title: 'Personal Técnico INIFAP',
      badgeColor: 'emerald',
      subTitle: 'Investigador Institucional',
    };
  }
  return {
    title: 'Productor Agrícola',
    badgeColor: 'sky',
    subTitle: 'Usuario Consultor',
  };
};

export const getUserRoleSummary = (user) => {
  const isSuspended = user?.status === 'suspendido';
  const subRole = user?.rbacRole || user?.RbacRole;
  const details = resolveRoleBadgeDetails(user?.role, subRole);

  return {
    ...details,
    isSuspended,
  };
};
