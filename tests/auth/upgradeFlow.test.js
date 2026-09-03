import { beforeEach, describe, expect, it, jest } from '@jest/globals';

const inifapCode = {
  burn: jest.fn(),
};

const transaction = jest.fn(async (callback) => callback({ id: 'tx' }));
const findAvailable = jest.fn(async () => inifapCode);

jest.unstable_mockModule('../../src/models/index.js', () => ({
  default: {
    InifapCode: { findAvailable },
    User: {},
    sequelize: { transaction },
  },
}));

const { authController } =
  await import('../../src/controllers/authController.js');

describe('processUpgrade', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('delega a Express un error al restablecer la sesión autenticada', async () => {
    const loginError = new Error('No fue posible restaurar la sesión');
    const req = {
      body: {
        job_title: 'Investigador',
        secret_code: 'CODIGO-VALIDO',
      },
      logIn: jest.fn((_user, callback) => callback(loginError)),
      session: {
        regenerate: jest.fn((callback) => callback()),
      },
      user: {
        id: 17,
        role: 'agricultor',
        save: jest.fn(),
      },
    };
    const res = {
      redirect: jest.fn(),
      render: jest.fn(),
      status: jest.fn().mockReturnThis(),
    };
    const next = jest.fn();

    await authController.processUpgrade(req, res, next);

    expect(next).toHaveBeenCalledWith(loginError);
    expect(res.redirect).not.toHaveBeenCalled();
  });
});
