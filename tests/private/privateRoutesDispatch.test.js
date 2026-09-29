import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import express from 'express';
import request from 'supertest';

// Variables de estado para registrar orden y ejecución en pruebas de despacho
const executionLog = [];
let simulatedUser = null;
let simulatedPermissions = {
  crops: true,
  plagues: true,
  products: true,
  workflow: true,
  relations: true,
};

// ─── MOCKS DE CONTROLADORES ──────────────────────────────────────────────────
const createMockController = (name) =>
  jest.fn((req, res) => {
    executionLog.push(`controller:${name}`);
    res.status(200).json({
      controller: name,
      params: req.params,
      body: req.body,
    });
  });

const mockControllers = {
  // Dashboard
  dashboard: createMockController('dashboard'),

  // Users & Profile
  renderProfile: createMockController('renderProfile'),
  updateProfile: createMockController('updateProfile'),
  usersPrivate: createMockController('usersPrivate'),
  createUser: createMockController('createUser'),
  updateUser: createMockController('updateUser'),
  updateUserStatus: createMockController('updateUserStatus'),
  deleteUser: createMockController('deleteUser'),

  // Crops
  cropsPrivate: createMockController('cropsPrivate'),
  getCropDetail: createMockController('getCropDetail'),
  createCrop: createMockController('createCrop'),
  updateCrop: createMockController('updateCrop'),
  deleteCrop: createMockController('deleteCrop'),
  updateCropWorkflow: createMockController('updateCropWorkflow'),

  // Plagues
  plaguesPrivate: createMockController('plaguesPrivate'),
  getPlagueDetail: createMockController('getPlagueDetail'),
  createPlague: createMockController('createPlague'),
  updatePlague: createMockController('updatePlague'),
  deletePlague: createMockController('deletePlague'),
  updatePlagueWorkflow: createMockController('updatePlagueWorkflow'),
  updatePlagueRelations: createMockController('updatePlagueRelations'),

  // Products
  productsPrivate: createMockController('productsPrivate'),
  getProductDetail: createMockController('getProductDetail'),
  createProduct: createMockController('createProduct'),
  updateProduct: createMockController('updateProduct'),
  deleteProduct: createMockController('deleteProduct'),
  updateProductWorkflow: createMockController('updateProductWorkflow'),

  // Ingredients
  ingredientsPrivate: createMockController('ingredientsPrivate'),

  // Lands
  renderLandsPrivate: createMockController('renderLandsPrivate'),
  landDetail: createMockController('landDetail'),
  createFarmPrivate: createMockController('createFarmPrivate'),
  updateFarmPrivate: createMockController('updateFarmPrivate'),
  archiveFarmPrivate: createMockController('archiveFarmPrivate'),
  restoreFarmPrivate: createMockController('restoreFarmPrivate'),
  createLandCropCycle: createMockController('createLandCropCycle'),
  advanceLandCropStage: createMockController('advanceLandCropStage'),
  finishLandCropCycle: createMockController('finishLandCropCycle'),
  createFarmHealthReport: createMockController('createFarmHealthReport'),
  createFarmApplication: createMockController('createFarmApplication'),

  // Suppliers
  suppliersPrivate: createMockController('suppliersPrivate'),
  createSupplier: createMockController('createSupplier'),
  updateSupplier: createMockController('updateSupplier'),
  deleteSupplier: createMockController('deleteSupplier'),

  // Reports & Audit
  reportsPrivate: createMockController('reportsPrivate'),
  auditPrivate: createMockController('auditPrivate'),
};

