import { describe, expect, it, jest } from '@jest/globals';

import migration from '../../src/migrations/20260907000001-create-session-table.js';

describe('migración de sesiones PostgreSQL', () => {
  const Sequelize = {
    STRING: 'STRING',
    JSON: 'JSON',
    DATE: 'DATE',
  };

  it('crea la tabla y el índice cuando todavía no existen', async () => {
    const queryInterface = {
      showAllTables: jest.fn(async () => []),
      createTable: jest.fn(),
      showIndex: jest.fn(async () => []),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).toHaveBeenCalledWith(
      'session',
      expect.objectContaining({
        sid: expect.objectContaining({ primaryKey: true }),
        sess: expect.objectContaining({ allowNull: false }),
        expire: expect.objectContaining({ allowNull: false }),
      }),
    );
    expect(queryInterface.addIndex).toHaveBeenCalledWith(
      'session',
      ['expire'],
      { name: 'IDX_session_expire' },
    );
  });

  it('adopta una tabla existente sin intentar crearla nuevamente', async () => {
    const queryInterface = {
      showAllTables: jest.fn(async () => ['session']),
      createTable: jest.fn(),
      showIndex: jest.fn(async () => [{ name: 'IDX_session_expire' }]),
      addIndex: jest.fn(),
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.createTable).not.toHaveBeenCalled();
    expect(queryInterface.addIndex).not.toHaveBeenCalled();
  });

  it('elimina la tabla al revertir la migración', async () => {
    const queryInterface = { dropTable: jest.fn() };

    await migration.down(queryInterface);

    expect(queryInterface.dropTable).toHaveBeenCalledWith('session');
  });
});
