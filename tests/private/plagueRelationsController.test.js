import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const transaction = {
  LOCK: { UPDATE: 'UPDATE' },
  commit: jest.fn(),
  rollback: jest.fn(),
};

const plague = {
  id: 9,
  workflow_status: 'draft',
  getProducts: jest.fn(async () => [{ id: 1 }]),
  getCrops: jest.fn(async () => [{ id: 6 }]),
  setProducts: jest.fn(),
  setCrops: jest.fn(),
  update: jest.fn(),
};

const mockDb = {
  sequelize: { transaction: jest.fn(async () => transaction) },
  Sequelize: { Op: {} },
  Plague: { findByPk: jest.fn(async () => plague) },
  PlagueImage: { create: jest.fn(), destroy: jest.fn() },
  Product: {
    findAll: jest.fn(async () => [{ id: 2 }, { id: 5 }]),
  },
  ProductImage: {},
  Region: {
    findAll: jest.fn(async () => [{ id: 3 }]),
  },
  Crop: {
    findAll: jest.fn(async () => [{ id: 8 }]),
  },
  PlagueRegion: {
    findAll: jest.fn(async () => [
      { plague_id: 9, region_id: 4, risk_level: 'Bajo' },
    ]),
    destroy: jest.fn(),
    bulkCreate: jest.fn(),
  },
  AuditLog: { create: jest.fn() },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { updatePlagueRelations } =
  await import('../../src/controllers/private/plagueController.js');

const buildResponse = () => ({
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

describe('controlador de relaciones de plagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    plague.workflow_status = 'draft';
    mockDb.Plague.findByPk.mockResolvedValue(plague);
    mockDb.Product.findAll.mockResolvedValue([{ id: 2 }, { id: 5 }]);
    mockDb.Crop.findAll.mockResolvedValue([{ id: 8 }]);
    mockDb.Region.findAll.mockResolvedValue([{ id: 3 }]);
    mockDb.PlagueRegion.findAll.mockResolvedValue([
      { plague_id: 9, region_id: 4, risk_level: 'Bajo' },
    ]);
  });

  it('reemplaza las tres relaciones en una transacción y registra auditoría', async () => {
    const req = {
      params: { id: '9' },
      body: {
        product_ids: ['2', '2', '5'],
        crop_ids: '8',
        region_ids: '3',
        region_risk_3: 'Alto',
      },
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updatePlagueRelations(req, res);

    expect(plague.setProducts).toHaveBeenCalledWith([2, 5], { transaction });
    expect(plague.setCrops).toHaveBeenCalledWith([8], { transaction });
    expect(mockDb.PlagueRegion.destroy).toHaveBeenCalledWith({
      where: { plague_id: 9 },
      transaction,
    });
    expect(mockDb.PlagueRegion.bulkCreate).toHaveBeenCalledWith(
      [{ plague_id: 9, region_id: 3, risk_level: 'Alto' }],
      { transaction },
    );
    expect(plague.update).toHaveBeenCalledWith(
      { updated_by_user_id: 12 },
      { transaction },
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'plague.relations.update',
        table_name: 'PlagueRelations',
        record_id: 9,
        user_id: 12,
        old_values: {
          products: [1],
          crops: [6],
          regions: [{ region_id: 4, risk_level: 'Bajo' }],
        },
        new_values: {
          products: [2, 5],
          crops: [8],
          regions: [{ region_id: 3, risk_level: 'Alto' }],
        },
      }),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith('/private/plagues/9');
  });

  it('rechaza referencias que no existen sin modificar relaciones', async () => {
    mockDb.Product.findAll.mockResolvedValue([{ id: 2 }]);
    const req = {
      params: { id: '9' },
      body: { product_ids: ['2', '99'] },
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updatePlagueRelations(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('productos'));
    expect(plague.setProducts).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
  });

  it('bloquea la edición de relaciones fuera de borrador o correcciones', async () => {
    plague.workflow_status = 'published';
    const req = {
      params: { id: '9' },
      body: {},
      user: { id: 1, role: 'admin' },
    };
    const res = buildResponse();

    await updatePlagueRelations(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(plague.setProducts).not.toHaveBeenCalled();
    expect(mockDb.AuditLog.create).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
  });
});
