import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const transaction = { id: 'land-operation-transaction' };
const farm = { id: 18, user_id: 12, status: true };
const crop = { id: 8, name: 'Maíz', harvest_days: 120 };
const farmCrop = {
  id: 33,
  farm_id: 18,
  is_active: true,
  update: jest.fn(),
};
const currentStage = {
  stage_order: 2,
  status: 'in_progress',
  notes: null,
  update: jest.fn(),
};
const nextStage = { stage_order: 3, status: 'pending', update: jest.fn() };
const plague = { id: 4, name: 'Gusano cogollero' };
const product = {
  id: 15,
  name: 'Producto QA',
  active_ingredient: 'Ingrediente QA',
};

const mockDb = {
  sequelize: {
    transaction: jest.fn(async (callback) => callback(transaction)),
  },
  Farm: { findOne: jest.fn(async () => farm) },
  FarmCrop: {
    create: jest.fn(async () => farmCrop),
    findOne: jest.fn(async () => farmCrop),
  },
  FarmCropStage: {
    bulkCreate: jest.fn(),
    findOne: jest.fn(),
  },
  Crop: { findOne: jest.fn(async () => crop) },
  Plague: { findOne: jest.fn(async () => plague) },
  Product: { findOne: jest.fn(async () => product) },
  FarmHealthReport: { create: jest.fn(async () => ({ id: 41 })) },
  FarmApplication: { create: jest.fn(async () => ({ id: 51 })) },
  AuditLog: { create: jest.fn() },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { advanceLandCropStage, createLandCropCycle, finishLandCropCycle } =
  await import('../../src/controllers/private/lands/landCycleController.js');
const { createFarmApplication, createFarmHealthReport } =
  await import('../../src/controllers/private/lands/landRecordController.js');

const buildResponse = () => ({
  json: jest.fn(),
  redirect: jest.fn(),
  send: jest.fn(),
  status: jest.fn().mockReturnThis(),
});

const requestContext = {
  headers: { accept: 'application/json' },
  params: { id: '18' },
  user: { id: 12, role: 'inifap' },
};

describe('operaciones del expediente de terrenos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.Farm.findOne.mockResolvedValue(farm);
    mockDb.FarmCrop.findOne.mockResolvedValue(farmCrop);
    mockDb.Crop.findOne.mockResolvedValue(crop);
    mockDb.Plague.findOne.mockResolvedValue(plague);
    mockDb.Product.findOne.mockResolvedValue(product);
    mockDb.FarmCropStage.findOne
      .mockResolvedValueOnce(currentStage)
      .mockResolvedValueOnce(nextStage);
  });

  it('crea un ciclo sólo dentro de un terreno accesible y con cultivo publicado', async () => {
    const res = buildResponse();
    await createLandCropCycle(
      {
        ...requestContext,
        body: {
          crop_id: '8',
          planting_date: '2026-03-15',
          area_section: 'Lote Norte',
        },
      },
      res,
    );

    expect(mockDb.Farm.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 18, user_id: 12, status: true },
      }),
    );
    expect(mockDb.Crop.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 8, workflow_status: 'published' }),
      }),
    );
    expect(mockDb.FarmCropStage.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ farm_crop_id: 33, stage_order: 1 }),
      ]),
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('no crea ciclos en un terreno ajeno o inexistente', async () => {
    mockDb.Farm.findOne.mockResolvedValue(null);
    const res = buildResponse();

    await createLandCropCycle(
      {
        ...requestContext,
        body: { crop_id: '8', planting_date: '2026-03-15' },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(mockDb.FarmCrop.create).not.toHaveBeenCalled();
  });

  it('avanza únicamente la etapa activa del ciclo relacionado', async () => {
    const res = buildResponse();
    await advanceLandCropStage(
      {
        ...requestContext,
        body: { farm_crop_id: '33', stage_order: '2', notes: 'Confirmada' },
      },
      res,
    );

    expect(currentStage.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'completed', notes: 'Confirmada' }),
      { transaction },
    );
    expect(nextStage.update).toHaveBeenCalledWith(
      { status: 'in_progress' },
      { transaction },
    );
  });

  it('finaliza un ciclo sin borrar su historial', async () => {
    const res = buildResponse();
    await finishLandCropCycle(
      { ...requestContext, body: { farm_crop_id: '33' } },
      res,
    );

    expect(farmCrop.update).toHaveBeenCalledWith(
      { is_active: false, status: 'completed' },
      { transaction },
    );
  });

  it('registra un hallazgo usando una plaga publicada y conserva su nombre', async () => {
    const res = buildResponse();
    await createFarmHealthReport(
      {
        ...requestContext,
        body: {
          plague_id: '4',
          farm_crop_id: '33',
          severity: 'high',
          description: 'Daño en hojas nuevas.',
          observed_at: '2026-09-06',
        },
      },
      res,
    );

    expect(mockDb.Plague.findOne).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 4, status: true, workflow_status: 'published' },
      }),
    );
    expect(mockDb.FarmHealthReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 18,
        farm_crop_id: 33,
        plague_id: 4,
        plague_name: 'Gusano cogollero',
        created_by_user_id: 12,
      }),
      { transaction },
    );
  });

  it('registra una aplicación usando un producto público activo', async () => {
    const res = buildResponse();
    await createFarmApplication(
      {
        ...requestContext,
        body: {
          product_id: '15',
          farm_crop_id: '33',
          dose_value: '1.5',
          dose_unit: 'L/ha',
          applied_at: '2026-09-06',
        },
      },
      res,
    );

    expect(mockDb.Product.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: 15, status: true } }),
    );
    expect(mockDb.FarmApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 18,
        product_id: 15,
        product_name: 'Producto QA',
        active_ingredient: 'Ingrediente QA',
        created_by_user_id: 12,
      }),
      { transaction },
    );
  });
});
