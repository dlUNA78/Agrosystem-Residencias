import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const PRIVATE_LAYOUT = path.resolve(
  __dirname,
  '../../../views/layouts/private',
);

export const buildSupplierWhereClause = (
  { search = '', supply_type = '', status = '' },
  Op,
) => {
  const where = {};

  if (search.trim()) {
    const texto = `%${search.trim()}%`;
    where[Op.or] = [
      { name: { [Op.iLike]: texto } },
      { commercial_name: { [Op.iLike]: texto } },
      { rfc: { [Op.iLike]: texto } },
      { contact_name: { [Op.iLike]: texto } },
      { contact_position: { [Op.iLike]: texto } },
      { email: { [Op.iLike]: texto } },
      { phone: { [Op.iLike]: texto } },
      { address: { [Op.iLike]: texto } },
      { city: { [Op.iLike]: texto } },
      { state: { [Op.iLike]: texto } },
      { postal_code: { [Op.iLike]: texto } },
      { supplied_products: { [Op.iLike]: texto } },
      { brands: { [Op.iLike]: texto } },
    ];
  }

  if (supply_type) {
    where.supply_type = supply_type;
  }

  if (status) {
    where.status = status;
  }

  return where;
};

export const calculateSupplierStats = (suppliers = []) => {
  const total = suppliers.length;
  const activos = suppliers.filter(
    (supplier) => supplier.status?.toLowerCase() === 'activo',
  ).length;
  const pendientes = suppliers.filter(
    (supplier) => supplier.status?.toLowerCase() === 'pendiente',
  ).length;
  const inactivos = suppliers.filter(
    (supplier) => supplier.status?.toLowerCase() === 'inactivo',
  ).length;

  return { total, activos, pendientes, inactivos };
};

export const SUPPLIER_SEARCH_FILTERS = Object.freeze([
  {
    id: 'filter-type',
    param: 'supply_type',
    label: 'Tipo:',
    options: [
      { value: '', text: 'Todos' },
      { value: 'agroquimicos', text: 'Agroquímicos' },
      { value: 'semillas', text: 'Semillas' },
      { value: 'equipo', text: 'Equipo agrícola' },
      { value: 'fertilizantes', text: 'Fertilizantes' },
      { value: 'herramientas', text: 'Herramientas' },
      { value: 'servicios', text: 'Servicios' },
      { value: 'otros', text: 'Otros' },
    ],
  },
  {
    id: 'filter-status',
    param: 'status',
    label: 'Estatus:',
    options: [
      { value: '', text: 'Todos' },
      { value: 'activo', text: 'Activo' },
      { value: 'inactivo', text: 'Inactivo' },
      { value: 'pendiente', text: 'Pendiente' },
    ],
  },
]);

const cleanString = (value) => {
  if (typeof value !== 'string') {
    return value;
  }
  return value.trim();
};

const REQUIRED_OR_STANDARD_STRINGS = [
  'name',
  'commercial_name',
  'contact_name',
  'contact_position',
  'email',
  'phone',
  'address',
  'city',
  'state',
  'postal_code',
  'supplied_products',
];

const OPTIONAL_STRINGS = [
  'alternative_email',
  'alternative_phone',
  'brands',
  'delivery_time',
];

export const normalizeSupplierPayload = (body = {}) => {
  const countryTrimmed = cleanString(body.country);
  const result = {
    supply_type: body.supply_type,
    rfc: cleanString(body.rfc)?.toUpperCase(),
    country: countryTrimmed || 'México',
    minimum_order: body.minimum_order || null,
    payment_method: body.payment_method || null,
    status: body.status || 'pendiente',
  };

  for (const field of REQUIRED_OR_STANDARD_STRINGS) {
    result[field] = cleanString(body[field]);
  }

  for (const field of OPTIONAL_STRINGS) {
    result[field] = cleanString(body[field]) || null;
  }

  return result;
};
