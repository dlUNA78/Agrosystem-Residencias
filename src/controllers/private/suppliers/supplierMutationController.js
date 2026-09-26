import db from '../../../models/index.js';
import { normalizeSupplierPayload } from './supplierControllerUtils.js';

export const createSupplier = async (req, res) => {
  try {
    const payload = normalizeSupplierPayload(req.body);
    await db.Supplier.create(payload);

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

    const payload = normalizeSupplierPayload(req.body);
    await supplier.update(payload);

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

    await supplier.destroy();

    return res.redirect('/private/suppliers');
  } catch (error) {
    console.error('Error al eliminar el proveedor:', error);
    return res.status(500).send('Error al eliminar el proveedor');
  }
};
