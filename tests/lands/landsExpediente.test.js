import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app from '../../app.js';
import db from '../../src/models/index.js';

const { User, Farm, FarmCrop, Crop } = db;

describe('📋 Módulo de Expediente de Predio (Lands Detail - Ciclos, Reportes & Bitácora)', () => {
  let farmerUser = null;
  let testFarm = null;
  let testCrop = null;

  beforeAll(async () => {
    // Sincronizar esquemas en la base de datos de pruebas
    await db.sequelize.sync();

    // 1. Limpieza de datos de prueba
    await Farm.destroy({
      where: { name: ['Predio Expediente TDD', 'Predio Expediente Editado'] },
    });

    // 2. Crear usuario agricultor para pruebas
    const hash = await bcrypt.hash('FarmerExpediente@1234', 10);
    farmerUser = await User.findOne({
      where: { email: 'farmer_expediente@agrosystem.com' },
    });
    if (!farmerUser) {
      farmerUser = await User.create({
        full_name: 'Farmer Expediente TEST',
        email: 'farmer_expediente@agrosystem.com',
        password_hash: hash,
        role: 'agricultor',
        status: 'activo',
      });
    }

    // 3. Crear predio de prueba
    testFarm = await Farm.create({
      name: 'Predio Expediente TDD',
      size_hectares: 12.5,
      farming_type: 'Riego',
      municipality: 'Uruapan',
      user_id: farmerUser.id,
      status: true,
    });

    // 4. Obtener o crear un cultivo de prueba
    testCrop = await Crop.findOne();
    if (!testCrop) {
      testCrop = await Crop.create({
        name: 'Limón Pérsico TEST',
        scientific_name: 'Citrus latifolia TEST',
        category: 'Frutal',
        status: 'aprobado',
      });
    }
  });

  afterAll(async () => {
    if (testFarm) {
      await db.HealthReport.destroy({ where: { farm_id: testFarm.id } });
      await db.ApplicationLog.destroy({ where: { farm_id: testFarm.id } });
      await FarmCrop.destroy({ where: { farm_id: testFarm.id } });
      await Farm.destroy({ where: { id: testFarm.id } });
    }
    if (farmerUser) {
      await User.destroy({ where: { id: farmerUser.id } });
    }
  });

  async function getFarmerAgent() {
    const agent = request.agent(app);
    await agent.post('/auth/login').type('form').send({
      email: 'farmer_expediente@agrosystem.com',
      password: 'FarmerExpediente@1234',
    });
    return agent;
  }

  it('1. Debe consultar el expediente dinámico del predio propio vía GET /lands/:id/expediente', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.get(`/lands/${testFarm.id}/expediente`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('Predio Expediente TDD');
    expect(res.text).toContain('Uruapan');
  });

  it('2. Debe actualizar la información del predio vía POST /lands/update/:id desde el expediente', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.post(`/lands/update/${testFarm.id}`).send({
      name: 'Predio Expediente Editado',
      size_hectares: 18.0,
      farming_type: 'Tecnificado',
      municipality: 'Tancítaro',
    });

    expect(res.status).toBe(302);
    const updatedFarm = await Farm.findByPk(testFarm.id);
    expect(updatedFarm.name).toBe('Predio Expediente Editado');
    expect(Number(updatedFarm.size_hectares)).toBe(18.0);
  });

  it('3. Debe registrar un nuevo ciclo de cultivo vía POST /lands/:id/crop/create', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.post(`/lands/${testFarm.id}/crop/create`).send({
      crop_id: testCrop.id,
      planting_date: '2026-01-15',
      status: 'En Crecimiento',
    });

    expect(res.status).toBe(302);
    const farmCrop = await FarmCrop.findOne({
      where: { farm_id: testFarm.id, crop_id: testCrop.id, is_active: true },
    });
    expect(farmCrop).not.toBeNull();
  });

  it('4. Debe registrar un hallazgo de salud en la parcela vía POST /lands/:id/health-report/create', async () => {
    const agent = await getFarmerAgent();
    const res = await agent
      .post(`/lands/${testFarm.id}/health-report/create`)
      .send({
        plaga_nombre: 'Gusano Cogollero',
        severidad: 'alta',
        descripcion: 'Afectación observada en el sector norte',
      });

    expect(res.status).toBe(302);
    const report = await db.HealthReport.findOne({
      where: { farm_id: testFarm.id, plaga_nombre: 'Gusano Cogollero' },
    });
    expect(report).not.toBeNull();
    expect(report.severidad).toBe('alta');
  });

  it('5. Debe registrar una aplicación química en la bitácora vía POST /lands/:id/application-log/create', async () => {
    const agent = await getFarmerAgent();
    const res = await agent
      .post(`/lands/${testFarm.id}/application-log/create`)
      .send({
        producto_nombre: 'Lorsban 480 E',
        ingrediente_activo: 'Clorpirifós',
        dosis: '1.5 L/ha',
        fecha_aplicacion: '2026-08-01',
        notas: 'Aplicación matutina',
      });

    expect(res.status).toBe(302);
    const log = await db.ApplicationLog.findOne({
      where: { farm_id: testFarm.id, producto_nombre: 'Lorsban 480 E' },
    });
    expect(log).not.toBeNull();
    expect(log.dosis).toBe('1.5 L/ha');
  });

  it('6. Debe registrar un nuevo ciclo con cultivo personalizado (Opción "Otro") y área/sección', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.post(`/lands/${testFarm.id}/crop/create`).send({
      crop_id: 'otro',
      custom_crop_name: 'Chile Jalapeño Criollo',
      area_section: 'Lote Norte 2',
      planting_date: '2026-02-10',
      status: 'En Crecimiento',
    });

    expect(res.status).toBe(302);
    const customCrop = await FarmCrop.findOne({
      where: {
        farm_id: testFarm.id,
        custom_crop_name: 'Chile Jalapeño Criollo',
      },
    });
    expect(customCrop).not.toBeNull();
    expect(customCrop.area_section).toBe('Lote Norte 2');
    expect(customCrop.crop_id).toBeNull();
  });

  it('7. Debe registrar hallazgo fitosanitario y aplicación química personalizada (Opción "Otro")', async () => {
    const agent = await getFarmerAgent();
    // Hallazgo personalizado
    const resReport = await agent
      .post(`/lands/${testFarm.id}/health-report/create`)
      .send({
        plaga_nombre: 'Ácaro Desconocido (Personalizado)',
        severidad: 'media',
        descripcion: 'Manchas amarillas inusuales',
      });
    expect(resReport.status).toBe(302);

    const report = await db.HealthReport.findOne({
      where: {
        farm_id: testFarm.id,
        plaga_nombre: 'Ácaro Desconocido (Personalizado)',
      },
    });
    expect(report).not.toBeNull();

    // Aplicación química personalizada
    const resLog = await agent
      .post(`/lands/${testFarm.id}/application-log/create`)
      .send({
        producto_nombre: 'Bio-Fungicida Orgánico Especial',
        ingrediente_activo: 'Extracto de Ajo + Neem',
        dosis: '2.0 L/ha',
      });
    expect(resLog.status).toBe(302);

    const log = await db.ApplicationLog.findOne({
      where: {
        farm_id: testFarm.id,
        producto_nombre: 'Bio-Fungicida Orgánico Especial',
      },
    });
    expect(log).not.toBeNull();
    expect(log.ingrediente_activo).toBe('Extracto de Ajo + Neem');
  });

  it('8. Debe auto-generar las 5 etapas en FarmCropProgress al crear un ciclo', async () => {
    const agent = await getFarmerAgent();
    const res = await agent.post(`/lands/${testFarm.id}/crop/create`).send({
      crop_id: 'otro',
      custom_crop_name: 'Tomate Saladette TDD',
      area_section: 'Lote Sur 1',
      planting_date: '2026-03-01',
      status: 'Siembra',
    });
    expect(res.status).toBe(302);

    const farmCrop = await FarmCrop.findOne({
      where: {
        farm_id: testFarm.id,
        custom_crop_name: 'Tomate Saladette TDD',
      },
    });
    expect(farmCrop).not.toBeNull();

    const stages = await db.FarmCropProgress.findAll({
      where: { farm_crop_id: farmCrop.id },
      order: [['stage_order', 'ASC']],
    });

    expect(stages.length).toBe(5);
    expect(stages[0].stage_name).toMatch(/Siembra/i);
    expect(stages[0].status).toBe('Completada');
    expect(stages[1].status).toBe('En Progreso');
  });

  it('9. Debe avanzar de etapa fenológica vía POST /lands/:id/crop-stage/advance', async () => {
    const agent = await getFarmerAgent();
    const farmCrop = await FarmCrop.findOne({
      where: {
        farm_id: testFarm.id,
        custom_crop_name: 'Tomate Saladette TDD',
      },
    });

    const res = await agent
      .post(`/lands/${testFarm.id}/crop-stage/advance`)
      .send({
        farm_crop_id: farmCrop ? farmCrop.id : 1,
        stage_order: 2,
        notes: 'Confirmación de germinación en parcela',
      });

    expect(res.status).toBe(302);

    const updatedStage = await db.FarmCropProgress.findOne({
      where: { farm_crop_id: farmCrop ? farmCrop.id : 1, stage_order: 2 },
    });
    expect(updatedStage.status).toBe('Completada');
    expect(updatedStage.real_date).not.toBeNull();
  });

  it('10. Debe finalizar el ciclo del cultivo vía POST /lands/:id/crop/finish', async () => {
    const agent = await getFarmerAgent();
    const farmCrop = await FarmCrop.findOne({
      where: {
        farm_id: testFarm.id,
        custom_crop_name: 'Tomate Saladette TDD',
      },
    });

    const res = await agent
      .post(`/lands/${testFarm.id}/crop/finish`)
      .send({
        farm_crop_id: farmCrop ? farmCrop.id : 1,
      });

    expect(res.status).toBe(302);

    const finishedCrop = await FarmCrop.findByPk(farmCrop.id);
    expect(finishedCrop.is_active).toBe(false);
    expect(finishedCrop.status).toBe('Finalizado');
  });

  it('11. Debe eliminar un ciclo de cultivo vía POST /lands/:id/crop/delete', async () => {
    const agent = await getFarmerAgent();
    const farmCrop = await FarmCrop.findOne({
      where: {
        farm_id: testFarm.id,
        custom_crop_name: 'Tomate Saladette TDD',
      },
    });

    const res = await agent
      .post(`/lands/${testFarm.id}/crop/delete`)
      .send({
        farm_crop_id: farmCrop ? farmCrop.id : 1,
      });

    expect(res.status).toBe(302);

    const deletedCrop = await FarmCrop.findByPk(farmCrop.id);
    expect(deletedCrop).toBeNull();
  });
});
