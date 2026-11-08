import { describe, expect, it } from '@jest/globals';
import {
  buildLandExpedienteCsv,
  buildLandExpedienteGeoJson,
  buildLandExpedientePayload,
} from '../../src/services/landExportService.js';
import { buildProductDetailView } from '../../src/services/productDetailService.js';

describe('exportación del expediente operativo de terrenos y mapeo de riesgo', () => {
  const sampleContext = {
    landId: 'TR-0018',
    land: {
      id: 18,
      name: 'Parcela Experimental Norte',
      status: true,
      size_hectares: '12.50',
      farming_type: 'Riego',
      municipality: 'Celaya',
      location_lat: '20.5235000',
      location_lng: '-100.8157000',
      region: { name: 'El Bajío' },
      user: { full_name: 'Ing. Ana López' },
    },
    lots: [
      {
        id: 3,
        name: 'Bloque A-1',
        size_hectares: 4.5,
        activeCropsCount: 1,
        description: '=SUM(1,2) nota con fórmula potencial',
      },
    ],
    farmCrops: [
      {
        id: 11,
        area_section: 'Bloque A-1',
        plantingDate: '15 mar 2026',
        estimatedHarvestDate: '13 jul 2026',
        statusLabel: 'En curso',
        progressPercent: 45,
        crop: { name: 'Maíz Blanco', scientific_name: 'Zea mays' },
      },
    ],
    healthReports: [
      {
        id: 21,
        observedDate: '02 abr 2026',
        lotName: 'Bloque A-1',
        cropName: 'Maíz Blanco',
        plague_name: 'Gusano cogollero',
        severityLabel: 'Alta',
        description: 'Larvas en cogollo central',
      },
    ],
    applications: [
      {
        id: 31,
        appliedDate: '03 abr 2026',
        lotName: 'Bloque A-1',
        cropName: 'Maíz Blanco',
        product_name: 'Belt 480 SC',
        active_ingredient: 'Flubendiamida',
        dose_value: 0.15,
        dose_unit: 'L/ha',
        notes: 'Aplicación matutina sin viento',
      },
    ],
  };

  it('construye el payload estructurado JSON con métricas consolidadas', () => {
    const payload = buildLandExpedientePayload(sampleContext);

    expect(payload.expedienteCode).toBe('TR-0018');
    expect(payload.land).toMatchObject({
      id: 18,
      name: 'Parcela Experimental Norte',
      status: 'Activo',
      sizeHectares: 12.5,
      region: 'El Bajío',
      coordinates: { lat: 20.5235, lng: -100.8157 },
    });
    expect(payload.summary).toEqual({
      lotsCount: 1,
      cyclesCount: 1,
      healthReportsCount: 1,
      applicationsCount: 1,
    });
  });

  it('genera CSV con BOM UTF-8 y neutraliza inyección de fórmulas en celdas', () => {
    const csv = buildLandExpedienteCsv(sampleContext);

    expect(csv.startsWith('\uFEFF')).toBe(true);
    expect(csv).toContain('TR-0018');
    expect(csv).toContain('Parcela Experimental Norte');
    expect(csv).toContain('Gusano cogollero');
    expect(csv).toContain('Belt 480 SC');
    expect(csv).toContain("'=SUM(1,2) nota con fórmula potencial");
  });

  it('construye un FeatureCollection GeoJSON RFC 7946 válido con coordenadas [lng, lat]', () => {
    const geojson = buildLandExpedienteGeoJson(sampleContext);

    expect(geojson.type).toBe('FeatureCollection');
    expect(geojson.features).toHaveLength(1);
    expect(geojson.features[0].geometry).toEqual({
      type: 'Point',
      coordinates: [-100.8157, 20.5235],
    });
    expect(geojson.features[0].properties.expedienteCode).toBe('TR-0018');
  });

  it('mapea niveles de riesgo "Crítico" con acento a estilo rose en fichas de producto', () => {
    const viewModel = buildProductDetailView({
      id: 7,
      name: 'Ridomil Gold Bravo',
      workflow_status: 'published',
      plagues: [
        { id: 1, name: 'Tizón Tardío', risk_level: 'Crítico' },
        { id: 2, name: 'Cenicilla', risk_level: 'Moderado' },
      ],
    });

    expect(viewModel.relatedPlagues[0].riskTheme).toMatchObject({
      label: 'Crítico',
      badgeClass: expect.stringContaining('rose'),
    });
    expect(viewModel.relatedPlagues[1].riskTheme).toMatchObject({
      label: 'Moderado',
      badgeClass: expect.stringContaining('amber'),
    });
  });
});
