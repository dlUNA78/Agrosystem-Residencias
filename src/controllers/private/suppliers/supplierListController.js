import db from '../../../models/index.js';
import {
  buildSupplierSearchFilters,
  buildSupplierWhereClause,
  calculateSupplierStats,
  PRIVATE_LAYOUT,
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
    const hasActiveFilters = Boolean(search.trim() || supply_type || status);

    return res.render('private/admin/suppliers', {
      layout: PRIVATE_LAYOUT,
      pageTitle: 'Proveedores',
      activePage: 'suppliers',
      suppliers,
      stats,
      search,
      searchValue: search,
      supply_type,
      status,
      hasActiveFilters,
      clearUrl: '/private/suppliers',
      searchId: 'supplier-search',
      searchPlaceholder: 'Buscar por empresa, contacto o RFC...',
      searchFilters: buildSupplierSearchFilters({ supply_type, status }),
      ctaLabel: 'Añadir Proveedor',
      ctaIcon: 'add_business',
      ctaLucideIcon: 'building-2',
      ctaBtnId: 'btn-add-supplier',
      showViewToggle: true,
    });
  } catch (error) {
    console.error('Error al cargar proveedores:', error);
    return res.status(500).send('Error al cargar proveedores');
  }
};
