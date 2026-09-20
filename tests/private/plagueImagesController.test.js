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
    findAll: jest.fn(async () => []),
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
  {
    filename: 'primera.png',
    originalname: 'primera.png',
    path: 'public/images/plagues/primera.png',
  },
  {
    filename: 'segunda.webp',
    originalname: 'segunda.webp',
    path: 'public/images/plagues/segunda.webp',
  },
];

describe('controlador de imágenes múltiples de plagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    plague.workflow_status = 'draft';
    plague.created_by_user_id = 12;
    mockDb.Plague.create.mockResolvedValue(plague);
    mockDb.Plague.findByPk.mockResolvedValue(plague);
    mockDb.PlagueImage.count.mockResolvedValue(2);
    mockDb.PlagueImage.findAll.mockResolvedValue([
      { id: 7, url: 'images/plagues/guardada-1.png', sort_order: 0 },
      { id: 8, url: 'images/plagues/guardada-2.png', sort_order: 1 },
    ]);
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

    expect(mockDb.PlagueImage.findAll).toHaveBeenCalledWith({
      where: { plague_id: 41 },
      transaction,
      order: [['sort_order', 'ASC']],
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

  it('rechaza en servidor más de 10 imágenes al crear aunque se omita el cliente', async () => {
    const req = {
      body: validBody,
      files: Array.from({ length: 11 }, (_, index) => ({
        filename: `imagen-${index}.png`,
        originalname: `imagen-${index}.png`,
      })),
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await createPlague(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'La galería puede contener como máximo 10 imágenes.',
    );
    expect(mockDb.Plague.create).not.toHaveBeenCalled();
  });

  it('rechaza si las imágenes conservadas y nuevas exceden 10', async () => {
    mockDb.PlagueImage.findAll.mockResolvedValue(
      Array.from({ length: 9 }, (_, index) => ({
        id: index + 1,
        url: `images/plagues/guardada-${index}.png`,
        sort_order: index,
      })),
    );
    const req = {
      params: { id: '41' },
      body: validBody,
      files: uploadedFiles,
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updatePlague(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'La galería puede contener como máximo 10 imágenes.',
    );
    expect(plague.update).not.toHaveBeenCalled();
    expect(mockDb.PlagueImage.bulkCreate).not.toHaveBeenCalled();
  });

  it('permite quitar imágenes propias y usa el total restante para el límite', async () => {
    mockDb.PlagueImage.findAll.mockResolvedValue(
      Array.from({ length: 10 }, (_, index) => ({
        id: index + 1,
        url: `images/plagues/guardada-${index}.png`,
        sort_order: index,
      })),
    );
    const req = {
      params: { id: '41' },
      body: { ...validBody, removed_image_ids: ['1', '2'] },
      files: uploadedFiles,
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updatePlague(req, res);

    expect(mockDb.PlagueImage.destroy).toHaveBeenCalledWith({
      where: { id: [1, 2], plague_id: 41 },
      transaction,
    });
    expect(mockDb.PlagueImage.bulkCreate).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ sort_order: 10 }),
        expect.objectContaining({ sort_order: 11 }),
      ]),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
  });

  it('rechaza eliminar una imagen que no pertenece a la plaga', async () => {
    const req = {
      params: { id: '41' },
      body: { ...validBody, removed_image_ids: '999' },
      files: [],
      user: { id: 12, role: 'inifap' },
    };
    const res = buildResponse();

    await updatePlague(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.send).toHaveBeenCalledWith(
      'La selección de imágenes que deseas quitar no es válida.',
    );
    expect(mockDb.PlagueImage.destroy).not.toHaveBeenCalled();
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
