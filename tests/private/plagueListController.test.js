import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const opOr = Symbol('or');
const opILike = Symbol('iLike');
const plagueRecords = [
  {
    toJSON: () => ({
      id: 13,
      name: 'Roya amarilla',
      workflow_status: 'in_review',
      biological_cycle: [
        { title: 'Huevo', description: 'Etapa inicial', duration: '3 días' },
      ],
      images: [
        { url: 'images/plagues/uno.png', sort_order: 0 },
        { url: '/images/plagues/dos.webp', sort_order: 1 },
      ],
    }),
  },
];

const mockDb = {
  sequelize: { transaction: jest.fn() },
  Sequelize: { Op: { or: opOr, iLike: opILike } },
  Plague: {
    count: jest.fn(async () => 25),
    findAll: jest.fn(async () => plagueRecords),
  },
  PlagueImage: {},
  PlagueRegion: {},
  Product: {},
  ProductImage: {},
  Region: {},
  Crop: {},
  AuditLog: {},
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { plaguesPrivate } =
  await import('../../src/controllers/private/plagueController.js');

describe('controlador del listado privado de plagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDb.Plague.count.mockResolvedValue(25);
    mockDb.Plague.findAll.mockResolvedValue(plagueRecords);
  });

  it('consulta solo la página solicitada y conserva filtros en la vista', async () => {
    const req = {
      query: {
        page: '2',
        search: 'roya',
        category: 'Hongo',
        workflow: 'in_review',
      },
      user: { id: 5, role: 'inifap' },
    };
    const res = {
      render: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await plaguesPrivate(req, res);

    expect(mockDb.Plague.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 12, offset: 12 }),
    );
    const listQuery = mockDb.Plague.findAll.mock.calls[0][0];
    expect(listQuery.where).toEqual(
      expect.objectContaining({
        category: 'Hongo',
        workflow_status: 'in_review',
      }),
    );
    expect(listQuery.where[opOr]).toEqual(
      expect.arrayContaining([
        { name: { [opILike]: '%roya%' } },
        { symptoms: { [opILike]: '%roya%' } },
      ]),
    );
    expect(res.render).toHaveBeenCalledWith(
      'private/catalog/plagues',
      expect.objectContaining({
        filters: {
          search: 'roya',
          category: 'Hongo',
          workflow: 'in_review',
        },
        pagination: expect.objectContaining({
          currentPage: 2,
          totalItems: 25,
          fromItem: 13,
          toItem: 24,
        }),
      }),
    );
    expect(res.render.mock.calls[0][1]).not.toHaveProperty('user');
    expect(res.render.mock.calls[0][1].plagues[0].biological_cycle_json).toBe(
      JSON.stringify([
        { title: 'Huevo', description: 'Etapa inicial', duration: '3 días' },
      ]),
    );
    expect(res.render.mock.calls[0][1].plagues[0].images_json).toBe(
      JSON.stringify([
        { url: '/images/plagues/uno.png', sort_order: 0 },
        { url: '/images/plagues/dos.webp', sort_order: 1 },
      ]),
    );
  });

  it('ajusta una página superior al total antes de calcular el offset', async () => {
    mockDb.Plague.count.mockResolvedValueOnce(13);
    const req = {
      query: { page: '99' },
      user: { id: 1, role: 'admin' },
    };
    const res = {
      render: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await plaguesPrivate(req, res);

    expect(mockDb.Plague.findAll).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 12, offset: 12 }),
    );
    expect(res.render).toHaveBeenCalledWith(
      'private/catalog/plagues',
      expect.objectContaining({
        pagination: expect.objectContaining({ currentPage: 2, totalPages: 2 }),
      }),
    );
  });
});
