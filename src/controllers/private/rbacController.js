// src/controllers/private/rbacController.js
import bcrypt from 'bcrypt';
import db from '../../models/index.js';
import {
  createInifapCodesBatch,
  revokeInifapCode,
} from '../../services/inifapCodeService.js';
import {
  ROLE_NOT_FOUND_MESSAGE,
  SUBROLE_ONLY_INIFAP_MESSAGE,
  canModifyUserRoleOrStatus,
  resolveUserCustomPermissionsMutation,
  resolveUserSubRoleMutation,
} from '../../services/rbacService.js';
import {
  ROLE_AUDIT_ACTIONS,
  ROLE_AUDIT_CHANGE_SOURCES,
  buildUserRoleAuditPayloads,
  buildUserRoleSnapshot,
  computePermissionsDiff,
  maskInifapCodeForAudit,
  resolveSubRoleRecord,
  runAtomicTransaction,
} from '../../services/userRoleAuditService.js';
import {
  createNotification,
  resolveNotificationActionUrl,
} from '../../services/notificationService.js';

const { RbacRole, User, AuditLog } = db;

const slugify = (text) =>
  String(text || '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)+/g, '');

const recordRbacAudit = async ({
  actorId,
  action,
  recordId,
  oldValues = null,
  details = {},
  transaction,
}) => {
  const payload = {
    user_id: actorId ?? null,
    action,
    table_name: 'RBAC',
    record_id: recordId ? Number(recordId) : null,
    old_values: oldValues,
    new_values: details,
  };
  if (transaction) {
    return AuditLog.create(payload, { transaction });
  }
  try {
    return await AuditLog.create(payload);
  } catch (err) {
    console.error('Error registrando auditoría RBAC:', err);
    return null;
  }
};

const normalizePermissionList = (items) =>
  items
    .map((item) => (typeof item === 'string' ? item.trim() : item))
    .filter(Boolean);

const sanitizePermissionsInput = (input) => {
  if (Array.isArray(input)) return normalizePermissionList(input);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return normalizePermissionList(parsed);
    } catch {
      return normalizePermissionList([input]);
    }
  }
  return [];
};

const isJsonRequest = (req) =>
  Boolean(
    req.xhr ||
    req.headers?.['x-requested-with'] === 'fetch' ||
    req.headers?.accept?.includes('application/json'),
  );

const respondRbacError = (
  req,
  res,
  { status = 400, code, message, tab = 'rbac' },
) => {
  if (isJsonRequest(req)) {
    return res.status(status).json({ error: code, code, message });
  }
  return res.redirect(`/private/users?tab=${tab}&error=${code}`);
};

const buildRbacRoleSnapshot = (role) => ({
  slug: role.slug,
  name: role.name,
  description: role.description ?? null,
  base_role: role.base_role,
  badge_color: role.badge_color,
  permissions: [...(role.permissions || [])],
});

const respondRbacSuccess = (req, res, { status = 200, role, successCode }) => {
  if (isJsonRequest(req)) {
    return res.status(status).json({ success: true, role });
  }
  return res.redirect(`/private/users?tab=rbac&success=${successCode}`);
};

const validateRbacRolePayload = ({ name, base_role }, { requireName }) => {
  if (requireName && (!name || !name.trim())) {
    return {
      status: 400,
      code: 'nombre_rol_requerido',
      message: 'El nombre del sub-rol es obligatorio.',
    };
  }
  if (base_role && base_role !== 'inifap') {
    return {
      status: 400,
      code: 'subrol_solo_inifap',
      message: SUBROLE_ONLY_INIFAP_MESSAGE,
    };
  }
  return null;
};

const applyRbacRoleUpdates = (role, body = {}) => {
  const { name, description, badge_color, permissions } = body;
  if (name && name.trim()) role.name = name.trim();
  if (description !== undefined) {
    role.description = description ? description.trim() : null;
  }
  if (badge_color) role.badge_color = badge_color;
  if (permissions !== undefined) {
    role.permissions = sanitizePermissionsInput(permissions);
  }
};

