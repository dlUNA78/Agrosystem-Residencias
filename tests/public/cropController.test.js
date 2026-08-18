import request from 'supertest';
import app from '../../app.js';
import db from '../../src/models/index.js';

const { Crop } = db;

describe('🧪 Suite de Pruebas Públicas - Módulo de Cultivos', () => {
  let sampleCrop;

  beforeAll(async () => {
    sampleCrop = await Crop.findOne({ where: { status: 'aprobado' } });
    if (!sampleCrop) {
      sampleCrop = await Crop.create({
        name: 'Cultivo Maíz QA',
        scientific_name: 'Zea mays qa',
        category: 'Cereales',
        description: 'Descripción para suite de prueba',
        status: 'aprobado',
      });
    }
  });

  // 1. Códigos de Estado y Contratos
  describe('1. Códigos de Estado y Contratos de Datos', () => {
    it('GET /crops debe retornar 200 OK y vista del catálogo público', async () => {
      const response = await request(app).get('/crops');
      expect(response.status).toBe(200);
    });

    it('GET /api/crops debe retornar 200 OK y esquema JSON válido sin datos de admin', async () => {
      const response = await request(app).get('/api/crops');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('crops');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');

      response.body.crops.forEach((c) => {
        expect(c).toHaveProperty('id');
        expect(c).toHaveProperty('name');
        expect(c.password).toBeUndefined();
        expect(c.internal_code).toBeUndefined();
      });
    });

    it('GET /crops/:id con ID inexistente (ej. 999999) debe retornar 404 Not Found (nunca 500)', async () => {
      const response = await request(app).get('/crops/999999');
      expect(response.status).toBe(404);
      expect(response.status).not.toBe(500);
    });
  });

  // 2. Paginación y Filtros
  describe('2. Paginación y Filtros de Búsqueda', () => {
    it('GET /api/crops?page=1&limit=5 debe aplicar límites y paginación exacta', async () => {
      const response = await request(app).get('/api/crops?page=1&limit=5');
      expect(response.status).toBe(200);
      expect(response.body.crops.length).toBeLessThanOrEqual(5);
      expect(response.body.currentPage).toBe(1);
    });

    it('GET /api/crops?category=Cereales debe retornar solo cultivos de esa categoría', async () => {
      const response = await request(app).get('/api/crops?category=Cereales');
      expect(response.status).toBe(200);
      response.body.crops.forEach((c) => {
        expect(c.category).toBe('Cereales');
      });
    });
  });

  // 3. Aislamiento y Seguridad (POST, PUT, DELETE -> 401 / 403)
  describe('3. Aislamiento de Métodos No Permitidos en Rutas Públicas', () => {
    it('POST /api/crops sin autenticación debe responder 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app)
        .post('/api/crops')
        .send({ name: 'Cultivo No Autorizado' });
      expect([401, 403]).toContain(response.status);
    });

    it('PUT /api/crops/1 sin autenticación debe responder 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app)
        .put('/api/crops/1')
        .send({ name: 'Infiltración' });
      expect([401, 403]).toContain(response.status);
    });

    it('DELETE /api/crops/1 sin autenticación debe responder 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app).delete('/api/crops/1');
      expect([401, 403]).toContain(response.status);
    });
  });

  // 4. Anti-Inyección SQL
  describe('4. Anti-Inyección SQL en Búsquedas', () => {
    it("GET /api/crops con payload 1' OR '1'='1 no debe colapsar el ORM", async () => {
      const response = await request(app).get(
        `/api/crops?search=${encodeURIComponent("1' OR '1'='1")}`,
      );
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.crops)).toBe(true);
    });
  });

  // 5. Rate Limiting (429 Too Many Requests)
  describe('5. Rate Limiting en Endpoints Públicos', () => {
    it('Múltiples peticiones ultras rápidas deben eventualmente retornar 429 Too Many Requests', async () => {
      const requests = [];
      for (let i = 0; i < 60; i++) {
        requests.push(request(app).get('/api/crops?rateLimitTest=1'));
      }
      const responses = await Promise.all(requests);
      const hasRateLimited = responses.some((r) => r.status === 429);
      expect(hasRateLimited).toBe(true);
    });
  });

  // 6. Lógica de Negocio y Visibilidad
  describe('6. Lógica de Negocio y Filtros de Visibilidad', () => {
    it('Cultivos no aprobados o en borrador (status !== "aprobado") NUNCA se muestran al público', async () => {
      const pendingCrop = await Crop.create({
        name: 'Cultivo Borrador QA',
        scientific_name: 'Draftus crop',
        category: 'Hortalizas',
        status: 'pendiente',
      });

      const response = await request(app).get('/api/crops');
      expect(response.status).toBe(200);
      const found = response.body.crops.find((c) => c.id === pendingCrop.id);
      expect(found).toBeUndefined();

      await pendingCrop.destroy();
    });
  });
});
