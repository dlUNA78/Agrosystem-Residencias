import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';

const { Product, ProductImage, Crop, Plague, User } = db;
const password = 'ProductRoutes@1234';
const emails = [
  'product-author@agrosystem.test',
  'product-reviewer@agrosystem.test',
  'product-admin@agrosystem.test',
];
const completeData = {
  name: 'Producto privado QA',
  category: 'Fungicida',
  active_ingredient: 'Cobre 50%',
  registration_code: 'RSCO-PROD-QA',
  manufacturer: 'Laboratorio QA',
  description: 'Producto completo para probar el flujo editorial.',
  mode_of_action: 'Contacto',
  suggested_dosage: '1 L/ha',
  safety_interval_days: '7',
};
const login = async (user) => {
  const agent = request.agent(app);
  const response = await agent
    .post('/auth/login')
    .send({ email: user.email, password });
  expect(response.status).toBe(302);
  return agent;
};

describe('rutas privadas de productos', () => {
  let author;
  let reviewer;
  let admin;
  let authorAgent;
  let reviewerAgent;
  let adminAgent;
  let product;
  let crop;
  let plague;

  beforeAll(async () => {
    await User.destroy({ where: { email: emails } });
    const passwordHash = await bcrypt.hash(password, 10);
    [author, reviewer, admin] = await Promise.all(
      [
        ['Autora Productos', emails[0], 'inifap'],
        ['Revisor Productos', emails[1], 'inifap'],
        ['Admin Productos', emails[2], 'admin'],
      ].map(([fullName, email, role]) =>
        User.create({
          full_name: fullName,
          email,
          role,
          status: 'activo',
          password_hash: passwordHash,
        }),
      ),
    );
    [authorAgent, reviewerAgent, adminAgent] = await Promise.all([
      login(author),
      login(reviewer),
      login(admin),
    ]);
    product = await Product.create({
      ...completeData,
      safety_interval_days: 7,
      status: true,
      workflow_status: 'draft',
      validation_status: 'En revisión',
      created_by_user_id: author.id,
      updated_by_user_id: author.id,
    });
    await ProductImage.create({
      product_id: product.id,
      image_url: 'images/products/workflow-route-test.png',
      is_primary: true,
      display_order: 0,
    });
    await ProductImage.create({
      product_id: product.id,
      image_url: 'images/products/workflow-route-test-secondary.png',
      is_primary: false,
      display_order: 1,
    });
    crop = await Crop.create({
      name: 'Cultivo relacionado QA',
      scientific_name: 'Test crop',
      category: 'Cereal',
      status: 'aprobado',
      workflow_status: 'published',
      created_by_user_id: author.id,
    });
    plague = await Plague.create({
      name: 'Plaga relacionada QA',
      scientific_name: 'Test plague',
      status: true,
      workflow_status: 'published',
      created_by_user_id: author.id,
    });
  });

  beforeEach(async () => {
    await product.update({
      ...completeData,
      safety_interval_days: 7,
      status: true,
      workflow_status: 'draft',
      validation_status: 'En revisión',
      created_by_user_id: author.id,
      verified_by_user_id: null,
      published_by_user_id: null,
    });
  });

  afterAll(async () => {
    if (product) await product.destroy();
    if (crop) await crop.destroy();
    if (plague) await plague.destroy();
    await User.destroy({ where: { email: emails } });
    await closeAppResources();
  });

  it('renderiza listado y detalle para INIFAP', async () => {
    const list = await authorAgent.get('/private/products');
    const detail = await authorAgent.get(`/private/products/${product.id}`);
    expect(list.status).toBe(200);
    expect(detail.status).toBe(200);
    expect(detail.text).toContain('Flujo editorial');
    expect(detail.text).toContain('Enviar a revisión');
    expect(detail.text).toContain('data-product-gallery');
    expect(detail.text).toContain('data-product-gallery-next');
  });

  it('crea siempre un borrador e ignora estados manipulados', async () => {
    const name = 'Producto creado por ruta QA';
    const response = await authorAgent.post('/private/products/create').send({
      ...completeData,
      name,
      workflow_status: 'published',
      validation_status: 'Aprobado',
      status: false,
    });
    const created = await Product.findOne({ where: { name } });
    try {
      expect(response.status).toBe(302);
      expect(created.workflow_status).toBe('draft');
      expect(created.created_by_user_id).toBe(author.id);
    } finally {
      if (created) await created.destroy();
    }
  });

  it('permite editar al autor y rechaza al revisor', async () => {
    const denied = await reviewerAgent
      .post(`/private/products/update/${product.id}`)
      .send({ ...completeData, description: 'Intento ajeno' });
    const allowed = await authorAgent
      .post(`/private/products/update/${product.id}`)
      .send({ ...completeData, description: 'Edición autorizada' });
    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(302);
  });

  it('guarda cultivos y plagas publicados al editar', async () => {
    const response = await authorAgent
      .post(`/private/products/update/${product.id}`)
      .send({
        ...completeData,
        crop_ids: String(crop.id),
        plague_ids: String(plague.id),
      });

    const [crops, plagues] = await Promise.all([
      product.getCrops(),
      product.getPlagues(),
    ]);
    expect(response.status).toBe(302);
    expect(crops.map(({ id }) => id)).toContain(crop.id);
    expect(plagues.map(({ id }) => id)).toContain(plague.id);
  });

  it('separa autor, revisor y publicación administrativa', async () => {
    await product.update({ workflow_status: 'in_review' });
    const selfReview = await authorAgent
      .post(`/private/products/${product.id}/workflow`)
      .send({ action: 'verify' });
    const review = await reviewerAgent
      .post(`/private/products/${product.id}/workflow`)
      .send({ action: 'verify' });
    const publish = await adminAgent
      .post(`/private/products/${product.id}/workflow`)
      .send({ action: 'publish' });
    expect(selfReview.status).toBe(403);
    expect(review.status).toBe(302);
    expect(publish.status).toBe(302);
    await product.reload();
    expect(product.workflow_status).toBe('published');
    expect(product.verified_by_user_id).toBe(reviewer.id);
    expect(product.published_by_user_id).toBe(admin.id);
  });

  it('reserva la eliminación definitiva al administrador', async () => {
    const disposable = await Product.create({
      ...completeData,
      created_by_user_id: author.id,
    });
    const denied = await authorAgent.post(
      `/private/products/delete/${disposable.id}`,
    );
    const allowed = await adminAgent.post(
      `/private/products/delete/${disposable.id}`,
    );
    expect(denied.status).toBe(403);
    expect(allowed.status).toBe(302);
    expect(await Product.findByPk(disposable.id)).toBeNull();
  });
});
