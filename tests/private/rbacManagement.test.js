import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import {
  PANEL_PERMISSIONS,
  resolveEffectivePermissions,
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
});
