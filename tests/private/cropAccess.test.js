import { describe, expect, it, jest } from '@jest/globals';

import {
  CROP_PERMISSIONS,
  getContextualCropPermissions,
  getCropPermissions,
  getRequiredCropPermissionForWorkflowAction,
  hasCropPermission,
} from '../../src/services/cropAuthorizationService.js';
import {
  requireCropPermission,
  requireCropWorkflowPermission,
} from '../../src/middlewares/cropAuthorizationMiddleware.js';
import { CROP_WORKFLOW_ACTIONS } from '../../src/services/cropWorkflowService.js';

describe('RBAC del módulo privado de cultivos', () => {
  it('separa la publicación administrativa de la verificación técnica', () => {
    expect(getCropPermissions('admin')).toEqual({
      canViewPrivate: true,
      canCreate: true,
      canEdit: true,
      canManageRelations: true,
      canSubmitReview: true,
      canVerify: false,
      canPublish: true,
      canArchive: true,
      canRestore: true,
      canDelete: true,
    });
  });

  it('permite editar al autor INIFAP y revisar sólo a otra persona', () => {
    const author = getContextualCropPermissions({
      role: 'inifap',
      userId: 12,
      createdByUserId: 12,
    });
    const reviewer = getContextualCropPermissions({
      role: 'inifap',
      userId: 27,
      createdByUserId: 12,
    });

    expect(author.canEdit).toBe(true);
    expect(author.canSubmitReview).toBe(true);
    expect(author.canVerify).toBe(false);
    expect(reviewer.canEdit).toBe(false);
    expect(reviewer.canSubmitReview).toBe(false);
    expect(reviewer.canVerify).toBe(true);
  });

  it('reserva al administrador los registros sin autor conocido', () => {
    const permissions = getContextualCropPermissions({
      role: 'inifap',
      userId: 12,
      createdByUserId: null,
    });

    expect(permissions.canEdit).toBe(false);
    expect(permissions.canSubmitReview).toBe(false);
    expect(permissions.canVerify).toBe(false);
  });

  it('impide a INIFAP publicar, archivar o eliminar', () => {
    const permissions = getCropPermissions('inifap');

    expect(permissions.canCreate).toBe(true);
    expect(permissions.canVerify).toBe(true);
    expect(permissions.canPublish).toBe(false);
    expect(permissions.canArchive).toBe(false);
    expect(permissions.canDelete).toBe(false);
  });

  it.each([['agricultor'], ['unknown'], [undefined]])(
    'no concede permisos privados al rol %s',
    (role) => {
      expect(Object.values(getCropPermissions(role)).some(Boolean)).toBe(false);
    },
  );

  it('rechaza permisos desconocidos', () => {
    expect(hasCropPermission('admin', 'crops.unknown')).toBe(false);
  });

  it('bloquea con 403 una acción no permitida', () => {
    const middleware = requireCropPermission(CROP_PERMISSIONS.DELETE);
    const req = {
      user: { role: 'inifap' },
      path: '/private/crops/1',
      headers: {},
    };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('traduce acciones editoriales a permisos cerrados', () => {
    expect(
      getRequiredCropPermissionForWorkflowAction(CROP_WORKFLOW_ACTIONS.VERIFY),
    ).toBe(CROP_PERMISSIONS.VERIFY);
    expect(
      getRequiredCropPermissionForWorkflowAction(CROP_WORKFLOW_ACTIONS.PUBLISH),
    ).toBe(CROP_PERMISSIONS.PUBLISH);
    expect(getRequiredCropPermissionForWorkflowAction('unknown')).toBeNull();
  });

  it('permite verificar a INIFAP pero le bloquea publicar', () => {
    const allowedNext = jest.fn();
    const deniedNext = jest.fn();
    const deniedResponse = {
      status: jest.fn().mockReturnThis(),
      send: jest.fn(),
    };

    requireCropWorkflowPermission(
      { user: { role: 'inifap' }, body: { action: 'verify' }, headers: {} },
      {},
      allowedNext,
    );
    requireCropWorkflowPermission(
      { user: { role: 'inifap' }, body: { action: 'publish' }, headers: {} },
      deniedResponse,
      deniedNext,
    );

    expect(allowedNext).toHaveBeenCalledTimes(1);
    expect(deniedNext).not.toHaveBeenCalled();
    expect(deniedResponse.status).toHaveBeenCalledWith(403);
  });

  it('responde 400 ante una acción editorial inexistente', () => {
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const next = jest.fn();

    requireCropWorkflowPermission(
      { user: { role: 'admin' }, body: { action: 'unknown' }, headers: {} },
      res,
      next,
    );

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
  });
});
