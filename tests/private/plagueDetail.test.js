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

    expect(template).toContain('id="private-editorial-panel"');
    expect(template).toContain('id="publication-checklist"');
    expect(template).toContain('readiness.items');
    expect(template).toContain('readiness.isReady');
    expect(template).toContain('Requisitos para revisión y publicación');
    expect(template).toContain('data-relation-search');
    expect(template).toContain('data-relation-counter');
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
        '../../src/controllers/private/plagues/plagueDetailController.js',
        import.meta.url,
      ),
      'utf8',
    );

    expect(controller).not.toMatch(/Confidor|defaultCycle|unpkg\.com/);
    expect(controller).toContain('/js/shared/plague-detail.js');
    expect(privateController).toContain('/js/shared/plague-detail.js');
  });

  it('calcula métricas proporcionales del ciclo biológico, checklist de síntomas y agentes benéficos', () => {
    const detail = buildPlagueDetailView({
      id: 21,
      name: 'Gusano cogollero',
      symptoms: 'Raspado foliar; Perforaciones en cogollo; Excremento húmedo.',
      biological_control: 'Trichogramma spp., Bacillus thuringiensis.',
      control_methods:
        'Monitoreo con feromonas; Aplicación dirigida al verticilo.',
      biological_cycle: [
        {
          title: 'Huevo',
          duration: '2-4 días',
          plantZone: 'Envés foliar',
          damageLevel: 'Sin daño directo',
          isControlWindow: true,
          recommendedAction: 'Liberar Trichogramma spp.',
        },
        {
          title: 'Larva L1-L3',
          duration: '6-8 días',
          plantZone: 'Cogollo',
          damageLevel: 'Severo',
          isControlWindow: true,
          recommendedAction: 'Aplicar Bt al verticilo.',
        },
      ],
    });

    expect(detail.cycleSummary).toEqual(
      expect.objectContaining({
        hasCycle: true,
        stageCount: 2,
        totalDurationLabel: '8–12 días',
        controlWindowCount: 2,
        hasNumericShares: true,
      }),
    );
    expect(detail.plague.biologicalCycle[0]).toEqual(
      expect.objectContaining({
        title: 'Huevo',
        icon: 'egg',
        plantZone: 'Envés foliar',
        damageLevel: 'Sin daño directo',
        isControlWindow: true,
        recommendedAction: 'Liberar Trichogramma spp.',
        sharePercent: 30,
      }),
    );
    expect(detail.plague.biologicalCycle[1].sharePercent).toBe(70);
    expect(detail.symptomItems).toHaveLength(3);
    expect(detail.biologicalAgents).toEqual([
      'Trichogramma spp.',
      'Bacillus thuringiensis',
    ]);
    expect(detail.controlMethodItems).toHaveLength(2);
  });

  it('estructura la ficha técnica en orden de decisión agronómica (resumen, diagnóstico, ciclo, manejo, productos y distribución)', () => {
    const template = fs.readFileSync(
      new URL('../../src/views/shared/plague-detail.hbs', import.meta.url),
      'utf8',
    );

    const orderedAnchors = [
      'id="resumen"',
      'id="diagnostico"',
      'id="ciclo-biologico"',
      'id="manejo-integrado"',
      'id="productos"',
      'id="distribucion"',
    ];
    const positions = orderedAnchors.map((anchor) => template.indexOf(anchor));

    positions.forEach((pos) => expect(pos).toBeGreaterThan(-1));
    for (let i = 1; i < positions.length; i += 1) {
      expect(positions[i]).toBeGreaterThan(positions[i - 1]);
    }
  });

  it('proyecta localmente el mapa vectorial de México sin depender de servicios externos y lo omite si no hay regiones', () => {
    const withRegions = buildPlagueDetailView({
      id: 30,
      name: 'Gusano cogollero',
      risk_level: 'Alto',
      regions: [
        {
          name: 'Sinaloa',
          lat: 25.17,
          lng: -107.48,
          PlagueRegions: { risk_level: 'Alto' },
        },
      ],
    });

    expect(withRegions.mexicoMap).not.toBeNull();
    expect(withRegions.mexicoMap.viewBox).toBe('0 0 900 520');
    expect(withRegions.mexicoMap.states).toHaveLength(32);
    expect(withRegions.mexicoMap.matchedStateCount).toBe(1);
    expect(
      withRegions.mexicoMap.states.find((state) => state.estado === 'Sinaloa'),
    ).toEqual(
      expect.objectContaining({
        isAffected: true,
        regionIndex: 0,
        riskLabel: 'Crítico',
      }),
    );
    expect(withRegions.mexicoMap.markers).toHaveLength(1);
    expect(withRegions.mexicoMap.markers[0].x).toBeGreaterThan(0);
    expect(withRegions.mexicoMap.markers[0].y).toBeGreaterThan(0);

    const withoutRegions = buildPlagueDetailView({
      id: 31,
      name: 'Sin regiones',
      regions: [],
    });
    expect(withoutRegions.mexicoMap).toBeNull();
  });

  it('habilita edición directa, confirmación asíncrona, impresión de expediente y diagnóstico diferencial sin estilos inline', () => {
    const template = fs.readFileSync(
      new URL('../../src/views/shared/plague-detail.hbs', import.meta.url),
      'utf8',
    );
    const detailClient = fs.readFileSync(
      new URL('../../public/js/shared/plague-detail.js', import.meta.url),
      'utf8',
    );

    expect(template).toContain('id="print-sheet-header"');
    expect(template).toContain('btn-edit-plague');
    expect(template).toContain('id="btn-delete-plague-detail"');
    expect(template).toContain('id="plague-mexico-map"');
    expect(template).toContain('id="plagas-relacionadas"');
    expect(template).not.toMatch(/\sstyle=/i);
    expect(detailClient).toContain('confirmAsyncAction');
    expect(detailClient).toContain('initializePlagueForm');
  });
});
