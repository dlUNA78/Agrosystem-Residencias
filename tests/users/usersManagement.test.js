import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  afterEach,
  jest,
} from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import { PANEL_PERMISSIONS } from '../../src/services/rbacService.js';

const { User, RbacRole, AuditLog } = db;

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

    afterEach(() => {
      jest.restoreAllMocks();
    });

    afterAll(async () => {
      const testUsers = await User.findAll({
        where: {
          email: [CREATE_BLOCKED_EMAIL, CREATE_INIFAP_EMAIL, EDIT_TARGET_EMAIL],
        },
        attributes: ['id'],
      });
      const testUserIds = testUsers.map((u) => u.id);
      if (testUserIds.length > 0) {
        await AuditLog.destroy({
          where: { table_name: 'Users', record_id: testUserIds },
        });
      }
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

      // Sub-rol inexistente en creación debe devolver 400 rol_no_encontrado (nunca 500 FK)
      const invalidRoleCreate = await adminAgent
        .post('/private/users/create')
        .set('Accept', 'application/json')
        .send({
          full_name: 'INIFAP Subrol Inexistente',
          email: CREATE_BLOCKED_EMAIL,
          password: 'Password@1234',
          role: 'inifap',
          status: 'activo',
          rbac_role_id: 999999,
        });
      expect(invalidRoleCreate.status).toBe(400);
      expect(invalidRoleCreate.body.code).toBe('rol_no_encontrado');
      expect(
        await User.findOne({ where: { email: CREATE_BLOCKED_EMAIL } }),
      ).toBeNull();

      // INIFAP legítimo sí puede crearse con sub-rol y genera auditoría enriquecida sin password_hash
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

      const createAudit = await AuditLog.findOne({
        where: {
          table_name: 'Users',
          record_id: createdInifap.id,
          action: 'create',
        },
        order: [['id', 'DESC']],
      });
      expect(createAudit).not.toBeNull();
      expect(createAudit.old_values).toBeNull();
      expect(createAudit.new_values.rbac_role_name).toBe(curatorRole.name);
      expect(createAudit.new_values.rbac_role_slug).toBe(curatorRole.slug);
      expect(createAudit.new_values.password).toBeUndefined();
      expect(createAudit.new_values.password_hash).toBeUndefined();
      expect(Array.isArray(createAudit.new_values.effective_permissions)).toBe(
        true,
      );
    });

    it('9.2. POST /private/users/edit/:id revoca sub-rol y custom_permissions automáticamente al degradar (H-3), rechaza sub-rol en no-INIFAP y audita H-4', async () => {
      const adminAgent = await getAdminAgent();
      const adminRecord = await User.findOne({
        where: { email: 'admin@agrosystem.com' },
      });

      // 1. Actualizar puesto de INIFAP sin enviar rbac_role_id conserva su sub-rol actual y audita acción 'update'
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

      const nonRoleAudit = await AuditLog.findOne({
        where: { table_name: 'Users', record_id: editTargetUser.id },
        order: [['id', 'DESC']],
      });
      expect(nonRoleAudit.action).toBe('update');

      // 2. H-3 (Opción 1): Degradar INIFAP -> agricultor enviando sub-rol previo (o distinto) retira sub-rol y custom_permissions automáticamente
      await User.update(
        {
          role: 'inifap',
          rbac_role_id: curatorRole.id,
          custom_permissions: {
            allow: [PANEL_PERMISSIONS.CROPS_PUBLISH],
            deny: [PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE],
          },
        },
        { where: { id: editTargetUser.id } },
      );
      const autoDemoteJson = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({
          role: 'agricultor',
          rbac_role_id: curatorRole.id,
        });
      expect(autoDemoteJson.status).toBe(200);
      expect(autoDemoteJson.body.success).toBe(true);
      expect(autoDemoteJson.body.user.role).toBe('agricultor');
      expect(autoDemoteJson.body.user.rbac_role_id).toBeNull();

      reloaded = await User.findByPk(editTargetUser.id);
      expect(reloaded.role).toBe('agricultor');
      expect(reloaded.rbac_role_id).toBeNull();
      expect(reloaded.custom_permissions).toEqual({ allow: [], deny: [] });

      const demoteAudit = await AuditLog.findOne({
        where: {
          table_name: 'Users',
          record_id: editTargetUser.id,
          action: 'update_user_role',
        },
        order: [['id', 'DESC']],
      });
      expect(demoteAudit).not.toBeNull();
      expect(demoteAudit.user_id).toBe(adminRecord.id);
      expect(demoteAudit.old_values).toEqual(
        expect.objectContaining({
          target_user_id: editTargetUser.id,
          email: EDIT_TARGET_EMAIL,
          role: 'inifap',
          rbac_role_id: curatorRole.id,
          rbac_role_name: curatorRole.name,
          rbac_role_slug: curatorRole.slug,
          custom_permissions: {
            allow: [PANEL_PERMISSIONS.CROPS_PUBLISH],
            deny: [PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE],
          },
        }),
      );
      expect(demoteAudit.new_values).toEqual(
        expect.objectContaining({
          target_user_id: editTargetUser.id,
          email: EDIT_TARGET_EMAIL,
          role: 'agricultor',
          rbac_role_id: null,
          rbac_role_name: null,
          custom_permissions: { allow: [], deny: [] },
          subrole_auto_revoked: true,
          custom_permissions_cleared: true,
          upgraded_without_code: false,
          change_source: 'admin_users_panel',
        }),
      );
      expect(demoteAudit.new_values.permissions_removed).toContain(
        PANEL_PERMISSIONS.CROPS_PUBLISH,
      );
      expect(demoteAudit.old_values.password_hash).toBeUndefined();
      expect(demoteAudit.new_values.password_hash).toBeUndefined();

      // 3. H-3: Degradar enviando incluso un sub-rol DISTINTO también retira automáticamente (revocar nunca bloquea)
      await User.update(
        {
          role: 'inifap',
          rbac_role_id: curatorRole.id,
        },
        { where: { id: editTargetUser.id } },
      );
      const demoteDiffSubRoleRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .send({
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: auditorRole.id,
        });
      expect(demoteDiffSubRoleRes.status).toBe(302);
      expect(demoteDiffSubRoleRes.headers.location).toContain(
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

    it('9.4. H-6(c) + H-4: audita ascenso directo agricultor -> inifap sin código y cambios de sub-rol A -> B -> null', async () => {
      const adminAgent = await getAdminAgent();
      const adminRecord = await User.findOne({
        where: { email: 'admin@agrosystem.com' },
      });

      await User.update(
        {
          role: 'agricultor',
          rbac_role_id: null,
          custom_permissions: { allow: [], deny: [] },
        },
        { where: { id: editTargetUser.id } },
      );

      // Ascenso directo sin código por admin con sub-rol A
      const promoteRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({
          role: 'inifap',
          rbac_role_id: curatorRole.id,
        });
      expect(promoteRes.status).toBe(200);

      const promoteAudit = await AuditLog.findOne({
        where: {
          table_name: 'Users',
          record_id: editTargetUser.id,
          action: 'update_user_role',
        },
        order: [['id', 'DESC']],
      });
      expect(promoteAudit).not.toBeNull();
      expect(promoteAudit.user_id).toBe(adminRecord.id);
      expect(promoteAudit.old_values.role).toBe('agricultor');
      expect(promoteAudit.new_values.role).toBe('inifap');
      expect(promoteAudit.new_values.rbac_role_name).toBe(curatorRole.name);
      expect(promoteAudit.new_values.upgraded_without_code).toBe(true);
      expect(promoteAudit.new_values.permissions_added.length).toBeGreaterThan(
        0,
      );

      // Cambio de sub-rol A -> sub-rol B
      const swapRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({
          role: 'inifap',
          rbac_role_id: auditorRole.id,
        });
      expect(swapRes.status).toBe(200);

      const swapAudit = await AuditLog.findOne({
        where: {
          table_name: 'Users',
          record_id: editTargetUser.id,
          action: 'update_user_role',
        },
        order: [['id', 'DESC']],
      });
      expect(swapAudit.old_values.rbac_role_name).toBe(curatorRole.name);
      expect(swapAudit.new_values.rbac_role_name).toBe(auditorRole.name);
      expect(swapAudit.new_values.upgraded_without_code).toBe(false);
      expect(swapAudit.new_values.permissions_added).toContain(
        PANEL_PERMISSIONS.AUDIT_VIEW,
      );
      expect(swapAudit.new_values.permissions_removed).toContain(
        PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
      );

      // Retiro explícito de sub-rol B -> null permaneciendo INIFAP
      const clearRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({
          role: 'inifap',
          rbac_role_id: '',
        });
      expect(clearRes.status).toBe(200);

      const clearAudit = await AuditLog.findOne({
        where: {
          table_name: 'Users',
          record_id: editTargetUser.id,
          action: 'update_user_role',
        },
        order: [['id', 'DESC']],
      });
      expect(clearAudit.old_values.rbac_role_name).toBe(auditorRole.name);
      expect(clearAudit.new_values.rbac_role_id).toBeNull();
      expect(clearAudit.new_values.rbac_role_name).toBeNull();
      expect(clearAudit.new_values.permissions_removed).toContain(
        PANEL_PERMISSIONS.AUDIT_VIEW,
      );
    });

    it('9.5. Atomicidad: si AuditLog.create falla en POST /private/users/edit/:id, la transacción hace rollback limpio', async () => {
      const adminAgent = await getAdminAgent();
      await User.update(
        {
          role: 'inifap',
          rbac_role_id: curatorRole.id,
          custom_permissions: {
            allow: [PANEL_PERMISSIONS.CROPS_PUBLISH],
            deny: [],
          },
        },
        { where: { id: editTargetUser.id } },
      );

      jest
        .spyOn(AuditLog, 'create')
        .mockRejectedValueOnce(new Error('Falla simulada de auditoría'));

      const failedRes = await adminAgent
        .post(`/private/users/edit/${editTargetUser.id}`)
        .set('Accept', 'application/json')
        .send({
          role: 'agricultor',
        });

      expect(failedRes.status).toBe(500);
      expect(failedRes.body.code).toBe('actualizacion_fallida');

      const rolledBack = await User.findByPk(editTargetUser.id);
      expect(rolledBack.role).toBe('inifap');
      expect(rolledBack.rbac_role_id).toBe(curatorRole.id);
      expect(rolledBack.custom_permissions).toEqual({
        allow: [PANEL_PERMISSIONS.CROPS_PUBLISH],
        deny: [],
      });
    });

    it('9.6. GET /private/audit encuentra eventos de cambio de rol filtrando por módulo usuarios, acción roles y correo del usuario afectado', async () => {
      const adminAgent = await getAdminAgent();
      const auditRes = await adminAgent.get(
        `/private/audit?module=usuarios&action=roles&search=${encodeURIComponent(EDIT_TARGET_EMAIL)}`,
      );
      expect(auditRes.status).toBe(200);
      expect(auditRes.text).toContain(EDIT_TARGET_EMAIL);
      expect(auditRes.text).toContain('Cambio de Rol');
    });
  });
});
