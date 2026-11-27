import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  normalizeAuditQuery,
  buildAuditWhere,
  escapeLikePattern,
  resolveMatchingAuditCatalogValues,
  extractRoleAuditSummary,
  KNOWN_AUDIT_TABLES,
  KNOWN_AUDIT_ACTIONS,
  serializeAuditLog,
  generateAuditCsv,
} from '../../src/services/auditQueryService.js';
import { CROP_WORKFLOW_ACTIONS } from '../../src/services/cropWorkflowService.js';
import { PLAGUE_WORKFLOW_ACTIONS } from '../../src/services/plagueWorkflowService.js';
import { PRODUCT_WORKFLOW_ACTIONS } from '../../src/services/productWorkflowService.js';
import { INGREDIENT_WORKFLOW_ACTIONS } from '../../src/services/ingredientWorkflowService.js';

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
      notIn: Symbol('notIn'),
      gte: Symbol('gte'),
      lte: Symbol('lte'),
      like: Symbol('like'),
      or: Symbol('or'),
      and: Symbol('and'),
    },
    fn: jest.fn((name, arg) => ({ fn: name, arg })),
    col: jest.fn((name) => ({ col: name })),
    where: jest.fn((left, right) => ({ left, right })),
    literal: jest.fn((sql) => ({ val: sql })),
  },
  AuditLog: {
    count: jest.fn(),
    findAll: jest.fn(),
    findAndCountAll: jest.fn(),
  },
  User: {},
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { auditPrivate } =
  await import('../../src/controllers/private/auditController.js');
