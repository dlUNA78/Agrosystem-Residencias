import { describe, expect, it, jest } from '@jest/globals';

import {
  PRODUCT_PERMISSIONS,
  getContextualProductPermissions,
  getProductPermissions,
} from '../../src/services/productAuthorizationService.js';
import { requireProductPermission } from '../../src/middlewares/productAuthorizationMiddleware.js';

describe('RBAC del módulo privado de productos', () => {
  it('separa autor, revisor técnico y administrador', () => {
    const author = getContextualProductPermissions({
      role: 'inifap',
      userId: 10,
      createdByUserId: 10,
    });
    const reviewer = getContextualProductPermissions({
      role: 'inifap',
      userId: 11,
      createdByUserId: 10,
    });
    const admin = getProductPermissions('admin');

    expect(author.canEdit).toBe(true);
    expect(author.canSubmitReview).toBe(true);
    expect(author.canVerify).toBe(false);
    expect(reviewer.canEdit).toBe(false);
    expect(reviewer.canVerify).toBe(true);
    expect(admin.canPublish).toBe(true);
    expect(admin.canDelete).toBe(true);
    expect(admin.canVerify).toBe(false);
  });

  it('no concede permisos privados a roles públicos', () => {
    expect(
      Object.values(getProductPermissions('agricultor')).some(Boolean),
    ).toBe(false);
  });

  it('bloquea con 403 una acción no permitida', () => {
    const middleware = requireProductPermission(PRODUCT_PERMISSIONS.DELETE);
    const req = { user: { role: 'inifap' }, headers: {} };
    const res = { status: jest.fn().mockReturnThis(), send: jest.fn() };
    const next = jest.fn();

    middleware(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(403);
  });
});
