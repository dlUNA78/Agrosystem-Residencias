import db from '../../../models/index.js';
import { normalizeSupplierPayload } from './supplierControllerUtils.js';

const recordSupplierAudit = async ({
  userId = null,
  action,
  recordId,
  oldValues = null,
  newValues = null,
}) => {
  if (!db.AuditLog || typeof db.AuditLog.create !== 'function') {
    return;
  }
  try {
    await db.AuditLog.create({
      user_id: userId,
      action,
      table_name: 'Suppliers',
      record_id: Number(recordId) || null,
      old_values: oldValues,
      new_values: newValues,
    });
  } catch (auditError) {
    console.warn('No se pudo registrar auditoría de proveedor:', auditError);
  }
};

export const createSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);
    const created = await db.Supplier.create(payload);

    await recordSupplierAudit({
      userId: req.user?.id,
      action: 'create',
      recordId: created?.id,
      newValues: {
        name: payload.name,
        rfc: payload.rfc,
        supply_type: payload.supply_type,
        status: payload.status,
      },
    });

    return res.redirect('/private/suppliers');
  } catch (error) {
    console.error('Error al crear el proveedor:', error);
    return res.status(500).send('Error al crear el proveedor');
  }
};

export const updateSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await db.Supplier.findByPk(id);

    if (!supplier) {
      return res.status(404).send('Proveedor no encontrado');
    }

    const oldSnapshot = {
      name: supplier.name,
      rfc: supplier.rfc,
      status: supplier.status,
    };

    const payload = normalizeSupplierPayload(req.body);
    await supplier.update(payload);

    await recordSupplierAudit({
      userId: req.user?.id,
      action: 'update',
      recordId: supplier.id ?? id,
      oldValues: oldSnapshot,
      newValues: {
        name: payload.name,
        rfc: payload.rfc,
        status: payload.status,
      },
    });

    return res.redirect('/private/suppliers');
  } catch (error) {
    console.error('Error al actualizar el proveedor:', error);
    return res.status(500).send('Error al actualizar el proveedor');
  }
};

export const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const supplier = await db.Supplier.findByPk(id);

    if (!supplier) {
      return res.status(404).send('Proveedor no encontrado');
    }

    const oldSnapshot = {
      name: supplier.name,
      rfc: supplier.rfc,
      status: supplier.status,
    };

    await supplier.destroy();

    await recordSupplierAudit({
      userId: req.user?.id,
      action: 'delete',
      recordId: supplier.id ?? id,
      oldValues: oldSnapshot,
    });

    return res.redirect('/private/suppliers');
  } catch (error) {
    console.error('Error al eliminar el proveedor:', error);
    return res.status(500).send('Error al eliminar el proveedor');
  }
};
