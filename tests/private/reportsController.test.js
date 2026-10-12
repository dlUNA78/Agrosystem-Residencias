import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const mockDb = {
  Sequelize: {
    Op: {
      between: Symbol('between'),
      in: Symbol('in'),
    },
    fn: jest.fn((name, arg) => ({ fn: name, arg })),
    col: jest.fn((name) => ({ col: name })),
    literal: jest.fn((expr) => ({ literal: expr })),
  },
  Farm: {
    count: jest.fn(),
    sum: jest.fn(),
    findAll: jest.fn(),
  },
  FarmHealthReport: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  FarmApplication: {
    count: jest.fn(),
    findAll: jest.fn(),
  },
  Product: {},
  User: {},
  AuditLog: {
    create: jest.fn(),
  },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const {
  normalizeReportQuery,
  getPeriodDateRange,
  formatDisplayDate,
  getTechnicianInitials,
  getCategoryBadgeClass,
  generateOperationalReportCsv,
} = await import('../../src/services/reportsService.js');

const { reportsPrivate } =
  await import('../../src/controllers/private/reportsController.js');

describe('módulo privado de reportes y estadísticas operativas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('reportsService - funciones puras de soporte', () => {
    it('normaliza parámetros de consulta por defecto ante valores inválidos o vacíos', () => {
      const q = normalizeReportQuery({});
      expect(q.period).toBe('mensual');
      expect(q.format).toBe('');
      expect(q.reportType).toBe('general');
      expect(q.farmId).toBeNull();
    });

    it('acepta períodos válidos, formatos permitidos y castea farmId', () => {
      const q = normalizeReportQuery({
        period: 'TRIMESTRAL',
        format: 'CSV',
        reportType: 'HEALTH',
        farmId: '12',
      });
      expect(q.period).toBe('trimestral');
      expect(q.format).toBe('csv');
      expect(q.reportType).toBe('health');
      expect(q.farmId).toBe(12);
    });

    it('calcula rangos de fechas correctos para períodos mensual, trimestral y anual', () => {
      const ref = new Date('2026-06-30T12:00:00Z');
      const mensual = getPeriodDateRange('mensual', ref);
      expect(mensual.days).toBe(30);

      const trimestral = getPeriodDateRange('trimestral', ref);
      expect(trimestral.days).toBe(90);

      const anual = getPeriodDateRange('anual', ref);
      expect(anual.days).toBe(365);
    });

    it('formatea fechas sin desfase horario', () => {
      expect(formatDisplayDate('2026-04-14')).toBe('14 Abr 2026');
      expect(formatDisplayDate(null)).toBe('Sin fecha');
      expect(formatDisplayDate('fecha-invalida')).toBe('fecha-invalida');
    });

    it('extrae iniciales de dos letras para el técnico responsable', () => {
      expect(getTechnicianInitials('Luis Vázquez')).toBe('LV');
      expect(getTechnicianInitials('Pedro')).toBe('PE');
      expect(getTechnicianInitials('')).toBe('TK');
      expect(getTechnicianInitials(null)).toBe('TK');
    });

    it('asigna insignias de tailwind según la categoría de producto', () => {
      expect(getCategoryBadgeClass('Herbicida')).toContain('text-primary');
      expect(getCategoryBadgeClass('Insecticida')).toContain('text-red-600');
      expect(getCategoryBadgeClass('Fungicida')).toContain('text-blue-600');
      expect(getCategoryBadgeClass('Fertilizante')).toContain('text-amber-600');
      expect(getCategoryBadgeClass('Biológico')).toContain('text-slate-600');
    });

    it('genera archivo CSV con encabezados y BOM UTF-8', async () => {
      const sampleData = {
        query: { period: 'mensual', farmId: null },
        latestApplications: [
          {
            formattedDate: '14 Abr 2026',
            farmName: 'La Esperanza',
            productName: 'Roundup Max',
            category: 'Herbicida',
            activeIngredient: 'Glifosato',
            doseText: '2.5 L/ha',
            technicianName: 'Luis Vázquez',
          },
        ],
      };

      const csv = await generateOperationalReportCsv({
        reportType: 'applications',
        data: sampleData,
        user: { id: 1, role: 'admin' },
      });

      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('Fecha Aplicación');
      expect(csv).toContain('"Roundup Max"');
      expect(csv).toContain('"Glifosato"');
    });
  });

  describe('controlador reportsPrivate', () => {
    it('renderiza la vista de reportes con métricas consultadas de la base de datos', async () => {
      // Mock de IDs de predios activos para getActiveFarmIds
      mockDb.Farm.findAll.mockResolvedValue([
        {
          id: 1,
          name: 'La Esperanza',
          municipality: 'Culiacán',
          size_hectares: 120,
        },
      ]);

      mockDb.FarmHealthReport.count
        .mockResolvedValueOnce(45) // reportedPlagues
        .mockResolvedValueOnce(3); // criticalAlerts

      mockDb.FarmApplication.count.mockResolvedValueOnce(28); // chemicalApplications
      mockDb.Farm.count.mockResolvedValueOnce(12); // monitoredFarms
      mockDb.Farm.sum.mockResolvedValueOnce(540.5); // hectares

      mockDb.FarmApplication.findAll.mockImplementation(
        ({ attributes, include }) => {
          if (attributes && attributes.includes('applied_at')) {
            return Promise.resolve([
              { applied_at: '2026-04-10', createdAt: new Date() },
              { applied_at: '2026-04-12', createdAt: new Date() },
            ]);
          }
          if (include && include.some((inc) => inc.as === 'farm')) {
            return Promise.resolve([
              {
                id: 1,
                applied_at: '2026-04-14',
                dose_value: 2.5,
                dose_unit: 'L/ha',
                farm: {
                  name: 'La Esperanza',
                  municipality: 'Culiacán',
                  size_hectares: 120,
                },
                product: { name: 'Roundup', category: 'Herbicida' },
                createdBy: { full_name: 'Carlos Ruiz' },
                toJSON() {
                  return this;
                },
              },
            ]);
          }
          return Promise.resolve([
            { product: { category: 'Herbicida' } },
            { product: { category: 'Insecticida' } },
          ]);
        },
      );

      // top plagues
      mockDb.FarmHealthReport.findAll
        .mockResolvedValueOnce([{ plague_name: 'Gusano Cogollero', count: 18 }])
        // active farms alerts count
        .mockResolvedValueOnce([{ farm_id: 1, alertsCount: 3 }]);

      const req = {
        session: { user: { id: 1, role: 'admin' } },
        query: { period: 'mensual' },
      };

      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await reportsPrivate(req, res);

      expect(res.render).toHaveBeenCalledTimes(1);
      const [viewPath, renderData] = res.render.mock.calls[0];
      expect(viewPath).toBe('private/admin/reports');
      expect(renderData.activePage).toBe('reports');
      expect(renderData.kpis.reportedPlagues).toBe(45);
      expect(renderData.kpis.chemicalApplications).toBe(28);
      expect(renderData.kpis.criticalAlerts).toBe(3);
      expect(renderData.kpis.monitoredFarms).toBe(12);
      expect(renderData.hasApplications).toBe(true);
      expect(renderData.latestApplications[0].farmName).toBe('La Esperanza');
    });

    it('exporta CSV con encabezados de descarga y registra auditoría cuando format=csv', async () => {
      mockDb.Farm.findAll.mockResolvedValue([]);
      mockDb.FarmHealthReport.count.mockResolvedValue(0);
      mockDb.FarmApplication.count.mockResolvedValue(0);
      mockDb.Farm.count.mockResolvedValue(0);
      mockDb.Farm.sum.mockResolvedValue(0);
      mockDb.FarmApplication.findAll.mockResolvedValue([]);
      mockDb.FarmHealthReport.findAll.mockResolvedValue([]);
      mockDb.AuditLog.create.mockResolvedValue({});

      const req = {
        session: { user: { id: 2, role: 'admin' } },
        query: { format: 'csv', period: 'mensual', reportType: 'applications' },
      };

      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await reportsPrivate(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        expect.stringContaining('attachment; filename='),
      );
      expect(res.send).toHaveBeenCalledTimes(1);
      expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 2,
          action: 'export',
          table_name: 'Reports',
        }),
      );
    });

    it('responde 500 con fallback seguro ante error de base de datos', async () => {
      mockDb.Farm.findAll.mockRejectedValue(new Error('DB failure'));

      const req = {
        session: { user: { id: 1, role: 'admin' } },
        query: {},
      };

      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await reportsPrivate(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith(
        'private/admin/reports',
        expect.objectContaining({
          errorMessage:
            'Ocurrió un error al cargar las estadísticas del sistema.',
          hasApplications: false,
        }),
      );
    });
  });
});
