import { afterAll, describe, it, expect } from '@jest/globals';
import request from 'supertest';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import bcrypt from 'bcrypt';

const { User } = db;

afterAll(closeAppResources);

describe('🔑 Pruebas de Flujo Completo de Inicio de Sesión (Login Flow)', () => {
  it('Debe iniciar sesión correctamente con credenciales válidas y mantener la cookie de sesión', async () => {
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

    // 2. Realizar petición POST /auth/login
    const response = await request(app)
      .post('/auth/login')
      .send({ email: testEmail, password: testPassword });

    // 3. Verificaciones de Autenticación Exitosa:
    // Debe responder redirección 302 hacia el inicio '/'
    expect(response.status).toBe(302);
    expect(response.headers.location).toBe('/');
    // Debe generar y enviar la cookie connect.sid de la sesión
    expect(response.headers['set-cookie']).toBeDefined();

    // Limpieza
    await testUser.destroy();
  });
});
