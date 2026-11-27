// src/services/userRoleAuditService.js
import db from '../models/index.js';
import { maskCodeString } from './inifapCodeService.js';
import {
  normalizeCustomPermissions,
  resolveEffectivePermissions,
} from './rbacService.js';

export const ROLE_AUDIT_ACTIONS = Object.freeze({
  USER_ROLE_UPDATE: 'update_user_role',
  USER_PERMISSIONS_UPDATE: 'update_user_permissions',
  USER_ROLE_UPGRADE: 'upgrade_role',
});

export const ROLE_AUDIT_CHANGE_SOURCES = Object.freeze({
  ADMIN_USERS_PANEL: 'admin_users_panel',
  ADMIN_RBAC_PANEL: 'admin_rbac_panel',
  INIFAP_CODE_UPGRADE: 'inifap_code_upgrade',
});

export const MAX_AUDITED_EFFECTIVE_PERMISSIONS = 64;

export const boundPermissionList = (
  permissions,
  maxEntries = MAX_AUDITED_EFFECTIVE_PERMISSIONS,
) => {
  const uniqueSorted = [
    ...new Set(
      Array.from(permissions || [])
        .map((item) => (typeof item === 'string' ? item.trim() : ''))
        .filter(Boolean),
    ),
  ].sort();

  const truncated = uniqueSorted.length > maxEntries;
  return {
    items: truncated ? uniqueSorted.slice(0, maxEntries) : uniqueSorted,
    total: uniqueSorted.length,
    truncated,
  };
};

export const computePermissionsDiff = (
  beforePermissions = [],
  afterPermissions = [],
) => {
  const beforeSet = new Set(beforePermissions);
  const afterSet = new Set(afterPermissions);

  const addedRaw = [...afterSet].filter((perm) => !beforeSet.has(perm));
  const removedRaw = [...beforeSet].filter((perm) => !afterSet.has(perm));

  return {
    added: boundPermissionList(addedRaw).items,
    removed: boundPermissionList(removedRaw).items,
  };
};

export const maskInifapCodeForAudit = (inifapCode) => {
  if (!inifapCode) return null;
  if (typeof inifapCode === 'string') {
    return maskCodeString(inifapCode);
  }
  if (
    typeof inifapCode.code_masked === 'string' &&
    inifapCode.code_masked.includes('*')
  ) {
    return inifapCode.code_masked;
  }
  const fallbackRaw = inifapCode.code_masked || inifapCode.code;
  return fallbackRaw ? maskCodeString(String(fallbackRaw)) : '****';
};

export const resolveSubRoleRecord = async (rbacRoleId, cachedSubRole) => {
  if (!rbacRoleId) return null;
  if (cachedSubRole && Number(cachedSubRole.id) === Number(rbacRoleId)) {
    return cachedSubRole;
  }
  if (!db.RbacRole || typeof db.RbacRole.findByPk !== 'function') {
    return cachedSubRole || null;
  }
  return db.RbacRole.findByPk(rbacRoleId);
};

const toNullable = (value) => (value === undefined ? null : value);

const resolveSnapshotSubRole = (user, subRoleOverride) => {
  if (subRoleOverride !== undefined) return subRoleOverride;
  return user.rbacRole || user.RbacRole || null;
};

export const buildUserRoleSnapshot = (user, subRoleOverride = undefined) => {
  if (!user) return null;
  const subRole = resolveSnapshotSubRole(user, subRoleOverride);
  const customPermissions = normalizeCustomPermissions(user.custom_permissions);
  const rbacRoleId = toNullable(user.rbac_role_id);
  const effectiveSet = resolveEffectivePermissions({
    role: user.role,
    status: user.status,
    rbac_role_id: rbacRoleId,
    rbacRole: subRole,
    custom_permissions: customPermissions,
  });
  const boundedEffective = boundPermissionList(effectiveSet);

  const snapshot = {
    target_user_id: toNullable(user.id),
    full_name: toNullable(user.full_name),
    email: toNullable(user.email),
    role: toNullable(user.role),
    status: toNullable(user.status),
    rbac_role_id: rbacRoleId,
    rbac_role_name: toNullable(subRole?.name),
    rbac_role_slug: toNullable(subRole?.slug),
    custom_permissions: customPermissions,
    effective_permissions: boundedEffective.items,
  };

  if (boundedEffective.truncated) {
    snapshot.effective_permissions_truncated = true;
    snapshot.effective_permissions_total = boundedEffective.total;
  }

  return {
    snapshot,
    effectiveSet,
  };
};

const buildInifapCodeAuditMetadata = (inifapCode, orphanSubroleCleared) => {
  if (!inifapCode) {
    return orphanSubroleCleared ? { orphan_subrole_cleared: true } : {};
  }
  return {
    inifap_code_id: inifapCode.id ?? null,
    inifap_code_masked: maskInifapCodeForAudit(inifapCode),
    orphan_subrole_cleared: Boolean(orphanSubroleCleared),
  };
};

export const buildUserRoleAuditPayloads = (options = {}) => {
  const beforeState = options.beforeState ?? null;
  const afterState = options.afterState ?? null;
  const oldValues = beforeState ? beforeState.snapshot : null;
  if (!afterState) {
    return { oldValues, newValues: null };
  }

  const diff = computePermissionsDiff(
    beforeState ? beforeState.effectiveSet : [],
    afterState.effectiveSet,
  );

  const newValues = {
    ...afterState.snapshot,
    permissions_added: diff.added,
    permissions_removed: diff.removed,
    change_source: options.changeSource ?? null,
    subrole_auto_revoked: Boolean(options.subroleAutoRevoked),
    custom_permissions_cleared: Boolean(options.customPermissionsCleared),
    upgraded_without_code: Boolean(options.upgradedWithoutCode),
    ...buildInifapCodeAuditMetadata(
      options.inifapCode,
      options.orphanSubroleCleared,
    ),
  };

  return { oldValues, newValues };
};

export const recordUserRoleAudit = async ({
  actorId = null,
  action,
  tableName = 'Users',
  recordId,
  oldValues = null,
  newValues = null,
  transaction,
}) => {
  if (!db.AuditLog || typeof db.AuditLog.create !== 'function') {
    return null;
  }
  const payload = {
    user_id: actorId ?? null,
    action,
    table_name: tableName,
    record_id: Number(recordId) || null,
    old_values: oldValues,
    new_values: newValues,
  };
  if (transaction) {
    return db.AuditLog.create(payload, { transaction });
  }
  return db.AuditLog.create(payload);
};

export const runAtomicTransaction = async (work) => {
  if (db.sequelize && typeof db.sequelize.transaction === 'function') {
    return db.sequelize.transaction(work);
  }
  return work(undefined);
};
