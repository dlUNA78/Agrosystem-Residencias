import db from '../../../models/index.js';
import { canPerformContextualPlagueWorkflowAction } from '../../../services/plagueAuthorizationService.js';
import {
  buildPlaguePublicationReadiness,
  requiresPlagueReadiness,
} from '../../../services/plagueReadinessService.js';
import {
  PLAGUE_WORKFLOW_ACTIONS,
  PlagueWorkflowError,
  transitionPlagueWorkflow,
} from '../../../services/plagueWorkflowService.js';
import { notifyAuthorOnWorkflowChange } from '../../../services/notificationService.js';
import { getPlagueDeactivationImpact } from '../../../services/deactivationImpactService.js';

const { AuditLog, Plague, PlagueImage } = db;

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

const getWorkflowReadiness = async (plague, transaction) => {
  const [imageCount, cropCount, regionCount] = await Promise.all([
    PlagueImage.count({ where: { plague_id: plague.id }, transaction }),
    plague.countCrops({ transaction }),
    plague.countRegions({ transaction }),
  ]);

  return buildPlaguePublicationReadiness(plague.toJSON(), {
    imageCount,
    cropCount,
    regionCount,
  });
};

const resolvePlagueVerifiedBy = (action, user) => {
  if (action === PLAGUE_WORKFLOW_ACTIONS.VERIFY) {
    return user.full_name || user.email || `Usuario ${user.id}`;
  }
  if (action === PLAGUE_WORKFLOW_ACTIONS.RESTORE) {
    return null;
  }
  return undefined;
};

const validatePlagueDeactivation = async (action, plagueId, transaction) => {
  if (action !== 'approve_archive' && action !== 'archive') return null;
  const impact = await getPlagueDeactivationImpact(plagueId, transaction);
  return impact.hasBlockingDependencies ? impact.message : null;
};

const validatePlagueReadiness = async (action, plague, transaction) => {
  if (!requiresPlagueReadiness(action)) return null;
  const readiness = await getWorkflowReadiness(plague, transaction);
  return readiness.isReady
    ? null
    : `La ficha está incompleta. Completa: ${readiness.missingItems.join(', ')}.`;
};

const handlePlagueWorkflowError = (error, req, res) => {
  if (error instanceof PlagueWorkflowError) {
    const status = [
      'REVIEW_NOTES_REQUIRED',
      'MISSING_ACTOR',
      'ARCHIVE_REASON_REQUIRED',
    ].includes(error.code)
      ? 400
      : error.code === 'DUAL_APPROVAL_REQUIRED'
        ? 403
        : 409;
    return respondError(req, res, status, error.message, error.code);
  }

  console.error('Error al actualizar el workflow de la plaga:', error);
  return respondError(
    req,
    res,
    500,
    'Error al actualizar el estado de la plaga',
  );
};

const parsePlagueId = (value) => {
  if (!/^\d+$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
};

export const updatePlagueWorkflow = async (req, res) => {
  const plagueId = parsePlagueId(req.params.id);
  if (!plagueId) {
    return respondError(req, res, 400, 'ID de plaga no válido');
  }

  const transaction = await db.sequelize.transaction();

  try {
    const plague = await Plague.findByPk(plagueId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!plague) {
      await transaction.rollback();
      return respondError(req, res, 404, 'Plaga no encontrada');
    }

    const { action, review_notes, archive_reason, archive_reason_category } =
      req.body;

    const allowed = canPerformContextualPlagueWorkflowAction({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: plague.created_by_user_id,
      archiveRequestedByUserId: plague.archive_requested_by_user_id,
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

    const deactivationError = await validatePlagueDeactivation(
      action,
      plague.id,
      transaction,
    );
    if (deactivationError) {
      await transaction.rollback();
      return respondError(req, res, 409, deactivationError);
    }

    const readinessError = await validatePlagueReadiness(
      action,
      plague,
      transaction,
    );
    if (readinessError) {
      await transaction.rollback();
      return respondError(req, res, 409, readinessError);
    }

    const oldValues = plague.toJSON();
    const changes = transitionPlagueWorkflow({
      currentStatus: plague.workflow_status,
      action,
      actor: req.user,
      reviewNotes: review_notes,
      archiveReason: archive_reason,
      archiveReasonCategory: archive_reason_category,
      record: plague,
    });

    const verifiedBy = resolvePlagueVerifiedBy(action, req.user);
    if (verifiedBy !== undefined) {
      changes.verified_by = verifiedBy;
    }

    await plague.update(changes, { transaction });
    await AuditLog.create(
      {
        action: `plague.${action}`,
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: oldValues,
        new_values: { ...oldValues, ...changes },
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();

    await notifyAuthorOnWorkflowChange({
      authorId: plague.created_by_user_id,
      actorId: req.user.id,
      entityName: plague.name,
      moduleTitle: 'Plaga',
      workflowStatus: changes.workflow_status || action,
      actionUrl: `/private/plagues/${plague.id}`,
    });

    return respondSuccess(
      req,
      res,
      `/private/plagues/${plague.id}`,
      'Estado de la plaga actualizado correctamente.',
      { workflowStatus: changes.workflow_status },
    );
  } catch (error) {
    await transaction.rollback();
    return handlePlagueWorkflowError(error, req, res);
  }
};
