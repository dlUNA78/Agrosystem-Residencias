// src/controllers/private/rbacController.js
import bcrypt from 'bcrypt';
import db from '../../models/index.js';
import {
  createInifapCodesBatch,
  revokeInifapCode,
} from '../../services/inifapCodeService.js';
import { canModifyUserRoleOrStatus } from '../../services/rbacService.js';
import { createNotification } from '../../services/notificationService.js';

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

const sanitizePermissionsInput = (input) => {
  if (Array.isArray(input)) return input.filter(Boolean);
  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (Array.isArray(parsed)) return parsed.filter(Boolean);
    } catch {
      return [input].filter(Boolean);
    }
  }
  return [];
};

export const createRbacRole = async (req, res) => {
  try {
    const { name, description, base_role, badge_color, permissions } = req.body;
    if (!name || !name.trim()) {
      return res.redirect('/private/users?tab=rbac&error=nombre_rol_requerido');
    }

    const baseSlug = slugify(name);
    const existing = await RbacRole.findOne({ where: { slug: baseSlug } });
    const finalSlug = existing
      ? `${baseSlug}-${Date.now().toString().slice(-4)}`
      : baseSlug;

    const created = await RbacRole.create({
      slug: finalSlug,
      name: name.trim(),
      description: description ? description.trim() : null,
      base_role: base_role || 'inifap',
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

    return res.redirect('/private/users?tab=rbac&success=rol_creado');
  } catch (error) {
    console.error('Error al crear sub-rol RBAC:', error);
    return res.redirect('/private/users?tab=rbac&error=creacion_rol_fallida');
  }
};

export const updateRbacRole = async (req, res) => {
  try {
    const { id } = req.params;
    const role = await RbacRole.findByPk(id);
    if (!role) {
      return res.redirect('/private/users?tab=rbac&error=rol_no_encontrado');
    }

    const { name, description, badge_color, permissions } = req.body;
    if (name && name.trim()) {
      role.name = name.trim();
    }
    if (description !== undefined) {
      role.description = description ? description.trim() : null;
    }
    if (badge_color) {
      role.badge_color = badge_color;
    }
    if (permissions !== undefined) {
      role.permissions = sanitizePermissionsInput(permissions);
    }

    await role.save();

    await recordRbacAudit({
      actorId: req.user?.id,
      action: 'update_role',
      recordId: role.id,
      details: { slug: role.slug, name: role.name },
    });

    return res.redirect('/private/users?tab=rbac&success=rol_actualizado');
  } catch (error) {
    console.error('Error al actualizar sub-rol RBAC:', error);
    return res.redirect(
      '/private/users?tab=rbac&error=actualizacion_rol_fallida',
    );
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

const parseCustomOverridesBody = (body = {}) => {
  const allow = sanitizePermissionsInput(body.allow_permissions || body.allow);
  const deny = sanitizePermissionsInput(body.deny_permissions || body.deny);
  return { allow, deny };
};

export const updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.redirect(
        '/private/users?tab=rbac&error=usuario_no_encontrado',
      );
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
      return res.redirect(
        '/private/users?tab=rbac&error=auto_bloqueo_restringido',
      );
    }

    if (role) user.role = role;
    if (status) user.status = status;
    user.rbac_role_id = rbac_role_id ? Number(rbac_role_id) : null;
    user.custom_permissions = parseCustomOverridesBody(req.body);

    await user.save();

    await recordRbacAudit({
      actorId: req.user?.id,
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
      actorId: req.user?.id,
      category: 'rbac',
      severity: 'info',
      title: 'Permisos Actualizados',
      message:
        'Tu perfil institucional o capacidades delegadas han sido actualizadas por la administración.',
      actionUrl: '/private/profile',
    });

    return res.redirect(
      '/private/users?tab=rbac&success=permisos_actualizados',
    );
  } catch (error) {
    console.error('Error al actualizar permisos de usuario:', error);
    return res.redirect(
      '/private/users?tab=rbac&error=actualizacion_permisos_fallida',
    );
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