const { ROLE_AUDIT_ACTIONS } =
  await import('../../src/services/userRoleAuditService.js');

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

    it('construye cláusula WHERE de Sequelize resolviendo table_name, action y subconsulta de Users', () => {
      const mockOp = {
        in: Symbol('in'),
        notIn: Symbol('notIn'),
        like: Symbol('like'),
        or: Symbol('or'),
        and: Symbol('and'),
      };
      const mockSequelize = {
        Op: mockOp,
        literal: jest.fn((sql) => ({ val: sql })),
      };

      const whereMatching = buildAuditWhere(mockSequelize, {
        module: 'terrenos',
        action: 'crear',
        search: 'farm',
      });

      expect(whereMatching.table_name).toBeDefined();
      expect(whereMatching.action).toBeDefined();
      expect(whereMatching[mockOp.or]).toHaveLength(3);
      expect(whereMatching[mockOp.or][0].table_name[mockOp.in]).toEqual(
        expect.arrayContaining(['Farms', 'Farm', 'FarmCrops']),
      );
      expect(whereMatching[mockOp.or][1].action[mockOp.in]).toEqual(
        expect.arrayContaining(['create_farm_lot']),
      );

      const whereOnlyUser = buildAuditWhere(mockSequelize, {
        search: 'Norte',
      });
      expect(whereOnlyUser[mockOp.or]).toHaveLength(1);
      expect(whereOnlyUser[mockOp.or][0][mockOp.and]).toHaveLength(2);
    });

    it('escapa comodines %, _ y \\ en escapeLikePattern y en la subconsulta de Users', () => {
      expect(escapeLikePattern('100%_test\\path')).toBe(
        '100\\%\\_test\\\\path',
      );

      const { matchingTables, matchingActions } =
        resolveMatchingAuditCatalogValues('create_crop');
      expect(matchingTables).toEqual([]);
      expect(matchingActions).toContain('create_crop_cycle');

      const wildcardAttempt = resolveMatchingAuditCatalogValues('create%crop');
      expect(wildcardAttempt.matchingActions).toEqual([]);

      const mockOp = {
        in: Symbol('in'),
        notIn: Symbol('notIn'),
        or: Symbol('or'),
        and: Symbol('and'),
      };
      const literals = [];
      const mockSequelize = {
        Op: mockOp,
        literal: (sql) => {
          literals.push(sql);
          return { val: sql };
        },
      };

      buildAuditWhere(mockSequelize, { search: "100%_admin\\test's" });
      expect(literals.length).toBeGreaterThan(0);
      for (const sql of literals) {
        expect(sql).toContain("LIKE '%100\\%\\_admin\\\\test''s%' ESCAPE '\\'");
      }
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
      expect(serialized.hasJsonPayload).toBe(true);
      expect(serialized.newValuesJson).toContain('"Parcela San Pedro"');
    });

    it('filtra por rango de fechas ISO y descarta fechas inválidas', () => {
      const normalized = normalizeAuditQuery({
        dateFrom: '2026-01-10',
        dateTo: 'fecha-invalida',
      });
      expect(normalized.dateFrom).toBe('2026-01-10');
      expect(normalized.dateTo).toBe('');

      const opGte = Symbol('gte');
      const opLte = Symbol('lte');
      const where = buildAuditWhere(
        { Op: { gte: opGte, lte: opLte } },
        { dateFrom: '2026-01-10', dateTo: '2026-01-31' },
      );
      expect(where.createdAt[opGte]).toBeInstanceOf(Date);
      expect(where.createdAt[opLte]).toBeInstanceOf(Date);
    });

    it('genera archivo CSV con encabezados, UTF-8 BOM y mitigación de inyección de fórmulas', () => {
      const logs = [
        {
          id: 1,
          dates: { dateText: 'Hoy', timeText: '10:00' },
          user: { name: 'Juan Pérez', email: 'juan@test.com', role: 'ADMIN' },
          moduleLabel: 'Cultivos',
          actionText: 'Creó un nuevo registro',
          recordId: 100,
          detailsText: '=CMD|calc',
        },
      ];

      const csv = generateAuditCsv(logs);
      expect(csv.startsWith('\uFEFF')).toBe(true);
      expect(csv).toContain('"ID Auditoría","Fecha","Hora"');
      expect(csv).toContain('"Juan Pérez"');
      expect(csv).toContain('"Cultivos"');
      expect(csv).toContain('"\'=CMD|calc"');
    });

    it('serializa logs sin usuario (user = null) sin lanzar TypeError', () => {
      const nullUserLog = {
        id: 99,
        action: 'delete',
        table_name: 'Farms',
        record_id: 12,
        createdAt: new Date(),
        user: null,
      };

      const serialized = serializeAuditLog(nullUserLog);
      expect(serialized.user.name).toBe('Sistema');
      expect(serialized.user.role).toBe('SISTEMA');
      expect(serialized.user.email).toBe('N/A');

      const csv = generateAuditCsv([serialized]);
      expect(csv).toContain('"Sistema"');
    });

    it('cubre en KNOWN_AUDIT_TABLES y KNOWN_AUDIT_ACTIONS todos los valores reales emitidos en src/', () => {
      const srcRoot = path.resolve(process.cwd(), 'src');
      const skipDirs = new Set(['migrations', 'seeders', 'scripts', 'views']);
      const jsFiles = [];

      const walk = (dir) => {
        for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
          if (entry.isDirectory()) {
            if (!skipDirs.has(entry.name)) {
              walk(path.join(dir, entry.name));
            }
          } else if (entry.name.endsWith('.js')) {
            jsFiles.push(path.join(dir, entry.name));
          }
        }
      };
      walk(srcRoot);

      const discoveredTables = new Set();
      const discoveredActions = new Set();

      const auditCallPattern =
        /(?:AuditLog\.create|recordUserAudit|recordUserRoleAudit|recordRbacAudit|recordSupplierAudit|recordIngredientAudit|createLandAudit|recordSafeAuditLog|changeFarmStatus)\s*\(\s*\{([\s\S]*?)\}\s*(?:,|\))/g;

      for (const filePath of jsFiles) {
        const content = fs.readFileSync(filePath, 'utf8');
        let match;
        while ((match = auditCallPattern.exec(content)) !== null) {
          const block = match[1];
          const tableMatch = block.match(
            /\b(?:table_name|tableName)\s*:\s*['"]([^'"]+)['"]/,
          );
          if (tableMatch) {
            discoveredTables.add(tableMatch[1]);
          }
          const actionMatch = block.match(/\baction\s*:\s*['"]([^'"]+)['"]/);
          if (actionMatch) {
            discoveredActions.add(actionMatch[1]);
          }
        }
      }

      // Acciones dinámicas de los flujos editoriales prefijados y gobernanza de roles
      for (const action of Object.values(ROLE_AUDIT_ACTIONS)) {
        discoveredActions.add(action);
      }
      for (const action of Object.values(CROP_WORKFLOW_ACTIONS)) {
        discoveredActions.add(`crop.${action}`);
      }
      for (const action of Object.values(PLAGUE_WORKFLOW_ACTIONS)) {
        discoveredActions.add(`plague.${action}`);
      }
      for (const action of Object.values(PRODUCT_WORKFLOW_ACTIONS)) {
        discoveredActions.add(`product.${action}`);
      }
      for (const action of Object.values(INGREDIENT_WORKFLOW_ACTIONS)) {
        discoveredActions.add(`workflow.${action}`);
      }

      expect(discoveredTables.size).toBeGreaterThanOrEqual(8);
      expect(discoveredActions.size).toBeGreaterThanOrEqual(20);

      const missingTables = [...discoveredTables].filter(
        (t) => !KNOWN_AUDIT_TABLES.includes(t),
      );
      const missingActions = [...discoveredActions].filter(
        (a) => !KNOWN_AUDIT_ACTIONS.includes(a),
      );

      expect(missingTables).toEqual([]);
      expect(missingActions).toEqual([]);
    });

    it('soporta filtro action=roles, módulo usuarios incluyendo RBAC/RbacRoles y búsqueda por usuario objetivo', () => {
      const normalized = normalizeAuditQuery({
        module: 'usuarios',
        action: 'roles',
        search: 'roberto@inifap.mx',
      });
      expect(normalized.module).toBe('usuarios');
      expect(normalized.action).toBe('roles');

      const mockOp = {
        in: Symbol('in'),
        notIn: Symbol('notIn'),
        or: Symbol('or'),
        and: Symbol('and'),
      };
      const mockSequelize = {
        Op: mockOp,
        literal: jest.fn((sql) => ({ val: sql })),
      };

      const where = buildAuditWhere(mockSequelize, normalized);
      expect(where.table_name[mockOp.in]).toEqual(
        expect.arrayContaining(['Users', 'InifapCodes', 'RBAC', 'RbacRoles']),
      );
      expect(where.action[mockOp.in]).toEqual(
        expect.arrayContaining([
          'update_user_role',
          'update_user_permissions',
          'upgrade_role',
          'create_role',
          'update_role',
          'delete_role',
          'generate_codes',
          'revoke_code',
        ]),
      );

      // La condición de usuario cubre tanto actor (user_id) como objetivo (table_name IN ['Users', 'RBAC'] + record_id)
      const userAndGroup = where[mockOp.or][0][mockOp.and];
      expect(userAndGroup).toHaveLength(2);
      const actorOrTargetBranches = userAndGroup[1][mockOp.or];
      expect(actorOrTargetBranches).toHaveLength(2);
      expect(actorOrTargetBranches[0]).toHaveProperty('user_id');
      expect(actorOrTargetBranches[1].table_name[mockOp.in]).toEqual([
        'Users',
        'RBAC',
      ]);
      expect(actorOrTargetBranches[1]).toHaveProperty('record_id');
    });

    it('serializa resúmenes estructurados de cambios de rol (update_user_role, update_user_permissions, upgrade_role, legacy) y los exporta a CSV', () => {
      const downgradeLog = serializeAuditLog({
        id: 501,
        action: 'update_user_role',
        table_name: 'Users',
        record_id: 42,
        createdAt: new Date('2026-11-27T10:00:00Z'),
        user: {
          id: 1,
          full_name: 'Admin General',
          email: 'admin@inifap.mx',
          role: 'admin',
        },
        old_values: {
          target_user_id: 42,
          full_name: 'Dr. Roberto Mendoza',
          email: 'roberto@inifap.mx',
          role: 'inifap',
          rbac_role_id: 2,
          rbac_role_name: 'Curador de Insumos',
        },
        new_values: {
          target_user_id: 42,
          full_name: 'Dr. Roberto Mendoza',
          email: 'roberto@inifap.mx',
          role: 'agricultor',
          rbac_role_id: null,
          rbac_role_name: null,
          permissions_added: [],
          permissions_removed: ['crops.publish', 'ingredients.manage'],
          subrole_auto_revoked: true,
          custom_permissions_cleared: true,
        },
      });

      expect(downgradeLog.actionLabel).toBe('Cambio de Rol');
      expect(downgradeLog.roleChange).toEqual(
        expect.objectContaining({
          targetName: 'Dr. Roberto Mendoza',
          targetEmail: 'roberto@inifap.mx',
          oldRoleLabel: 'Personal INIFAP',
          newRoleLabel: 'Productor Agrícola',
          oldSubRole: 'Curador de Insumos',
          newSubRole: 'Ninguno',
          subroleAutoRevoked: true,
          customPermissionsCleared: true,
        }),
      );
      expect(downgradeLog.roleChange.permissionsRemovedLabels).toEqual([
        'Publicar cultivos en portal',
        'Gestionar ingredientes (CRUD)',
      ]);
      expect(downgradeLog.detailsText).toContain('Dr. Roberto Mendoza');
      expect(downgradeLog.detailsText).toContain(
        'Personal INIFAP → Productor Agrícola',
      );
      expect(downgradeLog.detailsText).toContain(
        'Curador de Insumos → Ninguno',
      );
      expect(downgradeLog.detailsText).toContain('retiro automático');

      const upgradeLog = serializeAuditLog({
        id: 502,
        action: 'upgrade_role',
        table_name: 'Users',
        record_id: 55,
        createdAt: new Date('2026-11-27T11:00:00Z'),
        user: {
          id: 55,
          full_name: 'Ana Campo',
          email: 'ana@campo.mx',
          role: 'inifap',
        },
        old_values: {
          target_user_id: 55,
          full_name: 'Ana Campo',
          email: 'ana@campo.mx',
          role: 'agricultor',
          rbac_role_id: null,
        },
        new_values: {
          target_user_id: 55,
          full_name: 'Ana Campo',
          email: 'ana@campo.mx',
          role: 'inifap',
          rbac_role_id: 3,
          rbac_role_name: 'Auditor Fitosanitario',
          permissions_added: ['audit.view'],
          permissions_removed: [],
          inifap_code_masked: 'AGS-1234-****-****-WXYZ',
        },
      });
      expect(upgradeLog.actionLabel).toBe('Ascenso INIFAP');
      expect(upgradeLog.detailsText).toContain('AGS-1234-****-****-WXYZ');

      // Log legacy sin rbac_role_name, sin email y con old_values = null
      const legacySummary = extractRoleAuditSummary({
        id: 503,
        action: 'update_user_permissions',
        table_name: 'RBAC',
        record_id: 88,
        old_values: null,
        new_values: {
          role: 'inifap',
          status: 'activo',
          rbac_role_id: 7,
        },
      });
      expect(legacySummary).toEqual(
        expect.objectContaining({
          targetUserId: 88,
          targetName: 'Usuario #88',
          targetEmail: null,
          oldRoleLabel: 'Sin registro',
          newRoleLabel: 'Personal INIFAP',
          oldSubRole: 'Ninguno',
          newSubRole: 'Sub-rol #7',
        }),
      );

      const csv = generateAuditCsv([downgradeLog, upgradeLog]);
      expect(csv).toContain('Personal INIFAP → Productor Agrícola');
      expect(csv).toContain('AGS-1234-****-****-WXYZ');
    });
  });

  describe('controlador auditPrivate', () => {
    beforeEach(() => {
      jest.clearAllMocks();
      mockDb.AuditLog.count.mockResolvedValueOnce(15).mockResolvedValueOnce(1);
      mockDb.AuditLog.findAll.mockResolvedValue([mockLog]);
    });

    it('renderiza la vista de auditoría separando count sin include/distinct y findAll', async () => {
      const req = { query: {} };
      const res = {
        render: jest.fn(),
        status: jest.fn().mockReturnThis(),
      };

      await auditPrivate(req, res);

      expect(mockDb.AuditLog.findAndCountAll).not.toHaveBeenCalled();
      expect(mockDb.AuditLog.count).toHaveBeenCalledTimes(2);
      const totalCountArgs = mockDb.AuditLog.count.mock.calls[1][0];
      expect(totalCountArgs.include).toBeUndefined();
      expect(totalCountArgs.distinct).toBeUndefined();

      expect(mockDb.AuditLog.findAll).toHaveBeenCalledTimes(1);
      const findAllArgs = mockDb.AuditLog.findAll.mock.calls[0][0];
      expect(findAllArgs.include).toHaveLength(1);
      expect(findAllArgs.distinct).toBeUndefined();

      expect(res.render).toHaveBeenCalledWith(
        'private/admin/audit',
        expect.objectContaining({
          activePage: 'audit',
          pageTitle: 'Auditoría',
          todayActionsCount: 15,
          totalCount: 1,
          auditLogs: expect.any(Array),
          showViewToggle: true,
          searchFilters: expect.arrayContaining([
            expect.objectContaining({
              id: 'filter-module',
              options: expect.arrayContaining([
                expect.objectContaining({
                  value: 'usuarios',
                  text: 'Usuarios y RBAC',
                }),
              ]),
            }),
            expect.objectContaining({
              id: 'filter-action',
              options: expect.arrayContaining([
                expect.objectContaining({
                  value: 'roles',
                  text: 'Roles y Permisos (RBAC)',
                }),
              ]),
            }),
          ]),
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
      mockDb.AuditLog.findAll.mockRejectedValueOnce(
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
