import db from '../../../models/index.js';
import { getContextualPlaguePermissions } from '../../../services/plagueAuthorizationService.js';
import {
  MAX_PLAGUE_IMAGES,
  buildPlagueImageRecords,
  buildPlagueImageUpdatePlan,
  cleanupStoredPlagueImages,
  cleanupUploadedPlagueFiles,
  parseRemovedPlagueImageIds,
} from '../../../services/plagueImageService.js';
import { validatePlagueRelationsInput } from '../../../services/plagueRelationService.js';
import { validatePlagueInput } from '../../../services/plagueValidationService.js';
import {
  PLAGUE_WORKFLOW_STATUSES,
  isPlagueEditable,
} from '../../../services/plagueWorkflowService.js';

const { AuditLog, Plague, PlagueImage } = db;

const isControlledPlagueStage = (status) =>
  status === PLAGUE_WORKFLOW_STATUSES.VERIFIED ||
  status === PLAGUE_WORKFLOW_STATUSES.PUBLISHED;

const isControlledPlagueEditAuthorized = (plague, user, body) =>
  body?.controlled_edit === '1' &&
  (user.role === 'admin' || user.role === 'inifap') &&
  isControlledPlagueStage(plague.workflow_status);

const checkPlagueUpdateRestriction = (plague, user, body) => {
  const isControlled = body?.controlled_edit === '1';
  const editReason = String(body?.edit_reason || '').trim();
  if (isControlled && editReason.length < 10) {
    return {
      status: 400,
      message:
        'Debes capturar una justificación técnica de al menos 10 caracteres para modificar el expediente.',
    };
  }
  if (isControlledPlagueEditAuthorized(plague, user, body)) {
    return null;
  }
  const recordPermissions = getContextualPlaguePermissions({
    role: user.role,
    userId: user.id,
    createdByUserId: plague.created_by_user_id,
  });
  if (!recordPermissions.canEdit) {
    return {
      status: 403,
      message: 'Sólo el autor o un administrador puede editar esta plaga.',
    };
  }
  if (!isPlagueEditable(plague.workflow_status)) {
    return {
      status: 409,
      message: 'La plaga debe estar en borrador para poder editarse.',
    };
  }
  return null;
};

const buildPlagueUpdatePayload = (plague, validatedValue, user, body) => {
  const isControlled = body?.controlled_edit === '1';
  if (!isControlled) {
    return { ...validatedValue, updated_by_user_id: user.id };
  }
  const editReason = String(body?.edit_reason || '').trim();
  const actorLabel = user.full_name || user.email || 'Especialista INIFAP';
  const lockedIdentity = {
    name: plague.name,
    scientific_name: plague.scientific_name,
    category: plague.category || validatedValue.category,
  };
  const stageTransition = isControlledPlagueStage(plague.workflow_status)
    ? {
        workflow_status: PLAGUE_WORKFLOW_STATUSES.IN_REVIEW,
        status: false,
        verified_by: null,
        verified_by_user_id: null,
        verified_at: null,
        created_by_user_id: plague.created_by_user_id || user.id,
      }
    : {};
  return {
    ...validatedValue,
    ...lockedIdentity,
    ...stageTransition,
    review_notes: `[Edición controlada · ${actorLabel}]: ${editReason}`,
    updated_by_user_id: user.id,
  };
};

const rollbackWithUploadedFiles = async (transaction, files) => {
  await transaction.rollback();
  await cleanupUploadedPlagueFiles(files);
};

const syncPlagueModalRelations = async (plague, body, transaction) => {
  if (body?.relations_submitted !== '1') return null;
  const parsed = validatePlagueRelationsInput(body);
  if (!parsed.isValid) return parsed.errors.join(' ');
  await plague.setCrops?.(parsed.value.cropIds, { transaction });
  await plague.setProducts?.(parsed.value.productIds, { transaction });
  return null;
};

const applyPlagueImageChanges = async ({
  plagueId,
  removedImageIds,
  files,
  nextImageOrder,
  transaction,
}) => {
  if (removedImageIds.length > 0) {
    await PlagueImage.destroy({
      where: { id: removedImageIds, plague_id: plagueId },
      transaction,
    });
  }
  if (files.length > 0) {
    await PlagueImage.bulkCreate(
      buildPlagueImageRecords({
        plagueId,
        files,
        startOrder: nextImageOrder,
      }),
      { transaction },
    );
  }
};

