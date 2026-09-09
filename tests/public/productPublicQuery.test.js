import { describe, expect, it } from '@jest/globals';
import { Op } from 'sequelize';

import {
  buildPublishedProductWhere,
  normalizePublicProductQuery,
  parsePublicProductId,
} from '../../src/services/productPublicQueryService.js';

describe('consulta pública de productos', () => {
  it('exige que el producto esté activo y publicado', () => {
    expect(buildPublishedProductWhere(Op, { search: '' })).toEqual({
      status: true,
      workflow_status: 'published',
    });
  });

  it('limita paginación y normaliza búsqueda', () => {
    expect(
      normalizePublicProductQuery({
        search: '  cobre\0 ',
        page: '2',
        limit: '999',
      }),
    ).toEqual({ search: 'cobre', page: 2, limit: 24 });
  });

  it('rechaza identificadores públicos inválidos', () => {
    expect(parsePublicProductId('17')).toBe(17);
    expect(parsePublicProductId('1 OR 1=1')).toBeNull();
    expect(parsePublicProductId('-3')).toBeNull();
  });
});
