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

const { Crop, CropImage, AuditLog } = db;

const parseCropId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

export const updateCropWorkflow = async (req, res) => {
  const cropId = parseCropId(req.params.id);
  if (!cropId) return res.status(400).send('ID de cultivo no válido');

  const transaction = await db.sequelize.transaction();

  try {
    const crop = await Crop.findByPk(cropId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!crop) {
      await transaction.rollback();
      return res.status(404).send('Cultivo no encontrado');
    }

    if (
      !canPerformContextualCropWorkflowAction({
        role: req.user.role,
        userId: req.user.id,
        createdByUserId: crop.created_by_user_id,
        action: req.body.action,
      })
    ) {
      await transaction.rollback();
      return res
        .status(403)
        .send('No tienes permiso para realizar esta acción editorial.');
    }

    const oldValues = crop.toJSON();
    const changes = transitionCropWorkflow({
      currentStatus: crop.workflow_status,
      action: req.body.action,
      actor: req.user,
      reviewNotes: req.body.review_notes,
    });

    if (requiresCropReadiness(req.body.action)) {
      const imageCount = await CropImage.count({
        where: { crop_id: crop.id },
        transaction,
      });
      const readiness = buildCropPublicationReadiness(oldValues, {
        imageCount,
      });

      if (!readiness.isReady) {
        await transaction.rollback();
        return res
          .status(409)
          .send(
            `La ficha está incompleta. Completa: ${readiness.missingItems.join(', ')}.`,
          );
      }
    }

    await crop.update(changes, { transaction });
    await AuditLog.create(
      {
        action: `crop.${req.body.action}`,
        table_name: 'Crops',
        record_id: crop.id,
        old_values: oldValues,
        new_values: { ...oldValues, ...changes },
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    return res.redirect(`/private/crops/${crop.id}`);
  } catch (error) {
    await transaction.rollback();

    if (error instanceof CropWorkflowError) {
      const status = [
        'MISSING_ACTOR',
        'REVIEW_NOTES_REQUIRED',
        'REVIEW_NOTES_TOO_LONG',
      ].includes(error.code)
        ? 400
        : 409;
      return res.status(status).send(error.message);
    }

    console.error('Error al actualizar el workflow del cultivo:', error);
    return res.status(500).send('Error al actualizar el estado del cultivo');
  }
};