export const createRbacRole = async (req, res) => {
  try {
    const validationError = validateRbacRolePayload(req.body, {
      requireName: true,
    });
    if (validationError) {
      return respondRbacError(req, res, validationError);
    }

    const { name, description, badge_color, permissions } = req.body;
    const baseSlug = slugify(name);
    const existing = await RbacRole.findOne({ where: { slug: baseSlug } });
    const finalSlug = existing
      ? `${baseSlug}-${Date.now().toString().slice(-4)}`
      : baseSlug;

    const created = await runAtomicTransaction(async (transaction) => {
      const roleRecord = await RbacRole.create(
        {
          slug: finalSlug,
          name: name.trim(),
          description: description ? description.trim() : null,
          base_role: 'inifap',
          badge_color: badge_color || 'emerald',
          permissions: sanitizePermissionsInput(permissions),
          is_system: false,
        },
        { transaction },
      );

      await recordRbacAudit({
        actorId: req.user?.id,
        action: 'create_role',
        recordId: roleRecord.id,
        oldValues: null,
        details: buildRbacRoleSnapshot(roleRecord),
        transaction,
      });

      return roleRecord;
    });

    return respondRbacSuccess(req, res, {
      status: 201,
      role: created,
      successCode: 'rol_creado',
    });
  } catch (error) {
    console.error('Error al crear sub-rol RBAC:', error);
    return respondRbacError(req, res, {
      status: 500,
      code: 'creacion_rol_fallida',
      message: 'No fue posible crear el sub-rol.',
    });
  }
};

export const updateRbacRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await RbacRole.findByPk(id);
    if (!role) {
      return respondRbacError(req, res, {
        status: 404,
        code: 'rol_no_encontrado',
        message: ROLE_NOT_FOUND_MESSAGE,
      });
    }

    const validationError = validateRbacRolePayload(req.body, {
      requireName: false,
    });
    if (validationError) {
      return respondRbacError(req, res, validationError);
    }

    const oldValues = buildRbacRoleSnapshot(role);
    applyRbacRoleUpdates(role, req.body);
    const diff = computePermissionsDiff(
      oldValues.permissions,
      role.permissions || [],
    );

    await runAtomicTransaction(async (transaction) => {
      await role.save({ transaction });
      await recordRbacAudit({
        actorId: req.user?.id,
        action: 'update_role',
        recordId: role.id,
        oldValues,
        details: {
          ...buildRbacRoleSnapshot(role),
          permissions_added: diff.added,
          permissions_removed: diff.removed,
        },
        transaction,
      });
    });

    return respondRbacSuccess(req, res, {
      status: 200,
      role,
      successCode: 'rol_actualizado',
    });
  } catch (error) {
    console.error('Error al actualizar sub-rol RBAC:', error);
    return respondRbacError(req, res, {
      status: 500,
      code: 'actualizacion_rol_fallida',
      message: 'No fue posible actualizar el sub-rol.',
    });
  }
};

export const deleteRbacRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await RbacRole.findByPk(id);
    if (!role) {
      return res.redirect('/private/users?tab=rbac&error=rol_no_encontrado');
    }

    if (role.is_system) {
      return res.redirect(
        '/private/users?tab=rbac&error=rol_sistema_protegido',
      );
    }

    const oldValues = buildRbacRoleSnapshot(role);

    await runAtomicTransaction(async (transaction) => {
      const affectedUsers = await User.findAll({
        where: { rbac_role_id: id },
        attributes: ['id'],
        transaction,
      });
      const affectedUserIds = affectedUsers.map((u) => u.id);

      await User.update(
        { rbac_role_id: null },
        { where: { rbac_role_id: id }, transaction },
      );
      await role.destroy({ transaction });

      await recordRbacAudit({
        actorId: req.user?.id,
        action: 'delete_role',
        recordId: id,
        oldValues,
        details: {
          slug: role.slug,
          name: role.name,
          affected_user_ids: affectedUserIds,
          affected_users_count: affectedUserIds.length,
        },
        transaction,
      });
    });

    return res.redirect('/private/users?tab=rbac&success=rol_eliminado');
  } catch (error) {
    console.error('Error al eliminar sub-rol RBAC:', error);
    return res.redirect(
      '/private/users?tab=rbac&error=eliminacion_rol_fallida',
    );
  }
};

const mergePermissionInputs = (...inputs) => [
  ...new Set(inputs.flatMap((input) => sanitizePermissionsInput(input))),
];

const parseCustomOverridesBody = (body = {}) => {
  const allow = mergePermissionInputs(body.allow_permissions, body.allow);
  const deny = mergePermissionInputs(body.deny_permissions, body.deny);
  return { allow, deny };
};

