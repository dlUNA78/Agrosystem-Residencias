import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import db from '../../models/index.js';
import {
  buildUserListWhere,
  normalizeUserListQuery,
} from '../../services/userListService.js';
import {
  listInifapCodes,
  serializeInifapCode,
} from '../../services/inifapCodeService.js';
import {
  PERMISSION_DEFINITIONS,
  hasCustomPermissionsOverrides,
  isDowngradeFromInifap,
  resolveEffectivePermissions,
  resolveUserSubRoleMutation,
} from '../../services/rbacService.js';
import {
  ROLE_AUDIT_ACTIONS,
  ROLE_AUDIT_CHANGE_SOURCES,
  buildUserRoleAuditPayloads,
  buildUserRoleSnapshot,
  recordUserRoleAudit,
  resolveSubRoleRecord,
  runAtomicTransaction,
} from '../../services/userRoleAuditService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { User, RbacRole } = db;

const SUCCESS_MESSAGES = {
  usuario_creado: 'Usuario institucional registrado correctamente.',
  usuario_actualizado: 'Datos y permisos del usuario actualizados.',
  estatus_actualizado: 'Estatus operativo del usuario actualizado.',
  usuario_eliminado: 'Cuenta de usuario eliminada permanentemente.',
  usuario_suspendido:
    'Cuenta de usuario suspendida y desactivada preservando su historial de auditoría.',
  rol_creado: 'Sub-rol RBAC creado exitosamente.',
  rol_actualizado: 'Sub-rol y permisos actualizados.',
  rol_eliminado: 'Sub-rol RBAC eliminado.',
  permisos_actualizados: 'Permisos y perfil del usuario actualizados.',
  codigos_generados: 'Lote de códigos de acceso INIFAP generado exitosamente.',
  codigo_revocado: 'Código INIFAP revocado correctamente.',
};

const ERROR_MESSAGES = {
  campos_requeridos: 'Completa todos los campos obligatorios marcados con *.',
  email_duplicado:
    'Ya existe una cuenta registrada con ese correo electrónico.',
  creacion_fallida: 'No fue posible crear la cuenta de usuario.',
  usuario_no_encontrado: 'El usuario solicitado no existe o ya fue eliminado.',
  actualizacion_fallida: 'No fue posible guardar los cambios del usuario.',
  estatus_fallido: 'No fue posible actualizar el estatus del usuario.',
  auto_eliminacion_prohibida:
    'Por seguridad no puedes eliminar tu propia cuenta activa.',
  eliminacion_fallida: 'No fue posible eliminar la cuenta de usuario.',
  nombre_rol_requerido: 'El nombre del sub-rol es obligatorio.',
  rol_sistema_protegido:
    'Los roles base del sistema están protegidos contra eliminación.',
  auto_bloqueo_restringido:
    'Por seguridad no puedes auto-suspenderte ni retirar tu rol de Administrador.',
  rol_no_encontrado: 'El sub-rol solicitado no existe.',
  creacion_rol_fallida: 'No fue posible crear el sub-rol.',
  actualizacion_rol_fallida: 'No fue posible actualizar el sub-rol.',
  eliminacion_rol_fallida: 'No fue posible eliminar el sub-rol.',
  actualizacion_permisos_fallida:
    'No fue posible actualizar los permisos del usuario.',
  generacion_codigos_fallida: 'No fue posible generar los códigos de acceso.',
  revocacion_fallida: 'No fue posible revocar el código solicitado.',
  contrasena_incorrecta:
    'Contraseña de administrador incorrecta. Operación cancelada por seguridad.',
  sudo_password_requerida:
    'Debes confirmar tu contraseña de administrador para generar códigos.',
  admin_unico_inmutable:
    'Por gobernanza institucional, el rol de Administrador General es único y no transferible.',
  subrol_solo_inifap:
    'Los sub-roles RBAC solo pueden asignarse a personal técnico INIFAP.',
  permisos_custom_solo_inifap:
    'Los permisos personalizados solo pueden asignarse a personal técnico INIFAP.',
};

const calculateUserStats = (users = []) => ({
  total: users.length,
  activos: users.filter((u) => u.status === 'activo').length,
  inifap: users.filter((u) => u.role === 'inifap').length,
  admins: users.filter((u) => u.role === 'admin').length,
});

