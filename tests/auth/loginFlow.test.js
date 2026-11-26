import { afterAll, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app, { closeAppResources, SESSION_COOKIE_NAME } from '../../app.js';
import db from '../../src/models/index.js';
import bcrypt from 'bcrypt';

const { User } = db;

afterAll(closeAppResources);

describe('🔑 Pruebas de Flujo Completo de Inicio de Sesión (Login Flow)', () => {
  it('Debe iniciar sesión correctamente con credenciales válidas y emitir la cookie personalizada con SameSite=Lax y HttpOnly', async () => {
    // 1. Asegurar que existe un usuario de prueba en la BD
    const testEmail = 'logintest@agrosystem.com';
    const testPassword = 'TestPassword123';
    const hash = await bcrypt.hash(testPassword, 10);

    let testUser = await User.findOne({ where: { email: testEmail } });
    if (!testUser) {
      testUser = await User.create({
        full_name: 'Usuario Prueba Login',
        email: testEmail,
        password_hash: hash,
        role: 'inifap',
      });
    }

    try {
      // 2. Realizar petición POST /auth/login
      const response = await request(app)
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword });

      // 3. Verificaciones de Autenticación Exitosa:
      // Debe responder redirección 302 hacia el inicio '/'
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/');

      // Debe generar y enviar la cookie personalizada de sesión (no connect.sid) con SameSite=Lax y HttpOnly
      const setCookies = response.headers['set-cookie'] || [];
      const sessionCookie = setCookies.find((cookie) =>
        cookie.startsWith(`${SESSION_COOKIE_NAME}=`),
      );
      expect(sessionCookie).toBeDefined();
      expect(
        setCookies.some((cookie) => cookie.startsWith('connect.sid=')),
      ).toBe(false);
      expect(sessionCookie).toMatch(/Path=\//i);
      expect(sessionCookie).toMatch(/HttpOnly/i);
      expect(sessionCookie).toMatch(/SameSite=Lax/i);
    } finally {
      await testUser.destroy();
    }
  });

  it('Debe cerrar sesión mediante POST /auth/logout limpiando la cookie personalizada con atributos coincidentes y redirigir al login', async () => {
    const testEmail = `logout_flow_${Date.now()}@agrosystem.test`;
    const testPassword = 'TestPassword123';
    const hash = await bcrypt.hash(testPassword, 10);
    const testUser = await User.create({
      full_name: 'Usuario Prueba Logout',
      email: testEmail,
      password_hash: hash,
      role: 'inifap',
    });

    try {
      const agent = request.agent(app);
      const loginRes = await agent
        .post('/auth/login')
        .send({ email: testEmail, password: testPassword });
      expect(loginRes.status).toBe(302);

      const response = await agent.post('/auth/logout');
      expect(response.status).toBe(302);
      expect(response.headers.location).toBe('/auth/login');

      const setCookies = response.headers['set-cookie'] || [];
      const clearedCookie = setCookies.find((cookie) =>
        cookie.startsWith(`${SESSION_COOKIE_NAME}=;`),
      );
      expect(clearedCookie).toBeDefined();
      expect(
        setCookies.some((cookie) => cookie.startsWith('connect.sid=')),
      ).toBe(false);
      expect(clearedCookie).toMatch(/Path=\//i);
      expect(clearedCookie).toMatch(/HttpOnly/i);
      expect(clearedCookie).toMatch(/SameSite=Lax/i);
      expect(clearedCookie).toMatch(/Expires=Thu, 01 Jan 1970 00:00:00 GMT/i);

      const postLogoutRes = await agent.get('/dashboard');
      expect(postLogoutRes.status).toBe(302);
      expect(postLogoutRes.headers.location).toBe('/auth/login');
    } finally {
      await testUser.destroy();
    }
  });

  it('Debe redirigir defensivamente a /auth/login si se accede por GET /auth/logout', async () => {
    const response = await request(app).get('/auth/logout');
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/auth/login');
  });
});
