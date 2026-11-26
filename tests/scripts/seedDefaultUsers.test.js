import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import bcrypt from 'bcrypt';
import fs from 'node:fs';
import path from 'node:path';

import db from '../../src/models/index.js';
import {
  seedDefaultUsers,
  shouldRunDefaultUsersSeed,
} from '../../src/scripts/seedDefaultUsers.js';

const { RbacRole, User, sequelize } = db;

const EMAIL_UPGRADED = 'h1-seed-upgraded@agrosystem.test';
const EMAIL_SUSPENDED = 'h1-seed-suspended@agrosystem.test';
const EMAIL_PROD_BLOCKED = 'h1-seed-prod-blocked@agrosystem.test';
const TEST_ROLE_SLUG = 'h1-seed-inifap-subrole';

const SEED_FIXTURES = [
  {
    code: 'USR-H1-001',
    full_name: 'Usuario Semilla Uno',
    email: EMAIL_UPGRADED,
    password: 'SeedInitial@123',
    role: 'agricultor',
    phone: '6670001111',
    address: 'Domicilio Semilla 1',
    job_title: 'Productor Semilla',
    shift: 'Variable',
    photo_url: null,
    status: 'activo',
  },
  {
    code: 'USR-H1-002',
    full_name: 'Usuario Semilla Dos',
    email: EMAIL_SUSPENDED,
    password: 'SeedInitial@456',
    role: 'inifap',
    phone: '6670002222',
    address: 'Domicilio Semilla 2',
    job_title: 'Técnico Semilla',
    shift: 'Matutino',
    photo_url: null,
    status: 'activo',
  },
];

describe('H-1: seedDefaultUsers solo crea usuarios inexistentes y nunca corre en production', () => {
  let rbacRole = null;

  beforeAll(async () => {
    await User.destroy({
      where: { email: [EMAIL_UPGRADED, EMAIL_SUSPENDED, EMAIL_PROD_BLOCKED] },
    });
    await RbacRole.destroy({ where: { slug: TEST_ROLE_SLUG } });

    rbacRole = await RbacRole.create({
      name: 'Sub-rol Prueba H1',
      slug: TEST_ROLE_SLUG,
      description: 'Rol RBAC de prueba para validar preservación en H-1',
      permissions: ['crops.viewPrivate'],
      is_system: false,
    });
  });

  afterAll(async () => {
    await User.destroy({
      where: { email: [EMAIL_UPGRADED, EMAIL_SUSPENDED, EMAIL_PROD_BLOCKED] },
    });
    if (rbacRole) {
      await rbacRole.destroy();
    }
    await sequelize.close();
  });

  it('shouldRunDefaultUsersSeed deshabilita el seed en production y test, y lo habilita en development', () => {
    expect(shouldRunDefaultUsersSeed({ NODE_ENV: 'development' })).toBe(true);
    expect(shouldRunDefaultUsersSeed({})).toBe(true);
    expect(shouldRunDefaultUsersSeed({ NODE_ENV: 'production' })).toBe(false);
    expect(shouldRunDefaultUsersSeed({ NODE_ENV: 'PRODUCTION' })).toBe(false);
    expect(shouldRunDefaultUsersSeed({ NODE_ENV: 'test' })).toBe(false);

    const appSource = fs.readFileSync(path.resolve('app.js'), 'utf8');
    expect(appSource).toContain('shouldRunDefaultUsersSeed(process.env)');
  });

  it('omite por completo la creación de usuarios cuando NODE_ENV=production', async () => {
    const result = await seedDefaultUsers({
      env: { NODE_ENV: 'production' },
      users: [
        {
          code: 'USR-H1-PROD',
          full_name: 'No Debe Crearse',
          email: EMAIL_PROD_BLOCKED,
          password: 'NeverCreated@123',
          role: 'admin',
          status: 'activo',
        },
      ],
    });

    expect(result).toEqual({
      createdCount: 0,
      skippedCount: 0,
      skippedEnvironment: true,
    });

    const createdInProd = await User.findOne({
      where: { email: EMAIL_PROD_BLOCKED },
    });
    expect(createdInProd).toBeNull();
  });

  it('crea usuarios inexistentes y al re-ejecutarse preserva ascenso a inifap, rbac_role_id, password_hash, status y perfil', async () => {
    const firstRun = await seedDefaultUsers({
      env: { NODE_ENV: 'development' },
      users: SEED_FIXTURES,
    });

    expect(firstRun).toEqual({
      createdCount: 2,
      skippedCount: 0,
      skippedEnvironment: false,
    });

    const upgradedUser = await User.findOne({
      where: { email: EMAIL_UPGRADED },
    });
    const suspendedUser = await User.findOne({
      where: { email: EMAIL_SUSPENDED },
    });
    expect(upgradedUser).not.toBeNull();
    expect(suspendedUser).not.toBeNull();

    // Simular: ascenso a INIFAP con sub-rol RBAC + cambio de contraseña + edición de perfil
    const newUpgradedPasswordHash = await bcrypt.hash('NuevaClave@2026', 10);
    await upgradedUser.update({
      role: 'inifap',
      rbac_role_id: rbacRole.id,
      password_hash: newUpgradedPasswordHash,
      full_name: 'Carlos Ruiz Ascendido INIFAP',
      phone: '5559998877',
      job_title: 'Investigador Fitosanitario',
      shift: 'Vespertino',
      address: 'Centro Regional INIFAP',
    });

    // Simular: suspensión y cambio de contraseña del segundo usuario
    const newSuspendedPasswordHash = await bcrypt.hash('OtraClave@2026', 10);
    await suspendedUser.update({
      status: 'suspendido',
      password_hash: newSuspendedPasswordHash,
      full_name: 'Usuario Suspendido Editado',
    });

    // Re-ejecutar el seed simulando reinicio del servidor
    const secondRun = await seedDefaultUsers({
      env: { NODE_ENV: 'development' },
      users: SEED_FIXTURES,
    });

    expect(secondRun).toEqual({
      createdCount: 0,
      skippedCount: 2,
      skippedEnvironment: false,
    });

    await upgradedUser.reload();
    await suspendedUser.reload();

    // Verificar preservación total en usuario ascendido
    expect(upgradedUser.role).toBe('inifap');
    expect(upgradedUser.rbac_role_id).toBe(rbacRole.id);
    expect(upgradedUser.password_hash).toBe(newUpgradedPasswordHash);
    expect(
      await bcrypt.compare('NuevaClave@2026', upgradedUser.password_hash),
    ).toBe(true);
    expect(
      await bcrypt.compare('SeedInitial@123', upgradedUser.password_hash),
    ).toBe(false);
    expect(upgradedUser.full_name).toBe('Carlos Ruiz Ascendido INIFAP');
    expect(upgradedUser.phone).toBe('5559998877');
    expect(upgradedUser.job_title).toBe('Investigador Fitosanitario');
    expect(upgradedUser.shift).toBe('Vespertino');
    expect(upgradedUser.address).toBe('Centro Regional INIFAP');
    expect(upgradedUser.status).toBe('activo');

    // Verificar preservación total en usuario suspendido
    expect(suspendedUser.status).toBe('suspendido');
    expect(suspendedUser.password_hash).toBe(newSuspendedPasswordHash);
    expect(suspendedUser.full_name).toBe('Usuario Suspendido Editado');
  });
});
