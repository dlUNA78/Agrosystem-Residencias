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
import { validatePlagueInput } from '../../../services/plagueValidationService.js';
import {
  PLAGUE_WORKFLOW_STATUSES,
  isPlagueEditable,
} from '../../../services/plagueWorkflowService.js';

const { AuditLog, Plague, PlagueImage } = db;

const rollbackWithUploadedFiles = async (transaction, files) => {
  await transaction.rollback();
  await cleanupUploadedPlagueFiles(files);
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

    const recordPermissions = getContextualPlaguePermissions({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: plague.created_by_user_id,
    });
    if (!recordPermissions.canEdit) {
      await rollbackWithUploadedFiles(transaction, files);
      return res
        .status(403)
        .send('Sólo el autor o un administrador puede editar esta plaga.');
    }
    if (!isPlagueEditable(plague.workflow_status)) {
      await rollbackWithUploadedFiles(transaction, files);
      return res
        .status(409)
        .send('La plaga debe estar en borrador para poder editarse.');
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
      { ...validation.value, updated_by_user_id: req.user.id },
      { transaction },
    );

    if (removedImageIds.length > 0) {
      await PlagueImage.destroy({
        where: { id: removedImageIds, plague_id: plague.id },
        transaction,
      });
    }
    if (files.length > 0) {
      await PlagueImage.bulkCreate(
        buildPlagueImageRecords({
          plagueId: plague.id,
          files,
          startOrder: imageUpdatePlan.nextImageOrder,
        }),
        { transaction },
      );
    }

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