const buildUserSearchFilters = (filters) => [
  {
    id: 'filter-rol',
    param: 'role',
    label: 'Rol: Todos',
    options: [
      { value: 'admin', text: 'Admin' },
      { value: 'inifap', text: 'INIFAP' },
      { value: 'agricultor', text: 'Agricultor' },
    ].map((option) => ({
      ...option,
      selected: option.value === filters.role,
    })),
  },
  {
    id: 'filter-status',
    param: 'status',
    label: 'Estatus: Todos',
    options: [
      { value: 'activo', text: 'Activo' },
      { value: 'pendiente', text: 'Pendiente' },
      { value: 'suspendido', text: 'Suspendido' },
    ].map((option) => ({
      ...option,
      selected: option.value === filters.status,
    })),
  },
];

const isJsonRequest = (req) =>
  Boolean(
    req.xhr ||
    req.headers?.['x-requested-with'] === 'fetch' ||
    req.headers?.accept?.includes('application/json'),
  );

const respondUserMutationError = (req, res, { status = 400, code }) => {
  if (isJsonRequest(req)) {
    return res.status(status).json({
      error: code,
      code,
      message: ERROR_MESSAGES[code] || code,
    });
  }
  return res.redirect(`/private/users?error=${code}`);
};

const respondUserMutationSuccess = (req, res, { status = 200, code, user }) => {
  if (isJsonRequest(req)) {
    return res.status(status).json({
      success: true,
      code,
      message: SUCCESS_MESSAGES[code] || code,
      user: user
        ? {
            id: user.id,
            full_name: user.full_name,
            email: user.email,
            role: user.role,
            status: user.status,
            rbac_role_id: user.rbac_role_id,
          }
        : undefined,
    });
  }
  return res.redirect(`/private/users?success=${code}`);
};

const sanitizeUserRecord = (userInstance) => {
  const plain =
    typeof userInstance.toJSON === 'function'
      ? userInstance.toJSON()
      : { ...userInstance };
  delete plain.password_hash;
  if (plain.role !== 'inifap') {
    plain.rbac_role_id = null;
    plain.rbacRole = null;
    if ('RbacRole' in plain) plain.RbacRole = null;
  }
  const effective = resolveEffectivePermissions(userInstance);
  plain.effectivePermissions = Array.from(effective);
  return plain;
};

const trimOrNull = (val) => (val ? String(val).trim() : null);

const applyPersonalIdentityUpdates = (user, body = {}) => {
  if (body.mode === 'institutional') return;
  if (body.full_name) user.full_name = body.full_name.trim();
  if (body.email) user.email = body.email.trim().toLowerCase();
  if (body.phone !== undefined) user.phone = trimOrNull(body.phone);
};

const applyUserUpdates = (
  user,
  body = {},
  { rbacRoleId, clearCustomPermissions = false } = {},
) => {
  applyPersonalIdentityUpdates(user, body);
  if (body.role) user.role = body.role;
  if (body.status) user.status = body.status;
  if (body.job_title !== undefined) user.job_title = trimOrNull(body.job_title);
  if (body.address !== undefined) user.address = trimOrNull(body.address);
  user.rbac_role_id = rbacRoleId ?? null;
  if (clearCustomPermissions) {
    user.custom_permissions = { allow: [], deny: [] };
  }
};

const popRevealedCodes = (req) => {
  const revealed = req.session?.revealedCodes || null;
  if (req.session?.revealedCodes) {
    delete req.session.revealedCodes;
  }
  return revealed;
};

const buildUsersViewContext = ({
  req,
  safeUsers,
  plainRoles,
  safeCodes,
  filters,
}) => {
  const activeTab = ['users', 'rbac', 'codes'].includes(req.query.tab)
    ? req.query.tab
    : 'users';
  const successKey = req.query?.success;
  const errorKey = req.query?.error;

  return {
    layout: privateLayout,
    pageTitle: 'Usuarios y Control RBAC',
    activePage: 'users',
    activeTab,
    users: safeUsers,
    rbacRoles: plainRoles,
    permissionDefinitions: PERMISSION_DEFINITIONS,
    codes: safeCodes,
    revealedCodes: popRevealedCodes(req),
    codeFilters: {
      status: req.query.codeStatus || 'all',
      search: req.query.codeSearch || '',
    },
    stats: calculateUserStats(safeUsers),
    filters,
    success: SUCCESS_MESSAGES[successKey] || successKey || '',
    error: ERROR_MESSAGES[errorKey] || errorKey || '',
    hasActiveFilters: Boolean(filters.search || filters.role || filters.status),
    clearUrl: '/private/users',
    searchId: 'user-search',
    searchValue: filters.search,
    searchPlaceholder: 'Buscar por nombre, correo, cargo o código...',
    searchFilters: buildUserSearchFilters(filters),
    ctaLabel: 'Nuevo Usuario',
    ctaLucideIcon: 'user-plus',
    ctaBtnId: 'btn-add-user',
    showViewToggle: true,
  };
};

