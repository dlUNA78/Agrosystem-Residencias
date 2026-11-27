import { PERMISSION_DEFINITIONS } from './rbacService.js';

const PERMISSION_LABEL_MAP = Object.freeze(
  Object.fromEntries(
    PERMISSION_DEFINITIONS.flatMap((group) =>
      group.items.map((item) => [item.id, item.label]),
    ),
  ),
);

const USER_ROLE_LABELS = Object.freeze({
  admin: 'Administrador',
  inifap: 'Personal INIFAP',
  agricultor: 'Productor Agrícola',
});

const ROLE_TRANSITION_ACTIONS = new Set([
  'update_user_role',
  'update_user_permissions',
  'upgrade_role',
]);

const MODULE_TABLES = {
  plagas: ['Plagues', 'Plague', 'PlagueImages', 'PlagueRegions'],
  cultivos: ['Crops', 'Crop', 'CropImages'],
  productos: ['Products', 'Product', 'ProductImages'],
  terrenos: [
    'Farms',
    'Farm',
    'FarmCrops',
    'FarmCropStages',
    'FarmHealthReports',
    'FarmApplications',
    'FarmBlocks',
  ],
  usuarios: ['Users', 'User', 'InifapCodes', 'RBAC', 'RbacRoles'],
  proveedores: ['Suppliers', 'Supplier'],
  ingredientes: ['ActiveIngredients', 'ActiveIngredient'],
};

const ACTION_GROUPS = {
  crear: [
    'create',
    'create_crop_cycle',
    'create_health_report',
    'create_application',
    'create_block',
  ],
  editar: [
    'update',
    'update_user_role',
    'update_user_permissions',
    'upgrade_role',
    'advance_crop_stage',
    'revert_crop_stage',
    'finish_crop_cycle',
    'update_workflow',
    'manage_relations',
  ],
  roles: [
    'update_user_role',
    'update_user_permissions',
    'upgrade_role',
    'create_role',
    'update_role',
    'delete_role',
    'generate_codes',
    'revoke_code',
  ],
  eliminar: ['delete', 'destroy', 'deactivate_block'],
  archivar: ['archive'],
  restaurar: ['restore'],
  aprobar: ['verify', 'publish', 'request_changes', 'submit_review'],
};

const EXTRA_AUDIT_TABLES = [
  'FarmLots',
  'CropRelations',
  'PlagueRelations',
  'ProductRelations',
  'RBAC',
  'RbacRoles',
  'Reports',
  'Notifications',
  'Regions',
];

const WORKFLOW_ACTION_SUFFIXES = [
  'create',
  'update',
  'delete',
  'relations.update',
  'submit_review',
  'request_changes',
  'verify',
  'publish',
  'request_archive',
  'approve_archive',
  'reject_archive',
  'archive',
  'restore',
];

const PREFIXED_WORKFLOW_ACTIONS = [
  'crop',
  'plague',
  'product',
  'workflow',
].flatMap((prefix) =>
  WORKFLOW_ACTION_SUFFIXES.map((suffix) => `${prefix}.${suffix}`),
);

const EXTRA_AUDIT_ACTIONS = [
  'request_archive',
  'approve_archive',
  'reject_archive',
  'archive_crop_cycle',
  'restore_crop_cycle',
  'create_farm_lot',
  'update_farm_lot',
  'delete_farm_lot',
  'suspend',
  'export',
  'create_role',
  'update_role',
  'delete_role',
  'update_user_role',
  'update_user_permissions',
  'upgrade_role',
  'generate_codes',
  'revoke_code',
  'PASSWORD_CHANGE',
  'AVATAR_UPDATE',
  'AVATAR_REMOVE',
  'PROFILE_UPDATE',
  ...PREFIXED_WORKFLOW_ACTIONS,
];

export const KNOWN_AUDIT_TABLES = Object.freeze([
  ...new Set([...Object.values(MODULE_TABLES).flat(), ...EXTRA_AUDIT_TABLES]),
]);

export const KNOWN_AUDIT_ACTIONS = Object.freeze([
  ...new Set([...Object.values(ACTION_GROUPS).flat(), ...EXTRA_AUDIT_ACTIONS]),
]);

