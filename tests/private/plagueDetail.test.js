import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';

import { buildPlagueDetailView } from '../../src/services/plagueDetailService.js';

describe('detalle privado de plagas con datos verificables', () => {
  it('presenta el ciclo biológico y las relaciones cargadas desde Sequelize', () => {
    const detail = buildPlagueDetailView({
      id: 12,
      name: 'Gusano cogollero',
      scientific_name: 'Spodoptera frugiperda',
      risk_level: 'Alto',
      biological_cycle: [
        'Huevo sobre el follaje',
        {
          title: 'Larva',
          description: 'Etapa de alimentación',
          duration: '14 días',
        },
      ],
      images: [
        {
          url: 'images/plagues/segunda.webp',
          caption: 'Segunda imagen',
          sort_order: 2,
        },
        {
          url: '/images/plagues/principal.webp',
          caption: 'Daño observado',
          source: 'Expediente 12',
          sort_order: 1,
        },
      ],
      products: [
        {
          id: 4,
          name: 'Producto validado',
          active_ingredient: 'Ingrediente real',
          validation_status: 'Validado',
          images: [{ image_url: 'images/products/producto.webp' }],
        },
      ],
      regions: [
        {
          name: 'Sinaloa',
          lat: 25.17,
          lng: -107.48,
          PlagueRegions: { risk_level: 'Alto' },
        },
      ],
      crops: [
        {
          id: 8,
          name: 'Maíz',
          scientific_name: 'Zea mays',
        },
      ],
      verified_by: 'Dra. Elena Pérez',
      verified_at: '2026-08-20T12:00:00.000Z',
      updatedAt: '2026-08-21T12:00:00.000Z',
    });

    expect(detail.plague.biologicalCycle).toEqual([
      expect.objectContaining({
        step: '01',
        title: 'Etapa 1',
        description: 'Huevo sobre el follaje',
      }),
      expect.objectContaining({
        step: '02',
        title: 'Larva',
        description: 'Etapa de alimentación',
        duration: '14 días',
      }),
    ]);
    expect(detail.carouselImages[0]).toEqual(
      expect.objectContaining({
        url: '/images/plagues/principal.webp',
        source: 'Expediente 12',
      }),
    );
    expect(detail.relatedProducts[0]).toEqual(
      expect.objectContaining({
        id: 4,
        imageUrl: '/images/products/producto.webp',
        isValidated: true,
      }),
    );
    expect(detail.incidenceRegions[0]).toEqual(
      expect.objectContaining({ name: 'Sinaloa', riskLevel: 'Alto' }),
    );
    expect(detail.relatedCrops[0]).toEqual(
      expect.objectContaining({ name: 'Maíz', scientificName: 'Zea mays' }),
    );
    expect(detail.plague.isVerified).toBe(true);
  });

  it('mantiene vacías las secciones sin relaciones en vez de fabricar contenido', () => {
    const detail = buildPlagueDetailView({
      id: 13,
      name: 'Registro incompleto',
      risk_level: null,
      biological_cycle: null,
      images: [],
      products: [],
      regions: [],
      crops: [],
    });

    expect(detail.plague.biologicalCycle).toEqual([]);
    expect(detail.carouselImages).toEqual([]);
    expect(detail.relatedProducts).toEqual([]);
    expect(detail.incidenceRegions).toEqual([]);
    expect(detail.relatedCrops).toEqual([]);
    expect(detail.plague.image_url).toBeNull();
    expect(detail.plague.isVerified).toBe(false);
    expect(JSON.stringify(detail)).not.toMatch(
      /Confidor|Movento|Amistar|El Bajío|Cereales/,
    );
  });

  it('normaliza el formato histórico de ciclo biológico usado por los seeders', () => {
    const detail = buildPlagueDetailView({
      id: 14,
      name: 'Formato histórico',
      biological_cycle: JSON.stringify({
        huevo: '2-4 días',
        larva_temprana: '9-11 días',
      }),
    });

    expect(detail.plague.biologicalCycle).toEqual([
      expect.objectContaining({ title: 'Huevo', duration: '2-4 días' }),
      expect.objectContaining({
        title: 'Larva temprana',
        duration: '9-11 días',
      }),
    ]);
  });

  it('no conserva datos simulados ni código inline en la vista compartida', () => {
    const template = fs.readFileSync(
      new URL('../../src/views/shared/plague-detail.hbs', import.meta.url),
      'utf8',
    );

    expect(template).not.toMatch(
      /Confidor|Movento|Amistar|El Bajío|Cereales|20 generaciones\/año/,
    );
    expect(template).not.toMatch(/<script\b|<style\b|\sonclick=|\sonerror=/i);
  });

  it('muestra el checklist editorial antes de enviar o publicar', () => {
    const template = fs.readFileSync(
      new URL('../../src/views/shared/plague-detail.hbs', import.meta.url),
      'utf8',
    );

    expect(template).toContain('id="publication-checklist"');
    expect(template).toContain('readiness.items');
    expect(template).toContain('readiness.isReady');
    expect(template).toContain('Requisitos para revisión y publicación');
  });

  it('no inyecta fallbacks científicos ni dependencias CDN desde el controlador público', () => {
    const controller = fs.readFileSync(
      new URL(
        '../../src/controllers/public/plagueController.js',
        import.meta.url,
      ),
      'utf8',
    );
    const privateController = fs.readFileSync(
      new URL(
        '../../src/controllers/private/plagueController.js',
        import.meta.url,
      ),
      'utf8',
    );

    expect(controller).not.toMatch(/Confidor|defaultCycle|unpkg\.com/);
    expect(controller).toContain('/js/shared/plague-detail.js');
    expect(privateController).toContain('/js/shared/plague-detail.js');
  });
});
