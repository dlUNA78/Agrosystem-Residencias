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
    update: jest.fn(),
  },
  FarmCropStage: {
    bulkCreate: jest.fn(),
    findAll: jest.fn(),
    findOne: jest.fn(),
  },
  FarmLot: {
    create: jest.fn(async (data) => ({ id: 10, ...data })),
    findOne: jest.fn(),
  },
  Crop: {
    findOne: jest.fn(async () => crop),
    create: jest.fn(async (data) => ({ id: 99, ...data })),
  },
  Plague: { findOne: jest.fn(async () => plague) },
  Product: { findOne: jest.fn(async () => product) },
  FarmHealthReport: { create: jest.fn(async () => ({ id: 41 })) },
  FarmApplication: { create: jest.fn(async () => ({ id: 51 })) },
  AuditLog: { create: jest.fn() },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const {
  advanceLandCropStage,
  archiveLandCropCycle,
  createLandCropCycle,
  finishLandCropCycle,
  restoreLandCropCycle,
  revertLandCropStage,
} = await import('../../src/controllers/private/lands/landCycleController.js');
const { createLandLot, deleteLandLot, updateLandLot } =
  await import('../../src/controllers/private/lands/landLotController.js');
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

  it('crea un ciclo con cultivo personalizado si no se selecciona del catálogo', async () => {
    const res = buildResponse();
    mockDb.Crop.findOne.mockResolvedValueOnce(null);
    mockDb.Crop.create.mockResolvedValueOnce({
      id: 99,
      name: 'Pitahaya',
      harvest_days: 120,
    });

    await createLandCropCycle(
      {
        ...requestContext,
        body: {
          crop_id: 'custom',
          custom_crop_name: 'Pitahaya',
          planting_date: '2026-03-15',
          area_section: 'Lote Experimental',
        },
      },
      res,
    );

    expect(mockDb.Crop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Pitahaya',
        workflow_status: 'published',
      }),
      { transaction },
    );
    expect(mockDb.FarmCrop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 18,
        crop_id: 99,
      }),
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

  it('archiva un ciclo de cultivo cosechado', async () => {
    const res = buildResponse();
    await archiveLandCropCycle(
      { ...requestContext, body: { farm_crop_id: '33' } },
      res,
    );

    expect(farmCrop.update).toHaveBeenCalledWith(
      { is_active: false, status: 'archived' },
      { transaction },
    );
  });

  it('desarchiva y restaura un ciclo de cultivo', async () => {
    const res = buildResponse();
    await restoreLandCropCycle(
      { ...requestContext, body: { farm_crop_id: '33' } },
      res,
    );

    expect(farmCrop.update).toHaveBeenCalledWith(
      { is_active: false, status: 'completed' },
      { transaction },
    );
  });

  it('calcula la duración y etapas a partir de estimated_harvest_date', async () => {
    const res = buildResponse();
    await createLandCropCycle(
      {
        ...requestContext,
        body: {
          crop_id: '8',
          planting_date: '2026-03-01',
          estimated_harvest_date: '2026-06-09', // 100 días
        },
      },
      res,
    );

    expect(mockDb.FarmCropStage.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          stage_order: 5,
          estimated_date: '2026-06-09',
        }),
      ]),
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

  it('registra un hallazgo con plaga personalizada si no se selecciona del catálogo', async () => {
    const res = buildResponse();
    mockDb.Plague.findOne.mockResolvedValueOnce(null);

    await createFarmHealthReport(
      {
        ...requestContext,
        body: {
          plague_id: 'custom',
          custom_plague_name: 'Pulgón Amarillo',
          severity: 'medium',
          observed_at: '2026-09-06',
        },
      },
      res,
    );

    expect(mockDb.FarmHealthReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 18,
        plague_id: null,
        plague_name: 'Pulgón Amarillo',
        created_by_user_id: 12,
      }),
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(201);
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

  it('registra una aplicación con producto personalizado si no se selecciona del catálogo', async () => {
    const res = buildResponse();

    await createFarmApplication(
      {
        ...requestContext,
        body: {
          product_id: 'custom',
          custom_product_name: 'BioExtracto de Ajo',
          custom_active_ingredient: 'Alicina 10%',
          dose_value: '2.0',
          dose_unit: 'L/ha',
          applied_at: '2026-09-06',
        },
      },
      res,
    );

    expect(mockDb.FarmApplication.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 18,
        product_id: null,
        product_name: 'BioExtracto de Ajo',
        active_ingredient: 'Alicina 10%',
        created_by_user_id: 12,
      }),
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('retrocede la etapa fenológica actualizando estados y auditando el cambio', async () => {
    const res = buildResponse();
    const stage1 = { stage_order: 1, status: 'completed', update: jest.fn() };
    const stage2 = { stage_order: 2, status: 'completed', update: jest.fn() };
    const stage3 = { stage_order: 3, status: 'in_progress', update: jest.fn() };
    mockDb.FarmCropStage.findAll.mockResolvedValue([stage1, stage2, stage3]);

    await revertLandCropStage(
      {
        ...requestContext,
        body: {
          farm_crop_id: '33',
          target_stage_order: '2',
          notes: 'Corrección por helada tardía',
        },
      },
      res,
    );

    expect(stage2.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'in_progress',
        actual_date: null,
        notes: 'Corrección por helada tardía',
      }),
      { transaction },
    );
    expect(stage3.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: 'pending',
        actual_date: null,
      }),
      { transaction },
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'revert_crop_stage',
        record_id: 18,
      }),
      { transaction },
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('registra un lote o bloque nuevo y audita la acción', async () => {
    const res = buildResponse();
    mockDb.FarmLot.findOne.mockResolvedValue(null);

    await createLandLot(
      {
        ...requestContext,
        body: {
          name: 'Lote Norte C',
          size_hectares: '4.2',
          description: 'Suelo arcilloso con riego',
        },
      },
      res,
    );

    expect(mockDb.FarmLot.create).toHaveBeenCalledWith(
      expect.objectContaining({
        farm_id: 18,
        name: 'Lote Norte C',
        size_hectares: 4.2,
        description: 'Suelo arcilloso con riego',
        status: true,
      }),
      { transaction },
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'create_farm_lot',
        record_id: 18,
      }),
      { transaction },
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('rechaza la creación de un lote si ya existe uno activo con el mismo nombre', async () => {
    const res = buildResponse();
    mockDb.FarmLot.findOne.mockResolvedValue({ id: 9, name: 'Lote Norte C' });

    await createLandLot(
      {
        ...requestContext,
        body: {
          name: 'Lote Norte C',
          size_hectares: '4.2',
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(mockDb.FarmLot.create).not.toHaveBeenCalled();
  });

  it('desactiva un lote existente y audita la eliminación', async () => {
    const res = buildResponse();
    const existingLot = {
      id: 10,
      farm_id: 18,
      name: 'Lote Norte C',
      status: true,
      update: jest.fn(),
    };
    mockDb.FarmLot.findOne.mockResolvedValue(existingLot);

    await deleteLandLot(
      {
        ...requestContext,
        params: { id: '18', lotId: '10' },
      },
      res,
    );

    expect(existingLot.update).toHaveBeenCalledWith(
      { status: false },
      { transaction },
    );
    expect(mockDb.FarmCrop.update).toHaveBeenCalledWith(
      { area_section: null },
      expect.objectContaining({
        where: {
          farm_id: 18,
          area_section: 'Lote Norte C',
        },
        transaction,
      }),
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'delete_farm_lot',
        record_id: 18,
      }),
      { transaction },
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('actualiza un lote existente y renombra los ciclos vinculados', async () => {
    const res = buildResponse();
    const existingLot = {
      id: 10,
      farm_id: 18,
      name: 'Lote Antiguo',
      size_hectares: 2.5,
      description: 'Nota previa',
      status: true,
      update: jest.fn(),
    };
    mockDb.FarmLot.findOne
      .mockResolvedValueOnce(existingLot) // find the lot
      .mockResolvedValueOnce(null); // no conflict for new name

    await updateLandLot(
      {
        ...requestContext,
        params: { id: '18', lotId: '10' },
        body: {
          name: 'Lote Nuevo Renombrado',
          size_hectares: '3.8',
          description: 'Suelo mejorado con riego',
        },
      },
      res,
    );

    expect(existingLot.update).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Lote Nuevo Renombrado',
        size_hectares: 3.8,
        description: 'Suelo mejorado con riego',
      }),
      { transaction },
    );
    expect(mockDb.FarmCrop.update).toHaveBeenCalledWith(
      { area_section: 'Lote Nuevo Renombrado' },
      expect.objectContaining({
        where: {
          farm_id: 18,
          area_section: 'Lote Antiguo',
        },
        transaction,
      }),
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update_farm_lot',
        record_id: 18,
      }),
      { transaction },
    );
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
      }),
    );
  });

  it('rechaza la actualización si el nuevo nombre ya está ocupado por otro lote activo', async () => {
    const res = buildResponse();
    const existingLot = {
      id: 10,
      farm_id: 18,
      name: 'Lote A',
      status: true,
      update: jest.fn(),
    };
    const conflictingLot = {
      id: 20,
      farm_id: 18,
      name: 'Lote B',
      status: true,
    };
    mockDb.FarmLot.findOne
      .mockResolvedValueOnce(existingLot)
      .mockResolvedValueOnce(conflictingLot);

    await updateLandLot(
      {
        ...requestContext,
        params: { id: '18', lotId: '10' },
        body: {
          name: 'Lote B',
        },
      },
      res,
    );

    expect(res.status).toHaveBeenCalledWith(409);
    expect(existingLot.update).not.toHaveBeenCalled();
  });
});
