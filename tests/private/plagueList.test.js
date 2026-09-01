import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import {
  PRIVATE_PLAGUE_PAGE_SIZE,
  buildPrivatePlaguePagination,
  normalizePrivatePlagueListQuery,
} from '../../src/services/plagueListService.js';

describe('listado privado paginado de plagas', () => {
  it('normaliza página y conserva únicamente filtros permitidos', () => {
    expect(
      normalizePrivatePlagueListQuery({
        page: '3',
        search: '  roya amarilla  ',
        category: 'Hongo',
        workflow: 'in_review',
      }),
    ).toEqual({
      page: 3,
      search: 'roya amarilla',
      category: 'Hongo',
      workflow: 'in_review',
    });

    expect(
      normalizePrivatePlagueListQuery({
        page: '-4',
        category: 'categoría manipulada',
        workflow: 'deleted',
      }),
    ).toEqual({ page: 1, search: '', category: '', workflow: '' });
    expect(PRIVATE_PLAGUE_PAGE_SIZE).toBe(12);
  });

  it('limita búsquedas excesivas antes de enviarlas al ORM', () => {
    const query = normalizePrivatePlagueListQuery({ search: 'x'.repeat(300) });

    expect(query.search).toHaveLength(120);
  });

  it('construye una ventana de páginas y preserva todos los filtros', () => {
    const pagination = buildPrivatePlaguePagination({
      requestedPage: 6,
      totalItems: 120,
      filters: {
        search: 'roya amarilla',
        category: 'Hongo',
        workflow: 'published',
      },
    });

    expect(pagination.currentPage).toBe(6);
    expect(pagination.totalPages).toBe(10);
    expect(pagination.pages.map((page) => page.number)).toEqual([
      4, 5, 6, 7, 8,
    ]);
    expect(pagination.pages[2]).toEqual(
      expect.objectContaining({ number: 6, isCurrent: true }),
    );
    expect(pagination.prevUrl).toContain('page=5');
    expect(pagination.nextUrl).toContain('page=7');
    expect(pagination.nextUrl).toContain('search=roya+amarilla');
    expect(pagination.nextUrl).toContain('category=Hongo');
    expect(pagination.nextUrl).toContain('workflow=published');
  });

  it('ajusta páginas fuera de rango y representa correctamente una lista vacía', () => {
    const lastPage = buildPrivatePlaguePagination({
      requestedPage: 99,
      totalItems: 13,
      filters: {},
    });
    const empty = buildPrivatePlaguePagination({
      requestedPage: 8,
      totalItems: 0,
      filters: {},
    });

    expect(lastPage).toEqual(
      expect.objectContaining({ currentPage: 2, fromItem: 13, toItem: 13 }),
    );
    expect(empty).toEqual(
      expect.objectContaining({
        currentPage: 1,
        totalPages: 1,
        fromItem: 0,
        toItem: 0,
        hasPrevPage: false,
        hasNextPage: false,
      }),
    );
  });

  it('usa filtros GET y no conserva eventos o estilos inline en la vista', () => {
    const template = fs.readFileSync(
      new URL('../../src/views/private/catalog/plagues.hbs', import.meta.url),
      'utf8',
    );

    expect(template).toContain('id="plague-filter-form"');
    expect(template).toContain('name="search"');
    expect(template).toContain('pagination.pages');
    expect(template).not.toMatch(/\sonclick=|\sonerror=|\sstyle=/i);
  });

  it('no suplanta al usuario con datos de administrador cuando falta información', () => {
    const navbar = fs.readFileSync(
      new URL('../../src/views/partials/private/navbar.hbs', import.meta.url),
      'utf8',
    );
    const sidebar = fs.readFileSync(
      new URL('../../src/views/partials/private/sidebar.hbs', import.meta.url),
      'utf8',
    );

    expect(navbar).not.toMatch(/Administrador Principal|admin@agrosystem\.com/);
    expect(sidebar).not.toMatch(/\{\{else\}\}ADMIN/);
  });

  it('presenta el ciclo biológico como bloques administrados por JS externo', () => {
    const template = fs.readFileSync(
      new URL('../../src/views/private/catalog/plagues.hbs', import.meta.url),
      'utf8',
    );
    const clientScript = fs.readFileSync(
      new URL('../../public/js/private/plagues.js', import.meta.url),
      'utf8',
    );

    expect(template).toContain('id="biological-cycle-builder"');
    expect(template).toContain('id="btn-add-biological-stage"');
    expect(template).toContain('id="biological-cycle-stage-template"');
    expect(template).not.toMatch(/<textarea[^>]+name="biological_cycle"/);
    expect(clientScript).toContain('addBiologicalStage');
    expect(clientScript).toContain('remove-biological-stage');
  });
});
