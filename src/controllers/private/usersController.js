import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcrypt';
import db from '../../models/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Rutas absolutas a los layouts
const privateLayout = path.join(__dirname, '../../views/layouts/private');
const publicLayout = path.join(__dirname, '../../views/layouts/public');

const { User } = db;

/**
 * Muestra el listado de usuarios desde PostgreSQL
 */
export const usersPrivate = async (req, res) => {
  try {
    const users = await User.findAll({
      order: [['createdAt', 'DESC']],
    });

    const safeUsers = users.map((u) => {
      const plain = u.toJSON();
      delete plain.password_hash;
      return plain;
    });

    res.render('private/admin/users', {
      layout: privateLayout,
      pageTitle: 'Usuarios',
      activePage: 'users',
      users: safeUsers,
      searchId: 'user-search',
      searchPlaceholder: 'Buscar por nombre, correo o institución...',
      searchFilters: [
        {
          id: 'filter-rol',
          label: 'Rol: Todos',
          options: [
            { value: 'admin', text: 'Admin' },
            { value: 'inifap', text: 'INIFAP' },
            { value: 'agricultor', text: 'Agricultor' },
          ],
        },
        {
          id: 'filter-status',
          label: 'Estatus: Todos',
          options: [
            { value: 'activo', text: 'Activo' },
            { value: 'pendiente', text: 'Pendiente' },
            { value: 'suspendido', text: 'Suspendido' },
          ],
        },
      ],
      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).render('private/admin/users', {
      layout: privateLayout,
      pageTitle: 'Usuarios',
      activePage: 'users',
      users: [],
      error: 'Ocurrió un error al cargar la lista de usuarios.',
    });
  }
};

/**
 * Crea un nuevo usuario en PostgreSQL (Admin Only)
 */
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

    const existing = await User.findOne({
      where: { email: email.trim().toLowerCase() },
    });
    if (existing) {
      return res.redirect('/private/users?error=email_duplicado');
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await User.create({
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      password_hash: hashedPassword,
      role: role || 'inifap',
      job_title: job_title ? job_title.trim() : null,
      phone: phone ? phone.trim() : null,
      address: address ? address.trim() : null,
      status: status || 'activo',
    });

    return res.redirect('/private/users?success=usuario_creado');
  } catch (error) {
    console.error('Error al crear usuario:', error);
    return res.redirect('/private/users?error=creacion_fallida');
  }
};

/**
 * Edita los datos/rol de un usuario existente (Admin Only)
 */
export const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { full_name, email, role, job_title, phone, address, status } =
      req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.redirect('/private/users?error=usuario_no_encontrado');
    }

    if (full_name) user.full_name = full_name.trim();
    if (email) user.email = email.trim().toLowerCase();
    if (role) user.role = role;
    if (status) user.status = status;
    if (job_title !== undefined)
      user.job_title = job_title ? job_title.trim() : null;
    if (phone !== undefined) user.phone = phone ? phone.trim() : null;
    if (address !== undefined) user.address = address ? address.trim() : null;

    await user.save();

    return res.redirect('/private/users?success=usuario_actualizado');
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    return res.redirect('/private/users?error=actualizacion_fallida');
  }
};

/**
 * Cambia el estatus de un usuario (activo, suspendido, pendiente)
 */
export const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.redirect('/private/users?error=usuario_no_encontrado');
    }

    user.status = status || 'activo';
    await user.save();

    return res.redirect('/private/users?success=estatus_actualizado');
  } catch (error) {
    console.error('Error al cambiar estatus de usuario:', error);
    return res.redirect('/private/users?error=estatus_fallido');
  }
};

/**
 * Elimina un usuario de la base de datos (Admin Only)
 */
export const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;

    if (req.user && req.user.id == id) {
      return res.redirect('/private/users?error=auto_eliminacion_prohibida');
    }

    const user = await User.findByPk(id);
    if (!user) {
      return res.redirect('/private/users?error=usuario_no_encontrado');
    }

    await user.destroy();

    return res.redirect('/private/users?success=usuario_eliminado');
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    return res.redirect('/private/users?error=eliminacion_fallida');
  }
};

/**
 * Muestra la vista de perfil del usuario logueado
 */
export const renderProfile = async (req, res) => {
  try {
    const success = req.query.success;
    const error = req.query.error;

    const safeUser = req.user
      ? typeof req.user.toJSON === 'function'
        ? req.user.toJSON()
        : { ...req.user }
      : null;
    if (safeUser) delete safeUser.password_hash;

    // Si la petición viene de /private/profile y el usuario tiene rol de acceso al panel, usar layout privado.
    // De lo contrario (ej. rol 'agricultor' o ruta '/profile'), usar el layout público.
    const canAccessPanelRole =
      safeUser && (safeUser.role === 'admin' || safeUser.role === 'inifap');
    const isPrivatePath = req.path.startsWith('/private');
    const selectedLayout =
      isPrivatePath && canAccessPanelRole ? privateLayout : publicLayout;

    res.render('shared/profile', {
      layout: selectedLayout,
      pageTitle: 'Mi Perfil',
      activePage: 'profile',
      user: safeUser,
      isPrivatePath: isPrivatePath && canAccessPanelRole,
      success,
      error,
    });
  } catch (err) {
    console.error('Error al cargar perfil:', err);
    res.redirect('/');
  }
};

/**
 * Actualiza los datos personales del usuario logueado
 */
export const updateProfile = async (req, res) => {
  try {
    const { full_name, phone, job_title, address } = req.body;

    const isPrivatePath = req.path.startsWith('/private');
    const redirectBasePath = isPrivatePath ? '/private/profile' : '/profile';

    if (!full_name || !full_name.trim()) {
      return res.redirect(`${redirectBasePath}?error=campos_requeridos`);
    }

    const user = await User.findByPk(req.user.id);
    if (!user) {
      return res.redirect('/auth/login');
    }

    user.full_name = full_name.trim();
    if (phone !== undefined) user.phone = phone ? phone.trim() : null;
    if (job_title !== undefined)
      user.job_title = job_title ? job_title.trim() : null;
    if (address !== undefined) user.address = address ? address.trim() : null;

    await user.save();

    return res.redirect(`${redirectBasePath}?success=perfil_actualizado`);
  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    const isPrivatePath = req.path.startsWith('/private');
    const redirectBasePath = isPrivatePath ? '/private/profile' : '/profile';
    return res.redirect(`${redirectBasePath}?error=actualizacion_fallida`);
  }
};
