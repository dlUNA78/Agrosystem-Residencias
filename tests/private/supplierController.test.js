import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const opOr = Symbol('or');
const opILike = Symbol('iLike');

const sampleSuppliers = [
  {
    id: 1,
    name: 'Agroquímicos del Norte',
    commercial_name: 'AgroNorte',
    rfc: 'AGN123456789',
    supply_type: 'agroquimicos',
    status: 'activo',
    createdAt: new Date('2026-01-01'),
  },
  {
    id: 2,
    name: 'Semillas del Bajío',
    commercial_name: 'SemBajio',
    rfc: 'SBA987654321',
    supply_type: 'semillas',
    status: 'pendiente',
    createdAt: new Date('2026-01-02'),
  },
  {
    id: 3,
    name: 'Fertilizantes del Sur',
    commercial_name: 'Fertisur',
    rfc: 'FES112233445',
    supply_type: 'fertilizantes',
    status: 'inactivo',
    createdAt: new Date('2026-01-03'),
  },
];

const mockSupplierInstance = {
  update: jest.fn(async function (payload) {
    Object.assign(this, payload);
    return this;
  }),
  destroy: jest.fn(async () => true),
};

const mockDb = {
  Sequelize: { Op: { or: opOr, iLike: opILike } },
  Supplier: {
    findAll: jest.fn(async () => sampleSuppliers),
    findByPk: jest.fn(async (id) =>
      id === '999' ? null : { ...mockSupplierInstance, id },
    ),
    create: jest.fn(async (data) => ({ ...data, id: 10 })),
  },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { suppliersPrivate, createSupplier, updateSupplier, deleteSupplier } =
  await import('../../src/controllers/private/suppliersController.js');

describe('controladores privados de proveedores', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('suppliersPrivate (listado y consulta)', () => {
    it('consulta proveedores y calcula estadísticas correctamente', async () => {
      const req = {
        query: {
          search: 'agro',
          supply_type: 'agroquimicos',
          status: 'activo',
        },
      };
      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await suppliersPrivate(req, res);

      expect(mockDb.Supplier.findAll).toHaveBeenCalledWith(
        expect.objectContaining({
          order: [['createdAt', 'DESC']],
          raw: true,
        }),
      );

      const queryArg = mockDb.Supplier.findAll.mock.calls[0][0];
      expect(queryArg.where.supply_type).toBe('agroquimicos');
      expect(queryArg.where.status).toBe('activo');
      expect(queryArg.where[opOr]).toBeDefined();

      expect(res.render).toHaveBeenCalledWith(
        'private/admin/suppliers',
        expect.objectContaining({
          pageTitle: 'Proveedores',
          activePage: 'suppliers',
          suppliers: sampleSuppliers,
          stats: {
            total: 3,
            activos: 1,
            pendientes: 1,
            inactivos: 1,
          },
          search: 'agro',
          supply_type: 'agroquimicos',
          status: 'activo',
        }),
      );
    });

    it('responde 500 ante un error de consulta', async () => {
      mockDb.Supplier.findAll.mockRejectedValueOnce(new Error('DB failure'));
      const req = { query: {} };
      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await suppliersPrivate(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error al cargar proveedores');
    });
  });

  describe('createSupplier (creación)', () => {
    it('normaliza datos, crea el registro y redirige al listado', async () => {
      const req = {
        body: {
          name: '  Nueva Empresa SA  ',
          commercial_name: ' NuevaEmpresa ',
          rfc: ' abc123456xyz ',
          supply_type: 'semillas',
          contact_name: ' Juan Perez ',
          email: ' juan@example.com ',
          phone: ' 1234567890 ',
          address: ' Calle Falsa 123 ',
          city: ' Celaya ',
          state: ' Guanajuato ',
          postal_code: ' 38000 ',
          supplied_products: ' Semillas de maíz ',
        },
      };
      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await createSupplier(req, res);

      expect(mockDb.Supplier.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Nueva Empresa SA',
          commercial_name: 'NuevaEmpresa',
          rfc: 'ABC123456XYZ',
          country: 'México',
          status: 'pendiente',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith('/private/suppliers');
    });

    it('responde 500 ante un error en creación', async () => {
      mockDb.Supplier.create.mockRejectedValueOnce(
        new Error('Validation error'),
      );
      const req = { body: {} };
      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await createSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.send).toHaveBeenCalledWith('Error al crear el proveedor');
    });
  });

  describe('updateSupplier (actualización)', () => {
    it('actualiza el proveedor existente y redirige', async () => {
      const req = {
        params: { id: '1' },
        body: {
          name: ' AgroNorte Actualizado ',
          rfc: ' agn123456789 ',
          status: 'activo',
        },
      };
      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await updateSupplier(req, res);

      expect(mockDb.Supplier.findByPk).toHaveBeenCalledWith('1');
      expect(mockSupplierInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'AgroNorte Actualizado',
          rfc: 'AGN123456789',
          status: 'activo',
        }),
      );
      expect(res.redirect).toHaveBeenCalledWith('/private/suppliers');
    });

    it('responde 404 si el proveedor a actualizar no existe', async () => {
      const req = {
        params: { id: '999' },
        body: {},
      };
      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await updateSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Proveedor no encontrado');
    });
  });

  describe('deleteSupplier (eliminación)', () => {
    it('elimina el proveedor existente y redirige', async () => {
      const req = { params: { id: '1' } };
      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await deleteSupplier(req, res);

      expect(mockDb.Supplier.findByPk).toHaveBeenCalledWith('1');
      expect(mockSupplierInstance.destroy).toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith('/private/suppliers');
    });

    it('responde 404 si el proveedor a eliminar no existe', async () => {
      const req = { params: { id: '999' } };
      const res = {
        redirect: jest.fn(),
        status: jest.fn().mockReturnThis(),
        send: jest.fn(),
      };

      await deleteSupplier(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.send).toHaveBeenCalledWith('Proveedor no encontrado');
    });
  });
});