export const escapeLikePattern = (value) =>
  String(value ?? '').replace(/[\\%_]/g, '\\$&');

const toSqlStringLiteral = (value) =>
  `'${String(value ?? '')
    .replaceAll('\0', '')
    .replaceAll("'", "''")}'`;

export const resolveMatchingAuditCatalogValues = (search) => {
  const raw = String(search ?? '')
    .trim()
    .toLowerCase();
  if (!raw) {
    return { matchingTables: [], matchingActions: [] };
  }

  const matchingTables = KNOWN_AUDIT_TABLES.filter((tableName) =>
    tableName.toLowerCase().includes(raw),
  );
  const matchingActions = KNOWN_AUDIT_ACTIONS.filter((actionName) =>
    actionName.toLowerCase().includes(raw),
  );

  return { matchingTables, matchingActions };
};

const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

const normalizeText = (value, maxLength = 120) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, maxLength);

const normalizeIsoDate = (value) => {
  const cleaned = normalizeText(value, 10);
  return ISO_DATE_PATTERN.test(cleaned) ? cleaned : '';
};

export const normalizeAuditQuery = (query = {}) => {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 15));
  const moduleParam = normalizeText(query.module, 32).toLowerCase();
  const actionParam = normalizeText(query.action, 32).toLowerCase();
  const search = normalizeText(query.search, 100);

  return {
    page,
    limit,
    module: Object.prototype.hasOwnProperty.call(MODULE_TABLES, moduleParam)
      ? moduleParam
      : '',
    action: Object.prototype.hasOwnProperty.call(ACTION_GROUPS, actionParam)
      ? actionParam
      : '',
    search,
    dateFrom: normalizeIsoDate(query.dateFrom),
    dateTo: normalizeIsoDate(query.dateTo),
    format: query.format === 'csv' ? 'csv' : '',
  };
};

const buildCreatedAtRange = (Op, dateFrom, dateTo) => {
  if (!dateFrom && !dateTo) return null;
  const range = {};
  if (dateFrom && Op.gte) {
    range[Op.gte] = new Date(`${dateFrom}T00:00:00.000Z`);
  }
  if (dateTo && Op.lte) {
    range[Op.lte] = new Date(`${dateTo}T23:59:59.999Z`);
  }
  return Object.getOwnPropertySymbols(range).length > 0 ? range : null;
};

const buildUserMatchCondition = (
  Op,
  userFilterSql,
  userIdsSubquery,
  literalFn,
) => {
  const targetUserCondition = {
    table_name: { [Op.in]: ['Users', 'RBAC'] },
    record_id: { [Op.in]: userIdsSubquery },
  };
  const actorOrTargetCondition = Op.or
    ? {
        [Op.or]: [
          { user_id: { [Op.in]: userIdsSubquery } },
          targetUserCondition,
        ],
      }
    : { user_id: { [Op.in]: userIdsSubquery } };

  if (!Op.and) {
    return actorOrTargetCondition;
  }

  return {
    [Op.and]: [
      literalFn(`EXISTS (SELECT 1 FROM "Users" WHERE ${userFilterSql})`),
      actorOrTargetCondition,
    ],
  };
};

const buildSearchOrConditions = (Sequelize, search) => {
  const { Op } = Sequelize;
  const rawLower = String(search ?? '')
    .trim()
    .toLowerCase();
  const escapedTerm = escapeLikePattern(rawLower);
  const patternLiteral = toSqlStringLiteral(`%${escapedTerm}%`);
  const literalFn =
    typeof Sequelize.literal === 'function'
      ? (sql) => Sequelize.literal(sql)
      : (sql) => ({ val: sql });

  const { matchingTables, matchingActions } =
    resolveMatchingAuditCatalogValues(rawLower);

  const conditions = [];
  if (matchingTables.length > 0) {
    conditions.push({ table_name: { [Op.in]: matchingTables } });
  }
  if (matchingActions.length > 0) {
    conditions.push({ action: { [Op.in]: matchingActions } });
  }

  const userFilterSql = `lower("full_name") LIKE ${patternLiteral} ESCAPE '\\' OR lower("email") LIKE ${patternLiteral} ESCAPE '\\'`;
  const userIdsSubquery = literalFn(
    `(SELECT "id" FROM "Users" WHERE ${userFilterSql})`,
  );

  conditions.push(
    buildUserMatchCondition(Op, userFilterSql, userIdsSubquery, literalFn),
  );

  return conditions;
};

