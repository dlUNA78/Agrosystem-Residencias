import { describe, expect, it, jest } from '@jest/globals';
import {
  getMissingEnvVars,
  REQUIRED_ENV_VARS,
  validateEnv,
} from '../../src/config/env.js';

describe('1.A10 Validación desacoplada de variables de entorno (src/config/env.js)', () => {
  const validEnv = {
    SESSION_SECRET: 'test-secret',
    DB_HOST: 'localhost',
    DB_PORT: '5432',
    DB_NAME: 'agrosystem_test',
    DB_USER: 'postgres',
    DB_PASS: 'postgres',
  };

  it('valida correctamente cuando todas las variables requeridas están presentes', () => {
    expect(REQUIRED_ENV_VARS).toEqual([
      'SESSION_SECRET',
      'DB_HOST',
      'DB_PORT',
      'DB_NAME',
      'DB_USER',
      'DB_PASS',
    ]);
    expect(getMissingEnvVars(validEnv)).toEqual([]);
    expect(validateEnv(validEnv)).toEqual({
      valid: true,
      missingEnvVars: [],
    });
  });

  it('detecta variables faltantes o vacías y lanza un Error descriptivo sin matar el proceso de tests', () => {
    const logger = { error: jest.fn() };
    const incompleteEnv = {
      ...validEnv,
      SESSION_SECRET: '   ',
      DB_PASS: undefined,
    };

    expect(getMissingEnvVars(incompleteEnv)).toEqual([
      'SESSION_SECRET',
      'DB_PASS',
    ]);

    let capturedError = null;
    try {
      validateEnv(incompleteEnv, { logger, exitOnError: false });
    } catch (error) {
      capturedError = error;
    }

    expect(capturedError).toBeInstanceOf(Error);
    expect(capturedError.message).toContain(
      'Faltan variables de entorno requeridas: SESSION_SECRET, DB_PASS',
    );
    expect(capturedError.missingEnvVars).toEqual(['SESSION_SECRET', 'DB_PASS']);
    expect(logger.error).toHaveBeenCalledTimes(2);
  });

  it('invoca process.exit(1) únicamente cuando exitOnError es true', () => {
    const logger = { error: jest.fn() };
    const exitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {
      throw new Error('PROCESS_EXIT_1');
    });

    try {
      expect(() =>
        validateEnv({ DB_HOST: 'localhost' }, { logger, exitOnError: true }),
      ).toThrow('PROCESS_EXIT_1');
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
