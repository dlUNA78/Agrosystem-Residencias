import path from 'path';
import { fileURLToPath } from 'url';
import {
  getEnrichedProfileData,
  updateUserProfileDetails,
  updateUserPassword,
  updateUserAvatar,
} from '../../services/profileService.js';
import { revokeOtherSessions } from '../../services/sessionManagementService.js';
import { resolveEffectivePermissions } from '../../services/rbacService.js';
import { createNotification } from '../../services/notificationService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const privateLayout = path.join(__dirname, '../../views/layouts/private');
const publicLayout = path.join(__dirname, '../../views/layouts/public');

export const resolveProfileRedirectBase = (req) =>
  req.path.startsWith('/private') ? '/private/profile' : '/profile';

const sanitizeUserRecord = (userInstance) => {
  if (!userInstance) return null;
  const plain =
    typeof userInstance.toJSON === 'function'
      ? userInstance.toJSON()
      : { ...userInstance };
  delete plain.password_hash;
  const effective = resolveEffectivePermissions(userInstance);
  plain.effectivePermissions = Array.from(effective);

  if (plain.code) {
    const clean = String(plain.code).trim();
    plain.code_masked =
      clean.length > 6
        ? `${clean.slice(0, 3)}-***-${clean.slice(-3)}`
        : `${clean.slice(0, 1)}***`;
  } else {
    plain.code_masked = 'No asignada';
  }

  return plain;
};

export const renderProfile = async (req, res) => {
  try {
    if (!req.user) {
      return res.redirect('/auth/login');
    }
    const safeUser = sanitizeUserRecord(req.user);
    const canAccessPanelRole =
      safeUser && (safeUser.role === 'admin' || safeUser.role === 'inifap');
    const isPrivatePath = req.path.startsWith('/private') && canAccessPanelRole;

    const enriched = await getEnrichedProfileData(req.user, req.sessionID);

    return res.render('shared/profile', {
      layout: isPrivatePath ? privateLayout : publicLayout,
      pageTitle: 'Mi Perfil',
      activePage: 'profile',
      user: safeUser,
      isPrivatePath,
      success: req.query.success,
      error: req.query.error,
      activeSessions: enriched.activeSessions,
      sessionCount: enriched.sessionCount,
      farmerData: enriched.farmerData,
      inifapData: enriched.inifapData,
      adminData: enriched.adminData,
    });
  } catch (err) {
    console.error('Error al cargar perfil:', err);
    return res.redirect('/');
  }
};

export const updateProfile = async (req, res) => {
  const redirectBase = resolveProfileRedirectBase(req);
  try {
    const { full_name } = req.body;
    if (!full_name || !full_name.trim()) {
      return res.redirect(`${redirectBase}?error=campos_requeridos`);
    }

    await updateUserProfileDetails(req.user.id, {
      full_name: req.body.full_name,
      phone: req.body.phone,
      job_title: req.body.job_title,
      shift: req.body.shift,
      address: req.body.address,
    });

    return res.redirect(`${redirectBase}?success=perfil_actualizado`);
  } catch (err) {
    console.error('Error al actualizar perfil:', err);
    return res.redirect(`${redirectBase}?error=actualizacion_fallida`);
  }
};

export const updateAvatar = async (req, res) => {
  const redirectBase = resolveProfileRedirectBase(req);
  try {
    const removeAvatar =
      req.body.remove_avatar === 'true' || req.body.remove_avatar === '1';

    if (removeAvatar) {
      await updateUserAvatar(req.user.id, { removeAvatar: true });
      return res.redirect(`${redirectBase}?success=avatar_eliminado`);
    }

    if (!req.file) {
      return res.redirect(`${redirectBase}?error=sin_archivo_avatar`);
    }

    await updateUserAvatar(req.user.id, { filename: req.file.filename });
    return res.redirect(`${redirectBase}?success=avatar_actualizado`);
  } catch (err) {
    console.error('Error al actualizar avatar:', err);
    return res.redirect(`${redirectBase}?error=avatar_invalido`);
  }
};

export const changePassword = async (req, res) => {
  const redirectBase = resolveProfileRedirectBase(req);
  try {
    await updateUserPassword(req.user.id, {
      currentPassword: req.body.current_password,
      newPassword: req.body.new_password,
      confirmPassword: req.body.confirm_password,
    });

    await createNotification({
      userId: req.user.id,
      category: 'seguridad',
      severity: 'info',
      title: 'Contraseña Actualizada',
      message:
        'Tu contraseña de acceso institucional ha sido modificada con éxito.',
      actionUrl: `${redirectBase}#tab-security`,
    });

    return res.redirect(`${redirectBase}?success=password_actualizado`);
  } catch (err) {
    console.warn('Error al cambiar contraseña:', err.message);
    const validErrors = new Set([
      'missing_fields',
      'passwords_do_not_match',
      'password_too_short',
      'current_password_incorrect',
      'google_user_no_password',
    ]);
    const errorCode = validErrors.has(err.message)
      ? err.message
      : 'actualizacion_fallida';
    return res.redirect(`${redirectBase}?error=${errorCode}`);
  }
};

export const revokeOtherSessionsHandler = async (req, res) => {
  const redirectBase = resolveProfileRedirectBase(req);
  try {
    await revokeOtherSessions(req.user.id, req.sessionID);

    await createNotification({
      userId: req.user.id,
      category: 'seguridad',
      severity: 'info',
      title: 'Sesiones Remotas Cerradas',
      message:
        'Se han revocado todas las otras sesiones activas en diferentes navegadores.',
      actionUrl: `${redirectBase}#tab-security`,
    });

    return res.redirect(`${redirectBase}?success=sesiones_cerradas`);
  } catch (err) {
    console.error('Error al revocar sesiones:', err);
    return res.redirect(`${redirectBase}?error=actualizacion_fallida`);
  }
};
