import { describe, expect, it } from '@jest/globals';
import { Op } from 'sequelize';

import {
  buildPublicRegionCard,
  buildPublicRegionWhere,
  normalizePublicLandQuery,
} from '../../src/services/landPublicQueryService.js';

describe('consulta pública segura de regiones', () => {
  it('normaliza la búsqueda y limita la paginación', () => {
    expect(
      normalizePublicLandQuery({ search: '  Bajío\u0000  ', page: '2' }),
    ).toEqual({ search: 'Bajío', page: 2, limit: 12 });
    expect(normalizePublicLandQuery({ page: '-4' }).page).toBe(1);
  });

  it('construye el filtro sin aceptar campos adicionales del cliente', () => {
    const where = buildPublicRegionWhere(Op, {
      search: 'Centro',
      ignored: 'private',
    });

    expect(where.name[Op.iLike]).toBe('%Centro%');
    expect(where).not.toHaveProperty('ignored');
  });

  it('construye una tarjeta sin coordenadas, predios ni responsables', () => {
    const card = buildPublicRegionCard({
      id: 5,
      name: 'Centro',
      lat: 19.4,
      lng: -99.1,
      farms: [{ id: 95, user_id: 8 }],
      user: { full_name: 'Dato privado' },
      plagues: [
        { id: 3, name: 'Plaga pública', scientific_name: 'Species publicus' },
      ],
    });

    expect(card).toEqual({
      id: 5,
      name: 'Centro',
      plagueCount: 1,
      featuredPlagues: [
        {
          id: 3,
          name: 'Plaga pública',
          scientificName: 'Species publicus',
        },
      ],
    });
    expect(card).not.toHaveProperty('lat');
    expect(card).not.toHaveProperty('lng');
    expect(card).not.toHaveProperty('farms');
    expect(card).not.toHaveProperty('user');
  });
});
