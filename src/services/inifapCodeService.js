// src/services/inifapCodeService.js
import crypto from 'node:crypto';
import db from '../models/index.js';

const { InifapCode, User, RbacRole, Sequelize } = db;
const { Op } = Sequelize;

const CODE_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

export const generateSingleCodeString = () => {
  const randomBytes = crypto.randomBytes(8);
  let segmentA = '';
  let segmentB = '';

  for (let i = 0; i < 4; i += 1) {
    segmentA += CODE_CHARS[randomBytes[i] % CODE_CHARS.length];
    segmentB += CODE_CHARS[randomBytes[i + 4] % CODE_CHARS.length];
  }

  return `INIFAP-${segmentA}-${segmentB}`;
};

const calculateExpirationDate = (days) => {
  const parsedDays = Number(days);
  if (!parsedDays || parsedDays <= 0) return null;
  const date = new Date();
  date.setDate(date.getDate() + parsedDays);
  return date;
};

const createSingleCodeRecord = async ({
  expiresAt,
  note,
  rbacRoleId,
  createdByUserId,
}) => {
  let created = null;
  let attempts = 0;
  while (!created && attempts < 5) {
    try {
      const codeString = generateSingleCodeString();
      created = await InifapCode.create({
        code: codeString,
        expires_at: expiresAt,
        note,
        rbac_role_id: rbacRoleId,
        created_by_user_id: createdByUserId,
      });
    } catch (err) {
      attempts += 1;
      if (attempts >= 5) throw err;
    }
  }
  return created;
};

const normalizeBatchOptions = (options = {}) => ({
  count: Math.max(1, Math.min(20, Number(options.count) || 1)),
  expiresAt: calculateExpirationDate(options.expiresInDays),
  cleanNote: options.note ? String(options.note).trim() : null,
  safeRoleId: options.rbacRoleId ? Number(options.rbacRoleId) : null,
  createdByUserId: options.createdByUserId || null,
});

export const createInifapCodesBatch = async (options = {}) => {
  const { count, expiresAt, cleanNote, safeRoleId, createdByUserId } =
    normalizeBatchOptions(options);

  const generatedList = [];

  for (let i = 0; i < count; i += 1) {
    const created = await createSingleCodeRecord({
      expiresAt,
      note: cleanNote,
      rbacRoleId: safeRoleId,
      createdByUserId,
    });
    if (created) {
      generatedList.push(created);
    }
  }

  return generatedList;
};

export const revokeInifapCode = async ({ codeId, _adminUserId }) => {
  const record = await InifapCode.findByPk(codeId);
  if (!record) {
    return { success: false, reason: 'Código no encontrado.' };
  }
  if (record.is_used) {
    return {
      success: false,
      reason: 'No se puede revocar un código ya utilizado.',
    };
  }
  if (record.revoked_at) {
    return { success: false, reason: 'El código ya se encuentra revocado.' };
  }

  record.revoked_at = new Date();
  await record.save();
  return { success: true, code: record };
};

const resolveStatusClause = (status) => {
  const now = new Date();
  if (status === 'used') {
    return { is_used: true };
  }
  if (status === 'revoked') {
    return { revoked_at: { [Op.ne]: null } };
  }
  if (status === 'expired') {
    return {
      is_used: false,
      revoked_at: null,
      expires_at: { [Op.lt]: now },
    };
  }
  if (status === 'available') {
    return {
      is_used: false,
      revoked_at: null,
      [Op.or]: [{ expires_at: null }, { expires_at: { [Op.gte]: now } }],
    };
  }
  return {};
};

const resolveSearchClause = (search) => {
  if (!search) return {};
  const clean = String(search).trim();
  if (!clean) return {};

  return {
    [Op.or]: [
      { code: { [Op.iLike]: `%${clean}%` } },
      { note: { [Op.iLike]: `%${clean}%` } },
    ],
  };
};

export const listInifapCodes = async ({ status = 'all', search = '' } = {}) => {
  const statusClause = resolveStatusClause(status);
  const searchClause = resolveSearchClause(search);
  const where = { ...statusClause, ...searchClause };

  return InifapCode.findAll({
    where,
    include: [
      {
        model: User,
        as: 'usedBy',
        attributes: ['id', 'full_name', 'email', 'role'],
      },
      {
        model: User,
        as: 'createdBy',
        attributes: ['id', 'full_name', 'email'],
      },
      {
        model: RbacRole,
        as: 'targetRole',
        attributes: ['id', 'name', 'badge_color', 'slug'],
      },
    ],
    order: [['createdAt', 'DESC']],
  });
};

const formatSingleCodeState = (code) => {
  const now = new Date();
  if (code.is_used) {
    return { label: 'Canjeado', color: 'emerald', key: 'used' };
  }
  if (code.revoked_at) {
    return { label: 'Revocado', color: 'rose', key: 'revoked' };
  }
  if (code.expires_at && new Date(code.expires_at) < now) {
    return { label: 'Expirado', color: 'amber', key: 'expired' };
  }
  return { label: 'Disponible', color: 'sky', key: 'available' };
};

export const serializeInifapCode = (codeInstance) => {
  const plain =
    typeof codeInstance.toJSON === 'function'
      ? codeInstance.toJSON()
      : { ...codeInstance };

  const statusState = formatSingleCodeState(plain);
  return {
    ...plain,
    statusLabel: statusState.label,
    statusColor: statusState.color,
    statusKey: statusState.key,
    isAvailable: statusState.key === 'available',
  };
};
