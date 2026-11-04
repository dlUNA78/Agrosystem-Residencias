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
  resolveOperationalSummary,
} from '../../src/services/notificationService.js';

const { User, Notification } = db;

describe('🔔 Centro de Notificaciones Híbrido', () => {
  let testUser = null;
  let adminUser = null;
  let testNotif = null;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('NotifSecret@123', 10);

    testUser = await User.create({
      full_name: 'Usuario Notif Test',
      email: 'notif_test@inifap.gob.mx',
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
    });

    adminUser = await User.findOne({
      where: { role: 'admin', status: 'activo' },
    });
    if (!adminUser) {
      adminUser = await User.create({
        full_name: 'Admin Notif Test',
        email: 'admin_notif@inifap.gob.mx',
        password_hash: passwordHash,
        role: 'admin',
        status: 'activo',
      });
    }
  });

  afterAll(async () => {
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
        password: 'NotifSecret@123',
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
});
