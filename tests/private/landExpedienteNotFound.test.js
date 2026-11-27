import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import bcrypt from 'bcrypt';
import express from 'express';
import request from 'supertest';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import { sendNotFoundResponse } from '../../src/utils/errorRenderer.js';

const { Farm, User } = db;

describe('Expediente de predio privado: respuesta 404 institucional (HTML y JSON) y layout privado', () => {
  let ownerUser = null;
  let otherInifapUser = null;
  let otherAdminUser = null;
  let ownerFarm = null;

  const ephemeralCredential = `Test-${crypto.randomBytes(12).toString('hex')}`;
  const suffix = `${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const ownerEmail = `land404_owner_${suffix}@agrosystem.test`;
  const otherInifapEmail = `land404_other_${suffix}@agrosystem.test`;
  const otherAdminEmail = `land404_admin_${suffix}@agrosystem.test`;

  beforeAll(async () => {
    const hash = await bcrypt.hash(ephemeralCredential, 10);

    ownerUser = await User.create({
      full_name: 'Propietario Expediente 404',
      email: ownerEmail,
      password_hash: hash,
      role: 'inifap',
      status: 'activo',
    });

    otherInifapUser = await User.create({
      full_name: 'Otro Investigador 404',
      email: otherInifapEmail,
      password_hash: hash,
      role: 'inifap',
      status: 'activo',
    });

    otherAdminUser = await User.create({
      full_name: 'Admin No Propietario 404',
      email: otherAdminEmail,
      password_hash: hash,
      role: 'admin',
      status: 'activo',
    });

    ownerFarm = await Farm.create({
      name: `Predio Privado ${suffix}`,
      size_hectares: 4.5,
      farming_type: 'Riego',
      user_id: ownerUser.id,
      status: true,
    });
  });

  afterAll(async () => {
    if (ownerFarm) {
      await Farm.destroy({ where: { id: ownerFarm.id } });
    }
    const userIds = [
      ownerUser?.id,
      otherInifapUser?.id,
      otherAdminUser?.id,
    ].filter(Boolean);
    if (userIds.length > 0) {
      await User.destroy({ where: { id: userIds } });
    }
    await closeAppResources();
  });

  const loginAs = async (email) => {
    const agent = request.agent(app);
    const loginRes = await agent
      .post('/auth/login')
      .send({ email, password: ephemeralCredential });
    expect(loginRes.status).toBe(302);
    return agent;
  };

  const expectInstitutionalPrivate404Html = (response, expectedPath) => {
    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toMatch(/text\/html/i);
    expect(response.text).toContain('Código HTTP 404');
    expect(response.text).toContain('No encontramos la página solicitada');
    expect(response.text).toContain('Predio no encontrado.');
    expect(response.text).toContain(expectedPath);
    // Layout privado (sidebar + scroll-top privado), NO layout público
    expect(response.text).toContain('id="sidebar-backdrop"');
    expect(response.text).toContain('id="private-scroll-top"');
    expect(response.text).not.toContain('Top Bar Institucional');
  };

  it('renderiza vista HTML errors/404 con layout privado para un predio inexistente', async () => {
    const agent = await loginAs(ownerEmail);
    const targetPath = '/private/lands/99999999/expediente';

    const response = await agent.get(targetPath).set('Accept', 'text/html');

    expectInstitutionalPrivate404Html(response, targetPath);
  });

  it('renderiza vista HTML errors/404 con layout privado al abrir expediente de un predio de otro usuario (inifap)', async () => {
    const agent = await loginAs(otherInifapEmail);
    const targetPath = `/private/lands/${ownerFarm.id}/expediente`;

    const response = await agent.get(targetPath).set('Accept', 'text/html');

    expectInstitutionalPrivate404Html(response, targetPath);
  });

  it('renderiza vista HTML errors/404 con layout privado cuando un admin no propietario intenta abrir el expediente', async () => {
    const agent = await loginAs(otherAdminEmail);
    const targetPath = `/private/lands/${ownerFarm.id}/expediente`;

    const response = await agent.get(targetPath).set('Accept', 'text/html');

    expectInstitutionalPrivate404Html(response, targetPath);
  });

  it('retorna JSON estructurado 404 para predio inexistente y predio de otro usuario cuando Accept es application/json', async () => {
    const agent = await loginAs(otherInifapEmail);

    const missingRes = await agent
      .get('/private/lands/99999999/expediente')
      .set('Accept', 'application/json');
    expect(missingRes.status).toBe(404);
    expect(missingRes.body).toEqual({
      error: 'Not Found',
      message: 'Predio no encontrado.',
    });

    const foreignRes = await agent
      .get(`/private/lands/${ownerFarm.id}/expediente`)
      .set('Accept', 'application/json');
    expect(foreignRes.status).toBe(404);
    expect(foreignRes.body).toEqual({
      error: 'Not Found',
      message: 'Predio no encontrado.',
    });
  });

  it('resolveErrorLayout conserva layout privado en routers montados bajo /private donde req.path omite el prefijo', async () => {
    const subApp = express();
    const mountedRouter = express.Router();
    const capturedLayouts = [];

    mountedRouter.get('/lands/:id/expediente', (req, res) => {
      req.user = { id: 1, role: 'inifap' };
      const renderSpy = jest.fn((view, locals) => {
        capturedLayouts.push({ view, layout: locals.layout });
        return res.send(view);
      });
      res.render = renderSpy;
      return sendNotFoundResponse(req, res, 'Predio no encontrado.');
    });

    subApp.use('/private', mountedRouter);

    const response = await request(subApp)
      .get('/private/lands/123/expediente')
      .set('Accept', 'text/html');

    expect(response.status).toBe(404);
    expect(capturedLayouts).toHaveLength(1);
    expect(capturedLayouts[0].view).toBe('errors/404');
    expect(capturedLayouts[0].layout.replace(/\\/g, '/')).toMatch(
      /views\/layouts\/private$/,
    );
  });
});
