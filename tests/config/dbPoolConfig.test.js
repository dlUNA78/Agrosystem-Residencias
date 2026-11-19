import fs from 'fs';
import path from 'path';
import { afterAll, describe, expect, it } from '@jest/globals';
import { buildPgPoolConfig, closeAppResources, pgPool } from '../../app.js';
import configData, {
  buildSequelizeEnvConfig,
  resolveSequelizeLogging,
  resolveSequelizePool,
} from '../../src/config/config.js';
import db from '../../src/models/index.js';

afterAll(async () => {
  await closeAppResources();
});

describe('1.A2 Configuración de pools de conexión y logging SQL', () => {
  it('apaga el logging SQL de Sequelize por defecto en production y solo lo activa con DB_LOGGING=true', () => {
    expect(resolveSequelizeLogging({ NODE_ENV: 'production' })).toBe(false);
    expect(resolveSequelizeLogging({ NODE_ENV: 'development' })).toBe(false);
    expect(resolveSequelizeLogging({ NODE_ENV: 'test' })).toBe(false);
    expect(
      resolveSequelizeLogging({
        NODE_ENV: 'production',
        DB_LOGGING: 'false',
      }),
    ).toBe(false);
    expect(
      resolveSequelizeLogging({
        NODE_ENV: 'production',
        DB_LOGGING: 'true',
      }),
    ).toBe(console.log);
  });

  it('define límites explícitos en el pool de Sequelize (max=20, min=2, acquire=30000, idle=10000 en production/development y max=5, min=0 en test)', () => {
    expect(resolveSequelizePool({ NODE_ENV: 'production' })).toEqual({
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    });
    expect(resolveSequelizePool({ NODE_ENV: 'development' })).toEqual({
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    });
    expect(resolveSequelizePool({ NODE_ENV: 'test' })).toEqual({
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    });
    expect(
      resolveSequelizePool({
        NODE_ENV: 'production',
        DB_POOL_MAX: '15',
        DB_POOL_MIN: '1',
        DB_POOL_ACQUIRE_MS: '25000',
        DB_POOL_IDLE_MS: '8000',
      }),
    ).toEqual({
      max: 15,
      min: 1,
      acquire: 25000,
      idle: 8000,
    });

    const prodConfig = buildSequelizeEnvConfig({ NODE_ENV: 'production' });
    expect(prodConfig.logging).toBe(false);
    expect(prodConfig.pool).toEqual({
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    });

    expect(configData.production.pool).toEqual({
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    });
    expect(configData.development.pool).toEqual({
      max: 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    });
    expect(db.sequelize.options.pool).toMatchObject({
      max: 5,
      min: 0,
      acquire: 30000,
      idle: 10000,
    });
    expect(fs.existsSync(path.resolve('src/config/database.js'))).toBe(false);
  });

  it('define límites explícitos en el pg.Pool de sesiones (max=10 en production/development, max=2 en test, idleTimeoutMillis=10000, connectionTimeoutMillis=30000)', () => {
    const prodPgCfg = buildPgPoolConfig({ NODE_ENV: 'production' });
    expect(prodPgCfg).toMatchObject({
      max: 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
    });
    const testPgCfg = buildPgPoolConfig({ NODE_ENV: 'test' });
    expect(testPgCfg).toMatchObject({
      max: 2,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
    });
    expect(pgPool.options).toMatchObject({
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 30000,
    });

    // Regla de capacidad: instancias_node * (pool_sequelize + pool_sesiones) < max_connections (100)
    expect(configData.production.pool.max + prodPgCfg.max).toBeLessThan(100);
    expect(7 * (configData.test.pool.max + testPgCfg.max)).toBeLessThan(100);
  });

  it('define scripts de producción start y build:css en package.json (1.A10)', () => {
    const pkg = JSON.parse(
      fs.readFileSync(path.resolve('package.json'), 'utf8'),
    );
    expect(pkg.scripts?.start).toBe('node app.js');
    expect(pkg.scripts?.['build:css']).toBe(
      'pnpm exec tailwindcss -i ./public/css/input.css -o ./public/css/style.css --minify',
    );
  });
});
