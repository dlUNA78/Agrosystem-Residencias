import { describe, expect, it } from '@jest/globals';

import {
  buildAgriculturalCalendar,
  buildCropDetailView,
  formatAltitudeRange,
  formatRainfallRange,
  formatTemperatureRange,
} from '../../src/services/cropDetailService.js';

describe('cropDetailService - Rigor de datos y armado de vista de cultivos', () => {
  describe('Formateo de rangos sin inventar valores', () => {
    it('formatea rangos de temperatura con min y max, o solo uno de ellos', () => {
      expect(formatTemperatureRange(18, 30)).toBe('18°C – 30°C');
      expect(formatTemperatureRange(15, null)).toBe('Min. 15°C');
      expect(formatTemperatureRange(null, 32)).toBe('Max. 32°C');
      expect(formatTemperatureRange(null, null)).toBeNull();
      expect(formatTemperatureRange('', undefined)).toBeNull();
    });

    it('formatea rangos de precipitación', () => {
      expect(formatRainfallRange(500, 900)).toBe('500 – 900 mm');
      expect(formatRainfallRange(600, null)).toBe('> 600 mm');
      expect(formatRainfallRange(null, 1200)).toBe('< 1200 mm');
      expect(formatRainfallRange(null, null)).toBeNull();
    });

    it('formatea rangos de altitud con formato local', () => {
      expect(formatAltitudeRange(800, 2200)).toMatch(/800/);
      expect(formatAltitudeRange(800, 2200)).toMatch(/2.*200 msnm/);
      expect(formatAltitudeRange(1000, null)).toMatch(/Desde 1.*000 msnm/);
      expect(formatAltitudeRange(null, 3000)).toMatch(/Hasta 3.*000 msnm/);
      expect(formatAltitudeRange(null, null)).toBeNull();
    });
  });

  describe('Calendario agrícola estimado', () => {
    it('genera calendario para Primavera–Verano (PV)', () => {
      const cal = buildAgriculturalCalendar('Primavera–Verano');
      expect(cal.hasCalendar).toBe(true);
      expect(cal.pattern).toBe('pv');
      expect(cal.months).toHaveLength(12);

      // Abril (idx 3) es siembra
      expect(cal.months[3].status).toBe('siembra');
      expect(cal.months[3].statusLabel).toBe('Siembra');

      // Septiembre (idx 8) es cosecha
      expect(cal.months[8].status).toBe('cosecha');
      expect(cal.months[8].statusLabel).toBe('Cosecha');

      // Julio (idx 6) es desarrollo
      expect(cal.months[6].status).toBe('desarrollo');

      // Diciembre (idx 11) es inactivo
      expect(cal.months[11].status).toBe('inactivo');
    });

    it('genera calendario para Otoño–Invierno (OI)', () => {
      const cal = buildAgriculturalCalendar('Otoño-Invierno');
      expect(cal.hasCalendar).toBe(true);
      expect(cal.pattern).toBe('oi');

      // Noviembre (idx 10) es siembra
      expect(cal.months[10].status).toBe('siembra');

      // Marzo (idx 2) es cosecha
      expect(cal.months[2].status).toBe('cosecha');

      // Enero (idx 0) es desarrollo
      expect(cal.months[0].status).toBe('desarrollo');
    });

    it('genera calendario para Perenne', () => {
      const cal = buildAgriculturalCalendar('Perenne');
      expect(cal.hasCalendar).toBe(true);
      expect(cal.pattern).toBe('perenne');
      expect(cal.months.every((m) => m.status === 'desarrollo')).toBe(true);
    });

    it('devuelve hasCalendar false cuando la temporada no es estándar o es nula', () => {
      const emptyCal = buildAgriculturalCalendar(null);
      expect(emptyCal.hasCalendar).toBe(false);
      expect(emptyCal.months).toHaveLength(0);

      const customCal = buildAgriculturalCalendar('Bajo invernadero');
      expect(customCal.hasCalendar).toBe(false);
    });
  });

  describe('buildCropDetailView - Datos fidedignos y sin valores inventados', () => {
    it('no inventa cifras de maíz cuando los campos están vacíos', () => {
      const emptyCrop = {
        id: 99,
        name: 'Cultivo Desconocido',
        scientific_name: 'Plantae sp.',
      };

      const detail = buildCropDetailView(emptyCrop);

      expect(detail.crop.average_yield).toBeNull();
      expect(detail.kpis.yield).toBeNull();
      expect(detail.kpis.cycle).toBeNull();
      expect(detail.kpis.water).toBeNull();
      expect(detail.crop.temperatureRange).toBeNull();
      expect(detail.crop.rainfallRange).toBeNull();
      expect(detail.crop.altitudeRange).toBeNull();
      expect(detail.crop.ph_range).toBeNull();
      expect(detail.crop.soil_type).toBeNull();
      expect(detail.crop.soilSummary).toBeNull();
      expect(detail.crop.planting_density).toBeNull();
      expect(detail.crop.planting_depth).toBeNull();
      expect(detail.crop.requires_pruning).toBeNull();
      expect(detail.crop.requiresPruningLabel).toBeNull();
      expect(detail.plagues).toHaveLength(0);
      expect(detail.products).toHaveLength(0);
      expect(detail.mexicoMap).toBeNull();
    });

    it('resuelve imágenes ordenadas con la principal primero', () => {
      const cropWithImages = {
        id: 1,
        name: 'Aguacate Hass',
        images: [
          {
            id: 10,
            image_url: 'images/crops/secundaria.webp',
            is_primary: false,
            display_order: 1,
          },
          {
            id: 20,
            image_url: 'images/crops/principal.webp',
            is_primary: true,
            display_order: 2,
          },
        ],
      };

      const detail = buildCropDetailView(cropWithImages);
      expect(detail.primaryImage.id).toBe(20);
      expect(detail.primaryImage.isPrimary).toBe(true);
      expect(detail.crop.image_url).toBe('/images/crops/principal.webp');
      expect(detail.carouselImages[0].id).toBe(20);
      expect(detail.carouselImages[1].id).toBe(10);
    });

    it('asocia plagas y productos sin inventar URLs de respaldo falsas', () => {
      const crop = {
        id: 2,
        name: 'Café Arábica',
        plagues: [
          {
            id: 15,
            name: 'Broca del café',
            scientific_name: 'Hypothenemus hampei',
            risk_level: 'Alto',
            images: [],
          },
        ],
        products: [
          {
            id: 30,
            name: 'Biofungicida Cobre',
            active_ingredient: 'Oxicloruro de cobre',
            images: [],
          },
        ],
      };

      const detail = buildCropDetailView(crop);

      // Plaga sin imagen no debe inventar pulgon-verde.webp
      expect(detail.plagues).toHaveLength(1);
      expect(detail.plagues[0].name).toBe('Broca del café');
      expect(detail.plagues[0].imageUrl).toBeNull();
      expect(detail.plagues[0].hasImage).toBe(false);
      expect(detail.plagues[0].riskLabel).toBe('Crítico');

      // Producto sin imagen no debe inventar confidor-350-sc.webp
      expect(detail.products).toHaveLength(1);
      expect(detail.products[0].name).toBe('Biofungicida Cobre');
      expect(detail.products[0].imageUrl).toBeNull();
      expect(detail.products[0].hasImage).toBe(false);
    });

    it('genera mapa vectorial de México con estados resaltados y predios georreferenciados', () => {
      const crop = {
        id: 3,
        name: 'Maíz Blanco',
        state: 'Sinaloa, Jalisco',
        farms: [
          {
            id: 101,
            name: 'Predio El Encanto',
            municipality: 'Culiacán',
            location_lat: 24.808,
            location_lng: -107.394,
            size_hectares: 25.5,
          },
        ],
      };

      const detail = buildCropDetailView(crop);
      expect(detail.mexicoMap).not.toBeNull();
      expect(detail.mexicoMap.matchedStateCount).toBe(2);
      expect(detail.mexicoMap.markers).toHaveLength(1);
      expect(detail.mexicoMap.markers[0].name).toBe('Predio El Encanto');
      expect(detail.mexicoMap.markers[0].x).toBeGreaterThan(0);
      expect(detail.mexicoMap.markers[0].y).toBeGreaterThan(0);
    });
  });
});