export const usersPrivate = async (req, res) => {
  try {
    const filters = normalizeUserListQuery(req.query);
    const users = await User.findAll({
      where: buildUserListWhere(db.Sequelize, filters),
      include: [{ model: RbacRole, as: 'rbacRole' }],
      order: [['createdAt', 'DESC']],
    });

    const [rbacRoles, rawCodes] = await Promise.all([
      RbacRole.findAll({
        order: [
          ['is_system', 'DESC'],
          ['name', 'ASC'],
        ],
      }),
      listInifapCodes({
        status: req.query.codeStatus,
        search: req.query.codeSearch,
      }),
    ]);

    const safeUsers = users.map(sanitizeUserRecord);
    const plainRoles = rbacRoles.map((r) =>
      typeof r.toJSON === 'function' ? r.toJSON() : r,
    );
    const safeCodes = rawCodes.map(serializeInifapCode);
    const viewContext = buildUsersViewContext({
      req,
      safeUsers,
      plainRoles,
      safeCodes,
      filters,
    });

    return res.render('private/admin/users', viewContext);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    return res.status(500).render('private/admin/users', {
      layout: privateLayout,
      pageTitle: 'Usuarios y Control RBAC',
      activePage: 'users',
      activeTab: 'users',
      users: [],
      rbacRoles: [],
      permissionDefinitions: PERMISSION_DEFINITIONS,
      codes: [],
      stats: { total: 0, activos: 0, inifap: 0, admins: 0 },
      error: 'Ocurrió un error al cargar la lista de usuarios.',
    });
  }
};

const validateCreateUserPayload = (body = {}) => {
  const { full_name, email, password, role, rbac_role_id } = body;
  if (!full_name || !email || !password) {
    return { error: { status: 400, code: 'campos_requeridos' } };
  }
  const targetRole = role || 'inifap';
  if (targetRole === 'admin') {
    return { error: { status: 403, code: 'admin_unico_inmutable' } };
  }
  const subRoleResolution = resolveUserSubRoleMutation({
    previousRole: null,
    previousRbacRoleId: null,
    targetRole,
    rawRbacRoleId: rbac_role_id,
    preserveWhenOmitted: false,
  });
  if (!subRoleResolution.ok) {
    return {
      error: {
        status: subRoleResolution.status,
        code: subRoleResolution.code,
      },
    };
  }
  return { error: null, targetRole, subRoleResolution };
};

const verifySubRoleRecord = async (rbacRoleId, cachedSubRole = null) => {
  if (!rbacRoleId) return { ok: true, subRole: null };
  const subRole = await resolveSubRoleRecord(rbacRoleId, cachedSubRole);
  if (!subRole) {
    return { ok: false, error: { status: 400, code: 'rol_no_encontrado' } };
  }
  return { ok: true, subRole };
};

const resolveUserAuditAction = ({
  previousRole,
  nextRole,
  previousRbacRoleId,
  nextRbacRoleId,
  customPermissionsCleared,
}) => {
  const roleChanged = previousRole !== nextRole;
  const subRoleChanged =
    (previousRbacRoleId ?? null) !== (nextRbacRoleId ?? null);
  if (roleChanged || subRoleChanged || customPermissionsCleared) {
    return ROLE_AUDIT_ACTIONS.USER_ROLE_UPDATE;
  }
  return 'update';
};

