import { describe, expect, it } from '@jest/globals';
import { Op } from 'sequelize';

import {
  buildPublishedPlagueQuery,
  buildPublicPlaguePageUrl,
  normalizePublicPlagueQuery,
} from '../../src/services/plaguePublicQueryService.js';

describe('consulta pública de plagas', () => {
  it('normaliza búsqueda, categoría, región, riesgo y paginación', () => {
    expect(
      normalizePublicPlagueQuery({
        search: '  pulgón\0 ',
        category: 'insecto',
        region: 'Sinaloa',
        risk: 'Crítico',
        page: '-5',
        limit: '500',
      }),
    ).toEqual({
      search: 'pulgón',
      category: 'Insectos',
      region: 'Sinaloa',
      risk: 'Crítico',
      page: 1,
      limit: 24,
    });
  });

  it('incluye el filtro regional y exige activo y publicado', () => {
    const query = normalizePublicPlagueQuery({
      region: 'Sinaloa',
      category: 'Hongos',
      risk: 'Moderado',
    });
    const built = buildPublishedPlagueQuery({
      Op,
      query,
      Region: function Region() {},
      PlagueImage: function PlagueImage() {},
    });

    expect(built.where.status).toBe(true);
    expect(built.where.workflow_status).toBe('published');
    expect(built.where.risk_level[Op.in]).toEqual(['Medio', 'Moderado']);
    expect(built.where.category[Op.in]).toEqual(['Hongo', 'Hongos']);
    expect(built.include).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          as: 'regions',
          required: true,
          where: { name: 'Sinaloa' },
        }),
      ]),
    );
  });

  it('conserva todos los filtros al construir otra página', () => {
    const url = buildPublicPlaguePageUrl(2, {
      search: 'roya',
      category: 'Hongos',
      region: 'Bajío',
      risk: 'Crítico',
    });
    expect(url).toContain('page=2');
    expect(url).toContain('search=roya');
    expect(url).toContain('category=Hongos');
    expect(url).toContain('region=Baj%C3%ADo');
    expect(url).toContain('risk=Cr%C3%ADtico');
  });

  it('incluye valores legacy y actuales para cada nivel de riesgo', () => {
    const critical = buildPublishedPlagueQuery({
      Op,
      query: normalizePublicPlagueQuery({ risk: 'Alto' }),
      Region: function Region() {},
      PlagueImage: function PlagueImage() {},
    });
    const low = buildPublishedPlagueQuery({
      Op,
      query: normalizePublicPlagueQuery({ risk: 'Bajo' }),
      Region: function Region() {},
      PlagueImage: function PlagueImage() {},
    });

    expect(critical.where.risk_level[Op.in]).toEqual(['Alto', 'Crítico']);
    expect(low.where.risk_level[Op.in]).toEqual(['Bajo']);
  });
});
