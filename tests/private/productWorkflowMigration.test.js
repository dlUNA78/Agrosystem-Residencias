import { describe, expect, it, jest } from '@jest/globals';

import migration from '../../src/migrations/20260908000001-add-product-workflow.js';

const buildContext = () => {
  const transaction = { commit: jest.fn(), rollback: jest.fn() };
  const queryInterface = {
    sequelize: {
      transaction: jest.fn(async () => transaction),
      query: jest.fn(),
    },
    addColumn: jest.fn(),
    addIndex: jest.fn(),
    removeIndex: jest.fn(),
    removeColumn: jest.fn(),
  };
  return { queryInterface, transaction };
};

describe('migración del workflow de productos', () => {
  const Sequelize = {
    STRING: jest.fn((size) => `STRING(${size})`),
    INTEGER: 'INTEGER',
    DATE: 'DATE',
    TEXT: 'TEXT',
  };

  it('agrega autoría, workflow e índices dentro de una transacción', async () => {
    const { queryInterface, transaction } = buildContext();

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      'Products',
      'workflow_status',
      expect.objectContaining({ defaultValue: 'draft', allowNull: false }),
      { transaction },
    );
    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      'Products',
      'created_by_user_id',
      expect.objectContaining({
        references: { model: 'Users', key: 'id' },
      }),
      { transaction },
    );
    expect(queryInterface.sequelize.query).toHaveBeenCalledWith(
      expect.stringMatching(/validation_status.+published/is),
      { transaction },
    );
    expect(queryInterface.addIndex).toHaveBeenCalledTimes(2);
    expect(transaction.commit).toHaveBeenCalledTimes(1);
    expect(transaction.rollback).not.toHaveBeenCalled();
  });

  it('revierte índices y columnas en una transacción', async () => {
    const { queryInterface, transaction } = buildContext();

    await migration.down(queryInterface);

    expect(queryInterface.removeIndex).toHaveBeenCalledTimes(2);
    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      'Products',
      'workflow_status',
      { transaction },
    );
    expect(transaction.commit).toHaveBeenCalledTimes(1);
  });
});
