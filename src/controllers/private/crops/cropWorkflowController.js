import db from '../../../models/index.js';
import { canPerformContextualCropWorkflowAction } from '../../../services/cropAuthorizationService.js';
import {
  buildCropPublicationReadiness,
  requiresCropReadiness,
} from '../../../services/cropReadinessService.js';
import {
  CropWorkflowError,
  transitionCropWorkflow,
} from '../../../services/cropWorkflowService.js';
import { notifyAuthorOnWorkflowChange } from '../../../services/notificationService.js';
import { getCropDeactivationImpact } from '../../../services/deactivationImpactService.js';

const { Crop, CropImage, AuditLog } = db;

const parseCropId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

const wantsJson = (req) =>
  Boolean(req.xhr || req.headers?.accept?.includes('application/json'));

const respondError = (req, res, status, message, code = null) => {
  if (wantsJson(req)) {
    return res
      .status(status)
      .json({ success: false, message, ...(code ? { code } : {}) });
  }
  return res.status(status).send(message);
};

const respondSuccess = (req, res, redirectUrl, message, payload = {}) => {
  if (wantsJson(req)) {
    return res.status(200).json({ success: true, message, ...payload });
  }
  return res.redirect(redirectUrl);
};

const validateCropDeactivation = async (action, cropId, transaction) => {
  if (action !== 'approve_archive' && action !== 'archive') return null;
  const impact = await getCropDeactivationImpact(cropId, transaction);
  return impact.hasBlockingDependencies ? impact.message : null;
};

const validateCropReadiness = async (
  action,
  cropId,
  oldValues,
  transaction,
) => {
  if (!requiresCropReadiness(action)) return null;
  const imageCount = await CropImage.count({
    where: { crop_id: cropId },
    transaction,
  });
  const readiness = buildCropPublicationReadiness(oldValues, { imageCount });
  return readiness.isReady
    ? null
    : `La ficha está incompleta. Completa: ${readiness.missingItems.join(', ')}.`;
};

const handleCropWorkflowError = (error, req, res) => {
  if (error instanceof CropWorkflowError) {
    const status = [
      'MISSING_ACTOR',
      'REVIEW_NOTES_REQUIRED',
      'REVIEW_NOTES_TOO_LONG',
      'ARCHIVE_REASON_REQUIRED',
    ].includes(error.code)
      ? 400
      : error.code === 'DUAL_APPROVAL_REQUIRED'
        ? 403
        : 409;
    return respondError(req, res, status, error.message, error.code);
  }
  console.error('Error al actualizar el workflow del cultivo:', error);
  return respondError(
    req,
    res,
    500,
    'Error al actualizar el estado del cultivo',
  );
};

export const updateCropWorkflow = async (req, res) => {
  const cropId = parseCropId(req.params.id);
  if (!cropId) {
    return respondError(req, res, 400, 'ID de cultivo no válido');
  }

  const transaction = await db.sequelize.transaction();

  try {
    const crop = await Crop.findByPk(cropId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!crop) {
      await transaction.rollback();
      return respondError(req, res, 404, 'Cultivo no encontrado');
    }

    const { action, review_notes, archive_reason, archive_reason_category } =
      req.body;

    const allowed = canPerformContextualCropWorkflowAction({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: crop.created_by_user_id,
      archiveRequestedByUserId: crop.archive_requested_by_user_id,
      action,
    });
    if (!allowed) {
      await transaction.rollback();
      return respondError(
        req,
        res,
        403,
        'No tienes permiso o violas el principio de aprobación dual para esta acción.',
      );
    }

    const deactivationError = await validateCropDeactivation(
      action,
      crop.id,
      transaction,
    );
    if (deactivationError) {
      await transaction.rollback();
      return respondError(req, res, 409, deactivationError);
    }

    const oldValues = crop.toJSON();
    const readinessError = await validateCropReadiness(
      action,
      crop.id,
      oldValues,
      transaction,
    );
    if (readinessError) {
      await transaction.rollback();
      return respondError(req, res, 409, readinessError);
    }

    const changes = transitionCropWorkflow({
      currentStatus: crop.workflow_status,
      action,
      actor: req.user,
      reviewNotes: review_notes,
      archiveReason: archive_reason,
      archiveReasonCategory: archive_reason_category,
      record: crop,
    });

    await crop.update(changes, { transaction });
    await AuditLog.create(
      {
        action: `crop.${action}`,
        table_name: 'Crops',
        record_id: crop.id,
        old_values: oldValues,
        new_values: { ...oldValues, ...changes },
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();

    await notifyAuthorOnWorkflowChange({
      authorId: crop.created_by_user_id,
      actorId: req.user.id,
      entityName: crop.name,
      moduleTitle: 'Cultivo',
      workflowStatus: changes.workflow_status || action,
      actionUrl: `/private/crops/${crop.id}`,
    });

    return respondSuccess(
      req,
      res,
      `/private/crops/${crop.id}`,
      'Estado del cultivo actualizado correctamente.',
      { workflowStatus: changes.workflow_status },
    );
  } catch (error) {
    await transaction.rollback();
    return handleCropWorkflowError(error, req, res);
  }
};
