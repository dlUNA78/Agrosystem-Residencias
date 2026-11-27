import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { PANEL_PERMISSIONS } from '../../src/services/rbacService.js';

const mockDb = {
  Sequelize: {
    Op: {},
  },
  AuditLog: {
    create: jest.fn(),
  },
  RbacRole: {
    findByPk: jest.fn(),
  },
  sequelize: {
    transaction: jest.fn(async (cb) => cb({ id: 'tx-unit' })),
  },
};

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: mockDb,
}));

const {
  MAX_AUDITED_EFFECTIVE_PERMISSIONS,
  ROLE_AUDIT_ACTIONS,
  ROLE_AUDIT_CHANGE_SOURCES,
  boundPermissionList,
  buildUserRoleAuditPayloads,
  buildUserRoleSnapshot,
  computePermissionsDiff,
  maskInifapCodeForAudit,
  recordUserRoleAudit,
} = await import('../../src/services/userRoleAuditService.js');

describe('userRoleAuditService (unit)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('acota effective_permissions al límite estable y documenta truncamiento cuando excede 64 entradas', () => {
    const oversizedAllow = Array.from(
      { length: 80 },
      (_, idx) => `synthetic.perm.${String(idx).padStart(3, '0')}`,
    );
    const bounded = boundPermissionList([
      ...oversizedAllow,
      'synthetic.perm.000',
      '  ',
    ]);

    expect(bounded.items).toHaveLength(MAX_AUDITED_EFFECTIVE_PERMISSIONS);
    expect(bounded.total).toBe(80);
    expect(bounded.truncated).toBe(true);
    expect(bounded.items[0]).toBe('synthetic.perm.000');
    expect(bounded.items[63]).toBe('synthetic.perm.063');

    const built = buildUserRoleSnapshot({
      id: 10,
      full_name: 'Investigador Extenso',
      email: 'extenso@inifap.mx',
      role: 'inifap',
      status: 'activo',
      custom_permissions: { allow: oversizedAllow, deny: [] },
    });

    expect(built.snapshot.effective_permissions).toHaveLength(
      MAX_AUDITED_EFFECTIVE_PERMISSIONS,
    );
    expect(built.snapshot.effective_permissions_truncated).toBe(true);
    expect(built.snapshot.effective_permissions_total).toBeGreaterThan(
      MAX_AUDITED_EFFECTIVE_PERMISSIONS,
    );
  });

  it('nunca expone password, password_hash ni códigos INIFAP sin enmascarar en snapshots ni payloads', () => {
    const rawCode = 'AGS-PRIV-9876-5432-XYZW';
    const beforeState = buildUserRoleSnapshot({
      id: 21,
      full_name: 'Productor Privacidad',
      email: 'privacidad@campo.mx',
      role: 'agricultor',
      status: 'activo',
      password: 'PlaintextPassword!1',
      password_hash: '$2b$10$hashsecreto1234567890',
      rbac_role_id: 99,
    });
    const afterState = buildUserRoleSnapshot({
      id: 21,
      full_name: 'Productor Privacidad',
      email: 'privacidad@campo.mx',
      role: 'inifap',
      status: 'activo',
      password: 'PlaintextPassword!1',
      password_hash: '$2b$10$hashsecreto1234567890',
      rbac_role_id: null,
    });

    const payloads = buildUserRoleAuditPayloads({
      beforeState,
      afterState,
      changeSource: ROLE_AUDIT_CHANGE_SOURCES.INIFAP_CODE_UPGRADE,
      inifapCode: { id: 5, code: rawCode, code_masked: null },
      orphanSubroleCleared: true,
    });

    const serialized = JSON.stringify(payloads);
    expect(serialized).not.toContain('password_hash');
    expect(serialized).not.toContain('PlaintextPassword!1');
    expect(serialized).not.toContain('$2b$10$hashsecreto1234567890');
    expect(serialized).not.toContain(rawCode);
    expect(payloads.newValues.inifap_code_masked).toBe(
      'AGS-PRIV-****-****-XYZW',
    );
    expect(payloads.newValues.orphan_subrole_cleared).toBe(true);
    expect(
      maskInifapCodeForAudit({ code: rawCode, code_masked: rawCode }),
    ).toBe('AGS-PRIV-****-****-XYZW');
  });

  it('calcula exactamente permissions_added y permissions_removed y expone constantes de acción', () => {
    const diff = computePermissionsDiff(
      [PANEL_PERMISSIONS.CROPS_VIEW_PRIVATE, PANEL_PERMISSIONS.CROPS_PUBLISH],
      [PANEL_PERMISSIONS.CROPS_VIEW_PRIVATE, PANEL_PERMISSIONS.AUDIT_VIEW],
    );
    expect(diff).toEqual({
      added: [PANEL_PERMISSIONS.AUDIT_VIEW],
      removed: [PANEL_PERMISSIONS.CROPS_PUBLISH],
    });
    expect(ROLE_AUDIT_ACTIONS).toEqual({
      USER_ROLE_UPDATE: 'update_user_role',
      USER_PERMISSIONS_UPDATE: 'update_user_permissions',
      USER_ROLE_UPGRADE: 'upgrade_role',
    });
  });

  it('recordUserRoleAudit propaga errores sin silenciarlos para permitir rollback atómico de transacciones', async () => {
    const tx = { id: 'tx-rollback' };
    mockDb.AuditLog.create.mockRejectedValueOnce(new Error('SQL audit error'));

    await expect(
      recordUserRoleAudit({
        actorId: 1,
        action: ROLE_AUDIT_ACTIONS.USER_ROLE_UPDATE,
        tableName: 'Users',
        recordId: 42,
        oldValues: { role: 'inifap' },
        newValues: { role: 'agricultor' },
        transaction: tx,
      }),
    ).rejects.toThrow('SQL audit error');

    expect(mockDb.AuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 1,
        action: 'update_user_role',
        table_name: 'Users',
        record_id: 42,
      }),
      { transaction: tx },
    );
  });
});
