import { describe, expect, it } from '@jest/globals';

import {
  PRIVATE_CROP_PAGE_SIZE,
  buildPrivateCropPagination,
  normalizePrivateCropListQuery,
} from '../../src/services/cropListService.js';
import {
  MAX_PUBLIC_CROP_PAGE_SIZE,
  buildPublicCropPageUrl,
  buildPublishedCropWhere,
  normalizePublicImagePath,
  normalizePublicCropQuery,
  parsePublicCropId,
} from '../../src/services/cropPublicQueryService.js';

describe('consultas y paginación de cultivos', () => {
  it('normaliza y limita filtros privados a valores conocidos', () => {
    expect(
      normalizePrivateCropListQuery({
        page: '2',
        search: '  maíz\0 ',
        category: 'categoría inventada',
        workflow: 'published',
      }),
    ).toEqual({
      page: 2,
      search: 'maíz',
      category: '',
      workflow: 'published',
    });
  });

  it('acota la página privada y conserva filtros en los enlaces', () => {
    const pagination = buildPrivateCropPagination({
      requestedPage: 99,
      totalItems: PRIVATE_CROP_PAGE_SIZE * 3,
      filters: { search: 'maíz', workflow: 'draft' },
    });

    expect(pagination.currentPage).toBe(3);
    expect(pagination.totalPages).toBe(3);
    expect(pagination.prevUrl).toContain('search=ma%C3%ADz');
    expect(pagination.prevUrl).toContain('workflow=draft');
  });

  it('limita el tamaño de página público y rechaza IDs ambiguos', () => {
    const query = normalizePublicCropQuery({
      page: '-1',
      limit: '99999',
      search: ` ${'a'.repeat(140)} `,
    });

    expect(query.page).toBe(1);
    expect(query.limit).toBe(MAX_PUBLIC_CROP_PAGE_SIZE);
    expect(query.search).toHaveLength(120);
    expect(parsePublicCropId('18')).toBe(18);
    expect(parsePublicCropId('18x')).toBeNull();
  });

  it('normaliza alias públicos de categoría y conserva filtros al paginar', () => {
    const query = normalizePublicCropQuery({
      category: 'cereal',
      search: 'maíz blanco',
      page: '2',
    });
    expect(query.category).toBe('Granos y Cereales');
    expect(buildPublicCropPageUrl(3, query)).toBe(
      '/crops?page=3&search=ma%C3%ADz+blanco&category=Granos+y+Cereales',
    );
    expect(normalizePublicCropQuery({ category: 'inventada' }).category).toBe(
      '',
    );
  });

  it('normaliza rutas de imagen heredadas de Windows y del directorio public', () => {
    expect(normalizePublicImagePath('public\\images\\crops\\maiz.jpg')).toBe(
      '/images/crops/maiz.jpg',
    );
    expect(normalizePublicImagePath('images/crops/maiz.jpg')).toBe(
      '/images/crops/maiz.jpg',
    );
  });

  it('busca la categoría canónica y sus variantes heredadas', () => {
    const Op = { in: Symbol('in') };
    const where = buildPublishedCropWhere(Op, {
      search: '',
      category: 'Granos y Cereales',
    });

    expect(where.category[Op.in]).toEqual([
      'Granos y Cereales',
      'Cereales',
      'Cereal',
    ]);
  });
});
