import { describe, expect, it, jest } from '@jest/globals';

import migration from '../../src/migrations/20260906000001-add-land-operational-records.js';

describe('migración de registros operativos de terrenos', () => {
  const Sequelize = {
    INTEGER: 'INTEGER',
    STRING: jest.fn((size) => `STRING(${size})`),
    DECIMAL: jest.fn((precision, scale) => `DECIMAL(${precision},${scale})`),
    DATEONLY: 'DATEONLY',
    TEXT: 'TEXT',
    BOOLEAN: 'BOOLEAN',
    DATE: 'DATE',
  };

  it('crea el esquema nuevo y agrega sección al ciclo de cultivo', async () => {
    const queryInterface = {
      describeTable: jest.fn(async () => ({})),
      addColumn: jest.fn(),
      addConstraint: jest.fn(),
      createTable: jest.fn(),
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addColumn).toHaveBeenCalledWith(
      'FarmCrops',
      'area_section',
      expect.objectContaining({ allowNull: true }),
    );
    expect(queryInterface.createTable.mock.calls.map(([table]) => table)).toEqual([
      'FarmCropStages',
      'FarmHealthReports',
      'FarmApplications',
    ]);
    expect(queryInterface.addConstraint).toHaveBeenCalledWith(
      'FarmCropStages',
      expect.objectContaining({
        fields: ['farm_crop_id', 'stage_order'],
        type: 'unique',
      }),
    );
  });

  it('tolera una columna de sección existente sin ocultar otros errores', async () => {
    const queryInterface = {
      describeTable: jest.fn(async () => ({ area_section: {} })),
      addColumn: jest.fn(),
      addConstraint: jest.fn(),
      createTable: jest.fn(),
    };

    await migration.up(queryInterface, Sequelize);

    expect(queryInterface.addColumn).not.toHaveBeenCalled();
    expect(queryInterface.createTable).toHaveBeenCalledTimes(3);
  });

  it('revierte tablas y columna en orden seguro', async () => {
    const queryInterface = {
      describeTable: jest.fn(async () => ({ area_section: {} })),
      dropTable: jest.fn(),
      removeColumn: jest.fn(),
    };

    await migration.down(queryInterface);

    expect(queryInterface.dropTable.mock.calls.map(([table]) => table)).toEqual([
      'FarmApplications',
      'FarmHealthReports',
      'FarmCropStages',
    ]);
    expect(queryInterface.removeColumn).toHaveBeenCalledWith(
      'FarmCrops',
      'area_section',
    );
  });
});
