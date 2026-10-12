import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  Sequelize: {
    Op: {
      gte: Symbol('gte'),
    },
    fn: jest.fn((name, arg) => ({ fn: name, arg })),
    col: jest.fn((name) => ({ col: name })),
    literal: jest.fn((expr) => ({ literal: expr })),
  },
  Plague: {
    count: jest.fn(),
  },
  Crop: {
    count: jest.fn(),
  },
  Product: {
    count: jest.fn(),
  },
  Farm: {
    count: jest.fn(),
    sum: jest.fn(),
  },
  FarmCrop: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  FarmHealthReport: {
    count: jest.fn(),
    findOne: jest.fn(),
    findAll: jest.fn(),
  },
  AuditLog: {
    findAll: jest.fn(),
  },
  User: {},
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const {
  getPendingValidationsMetrics,
  getCriticalAlertsMetrics,
  getMonitoredLandMetrics,
  getTopPlaguesOfMonth,
  getActiveCropDistribution,
  getRecentAuditActivity,
  getDashboardSummary,
} = await import('../../src/services/dashboardMetricsService.js');

const { dashboard } =
  await import('../../src/controllers/private/dashboardController.js');

describe('módulo de métricas del dashboard', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockDb.Plague.count.mockResolvedValue(4);
    mockDb.Crop.count.mockResolvedValue(2);
    mockDb.Product.count.mockResolvedValue(3);

    mockDb.Farm.count.mockResolvedValue(10);
    mockDb.Farm.sum.mockResolvedValue(1250.5);

    mockDb.FarmCrop.count.mockResolvedValue(15);
    mockDb.FarmCrop.findAll.mockResolvedValue([
      {
        crop: { name: 'Aguacate Hass' },
        farm: { size_hectares: 500 },
      },
      {
        crop: { name: 'Limón Pérsico' },
        farm: { size_hectares: 300 },
      },
    ]);

    mockDb.FarmHealthReport.count.mockResolvedValue(3);
    mockDb.FarmHealthReport.findOne.mockResolvedValue({
      toJSON: () => ({
        id: 1,
        plague_name: 'Gusano Cogollero',
        severity: 'high',
        status: 'open',
        farm: { name: 'Rancho San José' },
      }),
    });
    mockDb.FarmHealthReport.findAll.mockResolvedValue([
      { plague_name: 'Gusano Cogollero', reportCount: '25' },
      { plague_name: 'Mosca de la Fruta', reportCount: '15' },
    ]);

    mockDb.AuditLog.findAll.mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          action: 'create',
          table_name: 'Farms',
          created_at: new Date(),
          user: { full_name: 'Juan Pérez' },
          new_values: { name: 'Parcela Nueva' },
        }),
      },
    ]);
  });

  describe('dashboardMetricsService', () => {
    it('calcula métricas de validaciones pendientes sumando catálogos', async () => {
      const result = await getPendingValidationsMetrics();
      expect(result.total).toBe(9); // 4 + 2 + 3
      expect(result.plaguesPending).toBe(4);
      expect(result.cropsPending).toBe(2);
      expect(result.productsPending).toBe(3);
    });

    it('obtiene alertas críticas y acota la búsqueda según el rol del usuario', async () => {
      const adminResult = await getCriticalAlertsMetrics({
        id: 1,
        role: 'admin',
      });
      expect(adminResult.criticalCount).toBe(3);
      expect(adminResult.latestAlert?.plague_name).toBe('Gusano Cogollero');

      await getCriticalAlertsMetrics({ id: 5, role: 'inifap' });
      expect(mockDb.FarmHealthReport.count).toHaveBeenCalledWith(
        expect.objectContaining({
          include: expect.arrayContaining([
            expect.objectContaining({ as: 'farm' }),
          ]),
        }),
      );
    });

    it('calcula hectáreas monitoreadas y ciclos de cultivo activos', async () => {
      const landMetrics = await getMonitoredLandMetrics({
        id: 1,
        role: 'admin',
      });
      expect(landMetrics.totalFarms).toBe(10);
      expect(landMetrics.hectares).toBe(1250.5);
      expect(landMetrics.formattedHectares).toBe('1,250.5');
      expect(landMetrics.activeCyclesCount).toBe(15);
    });

    it('calcula top 5 plagas del mes con porcentajes proporcionales', async () => {
      const topPlagues = await getTopPlaguesOfMonth();
      expect(topPlagues).toHaveLength(2);
      expect(topPlagues[0].name).toBe('Gusano Cogollero');
      expect(topPlagues[0].count).toBe(25);
      expect(topPlagues[0].percentage).toBe(100);
      expect(topPlagues[1].name).toBe('Mosca de la Fruta');
      expect(topPlagues[1].percentage).toBe(60);
    });

    it('retorna arreglo vacío en top plagas cuando no hay reportes', async () => {
      mockDb.FarmHealthReport.findAll.mockResolvedValueOnce([]);
      const topPlagues = await getTopPlaguesOfMonth();
      expect(topPlagues).toEqual([]);
    });

    it('calcula la distribución de cultivos y genera paradas para degradado cónico', async () => {
      const distribution = await getActiveCropDistribution({
        id: 1,
        role: 'admin',
      });
      expect(distribution.hasData).toBe(true);
      expect(distribution.crops).toHaveLength(2);
      expect(distribution.conicGradientStyle).toContain('conic-gradient');
    });

    it('retorna estado degradado cuando no hay cultivos activos', async () => {
      mockDb.FarmCrop.findAll.mockResolvedValueOnce([]);
      const distribution = await getActiveCropDistribution({
        id: 1,
        role: 'admin',
      });
      expect(distribution.hasData).toBe(false);
      expect(distribution.crops).toEqual([]);
    });

    it('obtiene registros recientes de auditoría con iniciales formateadas', async () => {
      const activity = await getRecentAuditActivity(5);
      expect(activity).toHaveLength(1);
      expect(activity[0].userName).toBe('Juan Pérez');
      expect(activity[0].initials).toBe('JP');
      expect(activity[0].entityName).toBe('Parcela Nueva');
    });

    it('consolida el resumen completo del dashboard distinguiendo rol administrativo', async () => {
      const summary = await getDashboardSummary({ id: 1, role: 'admin' });
      expect(summary.isAdmin).toBe(true);
      expect(summary.isInifap).toBe(false);
      expect(summary.validations).toBeDefined();
      expect(summary.land).toBeDefined();
    });
  });

  describe('controlador dashboard', () => {
    it('renderiza el dashboard con todas las métricas calculadas', async () => {
      const req = { user: { id: 1, role: 'admin' } };
      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await dashboard(req, res);

      expect(res.render).toHaveBeenCalledWith(
        'private/dashboard/index',
        expect.objectContaining({
          activePage: 'dashboard',
          pageTitle: 'Dashboard',
          isAdmin: true,
          validations: expect.objectContaining({ total: 9 }),
          land: expect.objectContaining({ totalFarms: 10 }),
        }),
      );
    });

    it('responde 500 con vista degradada cuando ocurre un error en base de datos', async () => {
      mockDb.Plague.count.mockRejectedValueOnce(
        new Error('Database connectivity failure'),
      );

      const req = { user: { id: 1, role: 'admin' } };
      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await dashboard(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith(
        'private/dashboard/index',
        expect.objectContaining({
          activePage: 'dashboard',
          error: expect.stringContaining('Ocurrió un error'),
          validations: expect.objectContaining({ total: 0 }),
        }),
      );
    });
  });
});
