import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import {
  createNotification,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  notifyAdmins,
  notifyAuthorOnWorkflowChange,
  resolveNotificationActionUrl,
  resolveOperationalSummary,
} from '../../src/services/notificationService.js';
import { resolveSafeRedirectUrl } from '../../src/controllers/notificationController.js';

const { User, Notification, RbacRole, AuditLog } = db;
const TEST_USER_EMAIL = 'notif_test@inifap.gob.mx';
const TEST_ADMIN_EMAIL = 'admin_notif@inifap.gob.mx';

describe('🔔 Centro de Notificaciones Híbrido', () => {
  let testUser = null;
  let adminUser = null;
  let testNotif = null;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('TestUser@1234', 10);

    const staleUsers = await User.findAll({
      where: { email: [TEST_USER_EMAIL, TEST_ADMIN_EMAIL] },
      order: [['id', 'ASC']],
    });
    if (staleUsers.length > 0) {
      const staleIds = staleUsers.map((u) => u.id);
      await Notification.destroy({ where: { user_id: staleIds } });
      await User.destroy({ where: { id: staleIds } });
    }

    testUser = await User.create({
      full_name: 'Usuario Notif Test',
      email: TEST_USER_EMAIL,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });

    await User.create({
      full_name: 'Admin Notif Test',
      email: TEST_ADMIN_EMAIL,
      password_hash: passwordHash,
      role: 'admin',
      status: 'activo',
    });

    adminUser = await User.findOne({
      where: {
        email: TEST_ADMIN_EMAIL,
        role: 'admin',
        status: 'activo',
      },
      order: [['id', 'ASC']],
    });
  });

  afterAll(async () => {
    if (adminUser) {
      await Notification.destroy({ where: { user_id: adminUser.id } });
      await adminUser.destroy();
    }
    if (testUser) {
      await Notification.destroy({ where: { user_id: testUser.id } });
      await testUser.destroy();
    }
    await closeAppResources();
  });

  describe('📬 1. Creación y Consulta de Notificaciones', () => {
    it('crea una notificación persistente con todos los campos sanitizados', async () => {
      testNotif = await createNotification({
        userId: testUser.id,
        category: 'editorial',
        severity: 'info',
        title: 'Ficha Aprobada',
        message: 'Tu ficha técnica de aguacate ha sido verificada.',
        actionUrl: '/private/crops/10',
      });

      expect(testNotif).not.toBeNull();
      expect(testNotif.title).toBe('Ficha Aprobada');
      expect(testNotif.category).toBe('editorial');
      expect(testNotif.severity).toBe('info');
      expect(testNotif.is_read).toBe(false);
      expect(testNotif.read_at).toBeNull();
    });

    it('obtiene el listado y el conteo de no leídas correctamente', async () => {
      const data = await getUserNotifications(testUser.id);
      expect(data.unreadCount).toBeGreaterThanOrEqual(1);
      expect(data.notifications.length).toBeGreaterThanOrEqual(1);
      expect(data.notifications[0].title).toBe('Ficha Aprobada');
    });

    it('notifica a los administradores del sistema en masa', async () => {
      await notifyAdmins({
        category: 'rbac',
        severity: 'warning',
        title: 'Alerta Administrativa',
        message: 'Nuevo evento de prueba para administradores.',
      });

      const adminNotifs = await getUserNotifications(adminUser.id);
      const found = adminNotifs.notifications.find(
        (n) => n.title === 'Alerta Administrativa',
      );
      expect(found).toBeDefined();
    });

    it('notifica al autor tras una transición editorial salvo si es el mismo actor', async () => {
      await notifyAuthorOnWorkflowChange({
        authorId: testUser.id,
        actorId: adminUser.id,
        entityName: 'Maíz Blanco INIFAP',
        moduleTitle: 'Cultivo',
        workflowStatus: 'published',
        actionUrl: '/private/crops/5',
      });

      const notifs = await getUserNotifications(testUser.id);
      const found = notifs.notifications.find((n) =>
        n.title.includes('Cultivo'),
      );
      expect(found).toBeDefined();
      expect(found.severity).toBe('success');

      // No debe auto-notificar si autor === actor
      const countBefore = (await getUserNotifications(testUser.id)).unreadCount;
      await notifyAuthorOnWorkflowChange({
        authorId: testUser.id,
        actorId: testUser.id,
        entityName: 'Prueba Auto',
        moduleTitle: 'Cultivo',
        workflowStatus: 'published',
      });
      const countAfter = (await getUserNotifications(testUser.id)).unreadCount;
      expect(countAfter).toBe(countBefore);
    });
  });

  describe('👁️ 2. Marcado de Lectura', () => {
    it('marca una notificación individual como leída con timestamp', async () => {
      const updated = await markNotificationAsRead(testNotif.id, testUser.id);
      expect(updated).not.toBeNull();
      expect(updated.is_read).toBe(true);
      expect(updated.read_at).not.toBeNull();
    });

    it('marca todas las notificaciones pendientes del usuario como leídas', async () => {
      await createNotification({
        userId: testUser.id,
        title: 'Otra Notificación',
        message: 'Mensaje pendiente',
      });

      const result = await markAllNotificationsAsRead(testUser.id);
      expect(result.updatedCount).toBeGreaterThanOrEqual(1);

      const after = await getUserNotifications(testUser.id);
      expect(after.unreadCount).toBe(0);
    });
  });

  describe('📊 3. Resumen Operativo en Vivo por Rol', () => {
    it('resuelve contadores operativos según el rol del usuario', async () => {
      const summary = await resolveOperationalSummary(adminUser);
      expect(summary).toBeDefined();
      expect(typeof summary.itemsInReview).toBe('number');
      expect(typeof summary.pendingUsers).toBe('number');
    });
  });

  describe('🌐 4. Endpoints de Notificaciones (Integración)', () => {
    let authAgent;

    beforeAll(async () => {
      authAgent = request.agent(app);
      await authAgent.post('/auth/login').send({
        email: 'notif_test@inifap.gob.mx',
        password: 'TestUser@1234',
      });
    });

    it('GET /api/notifications rechaza peticiones no autenticadas con 302 a login', async () => {
      const res = await request(app).get('/api/notifications');
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/login');
    });

    it('GET /api/notifications devuelve lista y resumen operativo para usuario autenticado', async () => {
      const res = await authAgent.get('/api/notifications');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.unreadCount).toBe('number');
      expect(Array.isArray(res.body.notifications)).toBe(true);
      expect(res.body.operationalSummary).toBeDefined();
    });

    it('POST /api/notifications/read-all marca todas como leídas vía API', async () => {
      const res = await authAgent.post('/api/notifications/read-all');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });

    it('POST /api/notifications/:id/read marca una notificación individual vía API', async () => {
      const newN = await createNotification({
        userId: testUser.id,
        title: 'Para API Read',
        message: 'Prueba',
      });

      const res = await authAgent.post(`/api/notifications/${newN.id}/read`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.id).toBe(newN.id);
    });

    it('GET /notifications/:id/open redirige de forma segura a action_url y marca como leída', async () => {
      const redirectNotif = await createNotification({
        userId: testUser.id,
        title: 'Abrir ficha',
        message: 'Ir a ficha',
        actionUrl: '/private/crops',
      });

      const res = await authAgent.get(
        `/notifications/${redirectNotif.id}/open`,
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/private/crops');

      const reloaded = await Notification.findByPk(redirectNotif.id);
      expect(reloaded.is_read).toBe(true);
    });

    it('GET /notifications/:id/open previene Open Redirects maliciosos', async () => {
      const maliciousNotif = await createNotification({
        userId: testUser.id,
        title: 'Ataque Open Redirect',
        message: 'Intento de redirección externa',
        actionUrl: 'https://malicious-site.com',
      });

      const res = await authAgent.get(
        `/notifications/${maliciousNotif.id}/open`,
      );
      expect(res.status).toBe(302);
      // Debe redirigir al dashboard interno seguro en vez del sitio externo
      expect(res.headers.location).toBe('/dashboard');
    });
  });

  describe('🛡️ 5. Redirección segura por rol y acceso RBAC (1.A16)', () => {
    const FARMER_EMAIL = 'notif_farmer_1a16@inifap.gob.mx';
    const INIFAP_SUBROLE_EMAIL = 'notif_inifap_subrole_1a16@inifap.gob.mx';
    const INIFAP_CUSTOM_ROLE_EMAIL = 'notif_inifap_custom_1a16@inifap.gob.mx';
    const FARMER_CUSTOM_ROLE_EMAIL = 'notif_farmer_custom_1a16@inifap.gob.mx';
    const ROLE_CHANGE_EMAIL = 'notif_role_change_1a16@inifap.gob.mx';
    const CUSTOM_INIFAP_ROLE_SLUG = 'notif-custom-inifap-1a16';
    const CUSTOM_FARMER_ROLE_SLUG = 'notif-custom-farmer-1a16';

    let farmerUser = null;
    let inifapSubRoleUser = null;
    let inifapCustomRoleUser = null;
    let farmerCustomRoleUser = null;
    let roleChangeUser = null;
    let customInifapRole = null;
    let customFarmerRole = null;

    const cleanup1A16 = async () => {
      const emails = [
        FARMER_EMAIL,
        INIFAP_SUBROLE_EMAIL,
        INIFAP_CUSTOM_ROLE_EMAIL,
        FARMER_CUSTOM_ROLE_EMAIL,
        ROLE_CHANGE_EMAIL,
      ];
      const existingUsers = await User.findAll({ where: { email: emails } });
      if (existingUsers.length > 0) {
        const ids = existingUsers.map((u) => u.id);
        await AuditLog.destroy({
          where: { table_name: 'RBAC', record_id: ids },
        });
        await Notification.destroy({ where: { user_id: ids } });
        await User.destroy({ where: { id: ids } });
      }
      await RbacRole.destroy({
        where: {
          slug: [CUSTOM_INIFAP_ROLE_SLUG, CUSTOM_FARMER_ROLE_SLUG],
        },
      });
    };

    const loginAs = async (email) => {
      const agent = request.agent(app);
      const loginRes = await agent.post('/auth/login').send({
        email,
        password: 'TestUser@1234',
      });
      expect(loginRes.status).toBe(302);
      return agent;
    };

    beforeAll(async () => {
      await cleanup1A16();
      const passwordHash = await bcrypt.hash('TestUser@1234', 10);

      const systemRole = await RbacRole.findOne({
        where: { slug: 'coordinador-editorial' },
      });
      expect(systemRole).not.toBeNull();

      customInifapRole = await RbacRole.create({
        slug: CUSTOM_INIFAP_ROLE_SLUG,
        name: 'Revisor Personalizado 1.A16',
        description: 'Rol RBAC personalizado para pruebas de notificaciones',
        base_role: 'inifap',
        badge_color: 'emerald',
        permissions: ['crops.viewPrivate', 'plagues.viewPrivate'],
        is_system: false,
      });

      customFarmerRole = await RbacRole.create({
        slug: CUSTOM_FARMER_ROLE_SLUG,
        name: 'Productor Colaborador 1.A16',
        description: 'Rol RBAC personalizado asociado a agricultor',
        base_role: 'agricultor',
        badge_color: 'sky',
        permissions: ['lands.viewPrivate'],
        is_system: false,
      });

      farmerUser = await User.create({
        full_name: 'Agricultor Notif 1A16',
        email: FARMER_EMAIL,
        password_hash: passwordHash,
        role: 'agricultor',
        status: 'activo',
      });

      inifapSubRoleUser = await User.create({
        full_name: 'INIFAP Subrol 1A16',
        email: INIFAP_SUBROLE_EMAIL,
        password_hash: passwordHash,
        role: 'inifap',
        rbac_role_id: systemRole?.id || null,
        status: 'activo',
      });

      inifapCustomRoleUser = await User.create({
        full_name: 'INIFAP Custom RBAC 1A16',
        email: INIFAP_CUSTOM_ROLE_EMAIL,
        password_hash: passwordHash,
        role: 'inifap',
        rbac_role_id: customInifapRole.id,
        status: 'activo',
      });

      farmerCustomRoleUser = await User.create({
        full_name: 'Agricultor Custom RBAC 1A16',
        email: FARMER_CUSTOM_ROLE_EMAIL,
        password_hash: passwordHash,
        role: 'agricultor',
        rbac_role_id: customFarmerRole.id,
        status: 'activo',
      });

      roleChangeUser = await User.create({
        full_name: 'Usuario Cambio Rol 1A16',
        email: ROLE_CHANGE_EMAIL,
        password_hash: passwordHash,
        role: 'inifap',
        status: 'activo',
      });
    });

    afterAll(async () => {
      await cleanup1A16();
    });

    it('reproduce/evita 403 cuando un agricultor abre notificaciones con action_url en /private/* o /dashboard', async () => {
      const farmerAgent = await loginAs(FARMER_EMAIL);
      const cases = [
        { actionUrl: '/private/crops/1', expectedLocation: '/crops' },
        { actionUrl: '/private/plagues/1', expectedLocation: '/plagues' },
        { actionUrl: '/private/products/1', expectedLocation: '/products' },
        { actionUrl: '/private/profile', expectedLocation: '/profile' },
        {
          actionUrl: '/private/profile#tab-security',
          expectedLocation: '/profile#tab-security',
        },
        { actionUrl: '/private/lands', expectedLocation: '/lands' },
        { actionUrl: '/private/users', expectedLocation: '/profile' },
        { actionUrl: '/dashboard', expectedLocation: '/profile' },
      ];

      for (const { actionUrl, expectedLocation } of cases) {
        const notif = await createNotification({
          userId: farmerUser.id,
          category: 'editorial',
          title: `Notif ${actionUrl}`,
          message: 'Prueba de redirección segura para agricultor',
          actionUrl,
        });

        const openRes = await farmerAgent.get(
          `/notifications/${notif.id}/open`,
        );
        expect(openRes.status).toBe(302);
        expect(openRes.headers.location).toBe(expectedLocation);

        const destinationPath = openRes.headers.location.split('#')[0];
        const followRes = await farmerAgent
          .get(destinationPath)
          .set('Accept', 'text/html');
        expect(followRes.status).toBe(200);
      }

      const externalNotif = await createNotification({
        userId: farmerUser.id,
        title: 'Enlace externo agricultor',
        message: 'Debe caer en /profile',
        actionUrl: 'https://evil.example/steal',
      });
      const extRes = await farmerAgent.get(
        `/notifications/${externalNotif.id}/open`,
      );
      expect(extRes.status).toBe(302);
      expect(extRes.headers.location).toBe('/profile');

      const invalidIdRes = await farmerAgent.get(
        '/notifications/id-invalido/open',
      );
      expect(invalidIdRes.status).toBe(302);
      expect(invalidIdRes.headers.location).toBe('/profile');
    });

    it('rechaza URLs externas, protocol-relative, con backslashes y traversal en resolveSafeRedirectUrl', () => {
      const maliciousInputs = [
        'https://malicious-site.com',
        'http://evil.example/phish',
        '//evil.example/hijack',
        '/\\evil.example/path',
        'javascript:alert(1)',
        '/profile\r\nLocation: https://evil.example',
        '',
        null,
        undefined,
      ];

      for (const input of maliciousInputs) {
        expect(resolveSafeRedirectUrl(input, 'agricultor')).toBe('/profile');
        expect(resolveSafeRedirectUrl(input, 'inifap')).toBe('/dashboard');
        expect(resolveSafeRedirectUrl(input, 'admin')).toBe('/dashboard');
      }

      expect(
        resolveNotificationActionUrl('/crops/../private/crops/1', 'agricultor'),
      ).toBe('/crops');
      expect(
        resolveNotificationActionUrl(
          '/PRIVATE/PROFILE#tab-security',
          'agricultor',
        ),
      ).toBe('/profile#tab-security');
      expect(resolveNotificationActionUrl('/DASHBOARD', 'agricultor')).toBe(
        '/profile',
      );
      expect(
        resolveNotificationActionUrl('/private/crops/42', 'agricultor', {
          workflowStatus: 'published',
        }),
      ).toBe('/crops/42');
      expect(
        resolveNotificationActionUrl('/private/crops/42', 'agricultor', {
          workflowStatus: 'changes_requested',
        }),
      ).toBe('/crops');
      expect(resolveNotificationActionUrl('/private/users', 'inifap')).toBe(
        '/dashboard',
      );
      expect(resolveNotificationActionUrl('/private/users', 'admin')).toBe(
        '/private/users',
      );
    });

    it('usa el rol ACTUAL del usuario como autoridad en openNotification sin migrar registros históricos', async () => {
      const legacyNotif = await createNotification({
        userId: roleChangeUser.id,
        category: 'editorial',
        title: 'Ficha histórica en /private/crops/1',
        message: 'Creada cuando el usuario era INIFAP',
        actionUrl: '/private/crops/1',
      });

      // Degradamos al usuario a agricultor sin tocar la tabla Notifications
      await roleChangeUser.update({ role: 'agricultor' });

      const demotedAgent = await loginAs(ROLE_CHANGE_EMAIL);
      const demotedOpen = await demotedAgent.get(
        `/notifications/${legacyNotif.id}/open`,
      );
      expect(demotedOpen.status).toBe(302);
      expect(demotedOpen.headers.location).toBe('/crops');

      const followDemoted = await demotedAgent
        .get(demotedOpen.headers.location)
        .set('Accept', 'text/html');
      expect(followDemoted.status).toBe(200);

      // Si vuelve a ser INIFAP, el mismo action_url privado vuelve a respetarse
      await roleChangeUser.update({ role: 'inifap' });
      const promotedNotif = await createNotification({
        userId: roleChangeUser.id,
        category: 'editorial',
        title: 'Acceso panel restaurado',
        message: 'Usuario nuevamente INIFAP',
        actionUrl: '/private/crops',
      });

      const promotedOpen = await demotedAgent.get(
        `/notifications/${promotedNotif.id}/open`,
      );
      expect(promotedOpen.status).toBe(302);
      expect(promotedOpen.headers.location).toBe('/private/crops');

      const followPromoted = await demotedAgent
        .get(promotedOpen.headers.location)
        .set('Accept', 'text/html');
      expect(followPromoted.status).toBe(200);
    });

    it('rechaza acceso no autenticado a todos los endpoints de notificaciones', async () => {
      const notif = await createNotification({
        userId: farmerUser.id,
        title: 'Solo autenticado',
        message: 'Debe redirigir a login',
        actionUrl: '/profile',
      });

      const endpoints = [
        request(app).get('/api/notifications'),
        request(app).post(`/api/notifications/${notif.id}/read`),
        request(app).post('/api/notifications/read-all'),
        request(app).get(`/notifications/${notif.id}/open`),
      ];

      const responses = await Promise.all(endpoints);
      for (const res of responses) {
        expect(res.status).toBe(302);
        expect(res.headers.location).toContain('/auth/login');
      }
    });

    const buildRoleScenarios = () => [
      {
        label: 'agricultor',
        user: farmerUser,
        email: FARMER_EMAIL,
        actionUrl: '/private/crops/1',
        expectedLocation: '/crops',
        adminActionExpected: '/profile',
        expectOtherRead404: true,
      },
      {
        label: 'agricultor con rol RBAC personalizado',
        user: farmerCustomRoleUser,
        email: FARMER_CUSTOM_ROLE_EMAIL,
        actionUrl: '/dashboard',
        expectedLocation: '/profile',
        adminActionExpected: '/profile',
        expectOtherRead404: true,
      },
      {
        label: 'inifap sin sub-rol RBAC',
        user: testUser,
        email: TEST_USER_EMAIL,
        actionUrl: '/private/crops',
        expectedLocation: '/private/crops',
        adminActionExpected: '/dashboard',
        expectOtherRead404: true,
      },
      {
        label: 'inifap con sub-rol RBAC de sistema',
        user: inifapSubRoleUser,
        email: INIFAP_SUBROLE_EMAIL,
        actionUrl: '/private/crops',
        expectedLocation: '/private/crops',
        adminActionExpected: '/dashboard',
        expectOtherRead404: true,
      },
      {
        label: 'inifap con rol RBAC personalizado',
        user: inifapCustomRoleUser,
        email: INIFAP_CUSTOM_ROLE_EMAIL,
        actionUrl: '/private/crops',
        expectedLocation: '/private/crops',
        adminActionExpected: '/dashboard',
        expectOtherRead404: true,
      },
      {
        label: 'admin',
        user: adminUser,
        email: TEST_ADMIN_EMAIL,
        actionUrl: '/private/crops',
        expectedLocation: '/private/crops',
        adminActionExpected: '/private/users',
        expectOtherRead404: false,
      },
    ];

    it.each([
      'agricultor',
      'agricultor con rol RBAC personalizado',
      'inifap sin sub-rol RBAC',
      'inifap con sub-rol RBAC de sistema',
      'inifap con rol RBAC personalizado',
      'admin',
    ])(
      'valida API y redirección de notificaciones para rol: %s',
      async (scenarioLabel) => {
        const otherUsersNotif = await createNotification({
          userId: adminUser.id,
          title: 'Privada de admin',
          message: 'No accesible por otros usuarios',
          actionUrl: '/private/users',
        });

        const scenario = buildRoleScenarios().find(
          (item) => item.label === scenarioLabel,
        );
        const agent = await loginAs(scenario.email);
        const ownNotif = await createNotification({
          userId: scenario.user.id,
          title: `Notif ${scenario.label}`,
          message: 'Prueba integral por rol',
          actionUrl: scenario.actionUrl,
        });
        const adminTargetNotif = await createNotification({
          userId: scenario.user.id,
          title: `Admin route ${scenario.label}`,
          message: 'Ruta exclusiva admin',
          actionUrl: '/private/users',
        });

        const listRes = await agent.get('/api/notifications');
        expect(listRes.status).toBe(200);
        expect(listRes.body.success).toBe(true);
        expect(Array.isArray(listRes.body.notifications)).toBe(true);

        const readOwnRes = await agent.post(
          `/api/notifications/${ownNotif.id}/read`,
        );
        expect(readOwnRes.status).toBe(200);
        expect(readOwnRes.body.success).toBe(true);

        if (scenario.expectOtherRead404) {
          const readOtherRes = await agent.post(
            `/api/notifications/${otherUsersNotif.id}/read`,
          );
          expect(readOtherRes.status).toBe(404);

          const openOtherRes = await agent.get(
            `/notifications/${otherUsersNotif.id}/open`,
          );
          expect(openOtherRes.status).toBe(302);
          expect(openOtherRes.headers.location).toBe(
            scenario.user.role === 'agricultor' ? '/profile' : '/dashboard',
          );
          const untouched = await Notification.findByPk(otherUsersNotif.id);
          expect(untouched.is_read).toBe(false);
        }

        const openOwnRes = await agent.get(
          `/notifications/${ownNotif.id}/open`,
        );
        expect(openOwnRes.status).toBe(302);
        expect(openOwnRes.headers.location).toBe(scenario.expectedLocation);
        const followOwnRes = await agent
          .get(openOwnRes.headers.location)
          .set('Accept', 'text/html');
        expect(followOwnRes.status).toBe(200);

        const openAdminRes = await agent.get(
          `/notifications/${adminTargetNotif.id}/open`,
        );
        expect(openAdminRes.status).toBe(302);
        expect(openAdminRes.headers.location).toBe(
          scenario.adminActionExpected,
        );
        const followAdminRes = await agent
          .get(openAdminRes.headers.location)
          .set('Accept', 'text/html');
        expect(followAdminRes.status).toBe(200);

        const readAllRes = await agent.post('/api/notifications/read-all');
        expect(readAllRes.status).toBe(200);
        expect(readAllRes.body.success).toBe(true);
      },
    );

    it('genera action_url acorde al rol en notifyAuthorOnWorkflowChange y rbacController', async () => {
      await notifyAuthorOnWorkflowChange({
        authorId: farmerUser.id,
        actorId: adminUser.id,
        entityName: 'Tomate Publicado 1A16',
        moduleTitle: 'Cultivo',
        workflowStatus: 'published',
        actionUrl: '/private/crops/55',
      });

      await notifyAuthorOnWorkflowChange({
        authorId: farmerUser.id,
        actorId: adminUser.id,
        entityName: 'Plaga En Revisión 1A16',
        moduleTitle: 'Plaga',
        workflowStatus: 'changes_requested',
        actionUrl: '/private/plagues/55',
      });

      await notifyAuthorOnWorkflowChange({
        authorId: inifapSubRoleUser.id,
        actorId: adminUser.id,
        entityName: 'Insumo Técnico 1A16',
        moduleTitle: 'Insumo',
        workflowStatus: 'published',
        actionUrl: '/private/products/55',
      });

      const farmerNotifs = await Notification.findAll({
        where: { user_id: farmerUser.id },
        order: [['id', 'DESC']],
      });
      const publishedCropNotif = farmerNotifs.find((n) =>
        n.message.includes('Tomate Publicado 1A16'),
      );
      const pendingPlagueNotif = farmerNotifs.find((n) =>
        n.message.includes('Plaga En Revisión 1A16'),
      );
      expect(publishedCropNotif?.action_url).toBe('/crops/55');
      expect(pendingPlagueNotif?.action_url).toBe('/plagues');

      const inifapNotifs = await Notification.findAll({
        where: { user_id: inifapSubRoleUser.id },
        order: [['id', 'DESC']],
      });
      const inifapProductNotif = inifapNotifs.find((n) =>
        n.message.includes('Insumo Técnico 1A16'),
      );
      expect(inifapProductNotif?.action_url).toBe('/private/products/55');

      const adminAgent = await loginAs(TEST_ADMIN_EMAIL);
      const rbacFarmerRes = await adminAgent
        .post(`/private/rbac/users/${farmerUser.id}/permissions`)
        .send({ role: 'agricultor', status: 'activo' });
      expect(rbacFarmerRes.status).toBe(302);

      const rbacInifapRes = await adminAgent
        .post(`/private/rbac/users/${inifapSubRoleUser.id}/permissions`)
        .send({ role: 'inifap', status: 'activo' });
      expect(rbacInifapRes.status).toBe(302);

      const latestFarmerRbacNotif = await Notification.findOne({
        where: { user_id: farmerUser.id, category: 'rbac' },
        order: [['id', 'DESC']],
      });
      const latestInifapRbacNotif = await Notification.findOne({
        where: { user_id: inifapSubRoleUser.id, category: 'rbac' },
        order: [['id', 'DESC']],
      });
      expect(latestFarmerRbacNotif?.action_url).toBe('/profile');
      expect(latestInifapRbacNotif?.action_url).toBe('/private/profile');
    });
  });
});
