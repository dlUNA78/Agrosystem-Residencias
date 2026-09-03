import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const transaction = {
  commit: jest.fn(),
  rollback: jest.fn(),
};

const plague = {
  id: 41,
  workflow_status: 'draft',
  created_by_user_id: 12,
  toJSON: jest.fn(() => ({ id: 41, workflow_status: 'draft' })),
  update: jest.fn(),
};

const mockDb = {
  sequelize: { transaction: jest.fn(async () => transaction) },
  Sequelize: { Op: {} },
  Plague: {
    create: jest.fn(async () => plague),
    findByPk: jest.fn(async () => plague),
  },
  PlagueImage: {
    bulkCreate: jest.fn(),
    count: jest.fn(async () => 2),
    create: jest.fn(),
    destroy: jest.fn(),
  },
  PlagueRegion: {},
  Product: {},
  ProductImage: {},
  Region: {},
  Crop: {},
  AuditLog: { create: jest.fn() },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { createPlague, updatePlague } =
  await import('../../src/controllers/private/plagueController.js');

const buildResponse = () => ({
  redirect: jest.fn(),
  status: jest.fn().mockReturnThis(),
  send: jest.fn(),
});

const validBody = {
  name: 'Gusano de prueba',
  scientific_name: 'Insectus probandus',
};

const uploadedFiles = [
  { filename: 'primera.png', originalname: 'primera.png' },
  { filename: 'segunda.webp', originalname: 'segunda.webp' },
];

describe('controlador de imágenes múltiples de plagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    plague.workflow_status = 'draft';
    plague.created_by_user_id = 12;
    mockDb.Plague.create.mockResolvedValue(plague);
    mockDb.Plague.findByPk.mockResolvedValue(plague);
    mockDb.PlagueImage.count.mockResolvedValue(2);
  });

  it('guarda todas las imágenes al crear la ficha', async () => {
    const req = {
      body: validBody,
      files: uploadedFiles,
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await createPlague(req, res);

    expect(mockDb.PlagueImage.bulkCreate).toHaveBeenCalledWith(
      [
        {
          plague_id: 41,
          url: 'images/plagues/primera.png',
          sort_order: 0,
        },
        {
          plague_id: 41,
          url: 'images/plagues/segunda.webp',
          sort_order: 1,
        },
      ],
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
  });

  it('agrega nuevas imágenes al editar sin eliminar las anteriores', async () => {
    const req = {
      params: { id: '41' },
      body: validBody,
      files: uploadedFiles,
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updatePlague(req, res);

    expect(mockDb.PlagueImage.count).toHaveBeenCalledWith({
      where: { plague_id: 41 },
      transaction,
    });
    expect(mockDb.PlagueImage.destroy).not.toHaveBeenCalled();
    expect(mockDb.PlagueImage.bulkCreate).toHaveBeenCalledWith(
      [
        {
          plague_id: 41,
          url: 'images/plagues/primera.png',
          sort_order: 2,
        },
        {
          plague_id: 41,
          url: 'images/plagues/segunda.webp',
          sort_order: 3,
        },
      ],
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
  });

  it('impide que otro INIFAP edite el expediente del autor', async () => {
    const req = {
      params: { id: '41' },
      body: validBody,
      files: [],
      user: { id: 27, role: 'inifap' },
    };
    const res = buildResponse();

    await updatePlague(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(plague.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
  });
});
