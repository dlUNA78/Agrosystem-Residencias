import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  normalizeAuditQuery,
  buildAuditWhere,
  serializeAuditLog,
  generateAuditCsv,
} from '../../src/services/auditQueryService.js';

const mockLog = {
  id: 1,
  action: 'create',
  table_name: 'Farms',
  record_id: 1,
  createdAt: new Date(),
  toJSON: () => ({
    id: 1,
    action: 'create',
    table_name: 'Farms',
    record_id: 1,
    createdAt: new Date(),
    user: { full_name: 'Admin Agro', role: 'admin' },
  }),
};

const mockDb = {
  Sequelize: {
    Op: {
      in: Symbol('in'),
      gte: Symbol('gte'),
      like: Symbol('like'),
      or: Symbol('or'),
    },
    fn: jest.fn((name, arg) => ({ fn: name, arg })),
    col: jest.fn((name) => ({ col: name })),
    where: jest.fn((left, right) => ({ left, right })),
  },
  AuditLog: {
    count: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  User: {},
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { auditPrivate } =
  await import('../../src/controllers/private/auditController.js');

describe('módulo privado de auditoría', () => {
  describe('auditQueryService', () => {
    it('normaliza parámetros de consulta por defecto y valores inválidos', () => {
      const empty = normalizeAuditQuery({});
      expect(empty.page).toBe(1);
      expect(empty.limit).toBe(15);
      expect(empty.module).toBe('');
      expect(empty.action).toBe('');
      expect(empty.format).toBe('');

      const invalid = normalizeAuditQuery({
        page: -5,
        limit: 500,
        module: 'modulo_falso',
        action: 'hack',
        format: 'json',
      });
      expect(invalid.page).toBe(1);
      expect(invalid.limit).toBe(100);
      expect(invalid.module).toBe('');
      expect(invalid.action).toBe('');
      expect(invalid.format).toBe('');
    });

    it('acepta módulos y acciones válidos con formato CSV', () => {
      const valid = normalizeAuditQuery({
        page: '2',
        limit: '20',
        module: 'plagas',
        action: 'crear',
        search: 'Gusano',
        format: 'csv',
      });
      expect(valid.page).toBe(2);
      expect(valid.limit).toBe(20);
      expect(valid.module).toBe('plagas');
      expect(valid.action).toBe('crear');
      expect(valid.search).toBe('Gusano');
      expect(valid.format).toBe('csv');
    });

    it('construye cláusula WHERE de Sequelize filtrando por tablas del módulo y grupo de acción', () => {
      const mockOp = {
        in: Symbol('in'),
        like: Symbol('like'),
        or: Symbol('or'),
      };
      const mockSequelize = {
        Op: mockOp,
        fn: jest.fn((name, arg) => ({ fn: name, arg })),
        col: jest.fn((name) => ({ col: name })),
        where: jest.fn((left, right) => ({ left, right })),
      };

      const where = buildAuditWhere(mockSequelize, {
        module: 'terrenos',
        action: 'crear',
        search: 'Norte',
      });

      expect(where.table_name).toBeDefined();
      expect(where.action).toBeDefined();
      expect(where[mockOp.or]).toHaveLength(4);
    });

    it('serializa un registro de auditoría con insignias, iniciales y fechas legibles', () => {
      const rawLog = {
        id: 42,
        action: 'create',
        table_name: 'Farms',
        record_id: 10,
        createdAt: new Date('2026-10-01T10:30:00Z'),
        user: {
          id: 5,
          full_name: 'Marcos Ramírez',
          email: 'm.ramirez@inifap.gob.mx',
          role: 'admin',
        },
        new_values: { name: 'Parcela San Pedro', size_hectares: 12.5 },
      };

      const serialized = serializeAuditLog(rawLog);

      expect(serialized.id).toBe(42);
      expect(serialized.moduleLabel).toBe('Terrenos');
      expect(serialized.actionLabel).toBe('Creación');
      expect(serialized.user.name).toBe('Marcos Ramírez');
      expect(serialized.user.initials).toBe('MR');
      expect(serialized.user.role).toBe('ADMIN');
      expect(serialized.detailsText).toContain('Parcela San Pedro');
    });

    it('genera archivo CSV con encabezados y caracteres UTF-8 escapados', () => {
      const logs = [
        {
          id: 1,
          dates: { dateText: 'Hoy', timeText: '10:00' },
          user: { name: 'Juan Pérez', email: 'juan@test.com', role: 'ADMIN' },
          moduleLabel: 'Cultivos',
          actionText: 'Creó un nuevo registro',
          recordId: 100,
          detailsText: 'Maíz Blanco',
        },
      ];

      const csv = generateAuditCsv(logs);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('"ID Auditoría","Fecha","Hora"');
      expect(csv).toContain('"Juan Pérez"');
      expect(csv).toContain('"Cultivos"');
    });
  });

  describe('controlador auditPrivate', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockDb.AuditLog.count.mockResolvedValue(15);
      mockDb.AuditLog.findAndCountAll.mockResolvedValue({
        count: 1,
        rows: [mockLog],
      });
    });

    it('renderiza la vista de auditoría con datos consultados desde la base de datos', async () => {
      const req = { query: {} };
      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await auditPrivate(req, res);

      expect(mockDb.AuditLog.findAndCountAll).toHaveBeenCalledTimes(1);
      expect(res.render).toHaveBeenCalledWith(
        'private/admin/audit',
        expect.objectContaining({
          activePage: 'audit',
          pageTitle: 'Auditoría',
          todayActionsCount: 15,
          totalCount: 1,
          auditLogs: expect.any(Array),
          showViewToggle: true,
        }),
      );
    });

    it('responde con archivo CSV cuando el parámetro format=csv está presente', async () => {
      const req = { query: { format: 'csv' } };
      const res = {
        setHeader: jest.fn(),
        send: jest.fn(),
      };

      await auditPrivate(req, res);

      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Type',
        'text/csv; charset=utf-8',
      );
      expect(res.send).toHaveBeenCalledWith(
        expect.stringContaining('\uFEFF"ID Auditoría"'),
      );
    });

    it('maneja errores internos de base de datos respondiendo 500 y vista degradada', async () => {
      mockDb.AuditLog.findAndCountAll.mockRejectedValueOnce(
        new Error('DB connection failed'),
      );

      const req = { query: {} };
      const res = {
        status: jest.fn().mockReturnThis(),
        render: jest.fn(),
      };

      await auditPrivate(req, res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.render).toHaveBeenCalledWith(
        'private/admin/audit',
        expect.objectContaining({
          error: expect.stringContaining('Ocurrió un error'),
          auditLogs: [],
        }),
      );
    });
  });
});
