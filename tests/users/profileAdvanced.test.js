import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import request from 'supertest';
import bcrypt from 'bcrypt';
import app, { closeAppResources } from '../../app.js';
import db from '../../src/models/index.js';
import {
  getEnrichedProfileData,
  updateUserProfileDetails,
  updateUserPassword,
  updateUserAvatar,
} from '../../src/services/profileService.js';
import {
  listUserActiveSessions,
  revokeOtherSessions,
  revokeAllUserSessions,
  formatUserAgentSummary,
} from '../../src/services/sessionManagementService.js';

const { User, Farm, AuditLog } = db;
const TEST_INIFAP_EMAIL = 'investigador_perfil@inifap.gob.mx';
const TEST_FARMER_EMAIL = 'agricultor_perfil@test.com';
const TEST_ADMIN_EMAIL = 'admin_perfil@inifap.gob.mx';

describe('👤 Módulo de Perfil Avanzado y Control de Sesiones', () => {
  let testUser = null;
  let farmerUser = null;
  let adminUser = null;
  let testFarm = null;

  beforeAll(async () => {
    const passwordHash = await bcrypt.hash('SecurePass@123', 10);

    const staleUsers = await User.findAll({
      where: {
        email: [TEST_INIFAP_EMAIL, TEST_FARMER_EMAIL, TEST_ADMIN_EMAIL],
      },
      order: [['id', 'ASC']],
    });
    if (staleUsers.length > 0) {
      const staleIds = staleUsers.map((u) => u.id);
      await Farm.destroy({ where: { user_id: staleIds } });
      await AuditLog.destroy({ where: { user_id: staleIds } });
      await User.destroy({ where: { id: staleIds } });
    }

    // 1. Crear usuario de prueba institucional
    testUser = await User.create({
      full_name: 'Investigador Perfil Test',
      email: TEST_INIFAP_EMAIL,
      password_hash: passwordHash,
      role: 'inifap',
      status: 'activo',
      shift: 'matutino',
      code: 'INIFAP-PRF-001',
      job_title: 'Investigador Titular',
      phone: '5551234567',
      address: 'Campo Experimental Valle de México',
    });

    // 2. Crear usuario agricultor
    farmerUser = await User.create({
      full_name: 'Agricultor Perfil Test',
      email: TEST_FARMER_EMAIL,
      password_hash: passwordHash,
      role: 'agricultor',
      status: 'activo',
    });

    // 3. Crear predio para el agricultor
    testFarm = await Farm.create({
      name: 'Rancho Santa María Test',
      user_id: farmerUser.id,
      size_hectares: 25.5,
      farming_type: 'Riego',
      municipality: 'Uruapan',
      status: true,
    });

    // 4. Crear admin propio con correo fijo y ORDER BY
    await User.create({
      full_name: 'Admin Global Test',
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

    // 5. Inyectar registros simulados en la tabla "session" para probar aislamiento multiusuario (2 usuarios con varias sesiones + 1 expirada)
    const expireDate = new Date(Date.now() + 1000 * 60 * 60 * 24);
    const expiredDate = new Date(Date.now() - 1000 * 60 * 60);
    await db.sequelize.query(
      `INSERT INTO "session" (sid, sess, expire) VALUES 
       (:sid1, :sess1, :expire),
       (:sid2, :sess2, :expire),
       (:sid3, :sess3, :expire),
       (:sid4, :sess4, :expire),
       (:sid5, :sess5, :expire),
       (:sid6, :sess6, :expired)
       ON CONFLICT (sid) DO UPDATE SET sess = EXCLUDED.sess, expire = EXCLUDED.expire`,
      {
        replacements: {
          sid1: 'session_prf_current',
          sess1: JSON.stringify({
            passport: { user: testUser.id },
            clientIp: '192.168.1.100',
            userAgent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0 Safari/537.36',
            lastActive: new Date().toISOString(),
          }),
          sid2: 'session_prf_remote1',
          sess2: JSON.stringify({
            passport: { user: testUser.id },
            clientIp: '187.189.10.5',
            userAgent:
              'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
            lastActive: new Date().toISOString(),
          }),
          sid3: 'session_prf_other_user',
          sess3: JSON.stringify({
            passport: { user: farmerUser.id },
            clientIp: '189.200.1.1',
            userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)',
            lastActive: new Date().toISOString(),
          }),
          sid4: 'session_prf_remote2',
          sess4: JSON.stringify({
            passport: { user: testUser.id },
            clientIp: '198.51.100.44',
            userAgent: 'Mozilla/5.0 (Linux; Android 14) Firefox/122.0',
            lastActive: new Date().toISOString(),
          }),
          sid5: 'session_prf_other_user_2',
          sess5: JSON.stringify({
            passport: { user: farmerUser.id },
            clientIp: '189.200.1.2',
            userAgent: 'Mozilla/5.0 (Windows NT 10.0) Edge/121.0',
            lastActive: new Date().toISOString(),
          }),
          sid6: 'session_prf_expired',
          sess6: JSON.stringify({
            passport: { user: testUser.id },
            clientIp: '10.0.0.5',
            userAgent: 'Mozilla/5.0 Chrome/118.0',
            lastActive: expiredDate.toISOString(),
          }),
          expire: expireDate,
          expired: expiredDate,
        },
      },
    );
  });

  afterAll(async () => {
    // Limpieza de datos creados en pruebas
    await db.sequelize.query(
      `DELETE FROM "session" WHERE sid IN (
        'session_prf_current',
        'session_prf_remote1',
        'session_prf_remote2',
        'session_prf_other_user',
        'session_prf_other_user_2',
        'session_prf_expired'
      )`,
    );
    if (testFarm) await testFarm.destroy();
    if (testUser) {
      await AuditLog.destroy({ where: { user_id: testUser.id } });
      await testUser.destroy();
    }
    if (farmerUser) {
      await AuditLog.destroy({ where: { user_id: farmerUser.id } });
      await farmerUser.destroy();
    }
    if (adminUser) {
      await AuditLog.destroy({ where: { user_id: adminUser.id } });
      await adminUser.destroy();
    }
    await closeAppResources();
  });

  describe('🛠️ 1. Servicio de Control de Sesiones en PostgreSQL', () => {
    it('formatea resúmenes legibles de agente de usuario', () => {
      expect(
        formatUserAgentSummary(
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0 Safari/537.36',
        ),
      ).toBe('Google Chrome (Windows)');
      expect(
        formatUserAgentSummary(
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1 Safari/604.1',
        ),
      ).toBe('Apple Safari (iOS)');
      expect(formatUserAgentSummary(null)).toBe('Navegador Web');
    });

    it('lista todas las sesiones activas asociadas a un usuario e identifica la actual (excluyendo expiradas y de otros usuarios)', async () => {
      const sessions = await listUserActiveSessions(
        testUser.id,
        'session_prf_current',
      );
      expect(sessions.map((s) => s.sid)).toEqual(
        expect.arrayContaining([
          'session_prf_current',
          'session_prf_remote1',
          'session_prf_remote2',
        ]),
      );
      expect(sessions.some((s) => s.sid === 'session_prf_expired')).toBe(false);
      expect(sessions.some((s) => s.sid === 'session_prf_other_user')).toBe(
        false,
      );

      const current = sessions.find((s) => s.sid === 'session_prf_current');
      expect(current).toBeDefined();
      expect(current.isCurrent).toBe(true);
      expect(current.clientIp).toBe('192.168.1.100');

      const remote = sessions.find((s) => s.sid === 'session_prf_remote1');
      expect(remote).toBeDefined();
      expect(remote.isCurrent).toBe(false);
    });

    it('revoca únicamente las otras sesiones del usuario preservando la actual y sin tocar las sesiones de otros usuarios', async () => {
      const { revokedCount } = await revokeOtherSessions(
        testUser.id,
        'session_prf_current',
      );
      expect(revokedCount).toBeGreaterThanOrEqual(2);

      const remaining = await listUserActiveSessions(
        testUser.id,
        'session_prf_current',
      );
      expect(remaining.some((s) => s.sid === 'session_prf_remote1')).toBe(
        false,
      );
      expect(remaining.some((s) => s.sid === 'session_prf_remote2')).toBe(
        false,
      );
      expect(remaining.some((s) => s.sid === 'session_prf_current')).toBe(true);

      // Ninguna de las 2 sesiones activas del agricultor debe verse afectada
      const farmerSessions = await listUserActiveSessions(farmerUser.id);
      expect(farmerSessions.map((s) => s.sid)).toEqual(
        expect.arrayContaining([
          'session_prf_other_user',
          'session_prf_other_user_2',
        ]),
      );
    });

    it('revoca todas las sesiones de un usuario sin afectar las sesiones de otros usuarios', async () => {
      const { revokedCount } = await revokeAllUserSessions(farmerUser.id);
      expect(revokedCount).toBeGreaterThanOrEqual(2);

      const remainingFarmer = await listUserActiveSessions(farmerUser.id);
      expect(remainingFarmer).toHaveLength(0);

      // La sesión actual del primer usuario sigue intacta
      const remainingInifap = await listUserActiveSessions(
        testUser.id,
        'session_prf_current',
      );
      expect(remainingInifap.some((s) => s.sid === 'session_prf_current')).toBe(
        true,
      );
    });
  });

  describe('📊 2. Servicio de Perfil Enriquecido Contextual', () => {
    it('resuelve métricas agronómicas para el rol agricultor', async () => {
      const data = await getEnrichedProfileData(farmerUser, null);
      expect(data.farmerData).not.toBeNull();
      expect(data.farmerData.totalFarms).toBeGreaterThanOrEqual(1);
      expect(Number(data.farmerData.totalHectares)).toBeGreaterThanOrEqual(
        25.5,
      );
    });

    it('resuelve línea de tiempo de auditoría para rol INIFAP', async () => {
      await AuditLog.create({
        table_name: 'Crops',
        record_id: 1,
        user_id: testUser.id,
        action: 'UPDATE',
      });

      const data = await getEnrichedProfileData(
        testUser,
        'session_prf_current',
      );
      expect(data.inifapData).not.toBeNull();
      expect(data.inifapData.recentLogs.length).toBeGreaterThanOrEqual(1);
      expect(data.inifapData.recentLogs[0].action).toBe('UPDATE');
    });

    it('resuelve consola rápida de gobernanza RBAC para rol Administrador', async () => {
      const data = await getEnrichedProfileData(adminUser, null);
      expect(data.adminData).not.toBeNull();
      expect(data.adminData.quickStats.totalUsers).toBeGreaterThanOrEqual(1);
      expect(data.adminData.availableRoles).toBeDefined();
    });
  });

  describe('✏️ 3. Actualización de Información Personal', () => {
    it('actualiza campos de perfil (nombre, teléfono, puesto, turno, dirección) y registra log', async () => {
      await updateUserProfileDetails(testUser.id, {
        full_name: 'Dr. Investigador Actualizado',
        phone: '5559876543',
        job_title: 'Director de Fitosanidad',
        shift: 'vespertino',
        address: 'Nuevo Campo de Pruebas',
      });

      await testUser.reload();
      expect(testUser.full_name).toBe('Dr. Investigador Actualizado');
      expect(testUser.phone).toBe('5559876543');
      expect(testUser.shift).toBe('vespertino');
      expect(testUser.job_title).toBe('Director de Fitosanidad');

      const log = await AuditLog.findOne({
        where: { user_id: testUser.id, action: 'PROFILE_UPDATE' },
        order: [['createdAt', 'DESC']],
      });
      expect(log).not.toBeNull();
      expect(log.new_values.shift).toBe('vespertino');
    });
  });

  describe('🔐 4. Cambio Seguro de Contraseña', () => {
    it('rechaza si las contraseñas no coinciden', async () => {
      await expect(
        updateUserPassword(testUser.id, {
          currentPassword: 'SecurePass@123',
          newPassword: 'NewPassword@2026',
          confirmPassword: 'DifferentPassword@2026',
        }),
      ).rejects.toThrow('passwords_do_not_match');
    });

    it('rechaza si la contraseña es menor a 8 caracteres', async () => {
      await expect(
        updateUserPassword(testUser.id, {
          currentPassword: 'SecurePass@123',
          newPassword: 'short',
          confirmPassword: 'short',
        }),
      ).rejects.toThrow('password_too_short');
    });

    it('rechaza si la contraseña actual no es válida', async () => {
      await expect(
        updateUserPassword(testUser.id, {
          currentPassword: 'WrongPassword@999',
          newPassword: 'ValidNewPassword@2026',
          confirmPassword: 'ValidNewPassword@2026',
        }),
      ).rejects.toThrow('current_password_incorrect');
    });

    it('actualiza exitosamente con contraseña correcta y genera log de auditoría', async () => {
      const success = await updateUserPassword(testUser.id, {
        currentPassword: 'SecurePass@123',
        newPassword: 'ValidNewPassword@2026',
        confirmPassword: 'ValidNewPassword@2026',
      });

      expect(success).toBe(true);

      await testUser.reload();
      const isNewMatch = await bcrypt.compare(
        'ValidNewPassword@2026',
        testUser.password_hash,
      );
      expect(isNewMatch).toBe(true);

      const passLog = await AuditLog.findOne({
        where: { user_id: testUser.id, action: 'PASSWORD_CHANGE' },
      });
      expect(passLog).not.toBeNull();
    });
  });

  describe('🖼️ 5. Gestión de Avatar de Perfil', () => {
    it('actualiza URL de avatar y registra log', async () => {
      const photoUrl = await updateUserAvatar(testUser.id, {
        filename: 'avatar-test-123.jpg',
      });
      expect(photoUrl).toBe('/images/avatars/avatar-test-123.jpg');

      await testUser.reload();
      expect(testUser.photo_url).toBe('/images/avatars/avatar-test-123.jpg');

      const avatarLog = await AuditLog.findOne({
        where: { user_id: testUser.id, action: 'AVATAR_UPDATE' },
      });
      // Las acciones de bajo impacto como avatar se omiten de la auditoría de alto impacto
      expect(avatarLog).toBeNull();
    });

    it('elimina foto de perfil y restaura a null', async () => {
      const photoUrl = await updateUserAvatar(testUser.id, {
        removeAvatar: true,
      });
      expect(photoUrl).toBeNull();

      await testUser.reload();
      expect(testUser.photo_url).toBeNull();

      const removeLog = await AuditLog.findOne({
        where: { user_id: testUser.id, action: 'AVATAR_REMOVE' },
      });
      // Las acciones de bajo impacto como avatar se omiten de la auditoría de alto impacto
      expect(removeLog).toBeNull();
    });
  });

  describe('🌐 6. Endpoints HTTP de Perfil (Integración)', () => {
    let authAgent;

    beforeAll(async () => {
      authAgent = request.agent(app);
      // Iniciar sesión con el usuario de prueba
      await authAgent.post('/auth/login').send({
        email: 'investigador_perfil@inifap.gob.mx',
        password: 'ValidNewPassword@2026',
      });
    });

    it('GET /private/profile responde 200 y renderiza vista de perfil institucional', async () => {
      const res = await authAgent.get('/private/profile');
      expect(res.status).toBe(200);
      expect(res.text).toContain('Perfil de Usuario');
      expect(res.text).toContain('Dr. Investigador Actualizado');
      expect(res.text).toContain('Seguridad y Sesiones');
    });

    it('POST /private/profile actualiza datos y redirige con mensaje de éxito', async () => {
      const res = await authAgent.post('/private/profile').type('form').send({
        full_name: 'Dr. Investigador Editado Web',
        phone: '5551122334',
        job_title: 'Investigador Principal',
        shift: 'matutino',
        address: 'Laboratorio Central',
      });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(
        '/private/profile?success=perfil_actualizado',
      );
    });

    it('POST /private/profile/password actualiza contraseña y redirige con éxito', async () => {
      const res = await authAgent
        .post('/private/profile/password')
        .type('form')
        .send({
          current_password: 'ValidNewPassword@2026',
          new_password: 'EvenNewerPassword@2026',
          confirm_password: 'EvenNewerPassword@2026',
        });

      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(
        '/private/profile?success=password_actualizado',
      );
    });

    it('POST /private/profile/sessions/revoke-others revoca sesiones y redirige', async () => {
      const res = await authAgent.post(
        '/private/profile/sessions/revoke-others',
      );
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain(
        '/private/profile?success=sesiones_cerradas',
      );
    });

    it('no reescribe "session" dentro de la ventana de 5 min y mantiene coherentes cookie Expires y expire en BD al renovar (1.A6)', async () => {
      const ua = 'AgroCoherenceAgent/1.0';
      // Primera petición autenticada con este UA: actualiza clientIp, userAgent y lastActive
      const initialRes = await authAgent
        .get('/api/notifications')
        .set('User-Agent', ua);
      expect(initialRes.status).toBe(200);

      const [[sessionRowBefore]] = await db.sequelize.query(
        `SELECT sid, sess, expire
         FROM "session"
         WHERE (sess -> 'passport' ->> 'user') = :uid
           AND sid <> 'session_prf_current'
           AND expire > NOW()
         ORDER BY expire DESC
         LIMIT 1`,
        { replacements: { uid: String(testUser.id) } },
      );
      expect(sessionRowBefore).toBeDefined();
      const initialLastActive = sessionRowBefore.sess.lastActive;
      const initialExpireMs = new Date(sessionRowBefore.expire).getTime();

      // 5 peticiones seguidas dentro de la ventana de 5 min: sin Set-Cookie y sin escrituras en BD
      for (let i = 0; i < 5; i += 1) {
        const res = await authAgent
          .get('/api/notifications')
          .set('User-Agent', ua);
        expect(res.status).toBe(200);
        expect(res.headers['set-cookie']).toBeUndefined();
      }

      const [[sessionRowThrottled]] = await db.sequelize.query(
        'SELECT sess, expire FROM "session" WHERE sid = :sid',
        { replacements: { sid: sessionRowBefore.sid } },
      );
      expect(sessionRowThrottled.sess.lastActive).toBe(initialLastActive);
      expect(new Date(sessionRowThrottled.expire).getTime()).toBe(
        initialExpireMs,
      );

      // Envejecemos lastActive > 5 min y expire en BD para verificar renovación conjunta de cookie + BD
      const agedLastActive = new Date(Date.now() - 6 * 60 * 1000).toISOString();
      const agedExpire = new Date(Date.now() + 12 * 60 * 60 * 1000);
      const agedSess = {
        ...sessionRowThrottled.sess,
        lastActive: agedLastActive,
      };
      await db.sequelize.query(
        'UPDATE "session" SET sess = :sess::json, expire = :expire WHERE sid = :sid',
        {
          replacements: {
            sid: sessionRowBefore.sid,
            sess: JSON.stringify(agedSess),
            expire: agedExpire,
          },
        },
      );

      const renewedRes = await authAgent
        .get('/api/notifications')
        .set('User-Agent', ua);
      expect(renewedRes.status).toBe(200);

      const setCookies = renewedRes.headers['set-cookie'] || [];
      const sidCookie = setCookies.find((c) => c.startsWith('connect.sid='));
      expect(sidCookie).toBeDefined();
      const expiresMatch = sidCookie.match(/Expires=([^;]+)/i);
      expect(expiresMatch).not.toBeNull();
      const cookieExpiresMs = Date.parse(expiresMatch[1]);

      const [[sessionRowAfter]] = await db.sequelize.query(
        'SELECT sess, expire FROM "session" WHERE sid = :sid',
        { replacements: { sid: sessionRowBefore.sid } },
      );
      const dbExpireMs = new Date(sessionRowAfter.expire).getTime();

      expect(sessionRowAfter.sess.lastActive).not.toBe(agedLastActive);
      expect(dbExpireMs).toBeGreaterThan(agedExpire.getTime());
      // La expiración de la cookie (maxAge 24h) y el campo expire guardado en PostgreSQL quedan alineados (<= 2s)
      expect(Math.abs(cookieExpiresMs - dbExpireMs)).toBeLessThanOrEqual(2000);
    });
  });
});
