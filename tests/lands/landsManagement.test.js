import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../app.js';
import db from '../../src/models/index.js';

const { User, Farm } = db;

describe('🌾 Módulo de Gestión de Terrenos y Predios (Lands - CRUD + Isolating user_id)', () => {
  let farmerUser = null;
  let anotherUser = null;
  let testFarmId = null;

  beforeAll(async () => {
    // 1. Limpiar predios de prueba previos
    await Farm.destroy({
      where: {
        name: [
          'Predio Test TDD',
          'Predio Test Actualizado',
          'Predio Ajeno TDD',
        ],
      },
    });

    // 2. Asegurar usuario Agricultor A
    const farmerHash = await bcrypt.hash('Farmer@1234', 10);
    farmerUser = await User.findOne({
      where: { email: 'agricultor_lands@agrosystem.com' },
    });
    if (!farmerUser) {
      farmerUser = await User.create({
        full_name: 'Agricultor Lands TEST',
        email: 'agricultor_lands@agrosystem.com',
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

    // 3. Asegurar usuario Agricultor B (para probar aislamiento de predios)
    anotherUser = await User.findOne({
      where: { email: 'agricultor_other@agrosystem.com' },
    });
    if (!anotherUser) {
      anotherUser = await User.create({
        full_name: 'Agricultor Ajeno TEST',
        email: 'agricultor_other@agrosystem.com',
        password_hash: farmerHash,
        role: 'agricultor',
        status: 'activo',
      });
    }
  });

  afterAll(async () => {
    // Limpieza final de predios y usuarios de prueba
    await Farm.destroy({
      where: {
        name: [
          'Predio Test TDD',
          'Predio Test Actualizado',
          'Predio Ajeno TDD',
        ],
      },
    });
    if (farmerUser) await User.destroy({ where: { id: farmerUser.id } });
    if (anotherUser) await User.destroy({ where: { id: anotherUser.id } });
  });

  const getFarmerAgent = async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({
        email: 'agricultor_lands@agrosystem.com',
        password: 'Farmer@1234',
      });
    return agent;
  };

  const getOtherAgent = async () => {
    const agent = request.agent(app);
    await agent
      .post('/auth/login')
      .send({
        email: 'agricultor_other@agrosystem.com',
        password: 'Farmer@1234',
      });
    return agent;
  };

  it('1. Debe permitir el acceso a /lands a un usuario autenticado (HTTP 200)', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.get('/lands');
    expect(res.status).toBe(200);
    expect(res.text).toContain('Terrenos') ||
      expect(res.text).toContain('Predios');
  });

  it('2. El usuario debe poder registrar un nuevo predio vía POST /lands/create', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.post('/lands/create').send({
      name: 'Predio Test TDD',
      size_hectares: 15.5,
      farming_type: 'Riego',
      municipality: 'Uruapan',
      location_lat: '19.4167',
      location_lng: '-102.0667',
    });

    expect(res.status).toBe(302); // Redirección a /lands

    const createdFarm = await Farm.findOne({
      where: { name: 'Predio Test TDD', user_id: farmerUser.id },
    });
    expect(createdFarm).not.toBeNull();
    expect(Number(createdFarm.size_hectares)).toBe(15.5);
    testFarmId = createdFarm.id;
  });

  it('3. El usuario debe poder consultar el expediente de su propio predio', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.get(`/lands/${testFarmId}/expediente`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Predio Test TDD');
  });

  it('4. Un usuario NO debe poder acceder al expediente de un predio ajeno (HTTP 404)', async () => {
    const otherAgent = await getOtherAgent();
    const res = await otherAgent.get(`/lands/${testFarmId}/expediente`);
    expect(res.status).toBe(404);
  });

  it('5. El propietario debe poder actualizar los datos de su predio vía POST /lands/update/:id', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.post(`/lands/update/${testFarmId}`).send({
      name: 'Predio Test Actualizado',
      size_hectares: 20.0,
      farming_type: 'Tecnificado',
      municipality: 'Zamora',
      location_lat: '19.9833',
      location_lng: '-102.2833',
    });

    expect(res.status).toBe(302);

    const updatedFarm = await Farm.findByPk(testFarmId);
    expect(updatedFarm.name).toBe('Predio Test Actualizado');
    expect(Number(updatedFarm.size_hectares)).toBe(20.0);
  });

  it('6. El propietario debe poder realizar la baja lógica del predio vía POST /lands/delete/:id', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.post(`/lands/delete/${testFarmId}`);
    expect(res.status).toBe(302);

    const deletedFarm = await Farm.findByPk(testFarmId);
    expect(deletedFarm.status).toBe(false);
  });
});
