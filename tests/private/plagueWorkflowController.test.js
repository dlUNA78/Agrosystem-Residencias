import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const transaction = {
  LOCK: { UPDATE: 'UPDATE' },
  commit: jest.fn(),
  rollback: jest.fn(),
};

const plague = {
  id: 9,
  workflow_status: 'verified',
  toJSON: jest.fn(() => ({ id: 9, workflow_status: 'verified' })),
  update: jest.fn(),
};

const mockDb = {
  sequelize: { transaction: jest.fn(async () => transaction) },
  Sequelize: { Op: {} },
  Plague: { findByPk: jest.fn(async () => plague) },
  PlagueImage: { create: jest.fn(), destroy: jest.fn() },
  Product: {},
  ProductImage: {},
  Region: {},
  Crop: {},
  AuditLog: { create: jest.fn() },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const { updatePlagueWorkflow } =
  await import('../../src/controllers/private/plagueController.js');

describe('controlador del workflow de plagas', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    plague.workflow_status = 'verified';
    plague.created_by_user_id = null;
    plague.toJSON.mockReturnValue({ id: 9, workflow_status: 'verified' });
    mockDb.Plague.findByPk.mockResolvedValue(plague);
  });

  it('publica dentro de una transacción y registra la auditoría', async () => {
    const req = {
      params: { id: '9' },
      body: { action: 'publish' },
      user: { id: 1, role: 'admin', full_name: 'Administradora' },
    };
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await updatePlagueWorkflow(req, res);

    expect(plague.update).toHaveBeenCalledWith(
      expect.objectContaining({
        workflow_status: 'published',
        published_by_user_id: 1,
        status: true,
      }),
      { transaction },
    );
    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'plague.publish',
        table_name: 'Plagues',
        record_id: 9,
        user_id: 1,
      }),
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(res.redirect).toHaveBeenCalledWith('/private/plagues/9');
  });

  it('revierte y responde 409 cuando la transición no es válida', async () => {
    plague.workflow_status = 'draft';
    plague.toJSON.mockReturnValue({ id: 9, workflow_status: 'draft' });
    const req = {
      params: { id: '9' },
      body: { action: 'publish' },
      user: { id: 1, role: 'admin' },
    };
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await updatePlagueWorkflow(req, res);

    expect(plague.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(res.status).toHaveBeenCalledWith(409);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('impide que el autor INIFAP verifique su propia ficha', async () => {
    plague.workflow_status = 'in_review';
    plague.created_by_user_id = 12;
    plague.toJSON.mockReturnValue({
      id: 9,
      workflow_status: 'in_review',
      created_by_user_id: 12,
    });
    const req = {
      params: { id: '9' },
      body: { action: 'verify' },
      user: { id: 12, role: 'inifap' },
    };
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    await updatePlagueWorkflow(req, res);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(plague.update).not.toHaveBeenCalled();
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
  });
});
