const allowedRoles = new Set(['admin', 'inifap', 'agricultor']);
const allowedStatuses = new Set(['activo', 'pendiente', 'suspendido']);

const normalizeText = (value, maxLength = 120) =>
  String(value ?? '')
    .replaceAll('\0', '')
    .trim()
    .slice(0, maxLength);

export const normalizeUserListQuery = (query = {}) => {
  const role = normalizeText(query.role, 32).toLowerCase();
  const status = normalizeText(query.status, 32).toLowerCase();
  return {
    search: normalizeText(query.search),
    role: allowedRoles.has(role) ? role : '',
    status: allowedStatuses.has(status) ? status : '',
  };
};

export const normalizeSearchTerm = (value) =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export const buildUserListWhere = (sequelize, query) => {
  const { Op } = sequelize;
  const where = {};
  if (query.role) where.role = query.role;
  if (query.status) where.status = query.status;

  if (query.search) {
    const normalizeColumn = (column) =>
      sequelize.fn(
        'translate',
        sequelize.fn(
          'lower',
          sequelize.fn('coalesce', sequelize.col(column), ''),
        ),
        'áéíóúüñ',
        'aeiouun',
      );
    const pattern = `%${normalizeSearchTerm(query.search)}%`;
    where[Op.or] = ['full_name', 'email', 'job_title', 'code'].map((column) =>
      sequelize.where(normalizeColumn(column), { [Op.like]: pattern }),
    );
  }
  return where;
};
