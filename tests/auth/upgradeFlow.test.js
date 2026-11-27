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

import { PANEL_PERMISSIONS } from '../../src/services/rbacService.js';

const {
  AuditLog,
  InifapCode,
  Notification,
  RbacRole,
  Sequelize,
  User,
  sequelize,
} = db;
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
    await AuditLog.destroy({
      where: {
        [Op.or]: [
          { user_id: { [Op.in]: userIds } },
          { table_name: 'Users', record_id: { [Op.in]: userIds } },
        ],
      },
    });
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
    jest.spyOn(AuditLog, 'create').mockResolvedValue({});
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

  it('H-6(a) + H-4 (unit): limpia rbac_role_id huérfano cuando el código tiene rbac_role_id=null, sincroniza req.user.rbacRole y audita código enmascarado', async () => {
    const rawCode = 'AGS-UNIT-ORPH-9999-ABCD';
    const inifapCode = {
      id: 77,
      code: rawCode,
      code_masked: maskCodeString(rawCode),
      rbac_role_id: null,
      burn: jest.fn().mockResolvedValue(undefined),
    };
    const orphanRole = {
      id: 99,
      name: 'Subrol Huérfano',
      slug: 'subrol-huerfano',
      permissions: [PANEL_PERMISSIONS.CROPS_PUBLISH],
    };
    jest.spyOn(InifapCode, 'findAvailable').mockResolvedValue(inifapCode);
    jest.spyOn(RbacRole, 'findByPk').mockResolvedValue(orphanRole);
    const tx = { id: 'tx-h6a' };
    jest
      .spyOn(sequelize, 'transaction')
      .mockImplementation(async (callback) => callback(tx));
    const auditSpy = jest.spyOn(AuditLog, 'create').mockResolvedValue({});
    jest.spyOn(Notification, 'create').mockResolvedValue({});
    jest.spyOn(User, 'findAll').mockResolvedValue([]);

    let rbacRoleSeenAtLogin = 'UNSET';
    const userObj = {
      id: 41,
      full_name: 'Agricultor Huérfano Unit',
      email: 'huerfano@agrosystem.test',
      role: 'agricultor',
      status: 'activo',
      rbac_role_id: 99,
      rbacRole: orphanRole,
      password_hash: '$2b$10$secretHashNeverAudited',
      save: jest.fn().mockResolvedValue(undefined),
    };

    const req = {
      body: { secret_code: rawCode, job_title: 'Técnico INIFAP' },
      logIn: jest.fn((loggedUser, callback) => {
        rbacRoleSeenAtLogin = loggedUser.rbacRole;
        callback();
      }),
      session: {
        regenerate: jest.fn((callback) => callback()),
      },
      user: userObj,
    };
    const res = {
      redirect: jest.fn(),
      render: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await authController.processUpgrade(req, res, next);

    expect(userObj.role).toBe('inifap');
    expect(userObj.rbac_role_id).toBeNull();
    expect(rbacRoleSeenAtLogin).toBeNull();
    expect(res.redirect).toHaveBeenCalledWith('/dashboard');

    expect(auditSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 41,
        action: 'upgrade_role',
        table_name: 'Users',
        record_id: 41,
        old_values: expect.objectContaining({
          role: 'agricultor',
          rbac_role_id: 99,
          rbac_role_name: 'Subrol Huérfano',
        }),
        new_values: expect.objectContaining({
          role: 'inifap',
          rbac_role_id: null,
          orphan_subrole_cleared: true,
          inifap_code_id: 77,
          inifap_code_masked: maskCodeString(rawCode),
          change_source: 'inifap_code_upgrade',
        }),
      }),
      { transaction: tx },
    );

    const auditedPayload = auditSpy.mock.calls[0][0];
    const serialized = JSON.stringify(auditedPayload);
    expect(serialized).not.toContain(rawCode);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('$2b$10$secretHashNeverAudited');
  });
});

