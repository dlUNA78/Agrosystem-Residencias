import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import {
  PANEL_PERMISSIONS,
  resolveEffectivePermissions,
  hasEffectivePermission,
  canModifyUserRoleOrStatus,
  getUserRoleSummary,
} from '../../src/services/rbacService.js';
import {
  createInifapCodesBatch,
  revokeInifapCode,
  listInifapCodes,
} from '../../src/services/inifapCodeService.js';

const { User, RbacRole, InifapCode } = db;

describe('🛡️ Módulo de Gobernanza RBAC y Códigos INIFAP', () => {
  let adminUser = null;
  let farmerUser = null;
  let testTargetUser = null;
  let createdRoleId = null;
  let createdCodeId = null;

  beforeAll(async () => {
    // 1. Asegurar Admin
    const adminHash = await bcrypt.hash('Admin@1234', 10);
    adminUser = await User.findOne({
      where: { email: 'admin@agrosystem.com' },
    });
    if (!adminUser) {
      adminUser = await User.create({
        full_name: 'Admin RBAC Test',
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

    // 2. Asegurar Agricultor (no-admin)
    const farmerHash = await bcrypt.hash('Farmer@1234', 10);
    farmerUser = await User.findOne({
      where: { email: 'agricultor@agrosystem.com' },
    });
    if (!farmerUser) {
      farmerUser = await User.create({
        full_name: 'Farmer RBAC Test',
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

    // 3. Crear usuario sujeto a pruebas RBAC
    const targetHash = await bcrypt.hash('Target@1234', 10);
    await User.destroy({ where: { email: 'target_rbac@agrosystem.com' } });
    testTargetUser = await User.create({
      full_name: 'Investigador Target RBAC',
      email: 'target_rbac@agrosystem.com',
      password_hash: targetHash,
      role: 'inifap',
      status: 'activo',
    });
  });

  afterAll(async () => {
    if (createdCodeId) {
      await InifapCode.destroy({ where: { id: createdCodeId } });
    }
    if (createdRoleId) {
      await RbacRole.destroy({ where: { id: createdRoleId } });
    }
    if (testTargetUser) {
      await User.destroy({ where: { id: testTargetUser.id } });
    }
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

  describe('1. Servicio de Resolución en Cascada RBAC (Lógica de Dominio)', () => {
    it('un usuario admin posee el conjunto completo de permisos del panel', () => {
      const perms = resolveEffectivePermissions({
        role: 'admin',
        status: 'activo',
      });
      expect(perms.has(PANEL_PERMISSIONS.CROPS_PUBLISH)).toBe(true);
      expect(perms.has(PANEL_PERMISSIONS.AUDIT_VIEW)).toBe(true);
      expect(perms.has(PANEL_PERMISSIONS.USERS_MANAGE)).toBe(true);
    });

    it('un usuario inifap base no posee permisos de publicación pero sí de edición/verificación', () => {
      const perms = resolveEffectivePermissions({
        role: 'inifap',
        status: 'activo',
      });
      expect(perms.has(PANEL_PERMISSIONS.CROPS_EDIT)).toBe(true);
      expect(perms.has(PANEL_PERMISSIONS.CROPS_VERIFY)).toBe(true);
      expect(perms.has(PANEL_PERMISSIONS.CROPS_PUBLISH)).toBe(false);
      expect(perms.has(PANEL_PERMISSIONS.AUDIT_VIEW)).toBe(false);
    });

    it('un sub-rol asignado suma permisos adicionales a un usuario inifap', () => {
      const perms = resolveEffectivePermissions({
        role: 'inifap',
        status: 'activo',
        rbacRole: {
          permissions: [
            PANEL_PERMISSIONS.CROPS_PUBLISH,
            PANEL_PERMISSIONS.AUDIT_VIEW,
          ],
        },
      });
      expect(perms.has(PANEL_PERMISSIONS.CROPS_PUBLISH)).toBe(true);
      expect(perms.has(PANEL_PERMISSIONS.AUDIT_VIEW)).toBe(true);
    });

    it('las excepciones allow agregan y deny retiran permisos puntuales', () => {
      const perms = resolveEffectivePermissions({
        role: 'inifap',
        status: 'activo',
        custom_permissions: {
          allow: [PANEL_PERMISSIONS.AUDIT_VIEW],
          deny: [PANEL_PERMISSIONS.CROPS_CREATE],
        },
      });
      expect(perms.has(PANEL_PERMISSIONS.AUDIT_VIEW)).toBe(true);
      expect(perms.has(PANEL_PERMISSIONS.CROPS_CREATE)).toBe(false);
    });

    it('un usuario suspendido no posee ningún permiso efectivo', () => {
      const perms = resolveEffectivePermissions({
        role: 'admin',
        status: 'suspendido',
      });
      expect(perms.size).toBe(0);
    });

    it('previene auto-suspensión y degradación de privilegios de administrador', () => {
      const selfDemotion = canModifyUserRoleOrStatus({
        actor: { id: 1, role: 'admin' },
        targetUserId: 1,
        newRole: 'inifap',
        newStatus: 'activo',
      });
      expect(selfDemotion.allowed).toBe(false);

      const selfSuspension = canModifyUserRoleOrStatus({
        actor: { id: 1, role: 'admin' },
        targetUserId: 1,
        newRole: 'admin',
        newStatus: 'suspendido',
      });
      expect(selfSuspension.allowed).toBe(false);
    });

    it('genera distintivos de usuario informativos y legibles', () => {
      const summary = getUserRoleSummary({
        role: 'inifap',
        status: 'activo',
        rbacRole: { name: 'Curador de Insumos', badge_color: 'sky' },
      });
      expect(summary.title).toBe('Curador de Insumos');
      expect(summary.badgeColor).toBe('sky');
    });

    it('H-2 Capa 1: ignora sub-roles huérfanos (IDs 2, 3 y 12) al resolver permisos de un agricultor', () => {
      const orphanSubRoles = [
        {
          id: 2,
          name: 'Curador de Insumos y Proveedores',
          permissions: [
            PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
            PANEL_PERMISSIONS.SUPPLIERS_MANAGE,
            PANEL_PERMISSIONS.PRODUCTS_PUBLISH,
          ],
        },
        {
          id: 3,
          name: 'Auditor Fitosanitario',
          permissions: [
            PANEL_PERMISSIONS.AUDIT_VIEW,
            PANEL_PERMISSIONS.REPORTS_EXPORT,
            PANEL_PERMISSIONS.LANDS_VIEW_DETAILED,
          ],
        },
        {
          id: 12,
          name: 'Moderador Institucional',
          permissions: [
            PANEL_PERMISSIONS.CROPS_VIEW_PRIVATE,
            PANEL_PERMISSIONS.CROPS_CREATE,
            PANEL_PERMISSIONS.CROPS_EDIT,
            PANEL_PERMISSIONS.CROPS_MANAGE_RELATIONS,
            PANEL_PERMISSIONS.CROPS_SUBMIT_REVIEW,
            PANEL_PERMISSIONS.CROPS_VERIFY,
            PANEL_PERMISSIONS.PLAGUES_VIEW_PRIVATE,
            PANEL_PERMISSIONS.PLAGUES_CREATE,
            PANEL_PERMISSIONS.PLAGUES_EDIT,
            PANEL_PERMISSIONS.PLAGUES_MANAGE_RELATIONS,
            PANEL_PERMISSIONS.PLAGUES_SUBMIT_REVIEW,
            PANEL_PERMISSIONS.PLAGUES_VERIFY,
            PANEL_PERMISSIONS.PRODUCTS_VIEW_PRIVATE,
            PANEL_PERMISSIONS.PRODUCTS_CREATE,
            PANEL_PERMISSIONS.PRODUCTS_EDIT,
            PANEL_PERMISSIONS.PRODUCTS_MANAGE_RELATIONS,
            PANEL_PERMISSIONS.PRODUCTS_SUBMIT_REVIEW,
            PANEL_PERMISSIONS.PRODUCTS_VERIFY,
            PANEL_PERMISSIONS.INGREDIENTS_VIEW,
            PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
            PANEL_PERMISSIONS.SUPPLIERS_VIEW,
            PANEL_PERMISSIONS.SUPPLIERS_MANAGE,
            PANEL_PERMISSIONS.LANDS_VIEW_PRIVATE,
            PANEL_PERMISSIONS.REPORTS_VIEW,
            'users.view',
          ],
        },
      ];

      for (const subRole of orphanSubRoles) {
        const farmerCamel = {
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: subRole.id,
          rbacRole: subRole,
        };
        const farmerPascal = {
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: subRole.id,
          RbacRole: subRole,
        };

        for (const candidate of [farmerCamel, farmerPascal]) {
          const effective = resolveEffectivePermissions(candidate);
          expect(Array.from(effective).sort()).toEqual(
            [
              PANEL_PERMISSIONS.LANDS_MANAGE,
              PANEL_PERMISSIONS.LANDS_VIEW_PRIVATE,
            ].sort(),
          );
          for (const perm of subRole.permissions) {
            if (perm === PANEL_PERMISSIONS.LANDS_VIEW_PRIVATE) continue;
            expect(hasEffectivePermission(candidate, perm)).toBe(false);
          }
        }

        // Un usuario INIFAP legítimo con el mismo sub-rol conserva todos los permisos delegados
        const inifapUser = {
          role: 'inifap',
          status: 'activo',
          rbac_role_id: subRole.id,
          rbacRole: subRole,
        };
        for (const perm of subRole.permissions) {
          expect(hasEffectivePermission(inifapUser, perm)).toBe(true);
        }
      }
    });

    it('H-2 Capa 3: getUserRoleSummary no renderiza sub-rol institucional para agricultor ni admin con sub-rol huérfano', () => {
      const orphanSubRoles = [
        { name: 'Curador de Insumos y Proveedores', badge_color: 'sky' },
        { name: 'Auditor Fitosanitario', badge_color: 'amber' },
        { name: 'Moderador Institucional', badge_color: 'amber' },
      ];

      for (const subRole of orphanSubRoles) {
        const farmerSummary = getUserRoleSummary({
          role: 'agricultor',
          status: 'activo',
          rbacRole: subRole,
        });
        expect(farmerSummary).toEqual({
          title: 'Productor Agrícola',
          badgeColor: 'sky',
          subTitle: 'Usuario Consultor',
          isSuspended: false,
        });
        expect(farmerSummary.subTitle).not.toContain('INIFAP');
        expect(farmerSummary.title).not.toBe(subRole.name);

        const farmerPascalSummary = getUserRoleSummary({
          role: 'agricultor',
          status: 'activo',
          RbacRole: subRole,
        });
        expect(farmerPascalSummary.title).toBe('Productor Agrícola');
        expect(farmerPascalSummary.subTitle).toBe('Usuario Consultor');

        const adminSummary = getUserRoleSummary({
          role: 'admin',
          status: 'activo',
          rbacRole: subRole,
        });
        expect(adminSummary).toEqual({
          title: 'Administrador General',
          badgeColor: 'purple',
          subTitle: 'Control Total del Sistema',
          isSuspended: false,
        });
      }

      const inifapSummary = getUserRoleSummary({
        role: 'inifap',
        status: 'activo',
        rbacRole: orphanSubRoles[0],
      });
      expect(inifapSummary).toEqual({
        title: 'Curador de Insumos y Proveedores',
        badgeColor: 'sky',
        subTitle: 'Personal INIFAP · Curador de Insumos y Proveedores',
        isSuspended: false,
      });
    });
  });

  describe('2. Servicio de Gestión y Emisión de Códigos INIFAP', () => {
    it('genera un lote de códigos con formato AGS-XXXX-XXXX-XXXX-XXXX y vigencia', async () => {
      const batch = await createInifapCodesBatch({
        count: 2,
        expiresInDays: 7,
        note: 'Lote Test Jest',
        createdByUserId: adminUser.id,
      });

      expect(batch).toHaveLength(2);
      expect(batch[0].code).toMatch(
        /^AGS-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/,
      );
      expect(batch[0].isAvailable()).toBe(true);

      createdCodeId = batch[0].id;
      await InifapCode.destroy({ where: { id: batch[1].id } });
    });

    it('permite revocar un código disponible e impide su reutilización', async () => {
      const result = await revokeInifapCode({
        codeId: createdCodeId,
        _adminUserId: adminUser.id,
      });

      expect(result.success).toBe(true);
      const reloaded = await InifapCode.findByPk(createdCodeId);
      expect(reloaded.isAvailable()).toBe(false);
      expect(reloaded.revoked_at).not.toBeNull();
    });

    it('el listado de códigos soporta filtrado por estatus', async () => {
      const revokedList = await listInifapCodes({ status: 'revoked' });
      expect(Array.isArray(revokedList)).toBe(true);
      const found = revokedList.find((c) => c.id === createdCodeId);
      expect(found).toBeDefined();
    });
  });

  describe('3. Endpoints HTTP de Gobernanza RBAC y Códigos (/private/rbac, /private/codes)', () => {
    it('un usuario sin privilegios es denegado al intentar crear roles o generar códigos', async () => {
      const farmerAgent = await getFarmerAgent();
      const resRole = await farmerAgent
        .post('/private/rbac/roles/create')
        .send({ name: 'Rol Ilegal' });
      expect([403, 302]).toContain(resRole.status);

      const resCode = await farmerAgent
        .post('/private/codes/generate')
        .send({ count: 1 });
      expect([403, 302]).toContain(resCode.status);
    });

    it('un administrador puede crear un sub-rol personalizado vía POST /private/rbac/roles/create', async () => {
      const adminAgent = await getAdminAgent();
      const res = await adminAgent.post('/private/rbac/roles/create').send({
        name: 'Especialista en Granos Test',
        description: 'Gestor editorial de cereales y granos',
        base_role: 'inifap',
        badge_color: 'amber',
        permissions: [
          PANEL_PERMISSIONS.CROPS_PUBLISH,
          PANEL_PERMISSIONS.AUDIT_VIEW,
        ],
      });

      expect([200, 302]).toContain(res.status);

      const created = await RbacRole.findOne({
        where: { slug: 'especialista-en-granos-test' },
      });
      expect(created).not.toBeNull();
      expect(created.name).toBe('Especialista en Granos Test');
      expect(created.permissions).toContain(PANEL_PERMISSIONS.CROPS_PUBLISH);
      createdRoleId = created.id;
    });

    it('un administrador puede actualizar el sub-rol vía POST /private/rbac/roles/edit/:id', async () => {
      if (!createdRoleId) return;
      const adminAgent = await getAdminAgent();
      const res = await adminAgent
        .post(`/private/rbac/roles/edit/${createdRoleId}`)
        .send({
          name: 'Especialista en Granos y Semillas',
          permissions: [PANEL_PERMISSIONS.CROPS_PUBLISH],
        });

      expect([200, 302]).toContain(res.status);
      const updated = await RbacRole.findByPk(createdRoleId);
      expect(updated.name).toBe('Especialista en Granos y Semillas');
    });

    it('un administrador puede asignar sub-rol y overrides vía POST /private/rbac/users/:id/permissions', async () => {
      const adminAgent = await getAdminAgent();
      const res = await adminAgent
        .post(`/private/rbac/users/${testTargetUser.id}/permissions`)
        .send({
          role: 'inifap',
          status: 'activo',
          rbac_role_id: createdRoleId,
          allow: [PANEL_PERMISSIONS.INGREDIENTS_MANAGE],
          deny: [PANEL_PERMISSIONS.CROPS_CREATE],
        });

      expect([200, 302]).toContain(res.status);

      const updatedUser = await User.findByPk(testTargetUser.id);
      expect(updatedUser.rbac_role_id).toBe(createdRoleId);
      expect(updatedUser.custom_permissions.allow).toContain(
        PANEL_PERMISSIONS.INGREDIENTS_MANAGE,
      );
      expect(updatedUser.custom_permissions.deny).toContain(
        PANEL_PERMISSIONS.CROPS_CREATE,
      );
    });

    it('un administrador requiere contraseña en modo Sudo para generar códigos vía POST /private/codes/generate', async () => {
      const adminAgent = await getAdminAgent();

      // Sin contraseña sudo debe fallar y redirigir con error
      const failRes = await adminAgent.post('/private/codes/generate').send({
        count: 1,
        expiresInDays: 30,
        note: 'Intento sin Sudo',
        rbacRoleId: createdRoleId,
      });
      expect([302, 403]).toContain(failRes.status);
      expect(failRes.headers.location || '').toContain(
        'error=contrasena_incorrecta',
      );

      // Con contraseña sudo correcta genera el código con éxito
      const res = await adminAgent.post('/private/codes/generate').send({
        count: 1,
        expiresInDays: 30,
        note: 'Token generado desde prueba HTTP',
        rbacRoleId: createdRoleId,
        sudo_password: 'Admin@1234',
      });

      expect([200, 302]).toContain(res.status);

      const latestCode = await InifapCode.findOne({
        where: { note: 'Token generado desde prueba HTTP' },
        order: [['createdAt', 'DESC']],
      });
      expect(latestCode).not.toBeNull();
      expect(latestCode.rbac_role_id).toBe(createdRoleId);

      // Limpieza
      await latestCode.destroy();
    });

    it('protege los sub-roles del sistema contra eliminación', async () => {
      const systemRole = await RbacRole.findOne({ where: { is_system: true } });
      if (!systemRole) return;

      const adminAgent = await getAdminAgent();
      const res = await adminAgent.post(
        `/private/rbac/roles/delete/${systemRole.id}`,
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('error=rol_sistema_protegido');

      const reloaded = await RbacRole.findByPk(systemRole.id);
      expect(reloaded).not.toBeNull();
    });
  });

  describe('4. H-2: Endurecimiento HTTP de sub-roles RBAC exclusivos para INIFAP', () => {
    const H2_FARMER_EMAIL = 'h2_orphan_farmer@agrosystem.com';
    const H2_INIFAP_EMAIL = 'h2_legit_inifap@agrosystem.com';
    let orphanFarmerUser = null;
    let legitInifapUser = null;
    let curatorRole = null;
    let auditorRole = null;
    let moderatorRole = null;

    beforeAll(async () => {
      await User.destroy({
        where: { email: [H2_FARMER_EMAIL, H2_INIFAP_EMAIL] },
      });

      [curatorRole, auditorRole, moderatorRole] = await Promise.all([
        RbacRole.findOne({ where: { slug: 'curador-insumos' } }),
        RbacRole.findOne({ where: { slug: 'auditor-fitosanitario' } }),
        RbacRole.findOne({ where: { slug: 'moderador-inifap' } }),
      ]);

      expect(curatorRole).not.toBeNull();
      expect(auditorRole).not.toBeNull();
      expect(moderatorRole).not.toBeNull();

      const pwdHash = await bcrypt.hash('H2Test@1234', 10);
      orphanFarmerUser = await User.create({
        full_name: 'Agricultor H2 Subrol Huérfano',
        email: H2_FARMER_EMAIL,
        password_hash: pwdHash,
        role: 'agricultor',
        status: 'activo',
        rbac_role_id: curatorRole.id,
      });

      legitInifapUser = await User.create({
        full_name: 'Investigador H2 Legítimo',
        email: H2_INIFAP_EMAIL,
        password_hash: pwdHash,
        role: 'inifap',
        status: 'activo',
        rbac_role_id: curatorRole.id,
      });
    });

    afterAll(async () => {
      await User.destroy({
        where: { email: [H2_FARMER_EMAIL, H2_INIFAP_EMAIL] },
      });
      await RbacRole.destroy({
        where: {
          slug: ['subrol-ilegal-agricultor', 'subrol-ilegal-admin'],
        },
      });
    });

    const loginAsH2 = async (email) => {
      const agent = request.agent(app);
      const res = await agent
        .post('/auth/login')
        .send({ email, password: 'H2Test@1234' });
      expect(res.status).toBe(302);
      return agent;
    };

    it('bloquea con HTTP 403 todas las rutas /private/ingredients* a un agricultor con rbac_role_id huérfano (curador/ID 2, auditor/ID 3 y moderador/ID 12)', async () => {
      const farmerAgent = await loginAsH2(H2_FARMER_EMAIL);

      for (const roleRow of [curatorRole, auditorRole, moderatorRole]) {
        await orphanFarmerUser.update({
          role: 'agricultor',
          rbac_role_id: roleRow.id,
        });

        const getRes = await farmerAgent.get('/private/ingredients');
        expect(getRes.status).toBe(403);

        const jsonRes = await farmerAgent
          .get('/private/ingredients')
          .set('Accept', 'application/json');
        expect(jsonRes.status).toBe(403);
        expect(jsonRes.body.error).toBe('Forbidden');

        const createRes = await farmerAgent
          .post('/private/ingredients/create')
          .send({ name: 'Molécula No Autorizada' });
        expect(createRes.status).toBe(403);

        const updateRes = await farmerAgent
          .post('/private/ingredients/update/1')
          .send({ name: 'Intento Update' });
        expect(updateRes.status).toBe(403);

        const deleteRes = await farmerAgent.post(
          '/private/ingredients/delete/1',
        );
        expect(deleteRes.status).toBe(403);

        const workflowRes = await farmerAgent
          .post('/private/ingredients/1/workflow')
          .send({ action: 'request_archive' });
        expect(workflowRes.status).toBe(403);

        // /profile tampoco debe renderizar el distintivo institucional del sub-rol huérfano
        const profileRes = await farmerAgent.get('/profile');
        expect(profileRes.status).toBe(200);
        expect(profileRes.text).not.toContain(roleRow.name);
        expect(profileRes.text).not.toContain(
          `Personal INIFAP · ${roleRow.name}`,
        );
      }
    });

    it('un investigador INIFAP legítimo con sub-rol curador conserva acceso a /private/ingredients y delegación de gestión', async () => {
      const inifapAgent = await loginAsH2(H2_INIFAP_EMAIL);

      const listRes = await inifapAgent.get('/private/ingredients');
      expect(listRes.status).toBe(200);

      // Payload incompleto para validar que supera requireRole('admin') y llega a validación del controlador (no 403)
      const createRes = await inifapAgent
        .post('/private/ingredients/create')
        .send({ name: '' });
      expect(createRes.status).not.toBe(403);
      expect([302, 400]).toContain(createRes.status);
    });

    it('POST /private/rbac/users/:id/permissions rechaza asignar sub-rol a agricultor o admin (redirect y JSON) y fuerza rbac_role_id = null al degradar a agricultor', async () => {
      const adminAgent = await getAdminAgent();

      // Preparar agricultor sin sub-rol
      await orphanFarmerUser.update({ role: 'agricultor', rbac_role_id: null });

      // 1. Form/redirect: rechazar asignar sub-rol a agricultor
      const farmerFormRes = await adminAgent
        .post(`/private/rbac/users/${orphanFarmerUser.id}/permissions`)
        .send({
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: curatorRole.id,
        });
      expect(farmerFormRes.status).toBe(302);
      expect(farmerFormRes.headers.location).toContain(
        'error=subrol_solo_inifap',
      );
      expect(
        (await User.findByPk(orphanFarmerUser.id)).rbac_role_id,
      ).toBeNull();

      // 2. JSON: rechazar asignar sub-rol a agricultor (con role omitido)
      const farmerJsonRes = await adminAgent
        .post(`/private/rbac/users/${orphanFarmerUser.id}/permissions`)
        .set('Accept', 'application/json')
        .send({
          status: 'activo',
          rbac_role_id: moderatorRole.id,
        });
      expect(farmerJsonRes.status).toBe(400);
      expect(farmerJsonRes.body.code).toBe('subrol_solo_inifap');
      expect(
        (await User.findByPk(orphanFarmerUser.id)).rbac_role_id,
      ).toBeNull();

      // 3. Form/redirect y JSON: rechazar asignar sub-rol a admin
      const adminFormRes = await adminAgent
        .post(`/private/rbac/users/${adminUser.id}/permissions`)
        .send({
          role: 'admin',
          status: 'activo',
          rbac_role_id: curatorRole.id,
        });
      expect(adminFormRes.status).toBe(302);
      expect(adminFormRes.headers.location).toContain(
        'error=subrol_solo_inifap',
      );
      expect((await User.findByPk(adminUser.id)).rbac_role_id).toBeNull();

      const adminJsonRes = await adminAgent
        .post(`/private/rbac/users/${adminUser.id}/permissions`)
        .set('Accept', 'application/json')
        .send({
          role: 'admin',
          status: 'activo',
          rbac_role_id: auditorRole.id,
        });
      expect(adminJsonRes.status).toBe(400);
      expect(adminJsonRes.body.code).toBe('subrol_solo_inifap');
      expect((await User.findByPk(adminUser.id)).rbac_role_id).toBeNull();

      // 4. Degradar INIFAP con sub-rol a agricultor enviando sub-rol no nulo -> rechaza y no altera registro
      await legitInifapUser.update({
        role: 'inifap',
        rbac_role_id: curatorRole.id,
      });
      const demoteWithSubRoleRes = await adminAgent
        .post(`/private/rbac/users/${legitInifapUser.id}/permissions`)
        .set('Accept', 'application/json')
        .send({
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: curatorRole.id,
        });
      expect(demoteWithSubRoleRes.status).toBe(400);
      expect(demoteWithSubRoleRes.body.code).toBe('subrol_solo_inifap');
      const unchangedInifap = await User.findByPk(legitInifapUser.id);
      expect(unchangedInifap.role).toBe('inifap');
      expect(unchangedInifap.rbac_role_id).toBe(curatorRole.id);

      // 5. Degradar INIFAP con sub-rol a agricultor sin sub-rol -> fuerza rbac_role_id = null
      const demoteCleanRes = await adminAgent
        .post(`/private/rbac/users/${legitInifapUser.id}/permissions`)
        .send({
          role: 'agricultor',
          status: 'activo',
          rbac_role_id: '',
        });
      expect(demoteCleanRes.status).toBe(302);
      expect(demoteCleanRes.headers.location).toContain(
        'success=permisos_actualizados',
      );
      const demotedUser = await User.findByPk(legitInifapUser.id);
      expect(demotedUser.role).toBe('agricultor');
      expect(demotedUser.rbac_role_id).toBeNull();

      // 6. Restaurar INIFAP con sub-rol legítimo vía JSON
      const restoreRes = await adminAgent
        .post(`/private/rbac/users/${legitInifapUser.id}/permissions`)
        .set('Accept', 'application/json')
        .send({
          role: 'inifap',
          status: 'activo',
          rbac_role_id: curatorRole.id,
        });
      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.success).toBe(true);
      expect(restoreRes.body.user.rbac_role_id).toBe(curatorRole.id);

      // 7. Guardar agricultor que tenía sub-rol huérfano en BD sin enviar rbac_role_id -> limpia a null
      await orphanFarmerUser.update({
        role: 'agricultor',
        rbac_role_id: auditorRole.id,
      });
      const cleanOrphanRes = await adminAgent
        .post(`/private/rbac/users/${orphanFarmerUser.id}/permissions`)
        .send({
          role: 'agricultor',
          status: 'activo',
        });
      expect(cleanOrphanRes.status).toBe(302);
      expect(
        (await User.findByPk(orphanFarmerUser.id)).rbac_role_id,
      ).toBeNull();
    });

    it('POST /private/rbac/roles/create rechaza base_role distinto de inifap (redirect y JSON)', async () => {
      const adminAgent = await getAdminAgent();

      const formRes = await adminAgent.post('/private/rbac/roles/create').send({
        name: 'Subrol Ilegal Agricultor',
        base_role: 'agricultor',
        permissions: [PANEL_PERMISSIONS.INGREDIENTS_MANAGE],
      });
      expect(formRes.status).toBe(302);
      expect(formRes.headers.location).toContain('error=subrol_solo_inifap');

      const jsonRes = await adminAgent
        .post('/private/rbac/roles/create')
        .set('Accept', 'application/json')
        .send({
          name: 'Subrol Ilegal Admin',
          base_role: 'admin',
          permissions: [PANEL_PERMISSIONS.AUDIT_VIEW],
        });
      expect(jsonRes.status).toBe(400);
      expect(jsonRes.body.code).toBe('subrol_solo_inifap');

      const editRes = await adminAgent
        .post(`/private/rbac/roles/edit/${curatorRole.id}`)
        .set('Accept', 'application/json')
        .send({
          base_role: 'agricultor',
        });
      expect(editRes.status).toBe(400);
      expect(editRes.body.code).toBe('subrol_solo_inifap');
    });
  });
});