const respondUserPermissionsSuccess = (req, res, user) => {
  if (isJsonRequest(req)) {
    return res.status(200).json({
      success: true,
      user: {
        id: user.id,
        role: user.role,
        status: user.status,
        rbac_role_id: user.rbac_role_id,
        custom_permissions: user.custom_permissions,
      },
    });
  }
  return res.redirect('/private/users?tab=rbac&success=permisos_actualizados');
};

const applyUserPermissionMutation = (
  user,
  body,
  resolvedRbacRoleId,
  resolvedCustomPermissions,
) => {
  if (body.role) user.role = body.role;
  if (body.status) user.status = body.status;
  user.rbac_role_id = resolvedRbacRoleId;
  user.custom_permissions = resolvedCustomPermissions;
};

const prepareUserPermissionsUpdate = async (user, body = {}) => {
  const previousRole = user.role;
  const previousRbacRoleId = user.rbac_role_id ?? null;
  const targetRole = body.role || previousRole;

  const subRoleResolution = resolveUserSubRoleMutation({
    previousRole,
    previousRbacRoleId,
    targetRole,
    rawRbacRoleId: body.rbac_role_id,
    preserveWhenOmitted: false,
  });
  if (!subRoleResolution.ok) {
    return { error: subRoleResolution };
  }

  const customPermissionsResolution = resolveUserCustomPermissionsMutation({
    previousRole,
    previousCustomPermissions: user.custom_permissions,
    targetRole,
    requestedCustomPermissions: parseCustomOverridesBody(body),
  });
  if (!customPermissionsResolution.ok) {
    return { error: customPermissionsResolution };
  }

  const [previousSubRole, targetSubRole] = await Promise.all([
    resolveSubRoleRecord(previousRbacRoleId, user.rbacRole),
    subRoleResolution.rbacRoleId
      ? resolveSubRoleRecord(subRoleResolution.rbacRoleId, user.rbacRole)
      : Promise.resolve(null),
  ]);
  if (subRoleResolution.rbacRoleId && !targetSubRole) {
    return {
      error: {
        status: 400,
        code: 'rol_no_encontrado',
        message: ROLE_NOT_FOUND_MESSAGE,
      },
    };
  }

  return {
    error: null,
    previousRole,
    previousRbacRoleId,
    subRoleResolution,
    customPermissionsResolution,
    previousSubRole,
    targetSubRole,
  };
};

const persistUserPermissionsWithAudit = async ({
  user,
  body,
  prep,
  actorId,
}) => {
  const beforeState = buildUserRoleSnapshot(user, prep.previousSubRole);
  applyUserPermissionMutation(
    user,
    body,
    prep.subRoleResolution.rbacRoleId,
    prep.customPermissionsResolution.customPermissions,
  );
  const afterState = buildUserRoleSnapshot(user, prep.targetSubRole);
  const orphanSubroleCleared =
    prep.previousRole !== 'inifap' &&
    Boolean(prep.previousRbacRoleId) &&
    user.rbac_role_id === null;
  const { oldValues, newValues } = buildUserRoleAuditPayloads({
    beforeState,
    afterState,
    changeSource: ROLE_AUDIT_CHANGE_SOURCES.ADMIN_RBAC_PANEL,
    subroleAutoRevoked: prep.subRoleResolution.autoRevokedSubRole,
    customPermissionsCleared:
      prep.customPermissionsResolution.customPermissionsCleared,
    upgradedWithoutCode:
      prep.previousRole === 'agricultor' && user.role === 'inifap',
    orphanSubroleCleared,
  });

  await runAtomicTransaction(async (transaction) => {
    await user.save({ transaction });
    await recordRbacAudit({
      actorId,
      action: ROLE_AUDIT_ACTIONS.USER_PERMISSIONS_UPDATE,
      recordId: user.id,
      oldValues,
      details: newValues,
      transaction,
    });
  });
};

