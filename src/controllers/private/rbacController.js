// src/controllers/private/rbacController.js
import bcrypt from 'bcrypt';
import db from '../../models/index.js';
import {
  createInifapCodesBatch,
  revokeInifapCode,
} from '../../services/inifapCodeService.js';
import { canModifyUserRoleOrStatus } from '../../services/rbacService.js';
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

const recordRbacAudit = async ({ actorId, action, recordId, details }) => {
  try {
    await AuditLog.create({
      user_id: actorId,
      action,
      table_name: 'RBAC',
      record_id: recordId ? Number(recordId) : null,
      new_values: details || {},
    });
  } catch (err) {
    console.error('Error registrando auditoría RBAC:', err);
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

const SUBROLE_ONLY_INIFAP_MESSAGE =
  'Los sub-roles RBAC solo pueden asignarse a personal técnico INIFAP.';

const CUSTOM_PERMISSIONS_ONLY_INIFAP_MESSAGE =
  'Los permisos personalizados solo pueden asignarse a personal técnico INIFAP.';

const isJsonRequest = (req) =>
  Boolean(
    req.xhr ||
    req.headers?.['x-requested-with'] === 'fetch' ||
    req.headers?.accept?.includes('application/json'),
  );

const hasNonEmptyRbacRoleInput = (value) =>
  value !== undefined && value !== null && String(value).trim() !== '';

const parsePositiveRoleId = (value) => {
  const parsed = Number(String(value).trim());
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

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

const resolveAssignedRbacRoleId = (targetRole, rawRbacRoleId) => {
  if (!hasNonEmptyRbacRoleInput(rawRbacRoleId)) {
    return { ok: true, rbacRoleId: null };
  }
  if (targetRole !== 'inifap') {
    return {
      ok: false,
      status: 400,
      code: 'subrol_solo_inifap',
      message: SUBROLE_ONLY_INIFAP_MESSAGE,
    };
  }
  const parsed = parsePositiveRoleId(rawRbacRoleId);
  if (!parsed) {
    return {
      ok: false,
      status: 400,
      code: 'rol_no_encontrado',
      message: 'El sub-rol solicitado no es válido.',
    };
  }
  return { ok: true, rbacRoleId: parsed };
};

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

    const created = await RbacRole.create({
      slug: finalSlug,
      name: name.trim(),
      description: description ? description.trim() : null,
      base_role: 'inifap',
      badge_color: badge_color || 'emerald',
      permissions: sanitizePermissionsInput(permissions),
      is_system: false,
    });

    await recordRbacAudit({
      actorId: req.user?.id,
      action: 'create_role',
      recordId: created.id,
      details: { slug: created.slug, name: created.name },
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
        message: 'El sub-rol solicitado no existe.',
      });
    }

    const validationError = validateRbacRolePayload(req.body, {
      requireName: false,
    });
    if (validationError) {
      return respondRbacError(req, res, validationError);
    }

    applyRbacRoleUpdates(role, req.body);
    await role.save();

    await recordRbacAudit({
      actorId: req.user?.id,
      action: 'update_role',
      recordId: role.id,
      details: { slug: role.slug, name: role.name },
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

    await User.update({ rbac_role_id: null }, { where: { rbac_role_id: id } });
    await role.destroy();

    await recordRbacAudit({
      actorId: req.user?.id,
      action: 'delete_role',
      recordId: id,
      details: { slug: role.slug, name: role.name },
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

const resolveAssignedCustomPermissions = (targetRole, body = {}) => {
  const customPermissions = parseCustomOverridesBody(body);
  const hasCustomOverrides =
    customPermissions.allow.length > 0 || customPermissions.deny.length > 0;
  if (targetRole !== 'inifap' && hasCustomOverrides) {
    return {
      ok: false,
      status: 400,
      code: 'permisos_custom_solo_inifap',
      message: CUSTOM_PERMISSIONS_ONLY_INIFAP_MESSAGE,
    };
  }
  return { ok: true, customPermissions };
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
  user.rbac_role_id = user.role === 'inifap' ? resolvedRbacRoleId : null;
  user.custom_permissions = resolvedCustomPermissions;
};

export const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return respondRbacError(req, res, {
        status: 404,
        code: 'usuario_no_encontrado',
        message: 'El usuario solicitado no existe o ya fue eliminado.',
      });
    }

    const { role, status, rbac_role_id } = req.body;
    const check = canModifyUserRoleOrStatus({
      actor: req.user,
      targetUserId: id,
      _targetCurrentRole: user.role,
      newRole: role,
      newStatus: status,
    });

    if (!check.allowed) {
      return respondRbacError(req, res, {
        status: 403,
        code: 'auto_bloqueo_restringido',
        message: check.reason,
      });
    }

    const targetRole = role || user.role;
    const subRoleResolution = resolveAssignedRbacRoleId(
      targetRole,
      rbac_role_id,
    );
    if (!subRoleResolution.ok) {
      return respondRbacError(req, res, subRoleResolution);
    }

    const customPermissionsResolution = resolveAssignedCustomPermissions(
      targetRole,
      req.body,
    );
    if (!customPermissionsResolution.ok) {
      return respondRbacError(req, res, customPermissionsResolution);
    }

    applyUserPermissionMutation(
      user,
      req.body,
      subRoleResolution.rbacRoleId,
      customPermissionsResolution.customPermissions,
    );
    await user.save();

    const actorId = req.user?.id || null;
    await recordRbacAudit({
      actorId,
      action: 'update_user_permissions',
      recordId: user.id,
      details: {
        role: user.role,
        status: user.status,
        rbac_role_id: user.rbac_role_id,
        custom_permissions: user.custom_permissions,
      },
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

    await recordRbacAudit({
      actorId: req.user?.id,
      action: 'revoke_code',
      recordId: id,
      details: { code: result.code.code },
    });

    return res.redirect('/private/users?tab=codes&success=codigo_revocado');
  } catch (error) {
    console.error('Error al revocar código INIFAP:', error);
    return res.redirect('/private/users?tab=codes&error=revocacion_fallida');
  }
};
