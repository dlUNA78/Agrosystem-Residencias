import db from '../../../models/index.js';
import { getLandListWhere } from '../../../services/landAuthorizationService.js';

const { AuditLog, Farm, FarmCrop } = db;

export const wantsJson = (req) =>
  req.xhr || req.headers?.accept?.includes('application/json');

export const sendValidationError = (req, res, fieldErrors) => {
  const errors = Object.values(fieldErrors).flat();
  if (wantsJson(req)) {
    return res.status(400).json({ success: false, errors, fieldErrors });
  }
  return res.status(400).send(errors.join(' '));
};

export const sendOperationSuccess = (
  req,
  res,
  { redirectTo, status = 200, payload = {} },
) => {
  if (wantsJson(req)) {
    return res.status(status).json({ success: true, ...payload });
  }
  return res.redirect(redirectTo);
};

export const findActiveLand = (id, user, transaction) =>
  Farm.findOne({
    where: { ...getLandListWhere(user, { status: 'active' }), id },
    transaction,
  });

export const findActiveFarmCrop = (farmId, farmCropId, transaction) =>
  FarmCrop.findOne({
    where: { id: farmCropId, farm_id: farmId, is_active: true },
    transaction,
  });

export const createLandAudit = (
  { action, recordId, oldValues = null, newValues, userId },
  transaction,
) =>
  AuditLog.create(
    {
      action,
      table_name: 'Farms',
      record_id: recordId,
      old_values: oldValues,
      new_values: newValues,
      user_id: userId,
    },
    { transaction },
  );