export const createUser = async (req, res) => {
  try {
    const validation = validateCreateUserPayload(req.body);
    if (validation.error) {
      return respondUserMutationError(req, res, validation.error);
    }

    const { targetRole, subRoleResolution } = validation;
    const { full_name, email, password, job_title, phone, address, status } =
      req.body;
    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return respondUserMutationError(req, res, {
        status: 409,
        code: 'email_duplicado',
      });
    }

    const subRoleCheck = await verifySubRoleRecord(
      subRoleResolution.rbacRoleId,
    );
    if (!subRoleCheck.ok) {
      return respondUserMutationError(req, res, subRoleCheck.error);
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await runAtomicTransaction(async (transaction) => {
      const userRecord = await User.create(
        {
          full_name: full_name.trim(),
          email: normalizedEmail,
          password_hash: hashedPassword,
          role: targetRole,
          rbac_role_id: subRoleResolution.rbacRoleId,
          job_title: trimOrNull(job_title),
          phone: trimOrNull(phone),
          address: trimOrNull(address),
          status: status || 'activo',
        },
        { transaction },
      );

      const afterState = buildUserRoleSnapshot(
        userRecord,
        subRoleCheck.subRole,
      );
      const { newValues } = buildUserRoleAuditPayloads({
        beforeState: null,
        afterState,
        changeSource: ROLE_AUDIT_CHANGE_SOURCES.ADMIN_USERS_PANEL,
      });

      await recordUserRoleAudit({
        actorId: req.user?.id,
        action: 'create',
        tableName: 'Users',
        recordId: userRecord.id,
        oldValues: null,
        newValues,
        transaction,
      });

      return userRecord;
    });

    return respondUserMutationSuccess(req, res, {
      status: 201,
      code: 'usuario_creado',
      user: created,
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return respondUserMutationError(req, res, {
      status: 500,
      code: 'creacion_fallida',
    });
  }
};

const prepareUserUpdate = async (user, body = {}) => {
  if (body.role === 'admin' && user.role !== 'admin') {
    return { error: { status: 403, code: 'admin_unico_inmutable' } };
  }

  const previousRole = user.role;
  const previousRbacRoleId = user.rbac_role_id ?? null;
  const targetRole = body.role || previousRole;
  const subRoleResolution = resolveUserSubRoleMutation({
    previousRole,
    previousRbacRoleId,
    targetRole,
    rawRbacRoleId: body.rbac_role_id,
    preserveWhenOmitted: true,
  });
  if (!subRoleResolution.ok) {
    return {
      error: {
        status: subRoleResolution.status,
        code: subRoleResolution.code,
      },
    };
  }

  const [previousSubRole, targetSubRoleCheck] = await Promise.all([
    resolveSubRoleRecord(previousRbacRoleId, user.rbacRole),
    verifySubRoleRecord(subRoleResolution.rbacRoleId, user.rbacRole),
  ]);
  if (!targetSubRoleCheck.ok) {
    return { error: targetSubRoleCheck.error };
  }

  return {
    error: null,
    previousRole,
    previousRbacRoleId,
    targetRole,
    subRoleResolution,
    previousSubRole,
    targetSubRole: targetSubRoleCheck.subRole,
  };
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      include: [{ model: RbacRole, as: 'rbacRole' }],
    });
    if (!user) {
      return respondUserMutationError(req, res, {
        status: 404,
        code: 'usuario_no_encontrado',
      });
    }

    const prep = await prepareUserUpdate(user, req.body);
    if (prep.error) {
      return respondUserMutationError(req, res, prep.error);
    }

    const beforeState = buildUserRoleSnapshot(user, prep.previousSubRole);
    const isDowngrade = isDowngradeFromInifap(
      prep.previousRole,
      prep.targetRole,
    );
    const customPermissionsCleared =
      isDowngrade && hasCustomPermissionsOverrides(user.custom_permissions);

    applyUserUpdates(user, req.body, {
      rbacRoleId: prep.subRoleResolution.rbacRoleId,
      clearCustomPermissions: isDowngrade,
    });

    const afterState = buildUserRoleSnapshot(user, prep.targetSubRole);
    const orphanSubroleCleared =
      !isDowngrade &&
      prep.previousRole !== 'inifap' &&
      Boolean(prep.previousRbacRoleId) &&
      user.rbac_role_id === null;
    const auditAction = resolveUserAuditAction({
      previousRole: prep.previousRole,
      nextRole: user.role,
      previousRbacRoleId: prep.previousRbacRoleId,
      nextRbacRoleId: user.rbac_role_id,
      customPermissionsCleared,
    });
    const { oldValues, newValues } = buildUserRoleAuditPayloads({
      beforeState,
      afterState,
      changeSource: ROLE_AUDIT_CHANGE_SOURCES.ADMIN_USERS_PANEL,
      subroleAutoRevoked: prep.subRoleResolution.autoRevokedSubRole,
      customPermissionsCleared,
      upgradedWithoutCode:
        prep.previousRole === 'agricultor' && user.role === 'inifap',
      orphanSubroleCleared,
    });

    await runAtomicTransaction(async (transaction) => {
      await user.save({ transaction });
      await recordUserRoleAudit({
        actorId: req.user?.id,
        action: auditAction,
        tableName: 'Users',
        recordId: user.id,
        oldValues,
        newValues,
        transaction,
      });
    });

    return respondUserMutationSuccess(req, res, {
      status: 200,
      code: 'usuario_actualizado',
      user,
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return respondUserMutationError(req, res, {
      status: 500,
      code: 'actualizacion_fallida',
    });
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id, {
      include: [{ model: RbacRole, as: 'rbacRole' }],
    });
    if (!user) {
      return respondUserMutationError(req, res, {
        status: 404,
        code: 'usuario_no_encontrado',
      });
    }

    const previousRbacRoleId = user.rbac_role_id ?? null;
    const subRoleResolution = resolveUserSubRoleMutation({
      previousRole: user.role,
      previousRbacRoleId,
      targetRole: user.role,
      rawRbacRoleId: req.body?.rbac_role_id,
      preserveWhenOmitted: true,
    });
    if (!subRoleResolution.ok) {
      return respondUserMutationError(req, res, {
        status: subRoleResolution.status,
        code: subRoleResolution.code,
      });
    }

    const previousSubRole = await resolveSubRoleRecord(
      previousRbacRoleId,
      user.rbacRole,
    );
    const beforeState = buildUserRoleSnapshot(user, previousSubRole);
    user.status = req.body.status || 'activo';
    user.rbac_role_id = subRoleResolution.rbacRoleId;

    const nextSubRole = user.rbac_role_id ? previousSubRole : null;
    const afterState = buildUserRoleSnapshot(user, nextSubRole);
    const orphanSubroleCleared =
      user.role !== 'inifap' &&
      Boolean(previousRbacRoleId) &&
      user.rbac_role_id === null;
    const { oldValues, newValues } = buildUserRoleAuditPayloads({
      beforeState,
      afterState,
      changeSource: ROLE_AUDIT_CHANGE_SOURCES.ADMIN_USERS_PANEL,
      orphanSubroleCleared,
    });

    await runAtomicTransaction(async (transaction) => {
      await user.save({ transaction });
      await recordUserRoleAudit({
        actorId: req.user?.id,
        action: 'update',
        tableName: 'Users',
        recordId: user.id,
        oldValues,
        newValues,
        transaction,
      });
    });

    return respondUserMutationSuccess(req, res, {
      status: 200,
      code: 'estatus_actualizado',
      user,
    });
  } catch (error) {
    console.error('Error al cambiar estatus de usuario:', error);
    return respondUserMutationError(req, res, {
      status: 500,
      code: 'estatus_fallido',
    });
  }
};

