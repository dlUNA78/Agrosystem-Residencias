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
  usuarios: ['Users', 'User', 'InifapCodes'],
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
    'advance_crop_stage',
    'revert_crop_stage',
    'finish_crop_cycle',
    'update_workflow',
    'manage_relations',
  ],
  eliminar: ['delete', 'destroy', 'deactivate_block'],
  archivar: ['archive'],
  restaurar: ['restore'],
  aprobar: ['verify', 'publish', 'request_changes', 'submit_review'],
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

const buildSearchOrConditions = (Sequelize, search) => {
  const { Op } = Sequelize;
  const term = `%${search.toLowerCase()}%`;
  return [
    Sequelize.where(Sequelize.fn('lower', Sequelize.col('table_name')), {
      [Op.like]: term,
    }),
    Sequelize.where(Sequelize.fn('lower', Sequelize.col('action')), {
      [Op.like]: term,
    }),
    Sequelize.where(
      Sequelize.fn(
        'lower',
        Sequelize.fn('coalesce', Sequelize.col('user.full_name'), ''),
      ),
      { [Op.like]: term },
    ),
    Sequelize.where(
      Sequelize.fn(
        'lower',
        Sequelize.fn('coalesce', Sequelize.col('user.email'), ''),
      ),
      { [Op.like]: term },
    ),
  ];
};

export const buildAuditWhere = (Sequelize, query) => {
  const { Op } = Sequelize;
  const where = {};

  if (query.module && MODULE_TABLES[query.module]) {
    where.table_name = { [Op.in]: MODULE_TABLES[query.module] };
  }

  if (query.action && ACTION_GROUPS[query.action]) {
    where.action = { [Op.in]: ACTION_GROUPS[query.action] };
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
};

const getActionDetails = (action) =>
  ACTION_DETAILS_MAP[action] || {
    label: action || 'Acción',
    actionText: `Acción ejecutada: ${action}`,
    icon: 'info',
    badgeClass: 'text-slate-700 bg-slate-100 border border-slate-200',
  };

const extractEntityName = (values) => {
  const candidateKeys = ['name', 'full_name', 'plague_name', 'product_name'];
  const foundKey = candidateKeys.find((key) => Boolean(values[key]));
  return foundKey ? values[foundKey] : '';
};

const extractDetails = (log) => {
  const values = log.new_values ?? log.old_values ?? {};
  const idText = log.record_id ? `ID: ${log.record_id}` : '';
  const nameText = extractEntityName(values);
  const statusText =
    values.status !== undefined ? `Estatus: ${values.status}` : '';

  const parts = [idText, nameText, statusText].filter(Boolean);
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
    detailsText: extractDetails(plain),
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
