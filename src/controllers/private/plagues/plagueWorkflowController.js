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

const { AuditLog, Plague, PlagueImage } = db;

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

const handlePlagueWorkflowError = (error, res) => {
  if (error instanceof PlagueWorkflowError) {
    const status =
      error.code === 'REVIEW_NOTES_REQUIRED' || error.code === 'MISSING_ACTOR'
        ? 400
        : 409;
    return res.status(status).send(error.message);
  }

  console.error('Error al actualizar el workflow de la plaga:', error);
  return res.status(500).send('Error al actualizar el estado de la plaga');
};

export const updatePlagueWorkflow = async (req, res) => {
  const { id } = req.params;
  if (!/^\d+$/.test(id) || Number(id) <= 0) {
    return res.status(400).send('ID de plaga no válido');
  }

  const transaction = await db.sequelize.transaction();

  try {
    const plague = await Plague.findByPk(Number(id), {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!plague) {
      await transaction.rollback();
      return res.status(404).send('Plaga no encontrada');
    }

    if (
      !canPerformContextualPlagueWorkflowAction({
        role: req.user.role,
        userId: req.user.id,
        createdByUserId: plague.created_by_user_id,
        action: req.body.action,
      })
    ) {
      await transaction.rollback();
      return res
        .status(403)
        .send('No tienes permiso para realizar esta acción editorial.');
    }

    const oldValues = plague.toJSON();
    const changes = transitionPlagueWorkflow({
      currentStatus: plague.workflow_status,
      action: req.body.action,
      actor: req.user,
      reviewNotes: req.body.review_notes,
    });

    if (requiresPlagueReadiness(req.body.action)) {
      const readiness = await getWorkflowReadiness(plague, transaction);
      if (!readiness.isReady) {
        await transaction.rollback();
        return res
          .status(409)
          .send(
            `La ficha está incompleta. Completa: ${readiness.missingItems.join(', ')}.`,
          );
      }
    }

    const verifiedBy = resolvePlagueVerifiedBy(req.body.action, req.user);
    if (verifiedBy !== undefined) {
      changes.verified_by = verifiedBy;
    }

    await plague.update(changes, { transaction });
    await AuditLog.create(
      {
        action: `plague.${req.body.action}`,
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
      workflowStatus: changes.workflow_status || req.body.action,
      actionUrl: `/private/plagues/${plague.id}`,
    });

    return res.redirect(`/private/plagues/${plague.id}`);
  } catch (error) {
    await transaction.rollback();
    return handlePlagueWorkflowError(error, res);
  }
};
