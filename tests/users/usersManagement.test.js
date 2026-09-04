import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';

const { User } = db;

describe('👥 Módulo de Gestión de Usuarios (CRUD + RBAC Admin + Perfil)', () => {
  let testCreatedUserId = null;

  beforeAll(async () => {
    // 1. Limpiar usuario de prueba temporal previo
    await User.destroy({ where: { email: 'usertest_crud@agrosystem.com' } });

    // 2. Asegurar usuario Admin de prueba
    const adminHash = await bcrypt.hash('Admin@1234', 10);
    let adminUser = await User.findOne({
      where: { email: 'admin@agrosystem.com' },
    });
    if (!adminUser) {
      await User.create({
        full_name: 'Administrador TEST',
        email: 'admin@agrosystem.com',
        password_hash: adminHash,
        role: 'admin',
        status: 'activo',
      });
    } else {
      await adminUser.update({
        role: 'admin',
        password_hash: adminHash,
        status: 'activo',
      });
    }

    // 3. Asegurar usuario No-Admin de prueba
    const farmerHash = await bcrypt.hash('Farmer@1234', 10);
    let farmerUser = await User.findOne({
      where: { email: 'agricultor@agrosystem.com' },
    });
    if (!farmerUser) {
      await User.create({
        full_name: 'Agricultor TEST',
        email: 'agricultor@agrosystem.com',
        password_hash: farmerHash,
        role: 'agricultor',
        status: 'activo',
      });
    } else {
      await farmerUser.update({
        role: 'agricultor',
        password_hash: farmerHash,
        status: 'activo',
      });
    }
  });

  afterAll(async () => {
    if (testCreatedUserId) {
      await User.destroy({ where: { id: testCreatedUserId } });
    }
    await User.destroy({ where: { email: 'usertest_crud@agrosystem.com' } });
    await closeAppResources();
  });

  const getAdminAgent = async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({ email: 'admin@agrosystem.com', password: 'Admin@1234' });
    return agent;
  };

  const getFarmerAgent = async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({ email: 'agricultor@agrosystem.com', password: 'Farmer@1234' });
    return agent;
  };

  it('1. Debe denegar el acceso a /private/users a usuarios no administradores (HTTP 403 o redirección)', async () => {
    const farmerAgent = await getFarmerAgent();
    const res = await farmerAgent.get('/private/users');
    expect([403, 302]).toContain(res.status);
  });

  it('2. Debe permitir el acceso a /private/users únicamente a Administradores (HTTP 200)', async () => {
    const adminAgent = await getAdminAgent();
    const res = await adminAgent.get('/private/users');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Usuarios');
  });

  it('3. El Administrador debe poder crear un nuevo usuario vía POST /private/users/create', async () => {
    const adminAgent = await getAdminAgent();
    const res = await adminAgent.post('/private/users/create').send({
      full_name: 'Usuario Prueba CRUD',
      email: 'usertest_crud@agrosystem.com',
      password: 'Password@1234',
      role: 'inifap',
      job_title: 'Investigador Agropecuario',
      phone: '5551234567',
      status: 'activo',
    });

    expect([200, 302]).toContain(res.status);

    const createdUser = await User.findOne({
      where: { email: 'usertest_crud@agrosystem.com' },
    });
    expect(createdUser).not.toBeNull();
    expect(createdUser.full_name).toBe('Usuario Prueba CRUD');
    expect(createdUser.role).toBe('inifap');
    testCreatedUserId = createdUser.id;
  });

  it('4. El Administrador debe poder editar el rol y estatus de un usuario vía POST /private/users/edit/:id', async () => {
    if (!testCreatedUserId) return;

    const adminAgent = await getAdminAgent();
    const res = await adminAgent
      .post(`/private/users/edit/${testCreatedUserId}`)
      .send({
        full_name: 'Usuario Prueba CRUD Modificado',
        email: 'usertest_crud@agrosystem.com',
        role: 'admin',
        status: 'suspendido',
        job_title: 'Administrador Auxiliar',
      });

    expect([200, 302]).toContain(res.status);

    const updatedUser = await User.findByPk(testCreatedUserId);
    expect(updatedUser.full_name).toBe('Usuario Prueba CRUD Modificado');
    expect(updatedUser.role).toBe('admin');
    expect(updatedUser.status).toBe('suspendido');
  });

  it('5. El Administrador debe poder eliminar un usuario vía POST /private/users/delete/:id', async () => {
    if (!testCreatedUserId) return;

    const adminAgent = await getAdminAgent();
    const res = await adminAgent.post(
      `/private/users/delete/${testCreatedUserId}`,
    );

    expect([200, 302]).toContain(res.status);

    const deletedUser = await User.findByPk(testCreatedUserId);
    expect(deletedUser).toBeNull();
    testCreatedUserId = null;
  });

  it('6. Cualquier usuario autenticado (ej. Agricultor) debe poder ver su propio perfil en /profile (HTTP 200)', async () => {
    const farmerAgent = await getFarmerAgent();
    const res = await farmerAgent.get('/profile');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Perfil de Usuario');
    expect(res.text).toContain('agricultor@agrosystem.com');
  });

  it('7. El usuario sin acceso al panel debe poder actualizar sus datos vía POST /profile y redirigirse a /profile sin tocar el panel', async () => {
    const farmerAgent = await getFarmerAgent();
    const res = await farmerAgent.post('/profile').send({
      full_name: 'Agricultor TEST Actualizado',
      phone: '5559876543',
      job_title: 'Productor Agrícola',
      address: 'Valle de Culiacán, Sinaloa',
    });

    expect(res.status).toBe(302);
    expect(res.headers.location).toContain(
      '/profile?success=perfil_actualizado',
    );
    expect(res.headers.location).not.toContain('/private');

    const updatedFarmer = await User.findOne({
      where: { email: 'agricultor@agrosystem.com' },
    });
    expect(updatedFarmer.full_name).toBe('Agricultor TEST Actualizado');
    expect(updatedFarmer.phone).toBe('5559876543');
    expect(updatedFarmer.job_title).toBe('Productor Agrícola');
  });

  it('8. Un usuario sin rol de panel (Agricultor) al intentar ingresar a /private/profile debe ser denegado (HTTP 403)', async () => {
    const farmerAgent = await getFarmerAgent();
    const res = await farmerAgent.get('/private/profile');
    expect(res.status).toBe(403);
  });
});
