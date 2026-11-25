import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';

import app, { closeAppResources } from '../../app.js';
import { initializeCropForm } from '../../public/js/private/crops/cropForm.js';
import db from '../../src/models/index.js';
import { PRIVATE_CROP_FARMS_LIMIT } from '../../src/services/cropFarmSummaryService.js';

const { Crop, CropImage, Farm, FarmCrop, Plague, Product, User } = db;
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
  region: 'centro',
  climate: 'templado',
  soil_type: 'franco',
  cycle: 'medio',
  season: 'primavera-verano',
  water_requirement: 'medio',
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

    admin = await User.findOne({
      where: { email: testEmails[2], role: 'admin', status: 'activo' },
      order: [['id', 'ASC']],
    });

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
    expect(detailResponse.text).toContain('data-crop-gallery');
    expect(detailResponse.text).toContain(
      'src="/images/crops/workflow-route-test.png"',
    );
  });

  it('crea por ruta un borrador propiedad del INIFAP autenticado', async () => {
    const response = await authorAgent.post('/private/crops/create').send({
      name: 'Cultivo Creado por Ruta',
      scientific_name: 'Created route crop',
      category: 'Hortalizas',
      region: 'centro',
      status: 'aprobado',
      workflow_status: 'published',
    });

    expect(response.status).toBe(302);
    const createdCrop = await Crop.findOne({
      where: { name: 'Cultivo Creado por Ruta' },
      order: [['id', 'DESC']],
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

  it('devuelve errores por campo sin salir del modal cuando se solicita JSON', async () => {
    const response = await authorAgent
      .post('/private/crops/create')
      .set('Accept', 'application/json')
      .send({
        name: 'Cultivo Inválido por Ruta',
        scientific_name: 'Invalidus crop',
        category: 'Hortalizas',
        region: 'centro',
        harvest_days: '999999999999',
        climate: 'clima-falsificado',
      });

    expect(response.status).toBe(400);
    expect(response.body).toEqual(
      expect.objectContaining({
        success: false,
        fieldErrors: expect.objectContaining({
          harvest_days: expect.any(Array),
          climate: expect.any(Array),
        }),
      }),
    );
    expect(
      await Crop.findOne({ where: { name: 'Cultivo Inválido por Ruta' } }),
    ).toBeNull();
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

  it('permite quitar imágenes existentes y designar nueva imagen principal', async () => {
    const initialImages = await CropImage.findAll({
      where: { crop_id: crop.id },
    });
    const img1 = await CropImage.create({
      crop_id: crop.id,
      image_url: 'images/crops/test-rem-1.webp',
      original_name: 'Foto 1.webp',
      is_primary: false,
      display_order: 1,
    });
    const img2 = await CropImage.create({
      crop_id: crop.id,
      image_url: 'images/crops/test-rem-2.webp',
      original_name: 'Foto 2.webp',
      is_primary: false,
      display_order: 2,
    });

    const removedIds = [...initialImages.map((img) => img.id), img1.id];

    const response = await authorAgent
      .post(`/private/crops/update/${crop.id}`)
      .set('Accept', 'application/json')
      .send({
        ...completeCropData,
        removed_image_ids: removedIds.join(','),
        primary_image_id: String(img2.id),
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    const remainingImages = await CropImage.findAll({
      where: { crop_id: crop.id },
    });
    expect(remainingImages).toHaveLength(1);
    expect(remainingImages[0].id).toBe(img2.id);
    expect(remainingImages[0].is_primary).toBe(true);
  });

  describe('detalle privado /private/crops/:id — privacidad, predios distintos, JSON/PDF y modal (1.A11)', () => {
    const createdFarmIds = [];
    let linkedPlague = null;
    let linkedProduct = null;

    const createClassList = (initial = []) => {
      const classes = new Set(initial);
      return {
        add: (...items) => items.forEach((item) => classes.add(item)),
        remove: (...items) => items.forEach((item) => classes.delete(item)),
        toggle: (item, force) => {
          if (force === undefined) {
            if (classes.has(item)) classes.delete(item);
            else classes.add(item);
            return classes.has(item);
          }
          if (force) classes.add(item);
          else classes.delete(item);
          return force;
        },
        contains: (item) => classes.has(item),
      };
    };

    const createStubElement = (tagName = 'div', initialClasses = []) => {
      const listeners = new Map();
      const attrs = new Map();
      const element = {
        tagName: tagName.toUpperCase(),
        value: '',
        textContent: '',
        innerHTML: '',
        action: '',
        type: '',
        name: '',
        checked: false,
        disabled: false,
        readOnly: false,
        required: false,
        tabIndex: 0,
        dataset: {},
        children: [],
        elements: [],
        classList: createClassList(initialClasses),
        addEventListener(type, fn) {
          if (!listeners.has(type)) listeners.set(type, []);
          listeners.get(type).push(fn);
        },
        dispatchEvent(event) {
          const handlers = listeners.get(event.type) || [];
          handlers.forEach((fn) => fn(event));
          return true;
        },
        setAttribute(k, v) {
          attrs.set(k, String(v));
        },
        getAttribute(k) {
          return attrs.get(k) ?? null;
        },
        appendChild(child) {
          this.children.push(child);
          return child;
        },
        querySelector: () => null,
        querySelectorAll: () => [],
        closest: () => null,
        focus: () => {},
        reset() {
          this.value = '';
        },
        getClientRects: () => [],
      };
      return element;
    };

    beforeAll(async () => {
      const baseTime = Date.parse('2026-10-01T12:00:00.000Z');
      const adminActiveFarms = [];

      for (let i = 1; i <= 14; i += 1) {
        const farm = await Farm.create({
          name: `Predio Admin Cultivo ${String(i).padStart(2, '0')}`,
          municipality: 'Morelia',
          farming_type: 'Riego',
          size_hectares: 10 + i,
          location_lat: 19.6 + i * 0.01,
          location_lng: -101.2 - i * 0.01,
          status: true,
          user_id: admin.id,
        });
        createdFarmIds.push(farm.id);
        adminActiveFarms.push(farm);

        await FarmCrop.create({
          farm_id: farm.id,
          crop_id: crop.id,
          area_section: `Lote ${i}`,
          is_active: true,
          status: 'active',
          createdAt: new Date(baseTime + i * 60_000),
          updatedAt: new Date(baseTime + i * 60_000),
        });
      }

      // Segundo ciclo activo sobre el predio 01 con fecha más reciente:
      // valida COUNT(DISTINCT farm_id), sin tarjetas duplicadas y orden estable.
      await FarmCrop.create({
        farm_id: adminActiveFarms[0].id,
        crop_id: crop.id,
        area_section: 'Lote Re-siembra',
        is_active: true,
        status: 'active',
        createdAt: new Date(baseTime + 99 * 60_000),
        updatedAt: new Date(baseTime + 99 * 60_000),
      });

      const inactiveStatusFarm = await Farm.create({
        name: 'Predio Admin Archivado',
        municipality: 'Uruapan',
        farming_type: 'Temporal',
        location_lat: 19.41,
        location_lng: -102.06,
        status: false,
        user_id: admin.id,
      });
      createdFarmIds.push(inactiveStatusFarm.id);
      await FarmCrop.create({
        farm_id: inactiveStatusFarm.id,
        crop_id: crop.id,
        is_active: true,
        status: 'active',
      });

      const inactiveCycleFarm = await Farm.create({
        name: 'Predio Admin Ciclo Finalizado',
        municipality: 'Zamora',
        farming_type: 'Temporal',
        location_lat: 19.98,
        location_lng: -102.28,
        status: true,
        user_id: admin.id,
      });
      createdFarmIds.push(inactiveCycleFarm.id);
      await FarmCrop.create({
        farm_id: inactiveCycleFarm.id,
        crop_id: crop.id,
        is_active: false,
        status: 'completed',
      });

      for (let j = 1; j <= 2; j += 1) {
        const farmerFarm = await Farm.create({
          name: `Predio Ajeno Agricultor ${j}`,
          municipality: 'Culiacán',
          farming_type: 'Riego',
          location_lat: 24.8 + j * 0.01,
          location_lng: -107.4 - j * 0.01,
          status: true,
          user_id: farmer.id,
        });
        createdFarmIds.push(farmerFarm.id);
        await FarmCrop.create({
          farm_id: farmerFarm.id,
          crop_id: crop.id,
          is_active: true,
          status: 'active',
        });
      }

      linkedPlague = await Plague.create({
        name: 'Plaga Modal Cultivo 1A11',
        scientific_name: 'Pestus modalis',
        category: 'Insecto',
        risk_level: 'Medio',
        status: true,
        workflow_status: 'published',
        created_by_user_id: author.id,
      });
      linkedProduct = await Product.create({
        name: 'Producto Modal Cultivo 1A11',
        category: 'Insecticida',
        active_ingredient: 'Azadiractina',
        registration_code: 'RSCO-1A11-TEST',
        manufacturer: 'Laboratorio Prueba 1A11',
        description: 'Insumo vinculado para probar modal de edición.',
        status: true,
        workflow_status: 'published',
        created_by_user_id: author.id,
      });
      await crop.setPlagues([linkedPlague.id]);
      await crop.setProducts([linkedProduct.id]);
    });

    afterAll(async () => {
      if (createdFarmIds.length > 0) {
        await FarmCrop.destroy({ where: { farm_id: createdFarmIds } });
        await Farm.destroy({ where: { id: createdFarmIds } });
      }
      await crop.setPlagues([]);
      await crop.setProducts([]);
      if (linkedPlague) await linkedPlague.destroy();
      if (linkedProduct) await linkedProduct.destroy();
    });

    it('redirige 302 a no autenticados y devuelve 403 al agricultor en /private/crops/:id', async () => {
      const anonRes = await request(app).get(`/private/crops/${crop.id}`);
      expect(anonRes.status).toBe(302);
      expect(anonRes.headers.location).toBe('/auth/login');

      const farmerHtml = await farmerAgent.get(`/private/crops/${crop.id}`);
      expect(farmerHtml.status).toBe(403);

      const farmerJson = await farmerAgent
        .get(`/private/crops/${crop.id}`)
        .set('Accept', 'application/json');
      expect(farmerJson.status).toBe(403);
    });

    it('admin ve conteo nacional (16), tope de 12 predios propios distintos ordenados y nunca predios ajenos', async () => {
      const res = await adminAgent.get(`/private/crops/${crop.id}`);
      expect(res.status).toBe(200);

      const html = res.text;
      expect(html).toContain('data-national-farms-count="16"');
      expect(html).toContain('Mostrando 12 de 14');
      expect(html).toContain('/private/lands');

      const cardMatches = [...html.matchAll(/data-own-farm-card="(\d+)"/g)];
      const markerMatches = [...html.matchAll(/data-map-marker="(\d+)"/g)];
      expect(cardMatches).toHaveLength(PRIVATE_CROP_FARMS_LIMIT);
      expect(markerMatches).toHaveLength(PRIVATE_CROP_FARMS_LIMIT);

      const renderedFarmIds = cardMatches.map((m) => Number(m[1]));
      expect(new Set(renderedFarmIds).size).toBe(PRIVATE_CROP_FARMS_LIMIT);

      // Predio 01 recibió el ciclo más reciente -> debe aparecer primero;
      // Predios 02 y 03 (los 2 más antiguos tras 01) quedan fuera del tope de 12.
      expect(html).toContain('Predio Admin Cultivo 01');
      expect(html).toContain('Predio Admin Cultivo 14');
      expect(html).not.toContain('Predio Admin Cultivo 02');
      expect(html).not.toContain('Predio Admin Cultivo 03');
      expect(html.indexOf('Predio Admin Cultivo 01')).toBeLessThan(
        html.indexOf('Predio Admin Cultivo 14'),
      );

      // Privacidad y estado activo estrictos
      expect(html).not.toContain('Predio Ajeno Agricultor 1');
      expect(html).not.toContain('Predio Ajeno Agricultor 2');
      expect(html).not.toContain('Predio Admin Archivado');
      expect(html).not.toContain('Predio Admin Ciclo Finalizado');
    });

    it('inifap sin predios propios ve conteo nacional (16), aviso hacia /private/lands y cero predios ajenos', async () => {
      const res = await authorAgent.get(`/private/crops/${crop.id}`);
      expect(res.status).toBe(200);

      const html = res.text;
      expect(html).toContain('data-national-farms-count="16"');
      expect(html).toContain('data-own-farms-empty');
      expect(html).toContain(
        'Ninguno de tus predios tiene un ciclo activo de este cultivo. Registra un ciclo desde el expediente del predio.',
      );
      expect(html).toContain('/private/lands');
      expect([...html.matchAll(/data-own-farm-card="/g)]).toHaveLength(0);
      expect([...html.matchAll(/data-map-marker="/g)]).toHaveLength(0);
      expect(html).not.toContain('Predio Admin Cultivo 01');
      expect(html).not.toContain('Predio Ajeno Agricultor 1');
    });

    it('muestra siempre la pestaña y sección Predios en modo privado incluso con farmsCount = 0 y sin enlaces rotos', async () => {
      const zeroCrop = await Crop.create({
        ...completeCropData,
        name: 'Cultivo Sin Ciclos Activos 1A11',
        status: 'aprobado',
        workflow_status: 'published',
        created_by_user_id: author.id,
        updated_by_user_id: author.id,
      });

      try {
        const res = await adminAgent.get(`/private/crops/${zeroCrop.id}`);
        expect(res.status).toBe(200);

        const html = res.text;
        expect(html).toContain('href="#predios"');
        expect(html).toContain('data-spy-link="predios"');
        expect(html).toContain('id="predios"');
        expect(html).toContain('data-national-farms-count="0"');
        expect(html).toContain('data-own-farms-empty');
        expect(html).toContain(
          '0 predios activos con este cultivo a nivel nacional',
        );
        expect(html).toContain(
          'Ninguno de tus predios tiene un ciclo activo de este cultivo. Registra un ciclo desde el expediente del predio.',
        );
        expect(html).toContain('/private/lands');
        expect([...html.matchAll(/data-own-farm-card="/g)]).toHaveLength(0);

        const subNavMatch = html.match(/<nav id="sub-nav"[\s\S]*?<\/nav>/);
        expect(subNavMatch).not.toBeNull();
        const anchorIds = [
          ...subNavMatch[0].matchAll(/href="#([a-z0-9-]+)"/g),
        ].map((m) => m[1]);
        expect(anchorIds).toContain('predios');
        for (const anchorId of anchorIds) {
          expect(html).toContain(`id="${anchorId}"`);
        }
      } finally {
        await zeroCrop.destroy();
      }
    });

    it('JSON devuelve farmsCount numérico sin array farms y PDF responde sin requerir predios', async () => {
      const jsonRes = await adminAgent
        .get(`/private/crops/${crop.id}`)
        .set('Accept', 'application/json');

      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.success).toBe(true);
      expect(jsonRes.body.farmsCount).toBe(16);
      expect(jsonRes.body.crop.farmsCount).toBe(16);
      expect(jsonRes.body.crop.farms).toBeUndefined();
      expect(jsonRes.body.crop.plagues).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: linkedPlague.id }),
        ]),
      );
      expect(jsonRes.body.crop.products).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: linkedProduct.id }),
        ]),
      );

      const pdfRes = await adminAgent
        .get(`/private/crops/${crop.id}?format=pdf`)
        .buffer(true)
        .parse((res, cb) => {
          const chunks = [];
          res.on('data', (c) => chunks.push(c));
          res.on('end', () => cb(null, Buffer.concat(chunks)));
        });

      expect(pdfRes.status).toBe(200);
      expect(pdfRes.headers['content-type']).toContain('application/pdf');
      expect(pdfRes.body.subarray(0, 5).toString('ascii')).toBe('%PDF-');
    });

    it('openEditModal en cropForm.js funciona correctamente con el nuevo JSON sin farms', async () => {
      const liveJson = await adminAgent
        .get(`/private/crops/${crop.id}`)
        .set('Accept', 'application/json');
      expect(liveJson.status).toBe(200);
      expect(liveJson.body.crop.farms).toBeUndefined();

      const modal = createStubElement('div', ['hidden']);
      const modalTitle = createStubElement('h2');
      const form = createStubElement('form');
      const validationErrorsList = {
        ...createStubElement('ul'),
        replaceChildren: () => {},
      };
      const validationSummary = createStubElement('div', ['hidden']);
      validationSummary.querySelector = (selector) =>
        selector === '#crop-form-validation-errors'
          ? validationErrorsList
          : null;

      const fieldsById = new Map([
        ['modal-crop', modal],
        ['modal-crop-title', modalTitle],
        ['crop-form', form],
        ['crop-form-validation-summary', validationSummary],
        ['crop-name', createStubElement('input')],
        ['crop-scientific-name', createStubElement('input')],
        ['crop-category', createStubElement('select')],
        ['crop-description', createStubElement('textarea')],
        ['crop-region', createStubElement('input')],
        ['crop-climate', createStubElement('input')],
        ['crop-soil', createStubElement('input')],
        ['crop-cycle', createStubElement('input')],
        ['crop-season', createStubElement('input')],
        ['crop-water', createStubElement('input')],
      ]);

      const plagueCheckbox = createStubElement('input');
      plagueCheckbox.type = 'checkbox';
      plagueCheckbox.name = 'plague_ids';
      plagueCheckbox.value = String(linkedPlague.id);

      const productCheckbox = createStubElement('input');
      productCheckbox.type = 'checkbox';
      productCheckbox.name = 'product_ids';
      productCheckbox.value = String(linkedProduct.id);

      form.querySelectorAll = (selector) => {
        if (selector === 'input[name="plague_ids"]') return [plagueCheckbox];
        if (selector === 'input[name="product_ids"]') return [productCheckbox];
        return [];
      };

      const docListeners = new Map();
      const prevDocument = globalThis.document;
      const prevMutationObserver = globalThis.MutationObserver;
      const prevFetch = globalThis.fetch;

      globalThis.document = {
        activeElement: null,
        body: createStubElement('body'),
        getElementById: (id) => fieldsById.get(id) || null,
        createElement: (tag) => createStubElement(tag),
        addEventListener(type, fn) {
          if (!docListeners.has(type)) docListeners.set(type, []);
          docListeners.get(type).push(fn);
        },
        querySelectorAll: () => [],
      };
      globalThis.MutationObserver = class {
        observe() {}
      };
      globalThis.fetch = jest.fn(async () => ({
        ok: true,
        json: async () => liveJson.body,
      }));

      try {
        initializeCropForm();

        const editButton = { dataset: { id: String(crop.id) } };
        const clickHandlers = docListeners.get('click') || [];
        expect(clickHandlers.length).toBeGreaterThan(0);

        clickHandlers.forEach((handler) =>
          handler({ target: { closest: () => editButton } }),
        );

        await new Promise((resolve) => setImmediate(resolve));
        await new Promise((resolve) => setImmediate(resolve));

        expect(globalThis.fetch).toHaveBeenCalledWith(
          `/private/crops/${crop.id}`,
          { headers: { Accept: 'application/json' } },
        );
        expect(form.action).toBe(`/private/crops/update/${crop.id}`);
        expect(fieldsById.get('crop-name').value).toBe(
          'Cultivo Workflow Rutas',
        );
        expect(fieldsById.get('crop-scientific-name').value).toBe(
          'Workflow routes crop',
        );
        expect(fieldsById.get('crop-category').value).toBe('Granos y Cereales');
        expect(plagueCheckbox.checked).toBe(true);
        expect(productCheckbox.checked).toBe(true);
        expect(modal.classList.contains('flex')).toBe(true);
        expect(modal.classList.contains('hidden')).toBe(false);
      } finally {
        globalThis.document = prevDocument;
        globalThis.MutationObserver = prevMutationObserver;
        globalThis.fetch = prevFetch;
      }
    });
  });
});
