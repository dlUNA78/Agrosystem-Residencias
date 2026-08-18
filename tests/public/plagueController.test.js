import request from 'supertest';
import app from '../../app.js';
import db from '../../src/models/index.js';

const { Plague } = db;

describe('🧪 Suite de Pruebas Públicas - Módulo de Plagas', () => {
  let samplePlague;

  beforeAll(async () => {
    samplePlague = await Plague.findOne({ where: { status: true } });
    if (!samplePlague) {
      samplePlague = await Plague.create({
        name: 'Plaga Test QA',
        scientific_name: 'Testus plaguis',
        category: 'Insectos',
        description: 'Plaga creada para suite estricta de QA',
        risk_level: 'Alto',
        status: true,
      });
    }
  });

  // 1. Códigos de Estado y Contratos
  describe('1. Códigos de Estado y Contratos de Datos', () => {
    it('GET /plagues debe retornar 200 OK y vista del catálogo público', async () => {
      const response = await request(app).get('/plagues');
      expect(response.status).toBe(200);
    });

    it('GET /api/plagues debe retornar 200 OK y contrato JSON estructurado sin contraseñas ni campos ocultos', async () => {
      const response = await request(app).get('/api/plagues');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('plagues');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');

      response.body.plagues.forEach((p) => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p.password).toBeUndefined();
        expect(p.secret_token).toBeUndefined();
      });
    });

    it('GET /plagues/:id con ID inexistente (ej. 999999) debe retornar 404 Not Found (nunca 500)', async () => {
      const response = await request(app).get('/plagues/999999');
      expect(response.status).toBe(404);
      expect(response.status).not.toBe(500);
    });
  });

  // 2. Paginación y Filtros
  describe('2. Paginación y Filtros de Búsqueda', () => {
    it('GET /api/plagues?page=1&limit=5 debe respetar los parámetros de paginación', async () => {
      const response = await request(app).get('/api/plagues?page=1&limit=5');
      expect(response.status).toBe(200);
      expect(response.body.plagues.length).toBeLessThanOrEqual(5);
      expect(response.body.currentPage).toBe(1);
    });

    it('GET /api/plagues?risk=Crítico debe filtrar correctamente por categoría de riesgo', async () => {
      const response = await request(app).get('/api/plagues?risk=Crítico');
      expect(response.status).toBe(200);
      response.body.plagues.forEach((p) => {
        expect(['Crítico', 'Alto']).toContain(p.riskLabel);
      });
    });
  });

  // 3. Aislamiento y Seguridad (POST, PUT, DELETE -> 401 / 403)
  describe('3. Aislamiento y Métodos No Permitidos en Rutas Públicas', () => {
    it('POST /api/plagues sin autenticación debe retornar 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app)
        .post('/api/plagues')
        .send({ name: 'Malicious Plague' });
      expect([401, 403]).toContain(response.status);
    });

    it('PUT /api/plagues/1 sin autenticación debe retornar 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app)
        .put('/api/plagues/1')
        .send({ name: 'Hacked Name' });
      expect([401, 403]).toContain(response.status);
    });

    it('DELETE /api/plagues/1 sin autenticación debe retornar 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app).delete('/api/plagues/1');
      expect([401, 403]).toContain(response.status);
    });
  });

  // 4. Anti-Inyección SQL
  describe('4. Anti-Inyección SQL en Búsquedas', () => {
    it("GET /api/plagues con payload 1' OR '1'='1 no debe romper el ORM", async () => {
      const response = await request(app).get(
        `/api/plagues?search=${encodeURIComponent("1' OR '1'='1")}`,
      );
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.plagues)).toBe(true);
    });
  });

  // 5. Rate Limiting (429 Too Many Requests)
  describe('5. Rate Limiting en Endpoints Públicos', () => {
    it('Múltiples peticiones ultras rápidas deben eventualmente retornar 429 Too Many Requests', async () => {
      const requests = [];
      for (let i = 0; i < 60; i++) {
        requests.push(request(app).get('/api/plagues?rateLimitTest=1'));
      }
      const responses = await Promise.all(requests);
      const hasRateLimited = responses.some((r) => r.status === 429);
      expect(hasRateLimited).toBe(true);
    });
  });

  // 6. Lógica de Negocio y Visibilidad
  describe('6. Lógica de Negocio y Filtros de Visibilidad', () => {
    it('Registros inactivos (status: false) NUNCA deben mostrarse en el catálogo público', async () => {
      const inactive = await Plague.create({
        name: 'Plaga Inactiva QA Test',
        scientific_name: 'Inactivus test',
        status: false,
      });

      const response = await request(app).get('/api/plagues');
      expect(response.status).toBe(200);
      const found = response.body.plagues.find((p) => p.id === inactive.id);
      expect(found).toBeUndefined();

      await inactive.destroy();
    });
  });
});