export const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      include: [{ model: RbacRole, as: 'rbacRole' }],
    });
    if (!user) {
      return respondRbacError(req, res, {
        status: 404,
        code: 'usuario_no_encontrado',
        message: 'El usuario solicitado no existe o ya fue eliminado.',
      });
    }

    const check = canModifyUserRoleOrStatus({
      actor: req.user,
      targetUserId: id,
      _targetCurrentRole: user.role,
      newRole: req.body?.role,
      newStatus: req.body?.status,
    });
    if (!check.allowed) {
      return respondRbacError(req, res, {
        status: 403,
        code: 'auto_bloqueo_restringido',
        message: check.reason,
      });
    }

    const prep = await prepareUserPermissionsUpdate(user, req.body);
    if (prep.error) {
      return respondRbacError(req, res, prep.error);
    }

    const actorId = req.user?.id || null;
    await persistUserPermissionsWithAudit({
      user,
      body: req.body,
      prep,
      actorId,
    });

    await createNotification({
      userId: user.id,
      actorId,
      category: 'rbac',
      severity: 'info',
      title: 'Permisos Actualizados',
      message:
        'Tu perfil institucional o capacidades delegadas han sido actualizadas por la administración.',
      actionUrl: resolveNotificationActionUrl('/private/profile', user.role),
    });

    return respondUserPermissionsSuccess(req, res, user);
  } catch (error) {
    console.error('Error al actualizar permisos de usuario:', error);
    return respondRbacError(req, res, {
      status: 500,
      code: 'actualizacion_permisos_fallida',
      message: 'No fue posible actualizar los permisos del usuario.',
    });
  }
};

const verifyAdminSudoPassword = async (userId, sudoPassword) => {
  if (!userId || !sudoPassword) return false;
  const adminUser = await User.findByPk(userId);
  if (!adminUser || !adminUser.password_hash) return false;
  return bcrypt.compare(sudoPassword, adminUser.password_hash);
};

const respondCodeGenerationError = (req, res, errorType) => {
  const isJson = req.xhr || req.headers?.accept?.includes('application/json');
  if (errorType === 'auth') {
    if (isJson) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Contraseña de administrador incorrecta o ausente.',
      });
    }
    return res.redirect('/private/users?tab=codes&error=contrasena_incorrecta');
  }

  if (isJson) {
    return res.status(500).json({ error: 'Error al generar códigos INIFAP.' });
  }
  return res.redirect(
    '/private/users?tab=codes&error=generacion_codigos_fallida',
  );
};

const respondCodeGenerationSuccess = (req, res, generated, rawCodes) => {
  const isJson = req.xhr || req.headers?.accept?.includes('application/json');
  if (isJson) {
    return res.json({
      success: true,
      count: generated.length,
      rawCodes,
    });
  }

  if (req.session) {
    req.session.revealedCodes = rawCodes;
  }

  return res.redirect(
    '/private/users?tab=codes&success=codigos_generados&reveal=1',
  );
};

export const generateCodes = async (req, res) => {
  try {
    const { count, expiresInDays, note, rbacRoleId, sudo_password } = req.body;

    const isPasswordValid = await verifyAdminSudoPassword(
      req.user?.id,
      sudo_password,
    );
    if (!isPasswordValid) {
      return respondCodeGenerationError(req, res, 'auth');
    }

    const generated = await createInifapCodesBatch({
      count,
      expiresInDays,
      note,
      rbacRoleId,
      createdByUserId: req.user?.id,
    });

    await recordRbacAudit({
      actorId: req.user?.id,
      action: 'generate_codes',
      recordId: generated[0]?.id || null,
      details: { count: generated.length, expiresInDays, note },
    });

    const rawCodes = generated.map((g) => g.rawCode || g.code).filter(Boolean);
    return respondCodeGenerationSuccess(req, res, generated, rawCodes);
  } catch (error) {
    console.error('Error al generar códigos INIFAP:', error);
    return respondCodeGenerationError(req, res, 'server');
  }
};

export const revokeCode = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await revokeInifapCode({
      codeId: id,
      _adminUserId: req.user?.id,
    });

    if (!result.success) {
      return res.redirect('/private/users?tab=codes&error=revocacion_fallida');
    }

    const maskedCode = maskInifapCodeForAudit(result.code);
    await recordRbacAudit({
      actorId: req.user?.id,
      action: 'revoke_code',
      recordId: id,
      details: { code: maskedCode, code_masked: maskedCode },
    });

    return res.redirect('/private/users?tab=codes&success=codigo_revocado');
  } catch (error) {
    console.error('Error al revocar código INIFAP:', error);
    return res.redirect('/private/users?tab=codes&error=revocacion_fallida');
  }
};
