import { afterAll, afterEach, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import app, { closeAppResources } from '../../app.js';
import { authController } from '../../src/controllers/authController.js';
import db from '../../src/models/index.js';
import {
  computeCodeHash,
  generateSingleCodeString,
  maskCodeString,
} from '../../src/services/inifapCodeService.js';

const { InifapCode, Notification, RbacRole, Sequelize, User, sequelize } = db;
const { Op } = Sequelize;

afterAll(closeAppResources);

const createTestUser = async ({ role, rbacRoleId = null, suffix }) => {
  const password = 'TestPassword123!';
  const password_hash = await bcrypt.hash(password, 10);
  const user = await User.create({
    full_name: `Usuario Upgrade ${role}`,
    email: `upgrade_${role}_${suffix}@agrosystem.test`,
    password_hash,
    role,
    status: 'activo',
    rbac_role_id: rbacRoleId,
  });
  return { user, password };
};

const createUnusedCode = async ({ rbacRoleId = null, note = 'Test guard' }) => {
  const rawCode = generateSingleCodeString();
  const record = await InifapCode.create({
    code: rawCode,
    code_hash: computeCodeHash(rawCode),
    code_masked: maskCodeString(rawCode),
    is_used: false,
    rbac_role_id: rbacRoleId,
    note,
  });
  return { record, rawCode };
};

const loginAs = async (email, password) => {
  const agent = request.agent(app);
  const loginRes = await agent.post('/auth/login').send({ email, password });
  expect(loginRes.status).toBe(302);
  expect(loginRes.headers.location).toBe('/');
  return agent;
};

const cleanupUpgradeFixtures = async ({
  userIds = [],
  codeIds = [],
  roleIds = [],
}) => {
  if (userIds.length > 0) {
    await Notification.destroy({
      where: {
        [Op.or]: [
          { user_id: { [Op.in]: userIds } },
          { actor_id: { [Op.in]: userIds } },
        ],
      },
    });
  }
  if (codeIds.length > 0) {
    await InifapCode.destroy({ where: { id: { [Op.in]: codeIds } } });
  }
  if (userIds.length > 0) {
    await User.destroy({ where: { id: { [Op.in]: userIds } } });
  }
  if (roleIds.length > 0) {
    await RbacRole.destroy({ where: { id: { [Op.in]: roleIds } } });
  }
};

describe('processUpgrade (unit)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('delega a Express un error al restablecer la sesión autenticada', async () => {
    const loginError = new Error('No fue posible restaurar la sesión');
    const inifapCode = {
      code: 'CODIGO-VALIDO',
      burn: jest.fn().mockResolvedValue(undefined),
    };
    jest.spyOn(InifapCode, 'findAvailable').mockResolvedValue(inifapCode);
    jest
      .spyOn(sequelize, 'transaction')
      .mockImplementation(async (callback) => callback({ id: 'tx' }));
    jest.spyOn(Notification, 'create').mockResolvedValue({});
    jest.spyOn(User, 'findAll').mockResolvedValue([]);

    const req = {
      body: {
        job_title: 'Investigador',
        secret_code: 'CODIGO-VALIDO',
      },
      logIn: jest.fn((_user, callback) => callback(loginError)),
      session: {
        regenerate: jest.fn((callback) => callback()),
      },
      user: {
        id: 17,
        role: 'agricultor',
        save: jest.fn().mockResolvedValue(undefined),
      },
    };
    const res = {
      redirect: jest.fn(),
      render: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await authController.processUpgrade(req, res, next);

    expect(next).toHaveBeenCalledWith(loginError);
    expect(res.redirect).not.toHaveBeenCalled();
  });

  it('rechaza con 403 a un admin antes de buscar o quemar el código INIFAP', async () => {
    const codeStub = {
      code: 'AGS-AAAA-BBBB-CCCC-DDDD',
      burn: jest.fn(),
    };
    const findAvailableSpy = jest
      .spyOn(InifapCode, 'findAvailable')
      .mockResolvedValue(codeStub);
    const transactionSpy = jest
      .spyOn(sequelize, 'transaction')
      .mockImplementation(async (callback) => callback({ id: 'tx' }));

    const adminUser = {
      id: 1,
      role: 'admin',
      rbac_role_id: null,
      save: jest.fn(),
    };
    const htmlReq = {
      path: '/auth/inifap-upgrade',
      originalUrl: '/auth/inifap-upgrade',
      headers: { accept: 'text/html' },
      body: { secret_code: 'AGS-AAAA-BBBB-CCCC-DDDD', job_title: 'Director' },
      user: adminUser,
    };
    const htmlRes = {
      status: jest.fn().mockReturnThis(),
      render: jest.fn(),
      send: jest.fn(),
      json: jest.fn(),
      redirect: jest.fn(),
    };
    const next = jest.fn();

    await authController.processUpgrade(htmlReq, htmlRes, next);

    expect(htmlRes.status).toHaveBeenCalledWith(403);
    expect(htmlRes.render).toHaveBeenCalledWith(
      'errors/403',
      expect.objectContaining({
        pageTitle: 'Acceso Denegado (403)',
      }),
    );
    expect(adminUser.role).toBe('admin');
    expect(adminUser.save).not.toHaveBeenCalled();
    expect(codeStub.burn).not.toHaveBeenCalled();
    expect(findAvailableSpy).not.toHaveBeenCalled();
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();

    const jsonReq = {
      path: '/auth/inifap-upgrade',
      originalUrl: '/auth/inifap-upgrade',
      headers: { accept: 'application/json' },
      body: { secret_code: 'AGS-AAAA-BBBB-CCCC-DDDD' },
      user: adminUser,
    };
    const jsonRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      redirect: jest.fn(),
    };

    await authController.processUpgrade(jsonReq, jsonRes, next);

    expect(jsonRes.status).toHaveBeenCalledWith(403);
    expect(jsonRes.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'Forbidden',
        message: expect.any(String),
      }),
    );
    expect(codeStub.burn).not.toHaveBeenCalled();
    expect(findAvailableSpy).not.toHaveBeenCalled();
    expect(transactionSpy).not.toHaveBeenCalled();
  });

  it('rechaza con 403 a un usuario inifap existente sin modificar rol, sub-rol ni quemar código', async () => {
    const codeStub = {
      code: 'AGS-EEEE-FFFF-GGGG-HHHH',
      rbac_role_id: 99,
      burn: jest.fn(),
    };
    const findAvailableSpy = jest
      .spyOn(InifapCode, 'findAvailable')
      .mockResolvedValue(codeStub);
    const transactionSpy = jest
      .spyOn(sequelize, 'transaction')
      .mockImplementation(async (callback) => callback({ id: 'tx' }));

    const inifapUser = {
      id: 22,
      role: 'inifap',
      rbac_role_id: 5,
      save: jest.fn(),
    };
    const req = {
      path: '/auth/inifap-upgrade',
      originalUrl: '/auth/inifap-upgrade',
      headers: { accept: 'application/json' },
      body: { secret_code: 'AGS-EEEE-FFFF-GGGG-HHHH' },
      user: inifapUser,
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      send: jest.fn(),
      redirect: jest.fn(),
    };
    const next = jest.fn();

    await authController.processUpgrade(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' }),
    );
    expect(inifapUser.role).toBe('inifap');
    expect(inifapUser.rbac_role_id).toBe(5);
    expect(inifapUser.save).not.toHaveBeenCalled();
    expect(codeStub.burn).not.toHaveBeenCalled();
    expect(findAvailableSpy).not.toHaveBeenCalled();
    expect(transactionSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('redirige a /auth/login si req.user no está presente sin consultar códigos', async () => {
    const findAvailableSpy = jest
      .spyOn(InifapCode, 'findAvailable')
      .mockResolvedValue(null);
    const req = {
      body: { secret_code: 'AGS-1111-2222-3333-4444' },
      user: undefined,
    };
    const res = {
      redirect: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    await authController.processUpgrade(req, res, next);

    expect(res.redirect).toHaveBeenCalledWith('/auth/login');
    expect(findAvailableSpy).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});

describe('POST /auth/inifap-upgrade (HTTP integration)', () => {
  it('rechaza con HTTP 403 a un admin con código válido sin degradar su rol ni quemar el código', async () => {
    const suffix = `${Date.now()}_admin`;
    const { user: adminUser, password } = await createTestUser({
      role: 'admin',
      suffix,
    });
    const { record: codeRecord, rawCode } = await createUnusedCode({
      note: 'Prueba admin guard',
    });

    try {
      const agent = await loginAs(adminUser.email, password);

      const htmlRes = await agent
        .post('/auth/inifap-upgrade')
        .set('Accept', 'text/html')
        .send({
          secret_code: rawCode,
          job_title: 'Intento Degradacion',
        });

      expect(htmlRes.status).toBe(403);
      expect(htmlRes.text).toMatch(/403|Acceso Denegado/i);

      const jsonRes = await agent
        .post('/auth/inifap-upgrade')
        .set('Accept', 'application/json')
        .send({
          secret_code: rawCode,
          job_title: 'Intento Degradacion JSON',
        });

      expect(jsonRes.status).toBe(403);
      expect(jsonRes.body).toEqual(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.any(String),
        }),
      );

      await adminUser.reload();
      await codeRecord.reload();

      expect(adminUser.role).toBe('admin');
      expect(adminUser.rbac_role_id).toBeNull();
      expect(codeRecord.is_used).toBe(false);
      expect(codeRecord.used_by_user_id).toBeNull();
      expect(codeRecord.used_at).toBeNull();
    } finally {
      await cleanupUpgradeFixtures({
        userIds: [adminUser.id],
        codeIds: [codeRecord.id],
      });
    }
  });

  it('rechaza con HTTP 403 a un usuario inifap con código válido sin alterar rol, rbac_role_id ni quemar el código', async () => {
    const suffix = `${Date.now()}_inifap`;
    const originalRole = await RbacRole.create({
      slug: `upgrade-guard-orig-${suffix}`,
      name: 'Subrol Original Test',
      base_role: 'inifap',
      permissions: [],
    });
    const targetRole = await RbacRole.create({
      slug: `upgrade-guard-target-${suffix}`,
      name: 'Subrol Destino Test',
      base_role: 'inifap',
      permissions: [],
    });
    const { user: inifapUser, password } = await createTestUser({
      role: 'inifap',
      rbacRoleId: originalRole.id,
      suffix,
    });
    const { record: codeRecord, rawCode } = await createUnusedCode({
      rbacRoleId: targetRole.id,
      note: 'Prueba inifap guard',
    });

    try {
      const agent = await loginAs(inifapUser.email, password);

      const response = await agent
        .post('/auth/inifap-upgrade')
        .set('Accept', 'application/json')
        .send({
          secret_code: rawCode,
          job_title: 'Investigador Sobrescrito',
        });

      expect(response.status).toBe(403);
      expect(response.body).toEqual(
        expect.objectContaining({
          error: 'Forbidden',
          message: expect.any(String),
        }),
      );

      await inifapUser.reload();
      await codeRecord.reload();

      expect(inifapUser.role).toBe('inifap');
      expect(inifapUser.rbac_role_id).toBe(originalRole.id);
      expect(codeRecord.is_used).toBe(false);
      expect(codeRecord.used_by_user_id).toBeNull();
      expect(codeRecord.used_at).toBeNull();
    } finally {
      await cleanupUpgradeFixtures({
        userIds: [inifapUser.id],
        codeIds: [codeRecord.id],
        roleIds: [originalRole.id, targetRole.id],
      });
    }
  });

  it('control positivo: permite a un agricultor ascender a inifap y quema el código', async () => {
    const suffix = `${Date.now()}_agricultor`;
    const targetRole = await RbacRole.create({
      slug: `upgrade-guard-pos-${suffix}`,
      name: 'Subrol Positivo Test',
      base_role: 'inifap',
      permissions: [],
    });
    const { user: farmerUser, password } = await createTestUser({
      role: 'agricultor',
      suffix,
    });
    const { record: codeRecord, rawCode } = await createUnusedCode({
      rbacRoleId: targetRole.id,
      note: 'Prueba agricultor positivo',
    });

    try {
      const agent = await loginAs(farmerUser.email, password);

      const response = await agent.post('/auth/inifap-upgrade').send({
        secret_code: rawCode,
        job_title: 'Investigador Titular',
        shift: 'Matutino',
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/dashboard');

      await farmerUser.reload();
      await codeRecord.reload();

      expect(farmerUser.role).toBe('inifap');
      expect(farmerUser.rbac_role_id).toBe(targetRole.id);
      expect(farmerUser.job_title).toBe('Investigador Titular');
      expect(farmerUser.shift).toBe('Matutino');
      expect(codeRecord.is_used).toBe(true);
      expect(codeRecord.used_by_user_id).toBe(farmerUser.id);
      expect(codeRecord.used_at).not.toBeNull();
    } finally {
      await cleanupUpgradeFixtures({
        userIds: [farmerUser.id],
        codeIds: [codeRecord.id],
        roleIds: [targetRole.id],
      });
    }
  });
});
