import db from '../../../models/index.js';
import {
  buildSupplierWhereClause,
  calculateSupplierStats,
  PRIVATE_LAYOUT,
  SUPPLIER_SEARCH_FILTERS,
} from './supplierControllerUtils.js';

export const suppliersPrivate = async (req, res) => {
  try {
    const { search = '', supply_type = '', status = '' } = req.query;
    const { Op } = db.Sequelize;

    const where = buildSupplierWhereClause({ search, supply_type, status }, Op);

    const suppliers = await db.Supplier.findAll({
      where,
      order: [['createdAt', 'DESC']],
      raw: true,
    });

    const stats = calculateSupplierStats(suppliers);

    return res.render('private/admin/suppliers', {
      layout: PRIVATE_LAYOUT,
      pageTitle: 'Proveedores',
      activePage: 'suppliers',
      suppliers,
      stats,
      search,
      supply_type,
      status,
      searchId: 'supplier-search',
      searchPlaceholder: 'Buscar por empresa, contacto o RFC...',
      searchFilters: SUPPLIER_SEARCH_FILTERS,
      ctaLabel: 'Añadir Proveedor',
      ctaIcon: 'add_business',
      ctaBtnId: 'btn-add-supplier',
      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al cargar proveedores:', error);
    return res.status(500).send('Error al cargar proveedores');
  }
};
