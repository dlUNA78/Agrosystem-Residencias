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

const { Product, ProductImage, AuditLog } = db;
const parseId = (value) => {
  if (!/^[1-9]\d*$/.test(String(value || ''))) return null;
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
};

export const updateProductWorkflow = async (req, res) => {
  const productId = parseId(req.params.id);
  if (!productId) return res.status(400).send('ID de producto no válido.');
  const transaction = await db.sequelize.transaction();

  try {
    const product = await Product.findByPk(productId, {
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
    if (!product) {
      await transaction.rollback();
      return res.status(404).send('Producto no encontrado.');
    }
    const allowed = canPerformContextualProductWorkflowAction({
      role: req.user.role,
      userId: req.user.id,
      createdByUserId: product.created_by_user_id,
      action: req.body.action,
    });
    if (!allowed) {
      await transaction.rollback();
      return res
        .status(403)
        .send('No tienes permiso para realizar esta acción editorial.');
    }

    const oldValues = product.toJSON();
    const changes = transitionProductWorkflow({
      currentStatus: product.workflow_status,
      action: req.body.action,
      actor: req.user,
      reviewNotes: req.body.review_notes,
    });
    if (requiresProductReadiness(req.body.action)) {
      const imageCount = await ProductImage.count({
        where: { product_id: product.id },
        transaction,
      });
      const readiness = buildProductPublicationReadiness(oldValues, {
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

    await product.update(changes, { transaction });
    await AuditLog.create(
      {
        action: `product.${req.body.action}`,
        table_name: 'Products',
        record_id: product.id,
        old_values: oldValues,
        new_values: { ...oldValues, ...changes },
        user_id: req.user.id,
      },
      { transaction },
    );
    await transaction.commit();
    return res.redirect(`/private/products/${product.id}`);
  } catch (error) {
    await transaction.rollback();
    if (error instanceof ProductWorkflowError) {
      const status = error.code === 'INVALID_TRANSITION' ? 409 : 400;
      return res.status(status).send(error.message);
    }
    console.error('Error al actualizar el workflow del producto:', error);
    return res.status(500).send('Error al actualizar el estado del producto.');
  }
};
