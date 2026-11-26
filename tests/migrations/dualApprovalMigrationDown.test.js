import 'dotenv/config';
import { afterAll, beforeAll, describe, expect, it, jest } from '@jest/globals';
import { Sequelize } from 'sequelize';

import configData from '../../src/config/config.js';
import migration from '../../src/migrations/20261111000001-add-dual-approval-deactivation-workflow.js';

const TARGET_TABLES = ['Crops', 'Plagues', 'Products', 'ActiveIngredients'];

const ARCHIVE_COLUMNS = [
  'archive_reason_category',
  'archive_reason',
  'archive_requested_by_user_id',
  'archive_requested_at',
  'archived_by_user_id',
  'archived_at',
  'archive_approval_notes',
];

const ACTIVE_INGREDIENT_EXTRA_COLUMNS = [
  'workflow_status',
  'created_by_user_id',
  'updated_by_user_id',
];

const buildFullTableDescription = (tableName) => {
  const columns = Object.fromEntries(
    ARCHIVE_COLUMNS.map((column) => [column, { type: 'TEXT' }]),
  );

  if (tableName === 'ActiveIngredients') {
    for (const column of ACTIVE_INGREDIENT_EXTRA_COLUMNS) {
      columns[column] = { type: 'STRING' };
    }
  }

  return columns;
};

const assertColumnsPresence = async (queryInterface, expectedPresent) => {
  for (const tableName of TARGET_TABLES) {
    const description = await queryInterface.describeTable(tableName);
    for (const column of ARCHIVE_COLUMNS) {
      expect(Boolean(description[column])).toBe(expectedPresent);
    }
  }

  const ingredientDescription =
    await queryInterface.describeTable('ActiveIngredients');
  for (const column of ACTIVE_INGREDIENT_EXTRA_COLUMNS) {
    expect(Boolean(ingredientDescription[column])).toBe(expectedPresent);
  }
};

describe('migración 20261111000001 (contrato transaccional de down())', () => {
  it('pasa { transaction } a todas las llamadas de describeTable y removeColumn en down()', async () => {
    const transaction = {
      commit: jest.fn(async () => {}),
      rollback: jest.fn(async () => {}),
    };
    const queryInterface = {
      sequelize: {
        transaction: jest.fn(async () => transaction),
      },
      describeTable: jest.fn(async (tableName) =>
        buildFullTableDescription(tableName),
      ),
      removeColumn: jest.fn(async () => {}),
    };

    await migration.down(queryInterface);

    expect(queryInterface.describeTable).toHaveBeenCalledTimes(5);
    for (const [, options] of queryInterface.describeTable.mock.calls) {
      expect(options).toEqual({ transaction });
    }

    const expectedRemovals =
      TARGET_TABLES.length * ARCHIVE_COLUMNS.length +
      ACTIVE_INGREDIENT_EXTRA_COLUMNS.length;
    expect(queryInterface.removeColumn).toHaveBeenCalledTimes(expectedRemovals);
    for (const [, , options] of queryInterface.removeColumn.mock.calls) {
      expect(options).toEqual({ transaction });
    }

    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
  });

  it('revierte la transacción si falla alguna operación dentro de down()', async () => {
    const transaction = {
      commit: jest.fn(async () => {}),
      rollback: jest.fn(async () => {}),
    };
    const queryInterface = {
      sequelize: {
        transaction: jest.fn(async () => transaction),
      },
      describeTable: jest.fn(async (tableName) =>
        buildFullTableDescription(tableName),
      ),
      removeColumn: jest
        .fn()
        .mockRejectedValueOnce(new Error('fallo simulado en removeColumn')),
    };

    await expect(migration.down(queryInterface)).rejects.toThrow(
      'fallo simulado en removeColumn',
    );
    expect(transaction.rollback).toHaveBeenCalledTimes(1);
    expect(transaction.commit).not.toHaveBeenCalled();
  });
});

describe('migración 20261111000001 (integración PostgreSQL down -> up)', () => {
  const testSchema = `r1_dual_approval_${process.pid}_${Date.now()}`;
  const env = process.env.NODE_ENV || 'test';
  const baseConfig = configData[env] || configData.test;

  let adminSequelize;
  let schemaSequelize;

  beforeAll(async () => {
    adminSequelize = new Sequelize(
      baseConfig.database,
      baseConfig.username,
      baseConfig.password,
      {
        ...baseConfig,
        logging: false,
      },
    );

    await adminSequelize.query(`CREATE SCHEMA "${testSchema}"`);
    await adminSequelize.query(
      `CREATE TABLE "${testSchema}"."Users" (id INTEGER PRIMARY KEY)`,
    );

    for (const tableName of TARGET_TABLES) {
      await adminSequelize.query(
        `CREATE TABLE "${testSchema}"."${tableName}" (LIKE public."${tableName}" INCLUDING DEFAULTS INCLUDING CONSTRAINTS)`,
      );
    }

    schemaSequelize = new Sequelize(
      baseConfig.database,
      baseConfig.username,
      baseConfig.password,
      {
        ...baseConfig,
        schema: testSchema,
        logging: false,
        pool: { max: 3, min: 0, acquire: 5000, idle: 1000 },
        dialectOptions: {
          ...(baseConfig.dialectOptions || {}),
          options: `-c search_path=${testSchema},public -c lock_timeout=3000`,
        },
      },
    );
  });

  afterAll(async () => {
    if (schemaSequelize) {
      await schemaSequelize.close();
    }
    if (adminSequelize) {
      await adminSequelize.query(
        `DROP SCHEMA IF EXISTS "${testSchema}" CASCADE`,
      );
      await adminSequelize.close();
    }
  });

  it('ejecuta down() y restaura el esquema con up() sin interbloqueo de candados en PostgreSQL', async () => {
    const queryInterface = schemaSequelize.getQueryInterface();

    await assertColumnsPresence(queryInterface, true);

    try {
      await migration.down(queryInterface);
      await assertColumnsPresence(queryInterface, false);

      // Segunda invocación idempotente cuando las columnas ya fueron eliminadas
      await migration.down(queryInterface);
      await assertColumnsPresence(queryInterface, false);
    } finally {
      await migration.up(queryInterface, Sequelize);
    }

    await assertColumnsPresence(queryInterface, true);
  }, 10000);
});
