import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';

const { Product, User } = db;
const specialistEmail = 'product-pdf-specialist@agrosystem.test';
const password = 'ProductPdf@1234';

describe('generación local de Ficha Técnica PDF de productos', () => {
  let specialist;
  let specialistAgent;
  let publishedProduct;
  let draftProduct;

  beforeAll(async () => {
    await User.destroy({ where: { email: specialistEmail } });
    const passwordHash = await bcrypt.hash(password, 10);
    specialist = await User.create({
      full_name: 'Especialista PDF Productos',
      email: specialistEmail,
      role: 'inifap',
      status: 'activo',
      password_hash: passwordHash,
    });

    specialistAgent = request.agent(app);
    const loginRes = await specialistAgent
      .post('/auth/login')
      .send({ email: specialistEmail, password });
    expect(loginRes.status).toBe(302);

    publishedProduct = await Product.create({
      name: 'Fungicida PDF Público QA',
      category: 'Fungicida',
      active_ingredient: 'Azoxistrobina 20%',
      registration_code: 'RSCO-PDF-PUB-01',
      manufacturer: 'INIFAP BioLab',
      hazard_category: 'Categoría IV — Precaución (Banda Verde)',
      suggested_dosage: '0.5 L/ha',
      safety_interval_days: 0,
      description: 'Insumo publicado para verificar exportación PDF.',
      status: true,
      workflow_status: 'published',
      validation_status: 'Aprobado',
      created_by_user_id: specialist.id,
    });

    draftProduct = await Product.create({
      name: 'Borrador PDF Privado QA',
      category: 'Insecticida',
      active_ingredient: 'Spinosad 12%',
      registration_code: 'RSCO-PDF-DRF-02',
      manufacturer: 'INIFAP BioLab',
      hazard_category:
        'Categoría II — Moderadamente Peligroso (Banda Amarilla)',
      safety_interval_days: 7,
      status: false,
      workflow_status: 'draft',
      validation_status: 'En revisión',
      created_by_user_id: specialist.id,
    });
  });

  afterAll(async () => {
    if (publishedProduct) await publishedProduct.destroy();
    if (draftProduct) await draftProduct.destroy();
    await User.destroy({ where: { email: specialistEmail } });
    await closeAppResources();
  });

  it('genera PDF válido en ruta pública para producto publicado', async () => {
    const res = await request(app)
      .get(`/products/${publishedProduct.id}?format=pdf`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(/inline;/);
    expect(res.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });

  it('oculta borradores en ruta pública PDF respondiendo 404', async () => {
    const res = await request(app).get(
      `/products/${draftProduct.id}?format=pdf`,
    );
    expect(res.status).toBe(404);
  });

  it('permite descargar PDF en ruta privada incluso en etapa borrador', async () => {
    const res = await specialistAgent
      .get(`/private/products/${draftProduct.id}?format=pdf&download=1`)
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/application\/pdf/);
    expect(res.headers['content-disposition']).toMatch(
      /attachment; filename="INIFAP-Ficha-Producto-\d+-borrador-pdf-privado-qa\.pdf"/,
    );
    expect(res.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
  });
});
