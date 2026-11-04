import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcrypt';
import db from '../models/index.js';
import { listUserActiveSessions } from './sessionManagementService.js';

const { User, Farm, AuditLog, RbacRole, InifapCode } = db;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '../../public');

const recordSafeAuditLog = async ({
  tableName = 'Users',
  recordId,
  userId,
  action,
  oldValues = null,
  newValues = null,
}) => {
  if (!AuditLog || typeof AuditLog.create !== 'function') return;
  try {
    await AuditLog.create({
      table_name: tableName,
      record_id: Number(recordId),
      user_id: Number(userId),
      action,
      old_values: oldValues,
      new_values: newValues,
    });
  } catch (err) {
    console.warn(
      '[profileService] No se pudo registrar log de auditoría:',
      err.message,
    );
  }
};

const resolveFarmerProfileData = async (userId) => {
  if (!Farm) return { farms: [], totalFarms: 0, totalHectares: '0.00' };

  const farms = await Farm.findAll({
    where: { user_id: userId, status: true },
    order: [['createdAt', 'DESC']],
    limit: 6,
  });

  const totalFarms = await Farm.count({
    where: { user_id: userId, status: true },
  });

  const totalHectaresNum = farms.reduce(
    (sum, f) => sum + (Number(f.size_hectares) || 0),
    0,
  );

  return {
    farms: farms.map((f) => (typeof f.toJSON === 'function' ? f.toJSON() : f)),
    totalFarms,
    totalHectares: totalHectaresNum.toFixed(2),
  };
};

const resolveInifapProfileData = async (userId) => {
  if (!AuditLog) return { recentLogs: [] };

  const logs = await AuditLog.findAll({
    where: { user_id: userId },
    order: [['createdAt', 'DESC']],
    limit: 6,
  });

  return {
    recentLogs: logs.map((l) =>
      typeof l.toJSON === 'function' ? l.toJSON() : l,
    ),
  };
};

const resolveAdminProfileData = async () => {
  const [
    totalUsers,
    pendingUsers,
    activeCodes,
    totalRoles,
    availableRoles,
    recentUsers,
  ] = await Promise.all([
    User ? User.count() : 0,
    User ? User.count({ where: { status: 'pendiente' } }) : 0,
    InifapCode
      ? InifapCode.count({ where: { is_used: false, revoked_at: null } })
      : 0,
    RbacRole ? RbacRole.count() : 0,
    RbacRole ? RbacRole.findAll({ order: [['createdAt', 'ASC']] }) : [],
    User ? User.findAll({ order: [['createdAt', 'DESC']], limit: 5 }) : [],
  ]);

  return {
    quickStats: {
      totalUsers,
      pendingUsers,
      activeCodes,
      totalRoles,
    },
    availableRoles: availableRoles.map((r) =>
      typeof r.toJSON === 'function' ? r.toJSON() : r,
    ),
    recentUsers: recentUsers.map((u) =>
      typeof u.toJSON === 'function' ? u.toJSON() : u,
    ),
  };
};

export const getEnrichedProfileData = async (user, sessionID) => {
  if (!user?.id) {
    return { activeSessions: [], sessionCount: 0 };
  }

  const activeSessions = await listUserActiveSessions(user.id, sessionID);

  let farmerData = null;
  if (user.role === 'agricultor') {
    farmerData = await resolveFarmerProfileData(user.id);
  }

  let inifapData = null;
  if (user.role === 'inifap' || user.role === 'admin') {
    inifapData = await resolveInifapProfileData(user.id);
  }

  let adminData = null;
  if (user.role === 'admin') {
    adminData = await resolveAdminProfileData();
  }

  return {
    activeSessions,
    sessionCount: activeSessions.length,
    farmerData,
    inifapData,
    adminData,
  };
};

export const updateUserProfileDetails = async (userId, data) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('user_not_found');

  const oldValues = {
    full_name: user.full_name,
    phone: user.phone,
    job_title: user.job_title,
    shift: user.shift,
    address: user.address,
  };

  if (typeof data.full_name === 'string') {
    user.full_name = data.full_name.trim();
  }
  if (typeof data.phone === 'string') {
    user.phone = data.phone.trim();
  }
  if (typeof data.job_title === 'string') {
    user.job_title = data.job_title.trim();
  }
  if (typeof data.shift === 'string') {
    user.shift = data.shift.trim();
  }
  if (typeof data.address === 'string') {
    user.address = data.address.trim();
  }

  await user.save();

  await recordSafeAuditLog({
    recordId: user.id,
    userId: user.id,
    action: 'PROFILE_UPDATE',
    oldValues,
    newValues: {
      full_name: user.full_name,
      phone: user.phone,
      job_title: user.job_title,
      shift: user.shift,
      address: user.address,
    },
  });

  return user;
};

const validatePasswordChangeInput = (
  currentPassword,
  newPassword,
  confirmPassword,
) => {
  if (!currentPassword || !newPassword || !confirmPassword) {
    throw new Error('missing_fields');
  }
  if (newPassword !== confirmPassword) {
    throw new Error('passwords_do_not_match');
  }
  if (newPassword.length < 8) {
    throw new Error('password_too_short');
  }
};

export const updateUserPassword = async (
  userId,
  { currentPassword, newPassword, confirmPassword },
) => {
  validatePasswordChangeInput(currentPassword, newPassword, confirmPassword);

  const user = await User.findByPk(userId);
  if (!user) throw new Error('user_not_found');

  if (!user.password_hash) {
    throw new Error('google_user_no_password');
  }

  const isMatch = await bcrypt.compare(currentPassword, user.password_hash);
  if (!isMatch) {
    throw new Error('current_password_incorrect');
  }

  user.password_hash = await bcrypt.hash(newPassword, 10);
  await user.save();

  await recordSafeAuditLog({
    recordId: user.id,
    userId: user.id,
    action: 'PASSWORD_CHANGE',
    oldValues: { password_updated: false },
    newValues: { password_updated: true },
  });

  return true;
};

const removeAvatarDiskFile = async (photoUrl) => {
  if (!photoUrl || !photoUrl.startsWith('/images/avatars/')) return;
  const relativePath = photoUrl.replace(/^\//, '');
  const absolutePath = path.join(publicDir, relativePath);
  try {
    if (fs.existsSync(absolutePath)) {
      await fs.promises.rm(absolutePath, { force: true });
    }
  } catch (err) {
    console.warn(
      '[profileService] No se pudo borrar archivo de avatar previo:',
      err.message,
    );
  }
};

export const updateUserAvatar = async (
  userId,
  { filename, removeAvatar = false },
) => {
  const user = await User.findByPk(userId);
  if (!user) throw new Error('user_not_found');

  const oldPhotoUrl = user.photo_url;

  if (removeAvatar) {
    await removeAvatarDiskFile(oldPhotoUrl);
    user.photo_url = null;
    await user.save();
    await recordSafeAuditLog({
      recordId: user.id,
      userId: user.id,
      action: 'AVATAR_REMOVE',
      oldValues: { photo_url: oldPhotoUrl },
      newValues: { photo_url: null },
    });
    return null;
  }

  if (filename) {
    await removeAvatarDiskFile(oldPhotoUrl);
    const newPhotoUrl = `/images/avatars/${filename}`;
    user.photo_url = newPhotoUrl;
    await user.save();
    await recordSafeAuditLog({
      recordId: user.id,
      userId: user.id,
      action: 'AVATAR_UPDATE',
      oldValues: { photo_url: oldPhotoUrl },
      newValues: { photo_url: newPhotoUrl },
    });
    return newPhotoUrl;
  }

  return user.photo_url;
};