jest.unstable_mockModule(
  '../../src/controllers/private/dashboardController.js',
  () => ({
    dashboard: mockControllers.dashboard,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/usersController.js',
  () => ({
    renderProfile: mockControllers.renderProfile,
    updateProfile: mockControllers.updateProfile,
    usersPrivate: mockControllers.usersPrivate,
    createUser: mockControllers.createUser,
    updateUser: mockControllers.updateUser,
    updateUserStatus: mockControllers.updateUserStatus,
    deleteUser: mockControllers.deleteUser,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/cropsController.js',
  () => ({
    cropsPrivate: mockControllers.cropsPrivate,
    getCropDetail: mockControllers.getCropDetail,
    createCrop: mockControllers.createCrop,
    updateCrop: mockControllers.updateCrop,
    deleteCrop: mockControllers.deleteCrop,
    updateCropWorkflow: mockControllers.updateCropWorkflow,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/plagueController.js',
  () => ({
    plaguesPrivate: mockControllers.plaguesPrivate,
    getPlagueDetail: mockControllers.getPlagueDetail,
    createPlague: mockControllers.createPlague,
    updatePlague: mockControllers.updatePlague,
    deletePlague: mockControllers.deletePlague,
    updatePlagueWorkflow: mockControllers.updatePlagueWorkflow,
    updatePlagueRelations: mockControllers.updatePlagueRelations,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/productsController.js',
  () => ({
    productsPrivate: mockControllers.productsPrivate,
    getProductDetail: mockControllers.getProductDetail,
    createProduct: mockControllers.createProduct,
    updateProduct: mockControllers.updateProduct,
    deleteProduct: mockControllers.deleteProduct,
    updateProductWorkflow: mockControllers.updateProductWorkflow,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/ingredientsController.js',
  () => ({
    ingredientsPrivate: mockControllers.ingredientsPrivate,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/landsController.js',
  () => ({
    renderLandsPrivate: mockControllers.renderLandsPrivate,
    landDetail: mockControllers.landDetail,
    createFarmPrivate: mockControllers.createFarmPrivate,
    updateFarmPrivate: mockControllers.updateFarmPrivate,
    archiveFarmPrivate: mockControllers.archiveFarmPrivate,
    restoreFarmPrivate: mockControllers.restoreFarmPrivate,
    createLandCropCycle: mockControllers.createLandCropCycle,
    advanceLandCropStage: mockControllers.advanceLandCropStage,
    finishLandCropCycle: mockControllers.finishLandCropCycle,
    createFarmHealthReport: mockControllers.createFarmHealthReport,
    createFarmApplication: mockControllers.createFarmApplication,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/suppliersController.js',
  () => ({
    suppliersPrivate: mockControllers.suppliersPrivate,
    createSupplier: mockControllers.createSupplier,
    updateSupplier: mockControllers.updateSupplier,
    deleteSupplier: mockControllers.deleteSupplier,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/reportsController.js',
  () => ({
    reportsPrivate: mockControllers.reportsPrivate,
  }),
);

jest.unstable_mockModule(
  '../../src/controllers/private/auditController.js',
  () => ({
    auditPrivate: mockControllers.auditPrivate,
  }),
);

// ─── MOCKS DE SUBIDA (REGISTRAN ORDEN DE EJECUCIÓN) ──────────────────────────
jest.unstable_mockModule('../../src/middlewares/upload.js', () => ({
  uploadCropImages: jest.fn((req, res, next) => {
    executionLog.push('upload:crops');
    next();
  }),
  uploadPlagueImages: jest.fn((req, res, next) => {
    executionLog.push('upload:plagues');
    next();
  }),
  uploadProductImages: jest.fn((req, res, next) => {
    executionLog.push('upload:products');
    next();
  }),
}));

// ─── MOCKS DE PERMISOS DE CATÁLOGO (REGISTRAN ORDEN DE EJECUCIÓN) ───────────
jest.unstable_mockModule(
  '../../src/middlewares/cropAuthorizationMiddleware.js',
  () => ({
    requireCropPermission: (permission) => (req, res, next) => {
      executionLog.push(`auth:crop:${permission}`);
      if (!simulatedPermissions.crops) {
        return res
          .status(403)
          .send('Acceso denegado: sin permiso sobre cultivos');
      }
      next();
    },
    requireCropWorkflowPermission: (req, res, next) => {
      executionLog.push('auth:crop:workflow');
      if (!simulatedPermissions.workflow) {
        return res.status(403).send('Acceso denegado: sin permiso de workflow');
      }
      next();
    },
  }),
);

jest.unstable_mockModule(
  '../../src/middlewares/plagueAuthorizationMiddleware.js',
  () => ({
    requirePlaguePermission: (permission) => (req, res, next) => {
      executionLog.push(`auth:plague:${permission}`);
      if (
        permission === 'plagues.manageRelations' &&
        !simulatedPermissions.relations
      ) {
        return res
          .status(403)
          .send('Acceso denegado: sin permiso de relaciones');
      }
      if (!simulatedPermissions.plagues) {
        return res
          .status(403)
          .send('Acceso denegado: sin permiso sobre plagas');
      }
      next();
    },
    requirePlagueWorkflowPermission: (req, res, next) => {
      executionLog.push('auth:plague:workflow');
      if (!simulatedPermissions.workflow) {
        return res.status(403).send('Acceso denegado: sin permiso de workflow');
      }
      next();
    },
  }),
);

jest.unstable_mockModule(
  '../../src/middlewares/productAuthorizationMiddleware.js',
  () => ({
    requireProductPermission: (permission) => (req, res, next) => {
      executionLog.push(`auth:product:${permission}`);
      if (!simulatedPermissions.products) {
        return res
          .status(403)
          .send('Acceso denegado: sin permiso sobre productos');
      }
      next();
    },
    requireProductWorkflowPermission: (req, res, next) => {
      executionLog.push('auth:product:workflow');
      if (!simulatedPermissions.workflow) {
        return res.status(403).send('Acceso denegado: sin permiso de workflow');
      }
      next();
    },
  }),
);

// Importar el privateRouter real tras registrar todos los mocks
const { default: privateRouter } =
  await import('../../src/routes/privateRoutes.js');

// Crear app Express mínima aislada para pruebas HTTP con Supertest
const buildTestApp = () => {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.isAuthenticated = () => Boolean(simulatedUser);
    req.user = simulatedUser;
    next();
  });
  app.use('/', privateRouter);
  return app;
};

describe('pruebas de despacho HTTP del router privado', () => {
  let app;

  beforeEach(() => {
    executionLog.length = 0;
    simulatedUser = null;
    simulatedPermissions = {
      crops: true,
      plagues: true,
      products: true,
      workflow: true,
      relations: true,
    };
    jest.clearAllMocks();
    app = buildTestApp();
  });

  describe('1. Solicitudes sin sesión (isAuthenticated)', () => {
    it('redirige a /auth/login y no ejecuta controladores ni middlewares posteriores', async () => {
      simulatedUser = null;

      const profileRes = await request(app).get('/profile');
      expect(profileRes.status).toBe(302);
      expect(profileRes.headers.location).toBe('/auth/login');

      const cropsRes = await request(app).post('/private/crops/create');
      expect(cropsRes.status).toBe(302);
      expect(cropsRes.headers.location).toBe('/auth/login');

      const usersRes = await request(app).get('/private/users');
      expect(usersRes.status).toBe(302);
      expect(usersRes.headers.location).toBe('/auth/login');

      expect(executionLog).toHaveLength(0);
      expect(mockControllers.renderProfile).not.toHaveBeenCalled();
      expect(mockControllers.createCrop).not.toHaveBeenCalled();
      expect(mockControllers.usersPrivate).not.toHaveBeenCalled();
    });
  });

  describe('2. Módulo de perfil (/profile accesible sin acceso al panel)', () => {
    it('un usuario autenticado sin acceso al panel (agricultor) accede a GET y POST /profile', async () => {
      simulatedUser = { id: 10, role: 'agricultor' };

      const getRes = await request(app).get('/profile');
      expect(getRes.status).toBe(200);
      expect(mockControllers.renderProfile).toHaveBeenCalledTimes(1);

      const postRes = await request(app)
        .post('/profile')
        .send({ nombre: 'Juan' });
      expect(postRes.status).toBe(200);
      expect(mockControllers.updateProfile).toHaveBeenCalledTimes(1);
    });
  });

  describe('3. Bloqueo del panel privado (requirePanelAccess)', () => {
    it('un usuario sin rol inifap/admin es rechazado (403) antes de alcanzar cualquier dominio', async () => {
      simulatedUser = { id: 10, role: 'agricultor' };

      const privateProfileRes = await request(app).get('/private/profile');
      expect(privateProfileRes.status).toBe(403);

      const dashboardRes = await request(app).get('/dashboard');
      expect(dashboardRes.status).toBe(403);

      const cropsRes = await request(app).get('/private/crops');
      expect(cropsRes.status).toBe(403);

      const landsRes = await request(app).get('/private/lands');
      expect(landsRes.status).toBe(403);

      const suppliersRes = await request(app).get('/private/suppliers');
      expect(suppliersRes.status).toBe(403);

      const usersRes = await request(app).get('/private/users');
      expect(usersRes.status).toBe(403);

      expect(executionLog).toHaveLength(0);
      expect(mockControllers.dashboard).not.toHaveBeenCalled();
      expect(mockControllers.cropsPrivate).not.toHaveBeenCalled();
      expect(mockControllers.renderLandsPrivate).not.toHaveBeenCalled();
      expect(mockControllers.suppliersPrivate).not.toHaveBeenCalled();
      expect(mockControllers.usersPrivate).not.toHaveBeenCalled();
    });
  });

  describe('4. Barrera de rol de administración (requireRole("admin"))', () => {
    it('un usuario inifap es rechazado (403) en endpoints de usuarios pero admitido en otros dominios', async () => {
      simulatedUser = { id: 2, role: 'inifap' };

      // Permitido en catálogo, parcelas, reportes y proveedores
      const cropsRes = await request(app).get('/private/crops');
      expect(cropsRes.status).toBe(200);

      const suppliersRes = await request(app).get('/private/suppliers');
      expect(suppliersRes.status).toBe(200);

      const reportsRes = await request(app).get('/private/reports');
      expect(reportsRes.status).toBe(200);

      // Denegado en los endpoints de administración de usuarios
      const usersGetRes = await request(app).get('/private/users');
      expect(usersGetRes.status).toBe(403);
      expect(mockControllers.usersPrivate).not.toHaveBeenCalled();

      const userCreateRes = await request(app).post('/private/users/create');
      expect(userCreateRes.status).toBe(403);
      expect(mockControllers.createUser).not.toHaveBeenCalled();

      const userEditRes = await request(app).post('/private/users/edit/12');
      expect(userEditRes.status).toBe(403);
      expect(mockControllers.updateUser).not.toHaveBeenCalled();

      const userStatusRes = await request(app).post('/private/users/status/12');
      expect(userStatusRes.status).toBe(403);
      expect(mockControllers.updateUserStatus).not.toHaveBeenCalled();

      const userDeleteRes = await request(app).post('/private/users/delete/12');
      expect(userDeleteRes.status).toBe(403);
      expect(mockControllers.deleteUser).not.toHaveBeenCalled();
    });

    it('un usuario admin accede exitosamente a los endpoints de usuarios', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      const usersRes = await request(app).get('/private/users');
      expect(usersRes.status).toBe(200);
      expect(mockControllers.usersPrivate).toHaveBeenCalledTimes(1);

      const createRes = await request(app)
        .post('/private/users/create')
        .send({ email: 'test@agro.test' });
      expect(createRes.status).toBe(200);
      expect(mockControllers.createUser).toHaveBeenCalledTimes(1);
    });
  });

  describe('5. Orden estricto en rutas de catálogo (autorización → subida → controlador)', () => {
    const catalogCreateUpdateEndpoints = [
      {
        path: '/private/crops/create',
        type: 'crops',
        controller: 'createCrop',
        upload: 'upload:crops',
        auth: 'auth:crop:crops.create',
      },
      {
        path: '/private/crops/update/1',
        type: 'crops',
        controller: 'updateCrop',
        upload: 'upload:crops',
        auth: 'auth:crop:crops.edit',
      },
      {
        path: '/private/plagues/create',
        type: 'plagues',
        controller: 'createPlague',
        upload: 'upload:plagues',
        auth: 'auth:plague:plagues.create',
      },
      {
        path: '/private/plagues/update/1',
        type: 'plagues',
        controller: 'updatePlague',
        upload: 'upload:plagues',
        auth: 'auth:plague:plagues.edit',
      },
      {
        path: '/private/products/create',
        type: 'products',
        controller: 'createProduct',
        upload: 'upload:products',
        auth: 'auth:product:products.create',
      },
      {
        path: '/private/products/update/1',
        type: 'products',
        controller: 'updateProduct',
        upload: 'upload:products',
        auth: 'auth:product:products.edit',
      },
    ];

    it('cuando está autorizado, ejecuta en orden exacto: autorización → subida → controlador', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      for (const endpoint of catalogCreateUpdateEndpoints) {
        executionLog.length = 0;
        const res = await request(app).post(endpoint.path);
        expect(res.status).toBe(200);

        expect(executionLog).toEqual([
          endpoint.auth,
          endpoint.upload,
          `controller:${endpoint.controller}`,
        ]);
      }
    });

    it('cuando la autorización rechaza, ni la subida ni el controlador se ejecutan', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      for (const endpoint of catalogCreateUpdateEndpoints) {
        executionLog.length = 0;
        simulatedPermissions[endpoint.type] = false;

        const res = await request(app).post(endpoint.path);
        expect(res.status).toBe(403);

        // Se ejecutó la guardia de autorización, pero NUNCA subida ni controlador
        expect(executionLog).toEqual([endpoint.auth]);
        expect(executionLog).not.toContain(endpoint.upload);
        expect(executionLog).not.toContain(`controller:${endpoint.controller}`);

        simulatedPermissions[endpoint.type] = true;
      }
    });
  });

  describe('6. Workflows y relaciones', () => {
    it('los endpoints de workflow ejecutan su guardia correspondiente antes del controlador', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      // Cultivos workflow
      executionLog.length = 0;
      const cropWfRes = await request(app).post('/private/crops/10/workflow');
      expect(cropWfRes.status).toBe(200);
      expect(executionLog).toEqual([
        'auth:crop:workflow',
        'controller:updateCropWorkflow',
      ]);

      // Plagas workflow
      executionLog.length = 0;
      const plagueWfRes = await request(app).post(
        '/private/plagues/10/workflow',
      );
      expect(plagueWfRes.status).toBe(200);
      expect(executionLog).toEqual([
        'auth:plague:workflow',
        'controller:updatePlagueWorkflow',
      ]);

      // Productos workflow
      executionLog.length = 0;
      const productWfRes = await request(app).post(
        '/private/products/10/workflow',
      );
      expect(productWfRes.status).toBe(200);
      expect(executionLog).toEqual([
        'auth:product:workflow',
        'controller:updateProductWorkflow',
      ]);
    });

    it('plagas conserva la guardia MANAGE_RELATIONS en /relations', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      executionLog.length = 0;
      const okRes = await request(app).post('/private/plagues/10/relations');
      expect(okRes.status).toBe(200);
      expect(executionLog).toEqual([
        'auth:plague:plagues.manageRelations',
        'controller:updatePlagueRelations',
      ]);

      executionLog.length = 0;
      simulatedPermissions.relations = false;
      const failRes = await request(app).post('/private/plagues/10/relations');
      expect(failRes.status).toBe(403);
      expect(executionLog).toEqual(['auth:plague:plagues.manageRelations']);
      expect(mockControllers.updatePlagueRelations).toHaveBeenCalledTimes(1); // solo del okRes
    });
  });

  describe('7. URLs, alias y preservación de parámetros :id', () => {
    it('los alias /private/catalog/... despachan al mismo controlador que la ruta estándar', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      await request(app).get('/private/crops');
      await request(app).get('/private/catalog/crops');
      expect(mockControllers.cropsPrivate).toHaveBeenCalledTimes(2);

      await request(app).get('/private/plagues');
      await request(app).get('/private/catalog/plagues');
      expect(mockControllers.plaguesPrivate).toHaveBeenCalledTimes(2);

      await request(app).get('/private/products');
      await request(app).get('/private/catalog/products');
      expect(mockControllers.productsPrivate).toHaveBeenCalledTimes(2);
    });

    it('las rutas con parámetro :id capturan y entregan el valor al controlador', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      const cropRes = await request(app).get('/private/crops/45');
      expect(cropRes.status).toBe(200);
      expect(cropRes.body.params.id).toBe('45');

      const landRes = await request(app).get('/private/lands/88/expediente');
      expect(landRes.status).toBe(200);
      expect(landRes.body.params.id).toBe('88');

      const userRes = await request(app).post('/private/users/edit/77');
      expect(userRes.status).toBe(200);
      expect(userRes.body.params.id).toBe('77');
    });

    it('la ruta de ingredientes activos despacha correctamente a ingredientsPrivate', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      const res = await request(app).get('/private/ingredients');
      expect(res.status).toBe(200);
      expect(mockControllers.ingredientsPrivate).toHaveBeenCalledTimes(1);
    });
  });
});
