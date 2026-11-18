import { describe, expect, it } from '@jest/globals';

import {
  getContextualLandPermissions,
  getLandListWhere,
  getLandPermissions,
} from '../../src/services/landAuthorizationService.js';

describe('acceso al módulo privado de terrenos', () => {
  it('limita el listado a los terrenos del usuario autenticado (incluido admin)', () => {
    expect(getLandListWhere({ id: 12, role: 'inifap' })).toEqual({
      user_id: 12,
      status: true,
    });
    expect(getLandListWhere({ id: 1, role: 'admin' })).toEqual({
      user_id: 1,
      status: true,
    });
    expect(getLandListWhere({ id: 99, role: 'agricultor' })).toEqual({
      user_id: 99,
      status: true,
    });
  });

  it('permite consultar archivados manteniendo siempre el aislamiento por usuario', () => {
    expect(
      getLandListWhere({ id: 12, role: 'inifap' }, { status: 'archived' }),
    ).toEqual({ user_id: 12, status: false });
    expect(
      getLandListWhere({ id: 1, role: 'admin' }, { status: 'all' }),
    ).toEqual({ user_id: 1 });
  });

  it('permite gestionar al propietario y rechaza a otro usuario', () => {
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

    expect(owner.canView).toBe(true);
    expect(owner.canEdit).toBe(true);
    expect(owner.canArchive).toBe(true);
    expect(owner.canDelete).toBe(false);
    expect(other.canView).toBe(false);
    expect(other.canEdit).toBe(false);
    expect(other.canDelete).toBe(false);
  });

  it('mantiene aislamiento estricto incluso para rol admin si no es propietario', () => {
    const permissions = getContextualLandPermissions({
      role: 'admin',
      userId: 1,
      ownerUserId: 12,
      isActive: false,
    });

    expect(permissions.canView).toBe(false);
    expect(permissions.canEdit).toBe(false);
    expect(permissions.canRestore).toBe(false);
    expect(permissions.canDelete).toBe(false);
  });

  it('permite restaurar y eliminar definitivamente únicamente terrenos archivados de su propiedad', () => {
    const archivedOwner = getContextualLandPermissions({
      role: 'inifap',
      userId: 12,
      ownerUserId: 12,
      isActive: false,
    });

    expect(archivedOwner.canView).toBe(true);
    expect(archivedOwner.canEdit).toBe(false);
    expect(archivedOwner.canArchive).toBe(false);
    expect(archivedOwner.canRestore).toBe(true);
    expect(archivedOwner.canDelete).toBe(true);
  });

  it.each([['unknown'], [undefined]])(
    'no concede acceso privado al rol inválido %s',
    (role) => {
      expect(Object.values(getLandPermissions(role)).some(Boolean)).toBe(false);
    },
  );
});
