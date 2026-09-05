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

const { Crop, CropImage, User } = db;
const testEmails = [
  'crop-author-route@agrosystem.test',
  'crop-reviewer-route@agrosystem.test',
  'crop-admin-route@agrosystem.test',
  'crop-farmer-route@agrosystem.test',
];
const password = 'CropRoutes@1234';
const completeCropData = {
  name: 'Cultivo Workflow Rutas',
  scientific_name: 'Workflow routes crop',
  category: 'Granos y Cereales',
  description: 'Ficha completa para validar el flujo de rutas.',
  region: 'El Bajío',
  climate: 'Templado',
  soil_type: 'Franco',
  cycle: 'Anual',
  season: 'Primavera-Verano',
  water_requirement: 'Medio',
};

const login = async (user) => {
  const agent = request.agent(app);
  const response = await agent
    .post('/auth/login')
    .send({ email: user.email, password });
  expect(response.status).toBe(302);
  return agent;
};

describe('rutas privadas del workflow de cultivos', () => {
  let author;
  let reviewer;
  let admin;
  let farmer;
  let authorAgent;
  let reviewerAgent;
  let adminAgent;
  let farmerAgent;
  let crop;

  beforeAll(async () => {
    await User.destroy({ where: { email: testEmails } });
    const passwordHash = await bcrypt.hash(password, 10);

    [author, reviewer, admin, farmer] = await Promise.all(
      [
        ['Autora Cultivos', testEmails[0], 'inifap'],
        ['Revisor Cultivos', testEmails[1], 'inifap'],
        ['Admin Cultivos', testEmails[2], 'admin'],
        ['Agricultor Cultivos', testEmails[3], 'agricultor'],
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

    [authorAgent, reviewerAgent, adminAgent, farmerAgent] = await Promise.all([
      login(author),
      login(reviewer),
      login(admin),
      login(farmer),
    ]);

    crop = await Crop.create({
      ...completeCropData,
      status: 'pendiente',
      workflow_status: 'draft',
      created_by_user_id: author.id,
      updated_by_user_id: author.id,
    });
    await CropImage.create({
      crop_id: crop.id,
      image_url: 'images/crops/workflow-route-test.png',
      original_name: 'workflow-route-test.png',
      is_primary: true,
      display_order: 0,
    });
  });

  beforeEach(async () => {
    await crop.update({
      ...completeCropData,
      status: 'pendiente',
      workflow_status: 'draft',
      created_by_user_id: author.id,
      updated_by_user_id: author.id,
      verified_by_user_id: null,
      published_by_user_id: null,
      review_notes: null,
    });
  });

  afterAll(async () => {
    if (crop) await crop.destroy();
    await User.destroy({ where: { email: testEmails } });
    await closeAppResources();
  });

  it('redirige al login a quien no está autenticado', async () => {
    const response = await request(app).get('/private/crops');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/login');
  });

  it('impide que un agricultor abra el panel de cultivos', async () => {
    const response = await farmerAgent.get('/private/crops');
    expect(response.status).toBe(403);
  });

  it('renderiza listado y detalle privado para INIFAP', async () => {
    const listResponse = await authorAgent.get('/private/crops');
    const detailResponse = await authorAgent.get(`/private/crops/${crop.id}`);

    expect(listResponse.status).toBe(200);
    expect(listResponse.text).toContain('Cultivo Workflow Rutas');
    expect(detailResponse.status).toBe(200);
    expect(detailResponse.text).toContain('Requisitos para revisión');
    expect(detailResponse.text).toContain('Enviar a revisión');
  });

  it('crea por ruta un borrador propiedad del INIFAP autenticado', async () => {
    const response = await authorAgent.post('/private/crops/create').send({
      name: 'Cultivo Creado por Ruta',
      scientific_name: 'Created route crop',
      category: 'Hortalizas',
      status: 'aprobado',
      workflow_status: 'published',
    });

    expect(response.status).toBe(302);
    const createdCrop = await Crop.findOne({
      where: { name: 'Cultivo Creado por Ruta' },
    });

    try {
      expect(createdCrop).not.toBeNull();
      expect(createdCrop.workflow_status).toBe('draft');
      expect(createdCrop.status).toBe('pendiente');
      expect(createdCrop.created_by_user_id).toBe(author.id);
    } finally {
      if (createdCrop) await createdCrop.destroy();
    }
  });

  it('permite editar al autor y rechaza a otro INIFAP', async () => {
    const deniedResponse = await reviewerAgent
      .post(`/private/crops/update/${crop.id}`)
      .send({ ...completeCropData, description: 'Intento ajeno' });
    const allowedResponse = await authorAgent
      .post(`/private/crops/update/${crop.id}`)
      .send({ ...completeCropData, description: 'Edición autorizada' });

    expect(deniedResponse.status).toBe(403);
    expect(allowedResponse.status).toBe(302);
    await crop.reload();
    expect(crop.description).toBe('Edición autorizada');
  });

  it('rechaza editar una ficha propia cuando está en revisión', async () => {
    await crop.update({ workflow_status: 'in_review' });
    const response = await authorAgent
      .post(`/private/crops/update/${crop.id}`)
      .send(completeCropData);

    expect(response.status).toBe(409);
  });

  it('separa autor, revisor y administrador en las transiciones', async () => {
    await crop.update({ workflow_status: 'in_review' });

    const selfReview = await authorAgent
      .post(`/private/crops/${crop.id}/workflow`)
      .send({ action: 'verify' });
    const review = await reviewerAgent
      .post(`/private/crops/${crop.id}/workflow`)
      .send({ action: 'verify' });
    const inifapPublish = await reviewerAgent
      .post(`/private/crops/${crop.id}/workflow`)
      .send({ action: 'publish' });
    const publish = await adminAgent
      .post(`/private/crops/${crop.id}/workflow`)
      .send({ action: 'publish' });

    expect(selfReview.status).toBe(403);
    expect(review.status).toBe(302);
    expect(inifapPublish.status).toBe(403);
    expect(publish.status).toBe(302);
    await crop.reload();
    expect(crop.workflow_status).toBe('published');
    expect(crop.status).toBe('aprobado');
    expect(crop.verified_by_user_id).toBe(reviewer.id);
    expect(crop.published_by_user_id).toBe(admin.id);
  });

  it('reserva la eliminación definitiva al administrador', async () => {
    const disposableCrop = await Crop.create({
      name: 'Cultivo Eliminable por Admin',
      scientific_name: 'Delete route crop',
      category: 'Otro',
      created_by_user_id: author.id,
    });

    const deniedResponse = await authorAgent.post(
      `/private/crops/delete/${disposableCrop.id}`,
    );
    const allowedResponse = await adminAgent.post(
      `/private/crops/delete/${disposableCrop.id}`,
    );

    expect(deniedResponse.status).toBe(403);
    expect(allowedResponse.status).toBe(302);
    expect(await Crop.findByPk(disposableCrop.id)).toBeNull();
  });
});