const suspendUserAtomically = async ({
  user,
  actorId,
  beforeState,
  previousSubRole,
}) => {
  const previousRbacRoleId = user.rbac_role_id ?? null;
  const orphanSubroleCleared =
    user.role !== 'inifap' && Boolean(previousRbacRoleId);
  user.status = 'suspendido';
  if (user.role !== 'inifap') {
    user.rbac_role_id = null;
  }
  const nextSubRole = user.rbac_role_id ? previousSubRole : null;
  const afterState = buildUserRoleSnapshot(user, nextSubRole);
  const { oldValues, newValues } = buildUserRoleAuditPayloads({
    beforeState,
    afterState,
    changeSource: ROLE_AUDIT_CHANGE_SOURCES.ADMIN_USERS_PANEL,
    orphanSubroleCleared,
  });

  await runAtomicTransaction(async (transaction) => {
    await user.save({ transaction });
    await recordUserRoleAudit({
      actorId,
      action: 'suspend',
      tableName: 'Users',
      recordId: user.id,
      oldValues,
      newValues,
      transaction,
    });
  });
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user && String(req.user.id) === String(id)) {
      return res.redirect('/private/users?error=auto_eliminacion_prohibida');
    }

    const user = await User.findByPk(id, {
      include: [{ model: RbacRole, as: 'rbacRole' }],
    });
    if (!user) {
      return res.redirect('/private/users?error=usuario_no_encontrado');
    }

    const previousSubRole = await resolveSubRoleRecord(
      user.rbac_role_id ?? null,
      user.rbacRole,
    );
    const beforeState = buildUserRoleSnapshot(user, previousSubRole);

    if (req.body?.mode === 'suspend') {
      await suspendUserAtomically({
        user,
        actorId: req.user?.id,
        beforeState,
        previousSubRole,
      });
      return res.redirect('/private/users?success=usuario_suspendido');
    }

    await runAtomicTransaction(async (transaction) => {
      await user.destroy({ transaction });
      await recordUserRoleAudit({
        actorId: req.user?.id,
        action: 'delete',
        tableName: 'Users',
        recordId: id,
        oldValues: beforeState.snapshot,
        newValues: null,
        transaction,
      });
    });

    return res.redirect('/private/users?success=usuario_eliminado');
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.redirect('/private/users?error=eliminacion_fallida');
  }
};

export {
  renderProfile,
  updateProfile,
  updateAvatar,
  changePassword,
  revokeOtherSessionsHandler,
} from './profileController.js';
