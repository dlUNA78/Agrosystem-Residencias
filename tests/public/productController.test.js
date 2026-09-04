import request from 'supertest';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import { calculateFinalPrice } from '../../src/utils/productCalculations.js';

const { Product } = db;

afterAll(closeAppResources);

describe('🧪 Suite de Pruebas Públicas - Módulo de Productos Fitosanitarios', () => {
  let sampleProduct;

  beforeAll(async () => {
    sampleProduct = await Product.findOne({ where: { status: true } });
    if (!sampleProduct) {
      sampleProduct = await Product.create({
        name: 'Producto QA Test',
        active_ingredient: 'Ingrediente QA',
        registration_code: 'REG-QA-100',
        manufacturer: 'AgroLab INIFAP',
        category: 'Fungicida',
        status: true,
      });
    }
  });

  // 1. Códigos de Estado y Contratos
  describe('1. Códigos de Estado y Contratos de Datos', () => {
    it('GET /products debe retornar 200 OK y vista del catálogo público', async () => {
      const response = await request(app).get('/products');
      expect(response.status).toBe(200);
    });

    it('GET /api/products debe retornar 200 OK y esquema JSON exacto (sin secretos ni contraseñas)', async () => {
      const response = await request(app).get('/api/products');
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('products');
      expect(response.body).toHaveProperty('totalCount');
      expect(response.body).toHaveProperty('totalPages');
      expect(response.body).toHaveProperty('currentPage');

      response.body.products.forEach((p) => {
        expect(p).toHaveProperty('id');
        expect(p).toHaveProperty('name');
        expect(p.password).toBeUndefined();
        expect(p.secret_token).toBeUndefined();
      });
    });

    it('GET /products/:id con ID inexistente (ej. 999999) debe retornar 404 Not Found (nunca 500)', async () => {
      const response = await request(app).get('/products/999999');
      expect(response.status).toBe(404);
      expect(response.status).not.toBe(500);
    });
  });

  // 2. Paginación y Filtros
  describe('2. Paginación y Filtros de Búsqueda', () => {
    it('GET /api/products?page=1&limit=5 debe aplicar paginación exacta', async () => {
      const response = await request(app).get('/api/products?page=1&limit=5');
      expect(response.status).toBe(200);
      expect(response.body.products.length).toBeLessThanOrEqual(5);
      expect(response.body.currentPage).toBe(1);
    });

    it('GET /api/products?search=Fungicida debe filtrar por coincidencia', async () => {
      const response = await request(app).get('/api/products?search=Fungicida');
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.products)).toBe(true);
    });
  });

  // 3. Aislamiento y Seguridad (POST, PUT, DELETE -> 401 / 403)
  describe('3. Aislamiento de Métodos No Permitidos en Rutas Públicas', () => {
    it('POST /api/products sin autenticación debe responder 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app)
        .post('/api/products')
        .send({ name: 'Producto Ilegal' });
      expect([401, 403]).toContain(response.status);
    });

    it('PUT /api/products/1 sin autenticación debe responder 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app)
        .put('/api/products/1')
        .send({ name: 'Hack Name' });
      expect([401, 403]).toContain(response.status);
    });

    it('DELETE /api/products/1 sin autenticación debe responder 401 Unauthorized o 403 Forbidden', async () => {
      const response = await request(app).delete('/api/products/1');
      expect([401, 403]).toContain(response.status);
    });
  });

  // 4. Anti-Inyección SQL
  describe('4. Anti-Inyección SQL en Búsquedas', () => {
    it("GET /api/products con payload 1' OR '1'='1 no debe romper el ORM", async () => {
      const response = await request(app).get(
        `/api/products?search=${encodeURIComponent("1' OR '1'='1")}`,
      );
      expect(response.status).toBe(200);
      expect(Array.isArray(response.body.products)).toBe(true);
    });
  });

  // 5. Rate Limiting (429 Too Many Requests)
  describe('5. Rate Limiting en Endpoints Públicos', () => {
    it('Múltiples peticiones ultras rápidas deben eventualmente retornar 429 Too Many Requests', async () => {
      const requests = [];
      for (let i = 0; i < 60; i++) {
        requests.push(request(app).get('/api/products?rateLimitTest=1'));
      }
      const responses = await Promise.all(requests);
      const hasRateLimited = responses.some((r) => r.status === 429);
      expect(hasRateLimited).toBe(true);
    });
  });

  // 6. Lógica de Negocio, Filtros de Visibilidad y Cálculos de Precio
  describe('6. Lógica de Negocio, Visibilidad y Cálculo de Precios', () => {
    it('Productos inactivos (status: false) NUNCA se filtran al público', async () => {
      const disabled = await Product.create({
        name: 'Producto Inactivo QA',
        active_ingredient: 'Inactivo QA',
        registration_code: 'REG-QA-101',
        manufacturer: 'Anon',
        category: 'Herbicida',
        status: false,
      });

      const response = await request(app).get('/api/products');
      expect(response.status).toBe(200);
      const found = response.body.products.find((p) => p.id === disabled.id);
      expect(found).toBeUndefined();

      await disabled.destroy();
    });

    it('calculateFinalPrice debe calcular el precio final exacto considerando descuento e IVA', () => {
      // Precio $100, 10% de descuento -> $90, 16% de IVA -> $104.40
      const price1 = calculateFinalPrice(100, 10, 16);
      expect(price1).toBe(104.4);

      // Precio $500, 20% descuento -> $400, 16% IVA -> $464
      const price2 = calculateFinalPrice(500, 20, 16);
      expect(price2).toBe(464.0);

      // Precio sin descuento ni IVA
      const price3 = calculateFinalPrice(250, 0, 0);
      expect(price3).toBe(250.0);
    });
  });
});
