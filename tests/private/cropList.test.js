import { describe, expect, it } from '@jest/globals';

import {
  PRIVATE_CROP_PAGE_SIZE,
  buildPrivateCropPagination,
  normalizePrivateCropListQuery,
} from '../../src/services/cropListService.js';
import {
  MAX_PUBLIC_CROP_PAGE_SIZE,
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
});