export const buildAuditWhere = (Sequelize, query) => {
  const { Op } = Sequelize;
  const where = {};

  if (query.module && MODULE_TABLES[query.module]) {
    where.table_name = { [Op.in]: MODULE_TABLES[query.module] };
  }

  const excludedLowImpactActions = [
    'AVATAR_UPDATE',
    'AVATAR_REMOVE',
    'PROFILE_UPDATE',
  ];

  if (query.action && ACTION_GROUPS[query.action]) {
    where.action = { [Op.in]: ACTION_GROUPS[query.action] };
  } else {
    where.action = { [Op.notIn]: excludedLowImpactActions };
  }

  const dateRange = buildCreatedAtRange(Op, query.dateFrom, query.dateTo);
  if (dateRange) {
    where.createdAt = dateRange;
  }

  if (query.search) {
    where[Op.or] = buildSearchOrConditions(Sequelize, query.search);
  }

  return where;
};

const MODULE_LABEL_MATCHERS = [
  [/Farm/i, 'Terrenos'],
  [/Plague/i, 'Plagas'],
  [/Crop/i, 'Cultivos'],
  [/Product/i, 'Productos'],
  [/RBAC|RbacRole/i, 'Usuarios y RBAC'],
  [/User|InifapCode/i, 'Usuarios'],
  [/Supplier/i, 'Proveedores'],
  [/ActiveIngredient/i, 'Ingredientes'],
];

const getModuleLabel = (tableName) => {
  const match = MODULE_LABEL_MATCHERS.find(([regex]) => regex.test(tableName));
  return match ? match[1] : tableName || 'Sistema';
};

