import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const transaction = {
  LOCK: { UPDATE: 'UPDATE' },
  commit: jest.fn(),
  rollback: jest.fn(),
};

const readyCropData = {
  id: 18,
  workflow_status: 'verified',
  name: 'Maíz',
  scientific_name: 'Zea mays',
  category: 'Granos y Cereales',
  description: 'Descripción técnica.',
  region: 'El Bajío',
  climate: 'Templado',
  soil_type: 'Franco',
  cycle: 'Anual',
  season: 'Primavera-Verano',
  water_requirement: 'Medio',
};

const crop = {
  id: 18,
  workflow_status: 'verified',
  created_by_user_id: 12,
  toJSON: jest.fn(() => readyCropData),
  update: jest.fn(),
  destroy: jest.fn(),
};

const mockDb = {
  sequelize: { transaction: jest.fn(async () => transaction) },
  Sequelize: { Op: {} },
  Crop: {
    create: jest.fn(async () => crop),
    findByPk: jest.fn(async () => crop),
  },
  CropImage: {
    bulkCreate: jest.fn(),
    count: jest.fn(async () => 1),
    findAll: jest.fn(async () => []),
    destroy: jest.fn(),
  },
  Plague: {},
  PlagueImage: {},
  Farm: {},
  Product: {},
  ProductImage: {},
  AuditLog: { create: jest.fn() },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { createCrop, updateCrop, updateCropWorkflow } =
  await import('../../src/controllers/private/cropsController.js');

const buildResponse = () => ({
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

const validBody = {
  name: 'Maíz',
  scientific_name: 'Zea mays',
  category: 'Granos y Cereales',
  region: 'centro',
};

describe('controladores editoriales de cultivos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    crop.workflow_status = 'verified';
    crop.created_by_user_id = 12;
    crop.toJSON.mockReturnValue(readyCropData);
    mockDb.Crop.findByPk.mockResolvedValue(crop);
    mockDb.CropImage.count.mockResolvedValue(1);
  });

  it('crea siempre un borrador propiedad del usuario autenticado', async () => {
    const req = {
      body: { ...validBody, status: 'aprobado', workflow_status: 'published' },
      files: [],
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await createCrop(req, res);

    expect(mockDb.Crop.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_status: 'draft',
        status: 'pendiente',
        created_by_user_id: 12,
        updated_by_user_id: 12,
      }),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
  });

  it('impide que otro INIFAP edite la ficha del autor', async () => {
    crop.workflow_status = 'draft';
    const req = {
      params: { id: '18' },
      body: validBody,
      files: [],
      user: { id: 27, role: 'inifap' },
    };
    const res = buildResponse();

    await updateCrop(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(crop.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
  });

  it('rechaza la edición aunque sea propia cuando el estado no es editable', async () => {
    crop.workflow_status = 'in_review';
    const req = {
      params: { id: '18' },
      body: validBody,
      files: [],
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updateCrop(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(crop.update).not.toHaveBeenCalled();
  });

  it('publica dentro de una transacción y registra auditoría', async () => {
    const req = {
      params: { id: '18' },
      body: { action: 'publish' },
      user: { id: 1, role: 'admin' },
    };
    const res = buildResponse();

    await updateCropWorkflow(req, res);

    expect(crop.update).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_status: 'published',
        status: 'aprobado',
        published_by_user_id: 1,
      }),
      { transaction },
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'crop.publish',
        table_name: 'Crops',
        record_id: 18,
        user_id: 1,
      }),
      { transaction },
    );
    expect(res.redirect).toHaveBeenCalledWith('/private/crops/18');
  });

  it('impide que el autor INIFAP verifique su propia ficha', async () => {
    crop.workflow_status = 'in_review';
    crop.toJSON.mockReturnValue({
      ...readyCropData,
      workflow_status: 'in_review',
    });
    const req = {
      params: { id: '18' },
      body: { action: 'verify' },
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updateCropWorkflow(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(crop.update).not.toHaveBeenCalled();
  });

  it('impide publicar una ficha incompleta', async () => {
    crop.toJSON.mockReturnValue({
      id: 18,
      workflow_status: 'verified',
      name: 'Ficha incompleta',
      scientific_name: 'Species incompleta',
    });
    mockDb.CropImage.count.mockResolvedValue(0);
    const req = {
      params: { id: '18' },
      body: { action: 'publish' },
      user: { id: 1, role: 'admin' },
    };
    const res = buildResponse();

    await updateCropWorkflow(req, res);

    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('incompleta'),
    );
    expect(crop.update).not.toHaveBeenCalled();
  });
});
