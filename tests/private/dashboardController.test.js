import fs from 'fs';
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
  ActiveIngredient: {
    count: jest.fn(),
  },
  Supplier: {
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
  getCatalogEcosystemMetrics,
  getRecentAuditActivity,
  buildQuickActions,
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
    mockDb.ActiveIngredient.count.mockResolvedValue(12);
    mockDb.Supplier.count.mockResolvedValue(7);

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
        farm: { id: 42, name: 'Rancho San José' },
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
      expect(result.total).toBe(9);
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
      expect(adminResult.latestAlert?.farm?.id).toBe(42);

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

    it('calcula la distribución de cultivos con segmentos vectoriales SVG y degradado', async () => {
      const distribution = await getActiveCropDistribution({
        id: 1,
        role: 'admin',
      });
      expect(distribution.hasData).toBe(true);
      expect(distribution.crops).toHaveLength(2);
      expect(distribution.conicGradientStyle).toContain('conic-gradient');
      expect(distribution.crops[0].dashArray).toMatch(/^\d+(\.\d+)?\s+\d+/);
      expect(typeof distribution.crops[0].dashOffset).toBe('number');
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

    it('consolida métricas del ecosistema de ingredientes activos y proveedores', async () => {
      const ecosystem = await getCatalogEcosystemMetrics();
      expect(ecosystem.totalIngredients).toBe(12);
      expect(ecosystem.activeIngredients).toBe(12);
      expect(ecosystem.totalSuppliers).toBe(7);
      expect(ecosystem.activeSuppliers).toBe(7);
      expect(ecosystem.publishedTotal).toBe(9);
    });

    it('obtiene registros recientes de auditoría con iniciales y etiquetas en español', async () => {
      const activity = await getRecentAuditActivity(5);
      expect(activity).toHaveLength(1);
      expect(activity[0].userName).toBe('Juan Pérez');
      expect(activity[0].initials).toBe('JP');
      expect(activity[0].actionLabel).toBe('registró');
      expect(activity[0].moduleLabel).toBe('Terrenos');
      expect(activity[0].entityName).toBe('Parcela Nueva');
    });

    it('construye accesos rápidos contextuales diferenciados por rol', () => {
      const adminActions = buildQuickActions({ role: 'admin' });
      const inifapActions = buildQuickActions({ role: 'inifap' });

      expect(adminActions.some((item) => item.href === '/private/audit')).toBe(
        true,
      );
      expect(adminActions.some((item) => item.href === '/private/users')).toBe(
        true,
      );
      expect(inifapActions.some((item) => item.href === '/private/audit')).toBe(
        false,
      );
      expect(
        inifapActions.some((item) => item.href === '/private/reports'),
      ).toBe(true);
    });

    it('consolida el resumen completo del dashboard distinguiendo rol administrativo', async () => {
      const summary = await getDashboardSummary({ id: 1, role: 'admin' });
      expect(summary.isAdmin).toBe(true);
      expect(summary.isInifap).toBe(false);
      expect(summary.validations).toBeDefined();
      expect(summary.land).toBeDefined();
      expect(summary.ecosystem.totalIngredients).toBe(12);
      expect(summary.quickActions.length).toBeGreaterThan(0);
    });
  });

  describe('controlador dashboard y plantillas Geist sin JS/CSS inline', () => {
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
          ecosystem: expect.objectContaining({ totalIngredients: 12 }),
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
          ecosystem: expect.objectContaining({ totalIngredients: 0 }),
        }),
      );
    });

    it('garantiza cero estilos inline, cero eventos inline y cero enlaces muertos en dashboard y layout privado', () => {
      const dashboardView = fs.readFileSync(
        new URL('../../src/views/private/dashboard/index.hbs', import.meta.url),
        'utf8',
      );
      const sidebarPartial = fs.readFileSync(
        new URL(
          '../../src/views/partials/private/sidebar.hbs',
          import.meta.url,
        ),
        'utf8',
      );
      const navbarPartial = fs.readFileSync(
        new URL('../../src/views/partials/private/navbar.hbs', import.meta.url),
        'utf8',
      );
      const footerPartial = fs.readFileSync(
        new URL('../../src/views/partials/private/footer.hbs', import.meta.url),
        'utf8',
      );
      const privateLayoutFile = fs.readFileSync(
        new URL('../../src/views/layouts/private.hbs', import.meta.url),
        'utf8',
      );

      for (const content of [
        dashboardView,
        sidebarPartial,
        navbarPartial,
        footerPartial,
        privateLayoutFile,
      ]) {
        expect(content).not.toMatch(/\sstyle=/i);
        expect(content).not.toMatch(/\son[a-z]+=/i);
        expect(content).not.toMatch(/href="#"/i);
      }

      expect(dashboardView).not.toMatch(/<main[\s>]/i);
      expect(privateLayoutFile).not.toMatch(/<script>\s*document/i);
      expect(sidebarPartial).toContain('href="/private/profile"');
    });
  });
});