const ACTION_DETAILS_MAP = {
  create: {
    label: 'Creación',
    actionText: 'Creó un nuevo registro',
    icon: 'plus-circle',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  create_crop_cycle: {
    label: 'Ciclo Agrícola',
    actionText: 'Abrió ciclo de cultivo',
    icon: 'sprout',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  create_health_report: {
    label: 'Sanidad',
    actionText: 'Reportó incidencia fitosanitaria',
    icon: 'bug',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
  },
  create_application: {
    label: 'Aplicación',
    actionText: 'Registró aplicación química',
    icon: 'flask-conical',
    badgeClass: 'text-sky-700 bg-sky-50 border border-sky-200',
  },
  create_block: {
    label: 'Lote',
    actionText: 'Registró lote operativo',
    icon: 'map-pin',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  update: {
    label: 'Edición',
    actionText: 'Actualizó registro',
    icon: 'pencil',
    badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
  },
  advance_crop_stage: {
    label: 'Fenología',
    actionText: 'Avanzó etapa fenológica',
    icon: 'trending-up',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  revert_crop_stage: {
    label: 'Fenología',
    actionText: 'Retrocedió etapa fenológica',
    icon: 'rotate-ccw',
    badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
  },
  finish_crop_cycle: {
    label: 'Cierre',
    actionText: 'Finalizó ciclo de cultivo',
    icon: 'check-circle-2',
    badgeClass: 'text-slate-700 bg-slate-100 border border-slate-200',
  },
  archive: {
    label: 'Archivado',
    actionText: 'Archivó registro',
    icon: 'archive',
    badgeClass: 'text-slate-700 bg-slate-100 border border-slate-200',
  },
  restore: {
    label: 'Restauración',
    actionText: 'Restauró registro a operación',
    icon: 'archive-restore',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  delete: {
    label: 'Eliminación',
    actionText: 'Eliminó registro',
    icon: 'trash-2',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
  },
  destroy: {
    label: 'Eliminación',
    actionText: 'Eliminó registro',
    icon: 'trash-2',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
  },
  deactivate_block: {
    label: 'Baja Lote',
    actionText: 'Desactivó lote operativo',
    icon: 'trash-2',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
  },
  publish: {
    label: 'Publicación',
    actionText: 'Publicó ficha técnica',
    icon: 'badge-check',
    badgeClass: 'text-sky-700 bg-sky-50 border border-sky-200',
  },
  verify: {
    label: 'Verificación',
    actionText: 'Aprobó técnicamente ficha',
    icon: 'shield-check',
    badgeClass: 'text-sky-700 bg-sky-50 border border-sky-200',
  },
  request_changes: {
    label: 'Observación',
    actionText: 'Solicitó cambios técnicos',
    icon: 'message-square-warning',
    badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
  },
  submit_review: {
    label: 'Revisión',
    actionText: 'Envió ficha a revisión técnica',
    icon: 'send',
    badgeClass: 'text-sky-700 bg-sky-50 border border-sky-200',
  },
  update_user_role: {
    label: 'Cambio de Rol',
    actionText: 'Modificó rol o sub-rol de usuario',
    icon: 'shield',
    badgeClass: 'text-indigo-700 bg-indigo-50 border border-indigo-200',
  },
  update_user_permissions: {
    label: 'Permisos RBAC',
    actionText: 'Actualizó permisos y sub-rol RBAC',
    icon: 'key-round',
    badgeClass: 'text-indigo-700 bg-indigo-50 border border-indigo-200',
  },
  upgrade_role: {
    label: 'Ascenso INIFAP',
    actionText: 'Ascendió a personal INIFAP con código',
    icon: 'award',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  suspend: {
    label: 'Suspensión',
    actionText: 'Suspendió cuenta de usuario',
    icon: 'user-x',
    badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
  },
  create_role: {
    label: 'Nuevo Sub-rol',
    actionText: 'Creó sub-rol RBAC',
    icon: 'shield-plus',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  update_role: {
    label: 'Edición Sub-rol',
    actionText: 'Actualizó sub-rol RBAC',
    icon: 'shield-check',
    badgeClass: 'text-amber-700 bg-amber-50 border border-amber-200',
  },
  delete_role: {
    label: 'Baja Sub-rol',
    actionText: 'Eliminó sub-rol RBAC',
    icon: 'shield-off',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
  },
  generate_codes: {
    label: 'Códigos INIFAP',
    actionText: 'Generó lote de códigos INIFAP',
    icon: 'key',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-200',
  },
  revoke_code: {
    label: 'Revocación',
    actionText: 'Revocó código de acceso INIFAP',
    icon: 'ban',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-200',
  },
};

const getActionDetails = (action) =>
  ACTION_DETAILS_MAP[action] || {
    label: action || 'Acción',
    actionText: `Acción ejecutada: ${action}`,
    icon: 'info',
    badgeClass: 'text-slate-700 bg-slate-100 border border-slate-200',
  };

const isRecordObject = (val) =>
  Boolean(val && typeof val === 'object' && !Array.isArray(val));

const formatUserRoleLabel = (role) => {
  if (!role) return 'Sin registro';
  return USER_ROLE_LABELS[role] || String(role);
};

const formatSubRoleLabel = (values) => {
  if (!isRecordObject(values)) return 'Ninguno';
  if (values.rbac_role_name) return String(values.rbac_role_name);
  if (values.rbac_role_id) return `Sub-rol #${values.rbac_role_id}`;
  return 'Ninguno';
};

const mapPermissionLabels = (list) =>
  Array.isArray(list)
    ? list.map((perm) => PERMISSION_LABEL_MAP[perm] || String(perm))
    : [];

const hasLegacyRoleTransition = (plain, oldValues, newValues) => {
  if (!['Users', 'User', 'RBAC'].includes(plain.table_name)) return false;
  if (plain.action !== 'update') return false;
  const roleChanged =
    oldValues.role !== undefined &&
    newValues.role !== undefined &&
    oldValues.role !== newValues.role;
  const subRoleChanged =
    (oldValues.rbac_role_id ?? null) !== (newValues.rbac_role_id ?? null);
  return roleChanged || subRoleChanged;
};

const resolveTargetIdentity = (plain, oldValues, newValues) => {
  const targetUserId =
    newValues.target_user_id ??
    oldValues.target_user_id ??
    plain.record_id ??
    null;
  const fallbackName = targetUserId ? `Usuario #${targetUserId}` : 'Usuario';
  const targetName = newValues.full_name || oldValues.full_name || fallbackName;
  const targetEmail = newValues.email || oldValues.email || null;
  return { targetUserId, targetName, targetEmail };
};

const asPermissionArray = (value) => (Array.isArray(value) ? value : []);

const asNonEmptyOrNull = (value) => (value ? value : null);

export const extractRoleAuditSummary = (plain) => {
  if (!isRecordObject(plain)) return null;
  const oldValues = isRecordObject(plain.old_values) ? plain.old_values : {};
  const newValues = isRecordObject(plain.new_values) ? plain.new_values : {};
  const isRoleAction =
    ROLE_TRANSITION_ACTIONS.has(plain.action) ||
    hasLegacyRoleTransition(plain, oldValues, newValues);

  if (!isRoleAction) return null;

  const { targetUserId, targetName, targetEmail } = resolveTargetIdentity(
    plain,
    oldValues,
    newValues,
  );
  const permissionsAdded = asPermissionArray(newValues.permissions_added);
  const permissionsRemoved = asPermissionArray(newValues.permissions_removed);

  return {
    targetUserId,
    targetName,
    targetEmail,
    oldRole: asNonEmptyOrNull(oldValues.role),
    newRole: asNonEmptyOrNull(newValues.role),
    oldRoleLabel: formatUserRoleLabel(oldValues.role),
    newRoleLabel: formatUserRoleLabel(newValues.role),
    oldSubRole: formatSubRoleLabel(oldValues),
    newSubRole: formatSubRoleLabel(newValues),
    permissionsAdded,
    permissionsRemoved,
    permissionsAddedLabels: mapPermissionLabels(permissionsAdded),
    permissionsRemovedLabels: mapPermissionLabels(permissionsRemoved),
    subroleAutoRevoked: Boolean(newValues.subrole_auto_revoked),
    customPermissionsCleared: Boolean(newValues.custom_permissions_cleared),
    upgradedWithoutCode: Boolean(newValues.upgraded_without_code),
    orphanSubroleCleared: Boolean(newValues.orphan_subrole_cleared),
    changeSource: asNonEmptyOrNull(newValues.change_source),
    codeMasked: asNonEmptyOrNull(newValues.inifap_code_masked),
  };
};

const formatRoleSummaryAnnotations = (roleChange) => {
  const tags = [];
  const addedCount = roleChange.permissionsAdded.length;
  const removedCount = roleChange.permissionsRemoved.length;
  if (addedCount > 0 || removedCount > 0) {
    tags.push(`(+${addedCount} / -${removedCount} permisos)`);
  }
  if (roleChange.subroleAutoRevoked) {
    tags.push('(retiro automático de sub-rol)');
  }
  if (roleChange.customPermissionsCleared) {
    tags.push('(permisos personalizados limpiados)');
  }
  if (roleChange.upgradedWithoutCode) {
    tags.push('(ascenso directo sin código)');
  }
  if (roleChange.codeMasked) {
    tags.push(`(código ${roleChange.codeMasked})`);
  }
  return tags;
};

const formatRoleChangeDetailsText = (roleChange) => {
  const targetLabel = roleChange.targetEmail
    ? `Objetivo: ${roleChange.targetName} (${roleChange.targetEmail})`
    : `Objetivo: ${roleChange.targetName}`;
  const roleText = roleChange.oldRole
    ? `Rol: ${roleChange.oldRoleLabel} → ${roleChange.newRoleLabel}`
    : `Rol: ${roleChange.newRoleLabel}`;
  const subRoleText = `Sub-rol: ${roleChange.oldSubRole} → ${roleChange.newSubRole}`;
  const annotations = formatRoleSummaryAnnotations(roleChange);
  return [targetLabel, roleText, subRoleText, ...annotations].join(' · ');
};

const extractEntityName = (values) => {
  const candidateKeys = ['name', 'full_name', 'plague_name', 'product_name'];
  const foundKey = candidateKeys.find((key) => Boolean(values[key]));
  return foundKey ? values[foundKey] : '';
};

const extractDetails = (log, roleChange = null) => {
  if (roleChange) {
    return formatRoleChangeDetailsText(roleChange);
  }
  const values = log.new_values ?? log.old_values ?? {};
  const idText = log.record_id ? `ID: ${log.record_id}` : '';
  const nameText = extractEntityName(values);
  const statusText =
    values.status !== undefined ? `Estatus: ${values.status}` : '';
  const affectedText =
    values.affected_users_count !== undefined
      ? `Usuarios afectados: ${values.affected_users_count}`
      : '';

  const parts = [idText, nameText, statusText, affectedText].filter(Boolean);
  return parts.length > 0
    ? parts.join(' · ')
    : `Registro #${log.record_id ?? 'N/A'}`;
};

const formatLogDate = (date) => {
  if (!date) {
    return {
      fullDate: 'Fecha no disponible',
      timeText: '--:--',
      dateText: '--',
    };
  }
  const d = new Date(date);
  const now = new Date();

  const isToday = d.toDateString() === now.toDateString();
  const timeText = d.toLocaleTimeString('es-MX', {
    hour: '2-digit',
    minute: '2-digit',
  });
  const dateText = d.toLocaleDateString('es-MX', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  return {
    fullDate: `${dateText}, ${timeText}`,
    timeText,
    dateText: isToday ? 'Hoy' : dateText,
    isToday,
  };
};

const getInitials = (fullName) => {
  if (!fullName) return 'SI';
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const toPlainLog = (logInstance) =>
  typeof logInstance.toJSON === 'function' ? logInstance.toJSON() : logInstance;

const buildSerializedUser = (rawUser) => {
  const user = rawUser || {};
  const userName = user.full_name || 'Sistema';
  return {
    id: user.id || null,
    name: userName,
    initials: getInitials(userName),
    email: user.email || 'N/A',
    role: (user.role || 'Sistema').toUpperCase(),
  };
};

const stringifyPayload = (payload) =>
  payload ? JSON.stringify(payload, null, 2) : null;

export const serializeAuditLog = (logInstance) => {
  const plain = toPlainLog(logInstance);
  const actionInfo = getActionDetails(plain.action);
  const newValuesJson = stringifyPayload(plain.new_values);
  const oldValuesJson = stringifyPayload(plain.old_values);
  const roleChange = extractRoleAuditSummary(plain);

  return {
    id: plain.id,
    recordId: plain.record_id,
    action: plain.action,
    actionLabel: actionInfo.label,
    actionText: actionInfo.actionText,
    actionIcon: actionInfo.icon,
    actionBadgeClass: actionInfo.badgeClass,
    tableName: plain.table_name,
    moduleLabel: getModuleLabel(plain.table_name),
    user: buildSerializedUser(plain.user),
    dates: formatLogDate(plain.createdAt),
    detailsText: extractDetails(plain, roleChange),
    roleChange,
    roleChangeJson: roleChange ? JSON.stringify(roleChange) : null,
    hasJsonPayload: Boolean(newValuesJson || oldValuesJson),
    newValuesJson,
    oldValuesJson,
  };
};

const sanitizeCsvValue = (raw) => {
  const str = String(raw ?? '').replaceAll('"', '""');
  if (/^[=+\-@]/.test(str)) {
    return `"'${str}"`;
  }
  return `"${str}"`;
};

export const generateAuditCsv = (logs = []) => {
  const headers = [
    'ID Auditoría',
    'Fecha',
    'Hora',
    'Usuario',
    'Correo',
    'Rol',
    'Módulo',
    'Acción',
    'ID Registro',
    'Detalles',
  ];

  const rows = logs.map((log) => [
    sanitizeCsvValue(log.id),
    sanitizeCsvValue(log.dates?.dateText),
    sanitizeCsvValue(log.dates?.timeText),
    sanitizeCsvValue(log.user?.name || 'Sistema'),
    sanitizeCsvValue(log.user?.email || 'N/A'),
    sanitizeCsvValue(log.user?.role || 'SISTEMA'),
    sanitizeCsvValue(log.moduleLabel),
    sanitizeCsvValue(log.actionText),
    sanitizeCsvValue(log.recordId),
    sanitizeCsvValue(log.detailsText),
  ]);

  const bom = '\uFEFF';
  return (
    bom +
    [
      headers.map(sanitizeCsvValue).join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\r\n')
  );
};
