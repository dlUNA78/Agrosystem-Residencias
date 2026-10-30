import { describe, expect, it } from '@jest/globals';

import { buildCropDetailView } from '../../src/services/cropDetailService.js';
import {
  buildCropPdfFilename,
  generateCropPdfBuffer,
  sendCropPdfResponse,
} from '../../src/services/cropPdfService.js';

describe('cropPdfService - Generación de PDF institucional de cultivos', () => {
  const sampleCrop = {
    id: 5,
    name: 'Maíz Blanco',
    common_name: 'Maíz H-515',
    scientific_name: 'Zea mays L.',
    category: 'Cereales',
    botanical_family: 'Poaceae',
    planting_season: 'Primavera–Verano',
    growth_cycle: '120-140 días',
    average_yield: '9.2 Ton/Ha',
    description:
      'Híbrido de maíz blanco de alto rendimiento para valles altos.',
    min_temperature: 18,
    max_temperature: 30,
    min_rainfall: 600,
    max_rainfall: 900,
    soil_type: 'Franco-arcilloso',
    ph_range: '6.5 – 7.2',
    organic_matter: '2.8%',
    drainage: 'Bueno',
    irrigation_type: 'Goteo y Gravedad',
    planting_density: '65,000 pl/Ha',
    planting_depth: '4-5 cm',
    requires_pruning: false,
    nutrients: 'Nitrógeno 120 kg/Ha, Fósforo 60 kg/Ha',
    fertilization: 'Aplicación fraccionada a la siembra y aclareo.',
    state: 'Sinaloa, Guanajuato',
    min_altitude: 1000,
    max_altitude: 2200,
    is_verified: true,
    verified_by: 'Dr. Roberto Mendoza (INIFAP)',
    verified_at: new Date('2026-05-10T12:00:00Z'),
    plagues: [
      {
        id: 1,
        name: 'Gusano cogollero',
        scientific_name: 'Spodoptera frugiperda',
        risk_level: 'Alto',
      },
    ],
    products: [
      {
        id: 2,
        name: 'Bio-Insecticida BT',
        active_ingredient: 'Bacillus thuringiensis',
        category: 'Biológico',
      },
    ],
  };

  it('construye un nombre de archivo normalizado y limpio', () => {
    const filename = buildCropPdfFilename({
      id: 5,
      commonName: 'Maíz H-515',
    });
    expect(filename).toBe('INIFAP-Ficha-Cultivo-5-maiz-h-515.pdf');

    const fallback = buildCropPdfFilename({});
    expect(fallback).toBe('INIFAP-Ficha-Cultivo-cultivo.pdf');
  });

  it('genera un Buffer de PDF válido con encabezado %PDF-', async () => {
    const detail = buildCropDetailView(sampleCrop);
    const pdfBuffer = await generateCropPdfBuffer(detail, { isPrivate: true });

    expect(Buffer.isBuffer(pdfBuffer)).toBe(true);
    expect(pdfBuffer.length).toBeGreaterThan(1000);

    // Verificar firma %PDF- al inicio
    const signature = pdfBuffer.subarray(0, 5).toString('utf8');
    expect(signature).toBe('%PDF-');
  });

  it('sendCropPdfResponse envía los headers adecuados y el buffer', async () => {
    const detail = buildCropDetailView(sampleCrop);
    const headers = {};
    let statusCode = null;
    let endPayload = null;

    const mockRes = {
      setHeader: (name, value) => {
        headers[name] = value;
      },
      status: (code) => {
        statusCode = code;
        return {
          end: (payload) => {
            endPayload = payload;
          },
        };
      },
    };

    await sendCropPdfResponse(mockRes, detail, {
      download: true,
      isPrivate: false,
    });

    expect(statusCode).toBe(200);
    expect(headers['Content-Type']).toBe('application/pdf');
    expect(headers['Content-Disposition']).toMatch(/^attachment; filename=/);
    expect(Buffer.isBuffer(endPayload)).toBe(true);
  });
});
