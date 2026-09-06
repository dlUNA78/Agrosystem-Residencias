import { describe, expect, it } from '@jest/globals';

import {
  getContextualLandPermissions,
  getLandListWhere,
  getLandPermissions,
} from '../../src/services/landAuthorizationService.js';

describe('acceso al módulo privado de terrenos', () => {
  it('limita el listado INIFAP a sus terrenos activos', () => {
    expect(getLandListWhere({ id: 12, role: 'inifap' })).toEqual({
      user_id: 12,
      status: true,
    });
  });

  it('permite al administrador consultar todos los terrenos activos', () => {
    expect(getLandListWhere({ id: 1, role: 'admin' })).toEqual({
      status: true,
    });
  });

  it('permite gestionar al propietario y rechaza a otro INIFAP', () => {
    const owner = getContextualLandPermissions({
      role: 'inifap',
      userId: 12,
      ownerUserId: 12,
      isActive: true,
    });
    const other = getContextualLandPermissions({
      role: 'inifap',
      userId: 27,
      ownerUserId: 12,
      isActive: true,
    });

    expect(owner.canEdit).toBe(true);
    expect(owner.canArchive).toBe(true);
    expect(other.canView).toBe(false);
    expect(other.canEdit).toBe(false);
  });

  it('da al administrador gestión excepcional sobre cualquier terreno', () => {
    const permissions = getContextualLandPermissions({
      role: 'admin',
      userId: 1,
      ownerUserId: 12,
      isActive: false,
    });

    expect(permissions.canView).toBe(true);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canRestore).toBe(true);
  });

  it.each([['agricultor'], ['unknown'], [undefined]])(
    'no concede acceso privado al rol %s',
    (role) => {
      expect(Object.values(getLandPermissions(role)).some(Boolean)).toBe(false);
    },
  );
});
