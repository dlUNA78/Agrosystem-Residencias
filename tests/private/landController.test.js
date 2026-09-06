import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const transaction = { id: 'land-transaction' };
const farm = {
  id: 18,
  toJSON: jest.fn(() => ({
    id: 18,
    name: 'Parcela Norte',
    size_hectares: 5.25,
    user_id: 12,
    status: true,
    region: { id: 3, name: 'Centro' },
  })),
};
const mockDb = {
  sequelize: {
    transaction: jest.fn(async (callback) => callback(transaction)),
  },
  Farm: {
    create: jest.fn(async () => farm),
    findAll: jest.fn(async () => [farm]),
    findOne: jest.fn(async () => farm),
  },
  Region: {
    findAll: jest.fn(async () => []),
    findByPk: jest.fn(async () => ({ id: 3 })),
  },
  User: {},
  AuditLog: { create: jest.fn() },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { createFarmPrivate, landDetail, renderLandsPrivate } = await import(
  '../../src/controllers/private/landsController.js'
);

const buildResponse = () => ({
  json: jest.fn(),
  redirect: jest.fn(),
  render: jest.fn(),
  send: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

describe('controladores privados de terrenos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.Farm.findAll.mockResolvedValue([farm]);
    mockDb.Farm.findOne.mockResolvedValue(farm);
    mockDb.Region.findByPk.mockResolvedValue({ id: 3 });
  });

  it('limita a INIFAP a sus terrenos y permite al administrador listar todos', async () => {
    const inifapResponse = buildResponse();
    await renderLandsPrivate(
      { user: { id: 12, role: 'inifap' } },
      inifapResponse,
    );
    expect(mockDb.Farm.findAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { user_id: 12, status: true } }),
    );

    const adminResponse = buildResponse();
    await renderLandsPrivate(
      { user: { id: 1, role: 'admin' } },
      adminResponse,
    );
    expect(mockDb.Farm.findAll).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { status: true } }),
    );
  });

  it('no reemplaza con datos ficticios un expediente inexistente', async () => {
    mockDb.Farm.findOne.mockResolvedValue(null);
    const res = buildResponse();

    await landDetail(
      { params: { id: '1' }, user: { id: 12, role: 'inifap' } },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.render).not.toHaveBeenCalled();
  });

  it('aplica propiedad al consultar el expediente INIFAP', async () => {
    const res = buildResponse();

    await landDetail(
      { params: { id: '18' }, user: { id: 12, role: 'inifap' } },
      res,
    );

    expect(mockDb.Farm.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 18, user_id: 12, status: true },
      }),
    );
    expect(res.render).toHaveBeenCalled();
  });

  it('rechaza entrada manipulada antes de consultar la base', async () => {
    const res = buildResponse();

    await createFarmPrivate(
      {
        body: { name: 'X', size_hectares: '999999999' },
        headers: { accept: 'application/json' },
        user: { id: 12, role: 'inifap' },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockDb.Farm.create).not.toHaveBeenCalled();
  });

  it('crea un terreno activo del usuario y registra auditoría', async () => {
    const res = buildResponse();

    await createFarmPrivate(
      {
        body: {
          name: 'Parcela Norte',
          size_hectares: '5.25',
          farming_type: 'Riego',
          region_id: '3',
          user_id: '999',
          status: 'false',
        },
        headers: { accept: 'application/json' },
        user: { id: 12, role: 'inifap' },
      },
      res,
    );

    expect(mockDb.Farm.create).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 12, status: true }),
      { transaction },
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create',
        table_name: 'Farms',
        record_id: 18,
        user_id: 12,
      }),
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
