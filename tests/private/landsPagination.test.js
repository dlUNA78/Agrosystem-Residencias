import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import request from 'supertest';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import { getLandListWhere } from '../../src/services/landAuthorizationService.js';
import {
  buildFilteredLandWhere,
  buildLandsPaginationState,
  clampLandsPage,
  computeLandStatsInMemory,
  DEFAULT_LANDS_PAGE_SIZE,
  fetchLandScopeStats,
  formatLandStatsFromAggregateRow,
  normalizeLandListQuery,
  serializeFarm,
} from '../../src/services/landListQueryService.js';

const { Farm, Region, User, sequelize } = db;

const USER_A_EMAIL = 'lands_pag_user_a@agrosystem.test';
const USER_B_EMAIL = 'lands_pag_user_b@agrosystem.test';
const PASSWORD = 'LandsPagination@1234';

describe('1.A12 Paginación, KPIs agregados y aislamiento de /private/lands', () => {
  let userA = null;
  let userB = null;
  let agentA = null;
  let agentB = null;
  let regionA = null;
  let regionB = null;

  beforeAll(async () => {
    const staleUsers = await User.findAll({
      where: { email: [USER_A_EMAIL, USER_B_EMAIL] },
      order: [['id', 'ASC']],
    });
    if (staleUsers.length > 0) {
      const staleIds = staleUsers.map((u) => u.id);
      await Farm.destroy({ where: { user_id: staleIds } });
      await User.destroy({ where: { id: staleIds } });
    }

    const regions = await Region.findAll({
      attributes: ['id', 'name'],
      order: [['id', 'ASC']],
      limit: 2,
      raw: true,
    });
    regionA = regions[0] || { id: null, name: 'Norte' };
    regionB = regions[1] || regionA;

    const passwordHash = await bcrypt.hash(PASSWORD, 10);
    userA = await User.create({
      full_name: 'Admin Paginación A',
      email: USER_A_EMAIL,
      password_hash: passwordHash,
      role: 'admin',
      status: 'activo',
    });
    userB = await User.create({
      full_name: 'Investigador Aislado B',
      email: USER_B_EMAIL,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });

    // Crear 15 predios activos y 2 archivados para userA (fuerza 2 páginas con pageSize=12)
    const userAFarms = [];
    for (let i = 1; i <= 15; i += 1) {
      userAFarms.push({
        name: `Parcela Paginada A-${String(i).padStart(2, '0')}`,
        user_id: userA.id,
        region_id: i <= 10 ? regionA.id : regionB.id,
        municipality: i % 2 === 0 ? 'Celaya' : 'Uruapan',
        farming_type: i % 3 === 0 ? 'Temporal' : 'Riego',
        size_hectares: Number((i * 1.5).toFixed(2)),
        location_lat: i <= 8 ? 19.43 + i * 0.01 : null,
        location_lng: i <= 8 ? -102.05 - i * 0.01 : null,
        status: true,
      });
    }
    userAFarms.push(
      {
        name: 'Parcela Archivada A-16',
        user_id: userA.id,
        region_id: regionA.id,
        municipality: 'Celaya',
        farming_type: 'Mixto',
        size_hectares: 10.25,
        location_lat: 20.1,
        location_lng: -101.5,
        status: false,
      },
      {
        name: 'Parcela Archivada A-17',
        user_id: userA.id,
        region_id: null,
        municipality: 'León',
        farming_type: 'Orgánico',
        size_hectares: 4.75,
        location_lat: null,
        location_lng: null,
        status: false,
      },
    );
    await Farm.bulkCreate(userAFarms);

    // Crear predios para userB que nunca deben mezclarse con userA
    await Farm.bulkCreate([
      {
        name: 'Predio Exclusivo Usuario B-01',
        user_id: userB.id,
        region_id: regionA.id,
        municipality: 'Culiacán',
        farming_type: 'Riego',
        size_hectares: 88.8,
        location_lat: 24.8,
        location_lng: -107.39,
        status: true,
      },
      {
        name: 'Predio Exclusivo Usuario B-02',
        user_id: userB.id,
        region_id: regionB.id,
        municipality: 'Culiacán',
        farming_type: 'Temporal',
        size_hectares: 12.2,
        location_lat: null,
        location_lng: null,
        status: true,
      },
    ]);

    agentA = request.agent(app);
    const loginA = await agentA
      .post('/auth/login')
      .send({ email: USER_A_EMAIL, password: PASSWORD });
    expect(loginA.status).toBe(302);

    agentB = request.agent(app);
    const loginB = await agentB
      .post('/auth/login')
      .send({ email: USER_B_EMAIL, password: PASSWORD });
    expect(loginB.status).toBe(302);
  });

  afterAll(async () => {
    const userIds = [userA?.id, userB?.id].filter(Boolean);
    if (userIds.length > 0) {
      await Farm.destroy({ where: { user_id: userIds } });
      await User.destroy({ where: { id: userIds } });
    }
    await closeAppResources();
  });

  it('normaliza page no numérico o fuera de rango y mantiene pageSize fijo en 12', () => {
    expect(DEFAULT_LANDS_PAGE_SIZE).toBe(12);
    expect(clampLandsPage('abc', 5)).toBe(1);
    expect(clampLandsPage(null, 5)).toBe(1);
    expect(clampLandsPage(0, 5)).toBe(1);
    expect(clampLandsPage(-8, 5)).toBe(1);
    expect(clampLandsPage(999, 5)).toBe(5);
    expect(clampLandsPage(3, 5)).toBe(3);

    const parsed = normalizeLandListQuery({
      page: 'not-a-number',
      pageSize: '500',
      limit: '500',
      status: 'invalid',
      region: 'abc',
      farmingType: 'Inexistente',
      search: '  Parcela  ',
    });
    expect(parsed).toEqual({
      status: 'active',
      search: 'Parcela',
      region: '',
      regionId: null,
      farmingType: '',
      requestedPage: 1,
    });

    const pag = buildLandsPaginationState(
      15,
      99,
      DEFAULT_LANDS_PAGE_SIZE,
      parsed,
    );
    expect(pag.pageSize).toBe(12);
    expect(pag.totalPages).toBe(2);
    expect(pag.currentPage).toBe(2);
    expect(pag.offset).toBe(12);
    expect(pag.startRecord).toBe(13);
    expect(pag.endRecord).toBe(15);
  });

  it('garantiza paridad exacta entre el agregado SQL COUNT(*) FILTER y el cálculo anterior en memoria', async () => {
    for (const status of ['active', 'archived', 'all']) {
      const rows = await Farm.findAll({
        where: getLandListWhere(userA, { status }),
        order: [
          ['createdAt', 'DESC'],
          ['id', 'DESC'],
        ],
      });
      const serialized = rows.map((f) => serializeFarm(f, userA));
      const inMemoryStats = computeLandStatsInMemory(serialized);
      const sqlStats = await fetchLandScopeStats(sequelize, userA, status);

      expect(sqlStats).not.toBeNull();
      expect({
        total: sqlStats.total,
        totalHectares: sqlStats.totalHectares,
        georeferenced: sqlStats.georeferenced,
        regionsCovered: sqlStats.regionsCovered,
      }).toEqual(inMemoryStats);
      expect(sqlStats.statusCounts).toEqual({
        active: 15,
        archived: 2,
        all: 17,
      });
    }

    const emptyRow = formatLandStatsFromAggregateRow({});
    expect(emptyRow).toMatchObject({
      total: 0,
      totalHectares: '0',
      georeferenced: 0,
      regionsCovered: 0,
    });
  });

  it('pagina en bloques de 12, incluye nav accesible con aria-current y cae en página 1 o última cuando page está fuera de rango', async () => {
    const page1 = await agentA.get('/private/lands?page=abc&pageSize=100');
    expect(page1.status).toBe(200);
    expect(page1.text).toContain('aria-label="Paginación de terrenos"');
    expect(page1.text).toContain('aria-current="page"');
    expect(page1.text).toContain(
      'Mostrando en el mapa los predios con GPS de la página actual.',
    );
    expect(page1.text).toContain('1–12');

    const cardsPage1 = (
      page1.text.match(/data-farm-url="\/private\/lands\/\d+\/expediente"/g) ||
      []
    ).length;
    expect(cardsPage1).toBe(12);

    const pageLast = await agentA.get('/private/lands?page=999');
    expect(pageLast.status).toBe(200);
    expect(pageLast.text).toContain('13–15');
    const cardsPage2 = (
      pageLast.text.match(
        /data-farm-url="\/private\/lands\/\d+\/expediente"/g,
      ) || []
    ).length;
    expect(cardsPage2).toBe(3);
  });

  it('mantiene aislamiento estricto entre usuarios en paginación, filtro de región, búsqueda y exportaciones CSV/GeoJSON', async () => {
    expect(getLandListWhere(userA, { status: 'active' })).toEqual({
      user_id: userA.id,
      status: true,
    });
    expect(
      buildFilteredLandWhere(
        userA,
        normalizeLandListQuery({
          status: 'active',
          region: String(regionA.id),
        }),
      ),
    ).toMatchObject({
      user_id: userA.id,
      status: true,
      region_id: regionA.id,
    });

    // User A buscando término de User B nunca ve predios de User B
    const searchFromA = await agentA.get(
      '/private/lands?search=Exclusivo%20Usuario%20B',
    );
    expect(searchFromA.status).toBe(200);
    expect(searchFromA.text).not.toContain('Predio Exclusivo Usuario B');

    // User A filtrando por región A solo ve sus propios predios en esa región
    const regionFromA = await agentA.get(
      `/private/lands?region=${regionA.id}&page=1`,
    );
    expect(regionFromA.status).toBe(200);
    expect(regionFromA.text).not.toContain('Predio Exclusivo Usuario B');

    // User B en página 1 solo ve sus 2 predios y nunca los de User A
    const listFromB = await agentB.get('/private/lands?page=1');
    expect(listFromB.status).toBe(200);
    expect(listFromB.text).toContain('Predio Exclusivo Usuario B-01');
    expect(listFromB.text).not.toContain('Parcela Paginada A-');

    // Exportaciones CSV y GeoJSON de User A nunca incluyen predios de User B
    const csvA = await agentA.get('/private/lands?format=csv');
    expect(csvA.status).toBe(200);
    expect(csvA.text).toContain('Parcela Paginada A-01');
    expect(csvA.text).not.toContain('Predio Exclusivo Usuario B');

    const geoA = await agentA.get('/private/lands?format=geojson');
    expect(geoA.status).toBe(200);
    const geoNames = (geoA.body.features || []).map((f) => f.properties?.name);
    expect(geoNames).toContain('Parcela Paginada A-01');
    expect(geoNames).not.toContain('Predio Exclusivo Usuario B-01');
  });

  it('filtra correctamente en /private/lands por nombre de región (?search=<región>), por código #PRD-00XX y documenta que un número puro coincide con el id del predio', async () => {
    const targetFarm = await Farm.findOne({
      where: {
        user_id: userA.id,
        name: 'Parcela Paginada A-03',
        status: true,
      },
    });
    expect(targetFarm).not.toBeNull();

    // 1. Búsqueda por nombre de región (?search=<regionA.name>)
    const byRegionName = await agentA.get(
      `/private/lands?search=${encodeURIComponent(regionA.name)}`,
    );
    expect(byRegionName.status).toBe(200);
    expect(byRegionName.text).toContain('Parcela Paginada A-03');
    expect(byRegionName.text).not.toContain('Predio Exclusivo Usuario B-01');

    // 2. Búsqueda por código formateado ?search=%23PRD-00XX
    const prdCode = `#PRD-${String(targetFarm.id).padStart(4, '0')}`;
    const byPrdCode = await agentA.get(
      `/private/lands?search=${encodeURIComponent(prdCode)}`,
    );
    expect(byPrdCode.status).toBe(200);
    expect(byPrdCode.text).toContain('Parcela Paginada A-03');
    expect(byPrdCode.text).not.toContain('Parcela Paginada A-02');

    // 3. Nota documentada: parsePrdCodeId(/^#?(?:prd-?)?0*(\d+)$/i) también acepta un número puro
    // y lo compara contra Farm.id del usuario en sesión (sin exponer predios de otros usuarios).
    const byPureNumericId = await agentA.get(
      `/private/lands?search=${targetFarm.id}`,
    );
    expect(byPureNumericId.status).toBe(200);
    expect(byPureNumericId.text).toContain('Parcela Paginada A-03');
  });
});