describe('POST /auth/inifap-upgrade (HTTP integration)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

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

      const auditLog = await AuditLog.findOne({
        where: {
          table_name: 'Users',
          record_id: farmerUser.id,
          action: 'upgrade_role',
        },
        order: [['id', 'DESC']],
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog.user_id).toBe(farmerUser.id);
      expect(auditLog.old_values.role).toBe('agricultor');
      expect(auditLog.new_values).toEqual(
        expect.objectContaining({
          role: 'inifap',
          rbac_role_id: targetRole.id,
          rbac_role_name: targetRole.name,
          rbac_role_slug: targetRole.slug,
          inifap_code_id: codeRecord.id,
          inifap_code_masked: codeRecord.code_masked,
          orphan_subrole_cleared: false,
          change_source: 'inifap_code_upgrade',
        }),
      );
      expect(auditLog.new_values.permissions_added.length).toBeGreaterThan(0);
      expect(JSON.stringify(auditLog.toJSON())).not.toContain(rawCode);
      expect(auditLog.old_values.password_hash).toBeUndefined();
      expect(auditLog.new_values.password_hash).toBeUndefined();
    } finally {
      await cleanupUpgradeFixtures({
        userIds: [farmerUser.id],
        codeIds: [codeRecord.id],
        roleIds: [targetRole.id],
      });
    }
  });

  it('H-6(a) integración: agricultor con rbac_role_id huérfano que canjea código sin sub-rol limpia rbac_role_id a null y registra auditoría', async () => {
    const suffix = `${Date.now()}_h6a_orphan`;
    const orphanRole = await RbacRole.create({
      slug: `upgrade-h6a-orphan-${suffix}`,
      name: 'Subrol Huérfano H6a',
      base_role: 'inifap',
      permissions: [PANEL_PERMISSIONS.CROPS_PUBLISH],
    });
    const { user: farmerUser, password } = await createTestUser({
      role: 'agricultor',
      rbacRoleId: orphanRole.id,
      suffix,
    });
    const { record: codeRecord, rawCode } = await createUnusedCode({
      rbacRoleId: null,
      note: 'Prueba H6a sin sub-rol',
    });

    try {
      const agent = await loginAs(farmerUser.email, password);
      const response = await agent.post('/auth/inifap-upgrade').send({
        secret_code: rawCode,
        job_title: 'Técnico SIN Subrol',
      });

      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/dashboard');

      await farmerUser.reload();
      await codeRecord.reload();
      expect(farmerUser.role).toBe('inifap');
      expect(farmerUser.rbac_role_id).toBeNull();
      expect(codeRecord.is_used).toBe(true);

      const auditLog = await AuditLog.findOne({
        where: {
          table_name: 'Users',
          record_id: farmerUser.id,
          action: 'upgrade_role',
        },
        order: [['id', 'DESC']],
      });
      expect(auditLog).not.toBeNull();
      expect(auditLog.old_values.rbac_role_id).toBe(orphanRole.id);
      expect(auditLog.old_values.rbac_role_name).toBe(orphanRole.name);
      expect(auditLog.new_values.rbac_role_id).toBeNull();
      expect(auditLog.new_values.orphan_subrole_cleared).toBe(true);
      expect(auditLog.new_values.inifap_code_masked).toBe(
        codeRecord.code_masked,
      );
      expect(JSON.stringify(auditLog.toJSON())).not.toContain(rawCode);
    } finally {
      await cleanupUpgradeFixtures({
        userIds: [farmerUser.id],
        codeIds: [codeRecord.id],
        roleIds: [orphanRole.id],
      });
    }
  });

  it('Atomicidad: si AuditLog.create falla durante el canje, la transacción hace rollback del rol y del código INIFAP', async () => {
    const suffix = `${Date.now()}_rollback`;
    const { user: farmerUser, password } = await createTestUser({
      role: 'agricultor',
      suffix,
    });
    const { record: codeRecord, rawCode } = await createUnusedCode({
      rbacRoleId: null,
      note: 'Prueba rollback audit upgrade',
    });

    try {
      const agent = await loginAs(farmerUser.email, password);
      jest
        .spyOn(AuditLog, 'create')
        .mockRejectedValueOnce(new Error('Falla simulada en AuditLog'));

      const response = await agent.post('/auth/inifap-upgrade').send({
        secret_code: rawCode,
        job_title: 'Debe Revertirse',
      });

      expect(response.status).toBe(500);

      await farmerUser.reload();
      await codeRecord.reload();
      expect(farmerUser.role).toBe('agricultor');
      expect(farmerUser.rbac_role_id).toBeNull();
      expect(codeRecord.is_used).toBe(false);
      expect(codeRecord.used_by_user_id).toBeNull();
    } finally {
      await cleanupUpgradeFixtures({
        userIds: [farmerUser.id],
        codeIds: [codeRecord.id],
      });
    }
  });
});
