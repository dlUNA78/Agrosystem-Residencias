import db from '../../../models/index.js';
import { canPerformContextualProductWorkflowAction } from '../../../services/productAuthorizationService.js';
import {
  buildProductPublicationReadiness,
  requiresProductReadiness,
} from '../../../services/productReadinessService.js';
import {
  ProductWorkflowError,
  transitionProductWorkflow,
} from '../../../services/productWorkflowService.js';
import { notifyAuthorOnWorkflowChange } from '../../../services/notificationService.js';
import { getProductDeactivationImpact } from '../../../services/deactivationImpactService.js';

const { Product, ProductImage, AuditLog } = db;

const parseId = (value) => {
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

const validateProductDeactivation = async (action, productId, transaction) => {
  if (action !== 'approve_archive' && action !== 'archive') return null;
  const impact = await getProductDeactivationImpact(productId, transaction);
  return impact.hasBlockingDependencies ? impact.message : null;
};

const validateProductReadiness = async (
  action,
  productId,
  oldValues,
  transaction,
) => {
  if (!requiresProductReadiness(action)) return null;
  const imageCount = await ProductImage.count({
    where: { product_id: productId },
    transaction,
  });
  const readiness = buildProductPublicationReadiness(oldValues, {
    imageCount,
  });
  return readiness.isReady
    ? null
    : `La ficha está incompleta. Completa: ${readiness.missingItems.join(', ')}.`;
};

const handleProductWorkflowError = (error, req, res) => {
  if (error instanceof ProductWorkflowError) {
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
  console.error('Error al actualizar el workflow del producto:', error);
  return respondError(
    req,
    res,
    500,
    'Error al actualizar el estado del producto.',
  );
};

export const updateProductWorkflow = async (req, res) => {
  const productId = parseId(req.params.id);
  if (!productId) {
    return respondError(req, res, 400, 'ID de producto no válido.');
  }

  const transaction = await db.sequelize.transaction();

  try {
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) {
      await transaction.rollback();
      return respondError(req, res, 404, 'Producto no encontrado.');
    }

    const { action, review_notes, archive_reason, archive_reason_category } =
      req.body;

    const allowed = canPerformContextualProductWorkflowAction({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: product.created_by_user_id,
      archiveRequestedByUserId: product.archive_requested_by_user_id,
      action,
    });
    if (!allowed) {
      await transaction.rollback();
      return respondError(
        req,
        res,
        403,
        'No tienes permiso o violas el principio de aprobación dual para esta acción editorial.',
      );
    }

    const deactivationError = await validateProductDeactivation(
      action,
      product.id,
      transaction,
    );
    if (deactivationError) {
      await transaction.rollback();
      return respondError(req, res, 409, deactivationError);
    }

    const oldValues = product.toJSON();
    const readinessError = await validateProductReadiness(
      action,
      product.id,
      oldValues,
      transaction,
    );
    if (readinessError) {
      await transaction.rollback();
      return respondError(req, res, 409, readinessError);
    }

    const changes = transitionProductWorkflow({
      currentStatus: product.workflow_status,
      action,
      actor: req.user,
      reviewNotes: review_notes,
      archiveReason: archive_reason,
      archiveReasonCategory: archive_reason_category,
      record: product,
    });

    await product.update(changes, { transaction });
    await AuditLog.create(
      {
        action: `product.${action}`,
        table_name: 'Products',
        record_id: product.id,
        old_values: oldValues,
        new_values: { ...oldValues, ...changes },
        user_id: req.user.id,
      },
      { transaction },
    );
    await transaction.commit();

    await notifyAuthorOnWorkflowChange({
      authorId: product.created_by_user_id,
      actorId: req.user.id,
      entityName: product.name,
      moduleTitle: 'Insumo',
      workflowStatus: changes.workflow_status || action,
      actionUrl: `/private/products/${product.id}`,
    });

    return respondSuccess(
      req,
      res,
      `/private/products/${product.id}`,
      'Estado del producto actualizado correctamente.',
      { workflowStatus: changes.workflow_status },
    );
  } catch (error) {
    await transaction.rollback();
    return handleProductWorkflowError(error, req, res);
  }
};
