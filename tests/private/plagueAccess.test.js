import { describe, expect, it, jest } from '@jest/globals';

import {
  PLAGUE_PERMISSIONS,
  getPlaguePermissions,
  getRequiredPlaguePermissionForWorkflowAction,
  hasPlaguePermission,
} from '../../src/services/plagueAuthorizationService.js';
import {
  requirePlaguePermission,
  requirePlagueWorkflowPermission,
} from '../../src/middlewares/plagueAuthorizationMiddleware.js';
import { PLAGUE_WORKFLOW_ACTIONS } from '../../src/services/plagueWorkflowService.js';

describe('RBAC del módulo privado de plagas', () => {
  it('permite al administrador administrar todo el ciclo de vida', () => {
    const permissions = getPlaguePermissions('admin');

    expect(Object.values(permissions).every(Boolean)).toBe(true);
  });

  it('permite al personal INIFAP editar y verificar, pero no publicar ni eliminar', () => {
    const permissions = getPlaguePermissions('inifap');

    expect(permissions).toEqual({
      canViewPrivate: true,
      canCreate: true,
      canEdit: true,
      canManageRelations: true,
      canSubmitReview: true,
      canVerify: true,
      canPublish: false,
      canArchive: false,
      canRestore: false,
      canDelete: false,
    });
  });

  it.each([['agricultor'], ['unknown'], [undefined]])(
    'no concede permisos privados al rol %s',
    (role) => {
      const permissions = getPlaguePermissions(role);

      expect(Object.values(permissions).some(Boolean)).toBe(false);
    },
  );

  it('resuelve permisos individuales con una lista cerrada de acciones', () => {
    expect(hasPlaguePermission('inifap', PLAGUE_PERMISSIONS.VERIFY)).toBe(true);
    expect(hasPlaguePermission('inifap', PLAGUE_PERMISSIONS.PUBLISH)).toBe(
      false,
    );
    expect(hasPlaguePermission('admin', 'plagues.unknown')).toBe(false);
  });

  it('bloquea con 403 una acción que el rol no puede ejecutar', () => {
    const middleware = requirePlaguePermission(PLAGUE_PERMISSIONS.DELETE);
    const req = {
      user: { role: 'inifap' },
      path: '/private/plagues/delete/1',
      headers: {},
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining('plagas'));
  });

  it('permite continuar cuando el rol posee el permiso solicitado', () => {
    const middleware = requirePlaguePermission(PLAGUE_PERMISSIONS.VERIFY);
    const req = { user: { role: 'inifap' } };
    const res = {};
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
  });

  it('traduce cada acción del workflow a un permiso cerrado', () => {
    expect(
      getRequiredPlaguePermissionForWorkflowAction(
        PLAGUE_WORKFLOW_ACTIONS.VERIFY,
      ),
    ).toBe(PLAGUE_PERMISSIONS.VERIFY);
    expect(
      getRequiredPlaguePermissionForWorkflowAction(
        PLAGUE_WORKFLOW_ACTIONS.PUBLISH,
      ),
    ).toBe(PLAGUE_PERMISSIONS.PUBLISH);
    expect(getRequiredPlaguePermissionForWorkflowAction('unknown')).toBeNull();
  });

  it('permite verificar a INIFAP pero bloquea que publique', () => {
    const allowedRequest = {
      user: { role: 'inifap' },
      body: { action: PLAGUE_WORKFLOW_ACTIONS.VERIFY },
      headers: {},
    };
    const deniedRequest = {
      user: { role: 'inifap' },
      body: { action: PLAGUE_WORKFLOW_ACTIONS.PUBLISH },
      headers: {},
    };
    const allowedNext = jest.fn();
    const deniedNext = jest.fn();
    const deniedResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    requirePlagueWorkflowPermission(allowedRequest, {}, allowedNext);
    requirePlagueWorkflowPermission(deniedRequest, deniedResponse, deniedNext);

    expect(allowedNext).toHaveBeenCalledTimes(1);
    expect(deniedNext).not.toHaveBeenCalled();
    expect(deniedResponse.status).toHaveBeenCalledWith(403);
  });

  it('responde 400 cuando la acción del workflow no existe', () => {
    const req = {
      user: { role: 'admin' },
      body: { action: 'unknown' },
      headers: {},
    };
    const res = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };
    const next = jest.fn();

    requirePlagueWorkflowPermission(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
