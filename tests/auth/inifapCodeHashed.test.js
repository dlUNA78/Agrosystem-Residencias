import { describe, it, expect } from '@jest/globals';
import {
  generateSingleCodeString,
  computeCodeHash,
  maskCodeString,
  serializeInifapCode,
} from '../../src/services/inifapCodeService.js';
import { canModifyUserRoleOrStatus } from '../../src/services/rbacService.js';
import { buildAuditWhere } from '../../src/services/auditQueryService.js';
import Sequelize from 'sequelize';

describe('Blindaje de Seguridad y Tokens Criptográficos INIFAP', () => {
  it('genera códigos con prefijo AGS y 16 caracteres de alta entropía', () => {
    const code = generateSingleCodeString();
    expect(code).toMatch(
      /^AGS-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}-[2-9A-Z]{4}$/,
    );

    const secondCode = generateSingleCodeString();
    expect(code).not.toBe(secondCode);
  });

  it('calcula hash SHA-256 determinista para búsqueda segura', () => {
    const raw = 'AGS-A2K9-7ZP2-M4N8-W1Q5';
    const hash1 = computeCodeHash(raw);
    const hash2 = computeCodeHash('  ags-a2k9-7zp2-m4n8-w1q5  '); // Case and whitespace insensitive

    expect(hash1).toBeDefined();
    expect(hash1).toHaveLength(64);
    expect(hash1).toBe(hash2);
  });

  it('enmascara códigos para evitar exposición en vistas y tablas', () => {
    const raw = 'AGS-A2K9-7ZP2-M4N8-W1Q5';
    const masked = maskCodeString(raw);
    expect(masked).toBe('AGS-A2K9-****-****-W1Q5');

    const serialized = serializeInifapCode({
      id: 1,
      code: raw,
      is_used: false,
    });
    expect(serialized.code).toBe('AGS-A2K9-****-****-W1Q5');
  });

  it('prohíbe promover a otros usuarios a Administrador (SuperAdmin inmutable)', () => {
    const actorAdmin = { id: 1, role: 'admin' };

    // Intentar otorgar rol admin a otro usuario
    const promotionAttempt = canModifyUserRoleOrStatus({
      actor: actorAdmin,
      targetUserId: 25,
      newRole: 'admin',
    });

    expect(promotionAttempt.allowed).toBe(false);
    expect(promotionAttempt.reason).toContain(
      'rol de Administrador General es único y no transferible',
    );
  });

  it('prohíbe auto-degradarse al Administrador activo', () => {
    const actorAdmin = { id: 1, role: 'admin' };

    const selfDemote = canModifyUserRoleOrStatus({
      actor: actorAdmin,
      targetUserId: 1,
      newRole: 'inifap',
    });

    expect(selfDemote.allowed).toBe(false);
    expect(selfDemote.reason).toContain(
      'no puedes retirar tus propios privilegios',
    );
  });

  it('filtra automáticamente eventos de bajo impacto en el módulo de auditoría', () => {
    const where = buildAuditWhere(Sequelize, {});
    expect(where.action).toBeDefined();
    expect(where.action[Sequelize.Op.notIn]).toContain('AVATAR_UPDATE');
    expect(where.action[Sequelize.Op.notIn]).toContain('AVATAR_REMOVE');
    expect(where.action[Sequelize.Op.notIn]).toContain('PROFILE_UPDATE');
  });
});
