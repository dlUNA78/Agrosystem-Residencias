import { jest, describe, it, expect } from '@jest/globals';
import * as authMiddleware from '../../src/middlewares/authMiddleware.js';
import { PANEL_PERMISSIONS } from '../../src/services/rbacService.js';

const { requireRole, requirePanelAccess, requirePermission } = authMiddleware;

describe('🛡️ Pruebas de Control de Acceso Granular por Rol (Paso 2 - RBAC)', () => {
  it('1. Debe permitir el acceso si el usuario posee un rol autorizado', () => {
    const middleware = requireRole('admin');
    const req = { user: { role: 'admin' }, path: '/private/users' };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('2. Debe denegar el acceso (403) a un usuario INIFAP cuando se requiere rol ADMIN exclusivamente', () => {
    const middleware = requireRole('admin');
    const req = { user: { role: 'inifap' }, path: '/private/audit' };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining('Acceso Denegado'),
    );
  });

  it('3. Debe denegar el acceso (403) a un AGRICULTOR en el panel privado (requirePanelAccess)', () => {
    const req = { user: { role: 'agricultor' }, path: '/private/lands' };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    requirePanelAccess(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('4. Debe retornar JSON 403 cuando la petición no autorizada proviene de una API o AJAX', () => {
    const middleware = requireRole('admin');
    const req = {
      user: { role: 'inifap' },
      path: '/api/admin/action',
      headers: { accept: 'application/json' },
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: 'Forbidden' }),
    );
  });

  it('5. Debe redirigir a /auth/login si req.user es undefined (usuario no autenticado)', () => {
    const middleware = requireRole('admin', 'inifap');
    const req = { user: undefined, path: '/private/lands' };
    const res = {
      redirect: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.redirect).toHaveBeenCalledWith('/auth/login');
  });
});

describe('🔒 H-2: Sub-roles RBAC exclusivos de INIFAP en middleware y delegación /ingredients', () => {
  const SUBROLE_CURATOR_2 = {
    id: 2,
    slug: 'curador-insumos',
    name: 'Curador de Insumos y Proveedores',
    permissions: [
      PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
      PANEL_PERMISSIONS.SUPPLIERS_MANAGE,
      PANEL_PERMISSIONS.PRODUCTS_PUBLISH,
    ],
  };

  const SUBROLE_AUDITOR_3 = {
    id: 3,
    slug: 'auditor-fitosanitario',
    name: 'Auditor Fitosanitario',
    permissions: [
      PANEL_PERMISSIONS.AUDIT_VIEW,
      PANEL_PERMISSIONS.REPORTS_EXPORT,
      PANEL_PERMISSIONS.LANDS_VIEW_DETAILED,
    ],
  };

  const SUBROLE_MODERATOR_12 = {
    id: 12,
    slug: 'moderador-inifap',
    name: 'Moderador Institucional',
    permissions: [
      PANEL_PERMISSIONS.CROPS_VIEW_PRIVATE,
      PANEL_PERMISSIONS.CROPS_CREATE,
      PANEL_PERMISSIONS.CROPS_EDIT,
      PANEL_PERMISSIONS.CROPS_MANAGE_RELATIONS,
      PANEL_PERMISSIONS.CROPS_SUBMIT_REVIEW,
      PANEL_PERMISSIONS.CROPS_VERIFY,
      PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE,
      PANEL_PERMISSIONS.PLAGUES_CREATE,
      PANEL_PERMISSIONS.PLAGUES_EDIT,
      PANEL_PERMISSIONS.PLAGUES_MANAGE_RELATIONS,
      PANEL_PERMISSIONS.PLAGUES_SUBMIT_REVIEW,
      PANEL_PERMISSIONS.PLAGUES_VERIFY,
      PANEL_PERMISSIONS.PRODUCTS_VIEW_PRIVATE,
      PANEL_PERMISSIONS.PRODUCTS_CREATE,
      PANEL_PERMISSIONS.PRODUCTS_EDIT,
      PANEL_PERMISSIONS.PRODUCTS_MANAGE_RELATIONS,
      PANEL_PERMISSIONS.PRODUCTS_SUBMIT_REVIEW,
      PANEL_PERMISSIONS.PRODUCTS_VERIFY,
      PANEL_PERMISSIONS.INGREDIENTS_VIEW,
      PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
      PANEL_PERMISSIONS.SUPPLIERS_VIEW,
      PANEL_PERMISSIONS.SUPPLIERS_MANAGE,
      PANEL_PERMISSIONS.LANDS_VIEW_PRIVATE,
      PANEL_PERMISSIONS.REPORTS_VIEW,
      'users.view',
    ],
  };

  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn(),
  });

  it('Capa 1 (requirePermission): deniega 403 a agricultor con sub-rol huérfano (IDs 2, 3 y 12) en permisos fuera de /ingredients', () => {
    const cases = [
      { subRole: SUBROLE_CURATOR_2, perm: PANEL_PERMISSIONS.PRODUCTS_PUBLISH },
      { subRole: SUBROLE_CURATOR_2, perm: PANEL_PERMISSIONS.SUPPLIERS_MANAGE },
      { subRole: SUBROLE_AUDITOR_3, perm: PANEL_PERMISSIONS.AUDIT_VIEW },
      { subRole: SUBROLE_AUDITOR_3, perm: PANEL_PERMISSIONS.REPORTS_EXPORT },
      {
        subRole: SUBROLE_AUDITOR_3,
        perm: PANEL_PERMISSIONS.LANDS_VIEW_DETAILED,
      },
      {
        subRole: SUBROLE_MODERATOR_12,
        perm: PANEL_PERMISSIONS.CROPS_VIEW_PRIVATE,
      },
      {
        subRole: SUBROLE_MODERATOR_12,
        perm: PANEL_PERMISSIONS.SUPPLIERS_MANAGE,
      },
    ];

    for (const { subRole, perm } of cases) {
      const middleware = requirePermission(perm);
      const req = {
        user: {
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: subRole.id,
          rbacRole: subRole,
        },
        path: '/private/reports',
      };
      const res = makeRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }

    // Control positivo: un usuario INIFAP legítimo conserva el permiso del sub-rol
    const inifapMiddleware = requirePermission(PANEL_PERMISSIONS.AUDIT_VIEW);
    const inifapReq = {
      user: {
        role: 'inifap',
        status: 'activo',
        rbac_role_id: SUBROLE_AUDITOR_3.id,
        rbacRole: SUBROLE_AUDITOR_3,
      },
      path: '/private/audit',
    };
    const inifapRes = makeRes();
    const inifapNext = jest.fn();
    inifapMiddleware(inifapReq, inifapRes, inifapNext);
    expect(inifapNext).toHaveBeenCalledTimes(1);
  });

  it('Capa 2 (hasSpecificDelegatedPermission directo con predicado stub): rechaza usuarios no-INIFAP en /private/ingredients incluso si el predicado devuelve true', () => {
    expect(typeof authMiddleware.hasSpecificDelegatedPermission).toBe(
      'function',
    );

    const alwaysTrue = jest.fn(() => true);

    const agricultorAllowed = authMiddleware.hasSpecificDelegatedPermission(
      {
        user: { role: 'agricultor', status: 'activo' },
        path: '/private/ingredients',
      },
      alwaysTrue,
    );
    expect(agricultorAllowed).toBe(false);
    expect(alwaysTrue).not.toHaveBeenCalled();

    const adminDelegated = authMiddleware.hasSpecificDelegatedPermission(
      {
        user: { role: 'admin', status: 'activo' },
        path: '/private/ingredients/create',
      },
      alwaysTrue,
    );
    expect(adminDelegated).toBe(false);
    expect(alwaysTrue).not.toHaveBeenCalled();

    const unknownRoleDelegated = authMiddleware.hasSpecificDelegatedPermission(
      {
        user: { role: 'invitado', status: 'activo' },
        path: '/private/ingredients',
      },
      alwaysTrue,
    );
    expect(unknownRoleDelegated).toBe(false);

    const inifapAllowed = authMiddleware.hasSpecificDelegatedPermission(
      {
        user: { role: 'inifap', status: 'activo' },
        path: '/private/ingredients/create',
      },
      alwaysTrue,
    );
    expect(inifapAllowed).toBe(true);
    expect(alwaysTrue).toHaveBeenCalledWith(
      { role: 'inifap', status: 'activo' },
      PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
    );

    const alwaysFalse = jest.fn(() => false);
    expect(
      authMiddleware.hasSpecificDelegatedPermission(
        {
          user: { role: 'inifap', status: 'activo' },
          path: '/private/ingredients',
        },
        alwaysFalse,
      ),
    ).toBe(false);
  });

  it('Capa 2 (defensa en profundidad en requirePanelAccess/requireRole): deniega 403 en /private/ingredients a agricultor aun con custom_permissions.allow de ingredients.manage', () => {
    const agricultorWithAllow = {
      role: 'agricultor',
      status: 'activo',
      custom_permissions: {
        allow: [PANEL_PERMISSIONS.INGREDIENTS_MANAGE],
        deny: [],
      },
    };

    for (const guard of [requirePanelAccess, requireRole('admin')]) {
      const req = {
        user: agricultorWithAllow,
        path: '/private/ingredients/create',
      };
      const res = makeRes();
      const next = jest.fn();

      guard(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }
  });

  it('Deniega 403 en /private/ingredients* a agricultor con sub-rol huérfano (IDs 2 y 12) y permite acceso delegado a INIFAP legítimo', () => {
    for (const subRole of [SUBROLE_CURATOR_2, SUBROLE_MODERATOR_12]) {
      for (const path of ['/ingredients', '/private/ingredients/create']) {
        const req = {
          user: {
            role: 'agricultor',
            status: 'activo',
            rbac_role_id: subRole.id,
            rbacRole: subRole,
          },
          path,
        };
        const res = makeRes();
        const next = jest.fn();

        requirePanelAccess(req, res, next);
        expect(next).not.toHaveBeenCalled();
        expect(res.status).toHaveBeenCalledWith(403);

        const adminRes = makeRes();
        const adminNext = jest.fn();
        requireRole('admin')(req, adminRes, adminNext);
        expect(adminNext).not.toHaveBeenCalled();
        expect(adminRes.status).toHaveBeenCalledWith(403);
      }
    }

    // INIFAP con sub-rol curador conserva delegación en /private/ingredients/create
    const inifapReq = {
      user: {
        role: 'inifap',
        status: 'activo',
        rbac_role_id: SUBROLE_CURATOR_2.id,
        rbacRole: SUBROLE_CURATOR_2,
      },
      path: '/private/ingredients/create',
    };
    const inifapRes = makeRes();
    const inifapNext = jest.fn();
    requireRole('admin')(inifapReq, inifapRes, inifapNext);
    expect(inifapNext).toHaveBeenCalledTimes(1);
  });
});

describe('🔒 Capa 1: custom_permissions exclusivos de INIFAP en requirePermission', () => {
  const makeRes = () => ({
    status: jest.fn().mockReturnThis(),
    send: jest.fn(),
    json: jest.fn(),
  });

  it('deniega 403 a agricultor con custom_permissions.allow en permisos delegables y preserva sus permisos base pese a deny', () => {
    const agricultorWithCustom = {
      role: 'agricultor',
      status: 'activo',
      custom_permissions: {
        allow: [
          PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
          PANEL_PERMISSIONS.CROPS_PUBLISH,
          PANEL_PERMISSIONS.AUDIT_VIEW,
        ],
        deny: [PANEL_PERMISSIONS.LANDS_MANAGE],
      },
    };

    for (const perm of [
      PANEL_PERMISSIONS.CROPS_PUBLISH,
      PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
      PANEL_PERMISSIONS.AUDIT_VIEW,
    ]) {
      const middleware = requirePermission(perm);
      const req = { user: agricultorWithCustom, path: '/private/crops' };
      const res = makeRes();
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
    }

    // custom_permissions.deny tampoco altera los permisos base del agricultor
    const landsReq = { user: agricultorWithCustom, path: '/private/lands' };
    const landsRes = makeRes();
    const landsNext = jest.fn();
    requirePermission(PANEL_PERMISSIONS.LANDS_MANAGE)(
      landsReq,
      landsRes,
      landsNext,
    );
    expect(landsNext).toHaveBeenCalledTimes(1);
  });

  it('control positivo: permite allow y aplica deny en requirePermission para usuario INIFAP legítimo', () => {
    const inifapWithCustom = {
      role: 'inifap',
      status: 'activo',
      custom_permissions: {
        allow: [PANEL_PERMISSIONS.CROPS_PUBLISH],
        deny: [PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE],
      },
    };

    const allowRes = makeRes();
    const allowNext = jest.fn();
    requirePermission(PANEL_PERMISSIONS.CROPS_PUBLISH)(
      { user: inifapWithCustom, path: '/private/crops/publish' },
      allowRes,
      allowNext,
    );
    expect(allowNext).toHaveBeenCalledTimes(1);

    const denyRes = makeRes();
    const denyNext = jest.fn();
    requirePermission(PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE)(
      { user: inifapWithCustom, path: '/private/plagues' },
      denyRes,
      denyNext,
    );
    expect(denyNext).not.toHaveBeenCalled();
    expect(denyRes.status).toHaveBeenCalledWith(403);
  });
});
