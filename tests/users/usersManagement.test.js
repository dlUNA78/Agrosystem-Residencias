import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';

const { User, RbacRole } = db;

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

  it('2.1. El buscador Admin encuentra coincidencias parciales sin distinguir mayúsculas', async () => {
    const adminAgent = await getAdminAgent();
    const res = await adminAgent.get('/private/users?search=MINISTRADOR');

    expect(res.status).toBe(200);
    expect(res.text).toContain('admin@agrosystem.com');
    expect(res.text).toContain('value="MINISTRADOR"');
  });

  it('2.2. El buscador Admin muestra un estado vacío seguro', async () => {
    const adminAgent = await getAdminAgent();
    const res = await adminAgent.get(
      '/private/users?search=usuario-que-no-existe-qa',
    );

    expect(res.status).toBe(200);
    expect(res.text).toContain('0</strong> usuario(s) encontrado(s)');
    expect(res.text).toContain('No se encontraron usuarios');
    expect(res.text).not.toMatch(/password_hash|\$2[aby]\$/i);
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

    // Intentar escalar a admin debe ser rechazado por la regla de SuperAdmin único
    const rejectRes = await adminAgent
      .post(`/private/users/edit/${testCreatedUserId}`)
      .send({
        full_name: 'Intento Admin',
        role: 'admin',
        status: 'activo',
      });
    expect([200, 302]).toContain(rejectRes.status);
    const unchanged = await User.findByPk(testCreatedUserId);
    expect(unchanged.role).not.toBe('admin');

    // Modificación válida permitida
    const res = await adminAgent
      .post(`/private/users/edit/${testCreatedUserId}`)
      .send({
        full_name: 'Usuario Prueba CRUD Modificado',
        email: 'usertest_crud@agrosystem.com',
        role: 'agricultor',
        status: 'suspendido',
        job_title: 'Técnico de Campo',
      });

    expect([200, 302]).toContain(res.status);

    const updatedUser = await User.findByPk(testCreatedUserId);
    expect(updatedUser.full_name).toBe('Usuario Prueba CRUD Modificado');
    expect(updatedUser.role).toBe('agricultor');
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

  describe('9. H-2: Reglas de persistencia de rbac_role_id exclusivo para INIFAP en /private/users', () => {
    const CREATE_BLOCKED_EMAIL = 'h2_blocked_farmer@agrosystem.com';
    const CREATE_INIFAP_EMAIL = 'h2_created_inifap@agrosystem.com';
    const EDIT_TARGET_EMAIL = 'h2_edit_target@agrosystem.com';
    let curatorRole = null;
    let auditorRole = null;
    let editTargetUser = null;

    beforeAll(async () => {
      await User.destroy({
        where: {
          email: [CREATE_BLOCKED_EMAIL, CREATE_INIFAP_EMAIL, EDIT_TARGET_EMAIL],
        },
      });
      curatorRole = await RbacRole.findOne({
        where: { slug: 'curador-insumos' },
      });
      auditorRole = await RbacRole.findOne({
        where: { slug: 'auditor-fitosanitario' },
      });
      expect(curatorRole).not.toBeNull();
      expect(auditorRole).not.toBeNull();

      const hash = await bcrypt.hash('H2Users@1234', 10);
      editTargetUser = await User.create({
        full_name: 'Usuario H2 Edición',
        email: EDIT_TARGET_EMAIL,
        password_hash: hash,
        role: 'inifap',
        status: 'activo',
        rbac_role_id: curatorRole.id,
      });
    });

    afterAll(async () => {
      await User.destroy({
        where: {
          email: [CREATE_BLOCKED_EMAIL, CREATE_INIFAP_EMAIL, EDIT_TARGET_EMAIL],
        },
      });
    });

    it('9.1. POST /private/users/create rechaza crear agricultor con rbac_role_id (redirect y JSON) y permite crear INIFAP con sub-rol', async () => {
      const adminAgent = await getAdminAgent();

      const formReject = await adminAgent.post('/private/users/create').send({
        full_name: 'Agricultor Con Subrol Form',
        email: CREATE_BLOCKED_EMAIL,
        password: 'Password@1234',
        role: 'agricultor',
        status: 'activo',
        rbac_role_id: curatorRole.id,
      });
      expect(formReject.status).toBe(302);
      expect(formReject.headers.location).toContain('error=subrol_solo_inifap');
      expect(
        await User.findOne({ where: { email: CREATE_BLOCKED_EMAIL } }),
      ).toBeNull();

      const jsonReject = await adminAgent
        .post('/private/users/create')
        .set('Accept', 'application/json')
        .send({
          full_name: 'Agricultor Con Subrol JSON',
          email: CREATE_BLOCKED_EMAIL,
          password: 'Password@1234',
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: auditorRole.id,
        });
      expect(jsonReject.status).toBe(400);
      expect(jsonReject.body.code).toBe('subrol_solo_inifap');
      expect(
        await User.findOne({ where: { email: CREATE_BLOCKED_EMAIL } }),
      ).toBeNull();

      // INIFAP legítimo sí puede crearse con sub-rol
      const inifapRes = await adminAgent
        .post('/private/users/create')
        .set('Accept', 'application/json')
        .send({
          full_name: 'INIFAP Con Subrol Válido',
          email: CREATE_INIFAP_EMAIL,
          password: 'Password@1234',
          role: 'inifap',
          status: 'activo',
          rbac_role_id: curatorRole.id,
        });
      expect(inifapRes.status).toBe(201);
      expect(inifapRes.body.success).toBe(true);
      const createdInifap = await User.findOne({
        where: { email: CREATE_INIFAP_EMAIL },
      });
      expect(createdInifap).not.toBeNull();
      expect(createdInifap.role).toBe('inifap');
      expect(createdInifap.rbac_role_id).toBe(curatorRole.id);
    });

    it('9.2. POST /private/users/edit/:id rechaza asignar sub-rol a agricultor o admin, limpia sub-rol al degradar y lo preserva para INIFAP', async () => {
      const adminAgent = await getAdminAgent();
      const adminRecord = await User.findOne({
        where: { email: 'admin@agrosystem.com' },
      });

      // 1. Actualizar puesto de INIFAP sin enviar rbac_role_id conserva su sub-rol actual
      const keepSubRoleRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .send({
          mode: 'institutional',
          job_title: 'Investigador Senior',
        });
      expect(keepSubRoleRes.status).toBe(302);
      expect(keepSubRoleRes.headers.location).toContain(
        'success=usuario_actualizado',
      );
      let reloaded = await User.findByPk(editTargetUser.id);
      expect(reloaded.role).toBe('inifap');
      expect(reloaded.rbac_role_id).toBe(curatorRole.id);

      // 2. Intentar degradar a agricultor manteniendo rbac_role_id no nulo -> rechazado (JSON y redirect)
      const rejectDemoteJson = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({
          role: 'agricultor',
          rbac_role_id: curatorRole.id,
        });
      expect(rejectDemoteJson.status).toBe(400);
      expect(rejectDemoteJson.body.code).toBe('subrol_solo_inifap');
      reloaded = await User.findByPk(editTargetUser.id);
      expect(reloaded.role).toBe('inifap');
      expect(reloaded.rbac_role_id).toBe(curatorRole.id);

      // 3. Degradar a agricultor sin rbac_role_id -> fuerza rbac_role_id = null
      const demoteRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .send({
          role: 'agricultor',
          status: 'activo',
        });
      expect(demoteRes.status).toBe(302);
      expect(demoteRes.headers.location).toContain(
        'success=usuario_actualizado',
      );
      reloaded = await User.findByPk(editTargetUser.id);
      expect(reloaded.role).toBe('agricultor');
      expect(reloaded.rbac_role_id).toBeNull();

      // 4. Intentar asignar sub-rol a agricultor (con role omitido) -> rechazado
      const rejectFarmerForm = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .send({
          rbac_role_id: auditorRole.id,
        });
      expect(rejectFarmerForm.status).toBe(302);
      expect(rejectFarmerForm.headers.location).toContain(
        'error=subrol_solo_inifap',
      );
      expect((await User.findByPk(editTargetUser.id)).rbac_role_id).toBeNull();

      // 5. Intentar asignar sub-rol a admin -> rechazado (form y JSON)
      const rejectAdminForm = await adminAgent
        .post(`/private/users/edit/${adminRecord.id}`)
        .send({
          role: 'admin',
          rbac_role_id: curatorRole.id,
        });
      expect(rejectAdminForm.status).toBe(302);
      expect(rejectAdminForm.headers.location).toContain(
        'error=subrol_solo_inifap',
      );

      const rejectAdminJson = await adminAgent
        .post(`/private/users/edit/${adminRecord.id}`)
        .set('Accept', 'application/json')
        .send({
          rbac_role_id: curatorRole.id,
        });
      expect(rejectAdminJson.status).toBe(400);
      expect(rejectAdminJson.body.code).toBe('subrol_solo_inifap');
      expect((await User.findByPk(adminRecord.id)).rbac_role_id).toBeNull();

      // 6. Guardar agricultor con sub-rol huérfano preexistente en BD -> limpia a null
      await editTargetUser.update({
        role: 'agricultor',
        rbac_role_id: auditorRole.id,
      });
      const autoCleanRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({
          job_title: 'Productor Actualizado',
        });
      expect(autoCleanRes.status).toBe(200);
      expect(autoCleanRes.body.user.rbac_role_id).toBeNull();
      expect((await User.findByPk(editTargetUser.id)).rbac_role_id).toBeNull();

      // 7. POST /private/users/status/:id rechaza sub-rol para agricultor y limpia sub-rol huérfano si role !== 'inifap'
      await editTargetUser.update({
        role: 'agricultor',
        rbac_role_id: curatorRole.id,
      });
      const statusRejectRes = await adminAgent
        .post(`/private/users/status/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({ status: 'activo', rbac_role_id: curatorRole.id });
      expect(statusRejectRes.status).toBe(400);
      expect(statusRejectRes.body.code).toBe('subrol_solo_inifap');

      const statusRes = await adminAgent
        .post(`/private/users/status/${editTargetUser.id}`)
        .send({ status: 'activo' });
      expect(statusRes.status).toBe(302);
      expect((await User.findByPk(editTargetUser.id)).rbac_role_id).toBeNull();
    });

    it('9.3. GET /private/users no expone ni renderiza sub-rol huérfano para un agricultor', async () => {
      const adminAgent = await getAdminAgent();
      await editTargetUser.update({
        role: 'agricultor',
        rbac_role_id: curatorRole.id,
      });

      const listRes = await adminAgent.get(
        `/private/users?search=${encodeURIComponent(EDIT_TARGET_EMAIL)}`,
      );
      expect(listRes.status).toBe(200);
      expect(listRes.text).toContain(EDIT_TARGET_EMAIL);
      expect(listRes.text).toContain('data-subrole-name="Sin sub-rol"');

      await editTargetUser.update({ rbac_role_id: null });
    });
  });
});
