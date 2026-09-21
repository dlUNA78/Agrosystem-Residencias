import { describe, expect, it } from '@jest/globals';

import {
  buildUserListWhere,
  normalizeSearchTerm,
  normalizeUserListQuery,
} from '../../src/services/userListService.js';

describe('consulta administrativa de usuarios', () => {
  it('normaliza búsqueda parcial sin distinguir mayúsculas ni acentos', () => {
    expect(normalizeSearchTerm('  JOSÉ Muñoz  ')).toBe('jose munoz');
  });

  it('acepta filtros conocidos y descarta valores fabricados', () => {
    expect(
      normalizeUserListQuery({
        search: '  agrónomo ',
        role: 'INIFAP',
        status: 'activo',
      }),
    ).toEqual({ search: 'agrónomo', role: 'inifap', status: 'activo' });
    expect(
      normalizeUserListQuery({ role: 'superadmin', status: 'borrado' }),
    ).toEqual({ search: '', role: '', status: '' });
  });

  it('construye búsqueda parcial sólo sobre campos permitidos', () => {
    const Op = { or: Symbol('or'), like: Symbol('like') };
    const sequelize = {
      Op,
      fn: (...args) => ({ fn: args }),
      col: (column) => ({ column }),
      where: (left, right) => ({ left, right }),
    };
    const where = buildUserListWhere(sequelize, {
      search: 'José',
      role: 'inifap',
      status: 'activo',
    });

    expect(where.role).toBe('inifap');
    expect(where.status).toBe('activo');
    expect(where[Op.or]).toHaveLength(4);
    expect(where[Op.or][0].right[Op.like]).toBe('%jose%');
    expect(JSON.stringify(where)).not.toMatch(/password|token/i);
  });
});
