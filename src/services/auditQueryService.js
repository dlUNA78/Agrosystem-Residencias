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
  ],
  editar: [
    'update',
    'advance_crop_stage',
    'finish_crop_cycle',
    'update_workflow',
    'manage_relations',
  ],
  eliminar: ['delete', 'destroy'],
  archivar: ['archive'],
  restaurar: ['restore'],
  aprobar: ['verify', 'publish', 'request_changes', 'submit_review'],
};

const normalizeText = (value, maxLength = 120) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, maxLength);

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
    format: query.format === 'csv' ? 'csv' : '',
  };
};

export const buildAuditWhere = (Sequelize, query) => {
  const { Op } = Sequelize;
  const where = {};

  if (query.module && MODULE_TABLES[query.module]) {
    where.table_name = {
      [Op.in]: MODULE_TABLES[query.module],
    };
  }

  if (query.action && ACTION_GROUPS[query.action]) {
    where.action = {
      [Op.in]: ACTION_GROUPS[query.action],
    };
  }

  if (query.search) {
    const term = `%${query.search.toLowerCase()}%`;
    where[Op.or] = [
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
  }

  return where;
};

const getModuleLabel = (tableName) => {
  if (/Farm/i.test(tableName)) return 'Terrenos';
  if (/Plague/i.test(tableName)) return 'Plagas';
  if (/Crop/i.test(tableName)) return 'Cultivos';
  if (/Product/i.test(tableName)) return 'Productos';
  if (/User|InifapCode/i.test(tableName)) return 'Usuarios';
  if (/Supplier/i.test(tableName)) return 'Proveedores';
  if (/ActiveIngredient/i.test(tableName)) return 'Ingredientes';
  return tableName || 'Sistema';
};

const ACTION_DETAILS_MAP = {
  create: {
    label: 'Creación',
    actionText: 'Creó un nuevo registro',
    icon: 'add_circle',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  },
  create_crop_cycle: {
    label: 'Ciclo Agrícola',
    actionText: 'Abrió ciclo de cultivo',
    icon: 'add_circle',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  },
  create_health_report: {
    label: 'Sanidad',
    actionText: 'Reportó incidencia fitosanitaria',
    icon: 'bug_report',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-100',
  },
  create_application: {
    label: 'Aplicación',
    actionText: 'Registró aplicación química',
    icon: 'science',
    badgeClass: 'text-blue-700 bg-blue-50 border border-blue-100',
  },
  update: {
    label: 'Edición',
    actionText: 'Actualizó registro',
    icon: 'edit',
    badgeClass: 'text-amber-700 bg-amber-50 border border-amber-100',
  },
  advance_crop_stage: {
    label: 'Fenología',
    actionText: 'Avanzó etapa fenológica',
    icon: 'trending_up',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  },
  finish_crop_cycle: {
    label: 'Cierre',
    actionText: 'Finalizó ciclo de cultivo',
    icon: 'task_alt',
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
    icon: 'unarchive',
    badgeClass: 'text-emerald-700 bg-emerald-50 border border-emerald-100',
  },
  delete: {
    label: 'Eliminación',
    actionText: 'Eliminó registro',
    icon: 'delete',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-100',
  },
  destroy: {
    label: 'Eliminación',
    actionText: 'Eliminó registro',
    icon: 'delete',
    badgeClass: 'text-rose-700 bg-rose-50 border border-rose-100',
  },
  publish: {
    label: 'Publicación',
    actionText: 'Publicó ficha técnica',
    icon: 'check_circle',
    badgeClass: 'text-blue-700 bg-blue-50 border border-blue-100',
  },
  verify: {
    label: 'Verificación',
    actionText: 'Aprobó técnicamente ficha',
    icon: 'verified',
    badgeClass: 'text-blue-700 bg-blue-50 border border-blue-100',
  },
  request_changes: {
    label: 'Observación',
    actionText: 'Solicitó cambios técnicos',
    icon: 'rate_review',
    badgeClass: 'text-amber-700 bg-amber-50 border border-amber-100',
  },
  submit_review: {
    label: 'Revisión',
    actionText: 'Envió ficha a revisión técnica',
    icon: 'send',
    badgeClass: 'text-blue-700 bg-blue-50 border border-blue-100',
  },
};

const getActionDetails = (action) => {
  return (
    ACTION_DETAILS_MAP[action] || {
      label: action || 'Acción',
      actionText: `Acción ejecutada: ${action}`,
      icon: 'info',
      badgeClass: 'text-slate-700 bg-slate-100 border border-slate-200',
    }
  );
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
  if (parts.length > 0) {
    return parts.join(' · ');
  }
  return `Registro #${log.record_id ?? 'N/A'}`;
};

const formatLogDate = (date) => {
  if (!date)
    return {
      fullDate: 'Fecha no disponible',
      timeText: '--:--',
      dateText: '--',
    };
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

export const serializeAuditLog = (logInstance) => {
  const plain =
    typeof logInstance.toJSON === 'function'
      ? logInstance.toJSON()
      : logInstance;
  const actionInfo = getActionDetails(plain.action);
  const moduleLabel = getModuleLabel(plain.table_name);
  const dates = formatLogDate(plain.createdAt);
  const user = plain.user || {};
  const userName = user.full_name || 'Sistema';

  return {
    id: plain.id,
    recordId: plain.record_id,
    action: plain.action,
    actionLabel: actionInfo.label,
    actionText: actionInfo.actionText,
    actionIcon: actionInfo.icon,
    actionBadgeClass: actionInfo.badgeClass,
    tableName: plain.table_name,
    moduleLabel,
    user: {
      id: user.id || null,
      name: userName,
      initials: getInitials(userName),
      email: user.email || 'N/A',
      role: (user.role || 'Sistema').toUpperCase(),
    },
    dates,
    detailsText: extractDetails(plain),
    newValuesJson: plain.new_values
      ? JSON.stringify(plain.new_values, null, 2)
      : null,
    oldValuesJson: plain.old_values
      ? JSON.stringify(plain.old_values, null, 2)
      : null,
  };
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

  const escapeCsv = (str) => {
    const val = String(str ?? '').replaceAll('"', '""');
    return `"${val}"`;
  };

  const rows = logs.map((log) => [
    escapeCsv(log.id),
    escapeCsv(log.dates.dateText),
    escapeCsv(log.dates.timeText),
    escapeCsv(log.user.name),
    escapeCsv(log.user.email),
    escapeCsv(log.user.role),
    escapeCsv(log.moduleLabel),
    escapeCsv(log.actionText),
    escapeCsv(log.recordId),
    escapeCsv(log.detailsText),
  ]);

  const bom = '\uFEFF';
  return (
    bom +
    [headers.map(escapeCsv).join(','), ...rows.map((r) => r.join(','))].join(
      '\r\n',
    )
  );
};