export const createPlague = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];

  if (files.length > MAX_PLAGUE_IMAGES) {
    await cleanupUploadedPlagueFiles(files);
    return res
      .status(400)
      .send('La galería puede contener como máximo 10 imágenes.');
  }

  const transaction = await db.sequelize.transaction();

  try {
    const validation = validatePlagueInput(req.body);
    if (!validation.isValid) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(400).send(validation.errors.join(' '));
    }

    const plague = await Plague.create(
      {
        ...validation.value,
        workflow_status: PLAGUE_WORKFLOW_STATUSES.DRAFT,
        created_by_user_id: req.user.id,
        updated_by_user_id: req.user.id,
        status: false,
      },
      { transaction },
    );

    const relationError = await syncPlagueModalRelations(
      plague,
      req.body,
      transaction,
    );
    if (relationError) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(400).send(relationError);
    }

    if (files.length > 0) {
      await PlagueImage.bulkCreate(
        buildPlagueImageRecords({ plagueId: plague.id, files }),
        { transaction },
      );
    }

    await AuditLog.create(
      {
        action: 'plague.create',
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: null,
        new_values: plague.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    return res.redirect('/private/plagues');
  } catch (error) {
    await rollbackWithUploadedFiles(transaction, files);
    console.error('Error al crear la plaga:', error);
    return res.status(500).send('Error al crear la plaga');
  }
};

export const updatePlague = async (req, res) => {
  const files = Array.isArray(req.files) ? req.files : [];
  const removedImageIds = parseRemovedPlagueImageIds(
    req.body?.removed_image_ids,
  );

  if (removedImageIds === null) {
    await cleanupUploadedPlagueFiles(files);
    return res
      .status(400)
      .send('La selección de imágenes que deseas quitar no es válida.');
  }

  const transaction = await db.sequelize.transaction();
  let removedImages;

  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(400).send('ID de plaga no válido');
    }

    const plague = await Plague.findByPk(Number(id), { transaction });
    if (!plague) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(404).send('Plaga no encontrada');
    }

    const restriction = checkPlagueUpdateRestriction(
      plague,
      req.user,
      req.body,
    );
    if (restriction) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(restriction.status).send(restriction.message);
    }

    const oldValues = plague.toJSON();
    const validation = validatePlagueInput(req.body);
    if (!validation.isValid) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(400).send(validation.errors.join(' '));
    }

    const existingImages = await PlagueImage.findAll({
      where: { plague_id: plague.id },
      transaction,
      ...(transaction.LOCK?.UPDATE ? { lock: transaction.LOCK.UPDATE } : {}),
      order: [['sort_order', 'ASC']],
    });
    const imageUpdatePlan = buildPlagueImageUpdatePlan({
      existingImages,
      removedImageIds,
      newFileCount: files.length,
    });
    if (imageUpdatePlan.error) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(400).send(imageUpdatePlan.error);
    }
    removedImages = imageUpdatePlan.removedImages;

    await plague.update(
      buildPlagueUpdatePayload(plague, validation.value, req.user, req.body),
      { transaction },
    );

    const relationError = await syncPlagueModalRelations(
      plague,
      req.body,
      transaction,
    );
    if (relationError) {
      await rollbackWithUploadedFiles(transaction, files);
      return res.status(400).send(relationError);
    }

    await applyPlagueImageChanges({
      plagueId: plague.id,
      removedImageIds,
      files,
      nextImageOrder: imageUpdatePlan.nextImageOrder,
      transaction,
    });

    await AuditLog.create(
      {
        action: 'plague.update',
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: oldValues,
        new_values: plague.toJSON(),
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    await cleanupStoredPlagueImages(removedImages);
    return res.redirect('/private/plagues');
  } catch (error) {
    await rollbackWithUploadedFiles(transaction, files);
    console.error('Error al actualizar la plaga:', error);
    return res.status(500).send('Error al actualizar la plaga');
  }
};

export const deletePlague = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { id } = req.params;
    if (!/^\d+$/.test(id)) {
      await transaction.rollback();
      return res.status(400).send('ID de plaga no válido');
    }

    const plague = await Plague.findByPk(Number(id), { transaction });
    if (!plague) {
      await transaction.rollback();
      return res.status(404).send('Plaga no encontrada');
    }

    const oldValues = plague.toJSON();
    const shouldArchive =
      req.body?.mode === 'archive' ||
      plague.workflow_status === PLAGUE_WORKFLOW_STATUSES.PUBLISHED ||
      plague.workflow_status === PLAGUE_WORKFLOW_STATUSES.VERIFIED;

    if (shouldArchive) {
      await plague.update(
        {
          workflow_status: PLAGUE_WORKFLOW_STATUSES.ARCHIVED,
          status: false,
          updated_by_user_id: req.user.id,
        },
        { transaction },
      );
      await AuditLog.create(
        {
          action: 'plague.archive',
          table_name: 'Plagues',
          record_id: plague.id,
          old_values: oldValues,
          new_values: plague.toJSON(),
          user_id: req.user.id,
        },
        { transaction },
      );
      await transaction.commit();
      return res.redirect('/private/plagues');
    }

    await PlagueImage.destroy({
      where: { plague_id: plague.id },
      transaction,
    });
    await plague.destroy({ transaction });
    await AuditLog.create(
      {
        action: 'plague.delete',
        table_name: 'Plagues',
        record_id: plague.id,
        old_values: oldValues,
        new_values: null,
        user_id: req.user.id,
      },
      { transaction },
    );

    await transaction.commit();
    return res.redirect('/private/plagues');
  } catch (error) {
    await transaction.rollback();
    console.error('Error al eliminar la plaga:', error);
    return res.status(500).send('Error al eliminar la plaga');
  }
};
