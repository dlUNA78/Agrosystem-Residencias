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
  resolveEffectivePermissions,
} from '../../services/rbacService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateLayout = path.join(__dirname, '../../views/layouts/private');

const { User, RbacRole } = db;

const SUCCESS_MESSAGES = {
  usuario_creado: 'Usuario institucional registrado correctamente.',
  usuario_actualizado: 'Datos y permisos del usuario actualizados.',
  estatus_actualizado: 'Estatus operativo del usuario actualizado.',
  usuario_eliminado: 'Cuenta de usuario eliminada permanentemente.',
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
};

const recordUserAudit = async ({
  actorId = null,
  action,
  recordId,
  oldValues = null,
  newValues = null,
}) => {
  if (!db.AuditLog || typeof db.AuditLog.create !== 'function') return;
  try {
    await db.AuditLog.create({
      user_id: actorId,
      action,
      table_name: 'Users',
      record_id: Number(recordId) || null,
      old_values: oldValues,
      new_values: newValues,
    });
  } catch (err) {
    console.warn('No se pudo auditar operación de usuario:', err);
  }
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

const sanitizeUserRecord = (userInstance) => {
  const plain =
    typeof userInstance.toJSON === 'function'
      ? userInstance.toJSON()
      : { ...userInstance };
  delete plain.password_hash;
  const effective = resolveEffectivePermissions(userInstance);
  plain.effectivePermissions = Array.from(effective);
  return plain;
};

const trimOrNull = (val) => (val ? String(val).trim() : null);

const applyUserUpdates = (user, body = {}) => {
  if (body.full_name) user.full_name = body.full_name.trim();
  if (body.email) user.email = body.email.trim().toLowerCase();
  if (body.role) user.role = body.role;
  if (body.status) user.status = body.status;
  if (body.job_title !== undefined) user.job_title = trimOrNull(body.job_title);
  if (body.phone !== undefined) user.phone = trimOrNull(body.phone);
  if (body.address !== undefined) user.address = trimOrNull(body.address);
  if (body.rbac_role_id !== undefined) {
    user.rbac_role_id = body.rbac_role_id ? Number(body.rbac_role_id) : null;
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

export const createUser = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      role,
      job_title,
      phone,
      address,
      status,
    } = req.body;

    if (!full_name || !email || !password) {
      return res.redirect('/private/users?error=campos_requeridos');
    }

    if (role === 'admin') {
      return res.redirect('/private/users?error=admin_unico_inmutable');
    }

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await User.findOne({ where: { email: normalizedEmail } });
    if (existing) {
      return res.redirect('/private/users?error=email_duplicado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const created = await User.create({
      full_name: full_name.trim(),
      email: normalizedEmail,
      password_hash: hashedPassword,
      role: role || 'inifap',
      job_title: trimOrNull(job_title),
      phone: trimOrNull(phone),
      address: trimOrNull(address),
      status: status || 'activo',
    });

    await recordUserAudit({
      actorId: req.user?.id,
      action: 'create',
      recordId: created?.id,
      newValues: {
        full_name: created.full_name,
        email: created.email,
        role: created.role,
        status: created.status,
      },
    });

    return res.redirect('/private/users?success=usuario_creado');
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.redirect('/private/users?error=creacion_fallida');
  }
};

export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.redirect('/private/users?error=usuario_no_encontrado');
    }

    if (req.body?.role === 'admin' && user.role !== 'admin') {
      return res.redirect('/private/users?error=admin_unico_inmutable');
    }

    const oldSnapshot = {
      full_name: user.full_name,
      role: user.role,
      status: user.status,
    };

    applyUserUpdates(user, req.body);
    await user.save();

    await recordUserAudit({
      actorId: req.user?.id,
      action: 'update',
      recordId: user.id,
      oldValues: oldSnapshot,
      newValues: {
        full_name: user.full_name,
        role: user.role,
        status: user.status,
      },
    });

    return res.redirect('/private/users?success=usuario_actualizado');
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.redirect('/private/users?error=actualizacion_fallida');
  }
};

export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      return res.redirect('/private/users?error=usuario_no_encontrado');
    }

    const prevStatus = user.status;
    user.status = req.body.status || 'activo';
    await user.save();

    await recordUserAudit({
      actorId: req.user?.id,
      action: 'update',
      recordId: user.id,
      oldValues: { status: prevStatus },
      newValues: { status: user.status },
    });

    return res.redirect('/private/users?success=estatus_actualizado');
  } catch (error) {
    console.error('Error al cambiar estatus de usuario:', error);
    return res.redirect('/private/users?error=estatus_fallido');
  }
};

export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user && String(req.user.id) === String(id)) {
      return res.redirect('/private/users?error=auto_eliminacion_prohibida');
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.redirect('/private/users?error=usuario_no_encontrado');
    }

    const snapshot = {
      full_name: user.full_name,
      email: user.email,
      role: user.role,
    };

    await user.destroy();

    await recordUserAudit({
      actorId: req.user?.id,
      action: 'delete',
      recordId: id,
      oldValues: snapshot,
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
