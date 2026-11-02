import { describe, expect, it } from '@jest/globals';
import { Op } from 'sequelize';

import {
  buildPublicProductPageUrl,
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

  it('limita paginación y normaliza búsqueda, categoría, banda NOM y relaciones', () => {
    expect(
      normalizePublicProductQuery({
        search: '  cobre\0 ',
        category: 'fungicida',
        hazard: 'verde',
        crop: '12',
        plague: 'bad-id',
        page: '2',
        limit: '999',
      }),
    ).toEqual({
      search: 'cobre',
      category: 'Fungicida',
      hazard: 'Categoría IV — Precaución (Banda Verde)',
      cropId: 12,
      plagueId: null,
      page: 2,
      limit: 24,
    });
  });

  it('aplica filtros exactos de categoría y banda toxicológica en where', () => {
    const query = normalizePublicProductQuery({
      category: 'Insecticida',
      hazard: 'roja',
    });
    expect(buildPublishedProductWhere(Op, query)).toEqual({
      status: true,
      workflow_status: 'published',
      category: 'Insecticida',
      hazard_category: 'Categoría I — Altamente Peligroso (Banda Roja)',
    });
  });

  it('construye URLs de paginación preservando filtros activos', () => {
    expect(
      buildPublicProductPageUrl(3, {
        search: 'amistar',
        category: 'Fungicida',
        hazard: 'Categoría IV — Precaución (Banda Verde)',
        cropId: 5,
        plagueId: 8,
      }),
    ).toBe(
      '/products?page=3&search=amistar&category=Fungicida&hazard=Categor%C3%ADa+IV+%E2%80%94+Precauci%C3%B3n+%28Banda+Verde%29&crop=5&plague=8',
    );
  });

  it('rechaza identificadores públicos inválidos', () => {
    expect(parsePublicProductId('17')).toBe(17);
    expect(parsePublicProductId('1 OR 1=1')).toBeNull();
    expect(parsePublicProductId('-3')).toBeNull();
  });
});
