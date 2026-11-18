import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import {
  validateIngredientPayload,
  VALID_ACTION_TYPES,
  VALID_TOXICITY_CATEGORIES,
} from '../../src/services/ingredientValidationService.js';
import {
  normalizeIngredientQuery,
  buildIngredientWhere,
  serializeIngredient,
} from '../../src/services/ingredientQueryService.js';

const mockTransaction = {
  commit: jest.fn(async () => {}),
  rollback: jest.fn(async () => {}),
  LOCK: { UPDATE: 'UPDATE' },
};

const mockIngredientInstance = {
  id: 1,
  name: 'Glifosato',
  chemical_group: 'Glicinas',
  action_type: 'herbicida',
  toxicological_category: 'clase-iii',
  workflow_status: 'published',
  archive_requested_by_user_id: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  toJSON: () => ({
    id: 1,
    name: 'Glifosato',
    chemical_group: 'Glicinas',
    action_type: 'herbicida',
    toxicological_category: 'clase-iii',
    workflow_status: 'published',
  }),
  update: jest.fn(async function (data) {
    Object.assign(this, data);
    return this;
  }),
  destroy: jest.fn(async () => true),
};

const mockDb = {
  Sequelize: {
    Op: {
      like: Symbol('like'),
      or: Symbol('or'),
    },
    fn: jest.fn((name, arg) => ({ fn: name, arg })),
    col: jest.fn((name) => ({ col: name })),
    where: jest.fn((left, right) => ({ left, right })),
  },
  ActiveIngredient: {
    findAndCountAll: jest.fn(async () => ({
      count: 1,
      rows: [mockIngredientInstance],
    })),
    findByPk: jest.fn(async (id) =>
      Number(id) === 1 ? mockIngredientInstance : null,
    ),
    create: jest.fn(async (data) => ({
      id: 2,
      ...data,
    })),
  },
  AuditLog: {
    create: jest.fn(async () => ({ id: 99 })),
  },
  sequelize: {
    transaction: jest.fn(async () => mockTransaction),
  },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const {
  createIngredient,
  updateIngredient,
  deleteIngredient,
  updateIngredientWorkflow,
} = await import('../../src/controllers/private/ingredientsController.js');

describe('módulo de persistencia y validación de ingredientes activos', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('ingredientValidationService', () => {
    it('valida exitosamente un payload completo y válido', () => {
      const result = validateIngredientPayload({
        name: ' Clorpirifós ',
        chemical_group: 'Organofosforados',
        action_type: 'INSECTICIDA',
        toxicological_category: 'CLASE-II',
      });

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.sanitized.name).toBe('Clorpirifós');
      expect(result.sanitized.action_type).toBe('insecticida');
      expect(result.sanitized.toxicological_category).toBe('clase-ii');
    });

    it('rechaza nombres vacíos o menores a 2 caracteres', () => {
      const empty = validateIngredientPayload({ name: ' ' });
      expect(empty.isValid).toBe(false);
      expect(empty.errors[0]).toContain('al menos 2 caracteres');

      const short = validateIngredientPayload({ name: 'A' });
      expect(short.isValid).toBe(false);
    });

    it('rechaza tipos de acción no permitidos', () => {
      const invalidAction = validateIngredientPayload({
        name: 'Compuesto X',
        action_type: 'fertilizante',
      });
      expect(invalidAction.isValid).toBe(false);
      expect(invalidAction.errors[0]).toContain('Tipo de acción no válido');
    });

    it('rechaza categorías toxicológicas inválidas', () => {
      const invalidToxicity = validateIngredientPayload({
        name: 'Compuesto Y',
        action_type: 'fungicida',
        toxicological_category: 'muy_peligroso',
      });
      expect(invalidToxicity.isValid).toBe(false);
      expect(invalidToxicity.errors[0]).toContain('Categoría toxicológica OMS');
    });

    it('exporta listas congeladas de tipos y toxicidades', () => {
      expect(VALID_ACTION_TYPES).toContain('herbicida');
      expect(VALID_TOXICITY_CATEGORIES).toContain('clase-i');
    });
  });

  describe('ingredientQueryService', () => {
    it('normaliza parámetros de consulta por defecto y con valores extremos', () => {
      const normalized = normalizeIngredientQuery({
        page: '3',
        limit: '200',
        search: '  Glifo  ',
        tipo: ' Herbicida ',
        toxicidad: ' Clase-III ',
      });

      expect(normalized.page).toBe(3);
      expect(normalized.limit).toBe(100);
      expect(normalized.search).toBe('Glifo');
      expect(normalized.tipo).toBe('herbicida');
      expect(normalized.toxicidad).toBe('clase-iii');
    });

    it('construye cláusula WHERE de Sequelize con búsqueda por nombre y grupo', () => {
      const where = buildIngredientWhere(mockDb.Sequelize, {
        search: 'organo',
        tipo: 'insecticida',
        toxicidad: 'clase-ii',
      });

      expect(where.action_type).toBeDefined();
      expect(where.toxicological_category).toBe('clase-ii');
      expect(where[mockDb.Sequelize.Op.or]).toHaveLength(2);
    });

    it('serializa un ingrediente con etiqueta legible de toxicidad', () => {
      const serialized = serializeIngredient(mockIngredientInstance);
      expect(serialized.name).toBe('Glifosato');
      expect(serialized.toxicityLabel).toContain('Clase III — Moderadamente');
    });
  });

  describe('controladores de mutación (create, update, delete)', () => {
    it('createIngredient crea el registro en transacción y guarda auditoría', async () => {
      const req = {
        body: {
          name: 'Mancozeb',
          chemical_group: 'Ditiocarbamatos',
          action_type: 'fungicida',
          toxicological_category: 'clase-iv',
        },
        user: { id: 7, role: 'admin' },
      };
      const res = { redirect: jest.fn() };

      await createIngredient(req, res);

      expect(mockDb.sequelize.transaction).toHaveBeenCalledTimes(1);
      expect(mockDb.ActiveIngredient.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Mancozeb', action_type: 'fungicida' }),
        expect.objectContaining({ transaction: mockTransaction }),
      );
      expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'create',
          table_name: 'ActiveIngredients',
          user_id: 7,
        }),
        expect.objectContaining({ transaction: mockTransaction }),
      );
      expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledWith(
        '/private/ingredients?success=creado',
      );
    });

    it('createIngredient redirige con error ante payload inválido sin abrir transacción', async () => {
      const req = {
        body: { name: 'A' },
      };
      const res = { redirect: jest.fn() };

      await createIngredient(req, res);

      expect(mockDb.sequelize.transaction).not.toHaveBeenCalled();
      expect(res.redirect).toHaveBeenCalledWith(
        expect.stringContaining('/private/ingredients?error='),
      );
    });

    it('updateIngredient actualiza un registro existente y audita la acción', async () => {
      const req = {
        params: { id: '1' },
        body: {
          name: 'Glifosato Concentrado',
          action_type: 'herbicida',
        },
        user: { id: 3, role: 'admin' },
      };
      const res = { redirect: jest.fn() };

      await updateIngredient(req, res);

      expect(mockDb.ActiveIngredient.findByPk).toHaveBeenCalledWith('1');
      expect(mockIngredientInstance.update).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Glifosato Concentrado' }),
        expect.objectContaining({ transaction: mockTransaction }),
      );
      expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          table_name: 'ActiveIngredients',
          record_id: 1,
        }),
        expect.objectContaining({ transaction: mockTransaction }),
      );
      expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledWith(
        '/private/ingredients?success=actualizado',
      );
    });

    it('updateIngredient redirige con error cuando el ingrediente no existe', async () => {
      const req = {
        params: { id: '999' },
        body: { name: 'Valido', action_type: 'herbicida' },
      };
      const res = { redirect: jest.fn() };

      await updateIngredient(req, res);

      expect(res.redirect).toHaveBeenCalledWith(
        '/private/ingredients?error=no_encontrado',
      );
    });

    it('deleteIngredient elimina el ingrediente y registra en auditoría', async () => {
      const req = {
        params: { id: '1' },
        user: { id: 1, role: 'admin' },
      };
      const res = { redirect: jest.fn() };

      await deleteIngredient(req, res);

      expect(mockIngredientInstance.destroy).toHaveBeenCalledWith({
        transaction: mockTransaction,
      });
      expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'delete',
          table_name: 'ActiveIngredients',
          record_id: '1',
        }),
        expect.objectContaining({ transaction: mockTransaction }),
      );
      expect(mockTransaction.commit).toHaveBeenCalledTimes(1);
      expect(res.redirect).toHaveBeenCalledWith(
        '/private/ingredients?success=eliminado',
      );
    });

    it('createIngredient responde con JSON 201 cuando proviene de petición asíncrona fetch', async () => {
      const req = {
        headers: { 'x-requested-with': 'fetch' },
        body: {
          name: 'Azoxistrobina',
          chemical_group: 'Estrobilurinas',
          action_type: 'fungicida',
          toxicological_category: 'clase-iv',
        },
        user: { id: 7, role: 'admin' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        redirect: jest.fn(),
      };

      await createIngredient(req, res);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true }),
      );
      expect(res.redirect).not.toHaveBeenCalled();
    });

    it('updateIngredientWorkflow procesa solicitud de baja con justificación válida', async () => {
      mockIngredientInstance.workflow_status = 'published';
      mockIngredientInstance.archive_requested_by_user_id = null;
      const req = {
        params: { id: '1' },
        headers: { 'x-requested-with': 'fetch' },
        body: {
          action: 'request_archive',
          archive_reason:
            'Justificación técnica con más de 20 caracteres requeridos.',
          archive_reason_category: 'toxicologico',
        },
        user: { id: 10, role: 'inifap' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        redirect: jest.fn(),
      };

      await updateIngredientWorkflow(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
      expect(mockIngredientInstance.workflow_status).toBe('archive_pending');
      expect(mockIngredientInstance.archive_requested_by_user_id).toBe(10);
      expect(mockTransaction.commit).toHaveBeenCalled();
    });

    it('updateIngredientWorkflow rechaza aprobación de baja si el usuario es el mismo solicitante (4 ojos)', async () => {
      mockIngredientInstance.workflow_status = 'archive_pending';
      mockIngredientInstance.archive_requested_by_user_id = 10;
      const req = {
        params: { id: '1' },
        headers: { 'x-requested-with': 'fetch' },
        body: {
          action: 'approve_archive',
          review_notes: 'Intento de autoaprobación de baja.',
        },
        user: { id: 10, role: 'admin' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        redirect: jest.fn(),
      };

      await updateIngredientWorkflow(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: expect.stringMatching(/distinto al solicitante/i),
        }),
      );
      expect(mockTransaction.rollback).toHaveBeenCalled();
    });

    it('updateIngredientWorkflow permite aprobar la baja por un usuario diferente', async () => {
      mockIngredientInstance.workflow_status = 'archive_pending';
      mockIngredientInstance.archive_requested_by_user_id = 10;
      const req = {
        params: { id: '1' },
        headers: { 'x-requested-with': 'fetch' },
        body: {
          action: 'approve_archive',
          review_notes:
            'Aprobación colegiada confirmada por segundo especialista.',
        },
        user: { id: 25, role: 'admin' },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
        redirect: jest.fn(),
      };

      await updateIngredientWorkflow(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
        }),
      );
      expect(mockIngredientInstance.workflow_status).toBe('archived');
      expect(mockIngredientInstance.archived_by_user_id).toBe(25);
    });
  });
});
