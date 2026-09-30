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

// ══════════════════════════════════════════════════════════════════════════════
// INVENTARIO COMPLETO DE LOS 50 ENDPOINTS PARA PRUEBAS PARAMETRIZADAS
// ══════════════════════════════════════════════════════════════════════════════
const ALL_50_DISPATCH_ENDPOINTS = [
  // ─── AGREGADOR RAÍZ / PERFIL / DASHBOARD (5) ──────────────────────────────
  {
    method: 'get',
    routePath: '/profile',
    dispatchPath: '/profile',
    controller: 'renderProfile',
    params: {},
  },
  {
    method: 'post',
    routePath: '/profile',
    dispatchPath: '/profile',
    controller: 'updateProfile',
    params: {},
    body: { bio: 'test' },
  },
  {
    method: 'get',
    routePath: '/private/profile',
    dispatchPath: '/private/profile',
    controller: 'renderProfile',
    params: {},
  },
  {
    method: 'post',
    routePath: '/private/profile',
    dispatchPath: '/private/profile',
    controller: 'updateProfile',
    params: {},
    body: { bio: 'test' },
  },
  {
    method: 'get',
    routePath: '/dashboard',
    dispatchPath: '/dashboard',
    controller: 'dashboard',
    params: {},
  },

  // ─── CATÁLOGO: CULTIVOS (7) ────────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/crops',
    dispatchPath: '/private/crops',
    controller: 'cropsPrivate',
    params: {},
    authEvent: 'auth:crop:crops.viewPrivate',
  },
  {
    method: 'get',
    routePath: '/private/catalog/crops',
    dispatchPath: '/private/catalog/crops',
    controller: 'cropsPrivate',
    params: {},
    authEvent: 'auth:crop:crops.viewPrivate',
  },
  {
    method: 'get',
    routePath: '/private/crops/:id',
    dispatchPath: '/private/crops/101',
    controller: 'getCropDetail',
    params: { id: '101' },
    authEvent: 'auth:crop:crops.viewPrivate',
  },
  {
    method: 'post',
    routePath: '/private/crops/create',
    dispatchPath: '/private/crops/create',
    controller: 'createCrop',
    params: {},
    authEvent: 'auth:crop:crops.create',
    uploadEvent: 'upload:crops',
  },
  {
    method: 'post',
    routePath: '/private/crops/update/:id',
    dispatchPath: '/private/crops/update/101',
    controller: 'updateCrop',
    params: { id: '101' },
    authEvent: 'auth:crop:crops.edit',
    uploadEvent: 'upload:crops',
  },
  {
    method: 'post',
    routePath: '/private/crops/delete/:id',
    dispatchPath: '/private/crops/delete/101',
    controller: 'deleteCrop',
    params: { id: '101' },
    authEvent: 'auth:crop:crops.delete',
  },
  {
    method: 'post',
    routePath: '/private/crops/:id/workflow',
    dispatchPath: '/private/crops/101/workflow',
    controller: 'updateCropWorkflow',
    params: { id: '101' },
    authEvent: 'auth:crop:workflow',
  },

  // ─── CATÁLOGO: PLAGAS (8) ──────────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/plagues',
    dispatchPath: '/private/plagues',
    controller: 'plaguesPrivate',
    params: {},
    authEvent: 'auth:plague:plagues.viewPrivate',
  },
  {
    method: 'get',
    routePath: '/private/catalog/plagues',
    dispatchPath: '/private/catalog/plagues',
    controller: 'plaguesPrivate',
    params: {},
    authEvent: 'auth:plague:plagues.viewPrivate',
  },
  {
    method: 'get',
    routePath: '/private/plagues/:id',
    dispatchPath: '/private/plagues/102',
    controller: 'getPlagueDetail',
    params: { id: '102' },
    authEvent: 'auth:plague:plagues.viewPrivate',
  },
  {
    method: 'post',
    routePath: '/private/plagues/create',
    dispatchPath: '/private/plagues/create',
    controller: 'createPlague',
    params: {},
    authEvent: 'auth:plague:plagues.create',
    uploadEvent: 'upload:plagues',
  },
  {
    method: 'post',
    routePath: '/private/plagues/update/:id',
    dispatchPath: '/private/plagues/update/102',
    controller: 'updatePlague',
    params: { id: '102' },
    authEvent: 'auth:plague:plagues.edit',
    uploadEvent: 'upload:plagues',
  },
  {
    method: 'post',
    routePath: '/private/plagues/delete/:id',
    dispatchPath: '/private/plagues/delete/102',
    controller: 'deletePlague',
    params: { id: '102' },
    authEvent: 'auth:plague:plagues.delete',
  },
  {
    method: 'post',
    routePath: '/private/plagues/:id/workflow',
    dispatchPath: '/private/plagues/102/workflow',
    controller: 'updatePlagueWorkflow',
    params: { id: '102' },
    authEvent: 'auth:plague:workflow',
  },
  {
    method: 'post',
    routePath: '/private/plagues/:id/relations',
    dispatchPath: '/private/plagues/102/relations',
    controller: 'updatePlagueRelations',
    params: { id: '102' },
    authEvent: 'auth:plague:plagues.manageRelations',
  },

  // ─── CATÁLOGO: PRODUCTOS (7) ───────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/products',
    dispatchPath: '/private/products',
    controller: 'productsPrivate',
    params: {},
    authEvent: 'auth:product:products.viewPrivate',
  },
  {
    method: 'get',
    routePath: '/private/catalog/products',
    dispatchPath: '/private/catalog/products',
    controller: 'productsPrivate',
    params: {},
    authEvent: 'auth:product:products.viewPrivate',
  },
  {
    method: 'get',
    routePath: '/private/products/:id',
    dispatchPath: '/private/products/103',
    controller: 'getProductDetail',
    params: { id: '103' },
    authEvent: 'auth:product:products.viewPrivate',
  },
  {
    method: 'post',
    routePath: '/private/products/create',
    dispatchPath: '/private/products/create',
    controller: 'createProduct',
    params: {},
    authEvent: 'auth:product:products.create',
    uploadEvent: 'upload:products',
  },
  {
    method: 'post',
    routePath: '/private/products/update/:id',
    dispatchPath: '/private/products/update/103',
    controller: 'updateProduct',
    params: { id: '103' },
    authEvent: 'auth:product:products.edit',
    uploadEvent: 'upload:products',
  },
  {
    method: 'post',
    routePath: '/private/products/delete/:id',
    dispatchPath: '/private/products/delete/103',
    controller: 'deleteProduct',
    params: { id: '103' },
    authEvent: 'auth:product:products.delete',
  },
  {
    method: 'post',
    routePath: '/private/products/:id/workflow',
    dispatchPath: '/private/products/103/workflow',
    controller: 'updateProductWorkflow',
    params: { id: '103' },
    authEvent: 'auth:product:workflow',
  },

  // ─── CATÁLOGO: INGREDIENTES (1) ────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/ingredients',
    dispatchPath: '/private/ingredients',
    controller: 'ingredientsPrivate',
    params: {},
  },

  // ─── PARCELAS / GRANJAS (11) ──────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/lands',
    dispatchPath: '/private/lands',
    controller: 'renderLandsPrivate',
    params: {},
  },
  {
    method: 'get',
    routePath: '/private/lands/:id/expediente',
    dispatchPath: '/private/lands/201/expediente',
    controller: 'landDetail',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/create',
    dispatchPath: '/private/lands/create',
    controller: 'createFarmPrivate',
    params: {},
  },
  {
    method: 'post',
    routePath: '/private/lands/update/:id',
    dispatchPath: '/private/lands/update/201',
    controller: 'updateFarmPrivate',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/archive/:id',
    dispatchPath: '/private/lands/archive/201',
    controller: 'archiveFarmPrivate',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/restore/:id',
    dispatchPath: '/private/lands/restore/201',
    controller: 'restoreFarmPrivate',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/:id/cycles',
    dispatchPath: '/private/lands/201/cycles',
    controller: 'createLandCropCycle',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/:id/cycles/advance',
    dispatchPath: '/private/lands/201/cycles/advance',
    controller: 'advanceLandCropStage',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/:id/cycles/finish',
    dispatchPath: '/private/lands/201/cycles/finish',
    controller: 'finishLandCropCycle',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/:id/health-reports',
    dispatchPath: '/private/lands/201/health-reports',
    controller: 'createFarmHealthReport',
    params: { id: '201' },
  },
  {
    method: 'post',
    routePath: '/private/lands/:id/applications',
    dispatchPath: '/private/lands/201/applications',
    controller: 'createFarmApplication',
    params: { id: '201' },
  },

  // ─── PROVEEDORES (4) ───────────────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/suppliers',
    dispatchPath: '/private/suppliers',
    controller: 'suppliersPrivate',
    params: {},
  },
  {
    method: 'post',
    routePath: '/private/suppliers/create',
    dispatchPath: '/private/suppliers/create',
    controller: 'createSupplier',
    params: {},
  },
  {
    method: 'post',
    routePath: '/private/suppliers/update/:id',
    dispatchPath: '/private/suppliers/update/301',
    controller: 'updateSupplier',
    params: { id: '301' },
  },
  {
    method: 'post',
    routePath: '/private/suppliers/delete/:id',
    dispatchPath: '/private/suppliers/delete/301',
    controller: 'deleteSupplier',
    params: { id: '301' },
  },

  // ─── USUARIOS (5) ──────────────────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/users',
    dispatchPath: '/private/users',
    controller: 'usersPrivate',
    params: {},
  },
  {
    method: 'post',
    routePath: '/private/users/create',
    dispatchPath: '/private/users/create',
    controller: 'createUser',
    params: {},
  },
  {
    method: 'post',
    routePath: '/private/users/edit/:id',
    dispatchPath: '/private/users/edit/401',
    controller: 'updateUser',
    params: { id: '401' },
  },
  {
    method: 'post',
    routePath: '/private/users/status/:id',
    dispatchPath: '/private/users/status/401',
    controller: 'updateUserStatus',
    params: { id: '401' },
  },
  {
    method: 'post',
    routePath: '/private/users/delete/:id',
    dispatchPath: '/private/users/delete/401',
    controller: 'deleteUser',
    params: { id: '401' },
  },

  // ─── REPORTES Y AUDITORÍA (2) ─────────────────────────────────────────────
  {
    method: 'get',
    routePath: '/private/reports',
    dispatchPath: '/private/reports',
    controller: 'reportsPrivate',
    params: {},
  },
  {
    method: 'get',
    routePath: '/private/audit',
    dispatchPath: '/private/audit',
    controller: 'auditPrivate',
    params: {},
  },
];

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

  // ════════════════════════════════════════════════════════════════════════════
  // 1. COBERTURA PARAMETRIZADA DE LOS 50 ENDPOINTS
  // ════════════════════════════════════════════════════════════════════════════
  describe('cobertura parametrizada exhaustiva de los 50 endpoints', () => {
    it('el catálogo de pruebas de despacho cubre exactamente 50 endpoints únicos', () => {
      expect(ALL_50_DISPATCH_ENDPOINTS).toHaveLength(50);
      const keys = ALL_50_DISPATCH_ENDPOINTS.map(
        (e) => `${e.method.toUpperCase()} ${e.routePath}`,
      );
      expect(new Set(keys).size).toBe(50);
    });

    test.each(ALL_50_DISPATCH_ENDPOINTS)(
      '$method.toUpperCase() $routePath ejecuta el controlador $controller con parámetros esperados',
      async (ep) => {
        simulatedUser = { id: 1, role: 'admin' };
        executionLog.length = 0;

        let req = request(app)[ep.method](ep.dispatchPath);
        if (ep.body) {
          req = req.send(ep.body);
        }

        const res = await req;
        expect(res.status).toBe(200);

        // 1. Verifica que el controlador ejecutado es exactamente el esperado
        expect(mockControllers[ep.controller]).toHaveBeenCalledTimes(1);
        expect(res.body.controller).toBe(ep.controller);

        // 2. Verifica la captura y entrega de parámetros esperados (ej: :id)
        expect(res.body.params).toEqual(ep.params);

        // 3. Verifica la cadena ordenada si involucra subida y/o autorización
        if (ep.uploadEvent) {
          expect(executionLog).toEqual([
            ep.authEvent,
            ep.uploadEvent,
            `controller:${ep.controller}`,
          ]);
        } else if (ep.authEvent) {
          expect(executionLog).toEqual([
            ep.authEvent,
            `controller:${ep.controller}`,
          ]);
        }
      },
    );
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 2. ACCIONES EXPLÍCITAS DE PARCELAS / GRANJAS (ARCHIVAR / RESTAURAR / CICLOS)
  // ════════════════════════════════════════════════════════════════════════════
  describe('acciones explícitas de parcelas y granjas', () => {
    beforeEach(() => {
      simulatedUser = { id: 1, role: 'admin' };
    });

    it('POST /private/lands/archive/:id ejecuta exclusivamente archiveFarmPrivate con el id correspondiente', async () => {
      const res = await request(app).post('/private/lands/archive/888');
      expect(res.status).toBe(200);
      expect(mockControllers.archiveFarmPrivate).toHaveBeenCalledTimes(1);
      expect(mockControllers.restoreFarmPrivate).not.toHaveBeenCalled();
      expect(res.body.controller).toBe('archiveFarmPrivate');
      expect(res.body.params.id).toBe('888');
    });

    it('POST /private/lands/restore/:id ejecuta exclusivamente restoreFarmPrivate con el id correspondiente', async () => {
      const res = await request(app).post('/private/lands/restore/888');
      expect(res.status).toBe(200);
      expect(mockControllers.restoreFarmPrivate).toHaveBeenCalledTimes(1);
      expect(mockControllers.archiveFarmPrivate).not.toHaveBeenCalled();
      expect(res.body.controller).toBe('restoreFarmPrivate');
      expect(res.body.params.id).toBe('888');
    });

    it('los tres endpoints de ciclos de cultivo ejecutan sus controladores específicos', async () => {
      // Crear ciclo
      const createCycleRes = await request(app).post(
        '/private/lands/999/cycles',
      );
      expect(createCycleRes.status).toBe(200);
      expect(mockControllers.createLandCropCycle).toHaveBeenCalledTimes(1);
      expect(createCycleRes.body.params.id).toBe('999');

      // Avanzar etapa
      const advanceRes = await request(app).post(
        '/private/lands/999/cycles/advance',
      );
      expect(advanceRes.status).toBe(200);
      expect(mockControllers.advanceLandCropStage).toHaveBeenCalledTimes(1);
      expect(advanceRes.body.params.id).toBe('999');

      // Finalizar ciclo
      const finishRes = await request(app).post(
        '/private/lands/999/cycles/finish',
      );
      expect(finishRes.status).toBe(200);
      expect(mockControllers.finishLandCropCycle).toHaveBeenCalledTimes(1);
      expect(finishRes.body.params.id).toBe('999');
    });

    it('los endpoints de reportes sanitarios y aplicaciones ejecutan sus controladores específicos', async () => {
      const healthRes = await request(app).post(
        '/private/lands/777/health-reports',
      );
      expect(healthRes.status).toBe(200);
      expect(mockControllers.createFarmHealthReport).toHaveBeenCalledTimes(1);
      expect(healthRes.body.params.id).toBe('777');

      const appRes = await request(app).post('/private/lands/777/applications');
      expect(appRes.status).toBe(200);
      expect(mockControllers.createFarmApplication).toHaveBeenCalledTimes(1);
      expect(appRes.body.params.id).toBe('777');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 3. MUTACIONES DE PROVEEDORES
  // ════════════════════════════════════════════════════════════════════════════
  describe('mutaciones de proveedores', () => {
    beforeEach(() => {
      simulatedUser = { id: 1, role: 'admin' };
    });

    it('crear proveedor ejecuta createSupplier', async () => {
      const res = await request(app)
        .post('/private/suppliers/create')
        .send({ nombre: 'AgroQuímica del Norte' });
      expect(res.status).toBe(200);
      expect(mockControllers.createSupplier).toHaveBeenCalledTimes(1);
      expect(res.body.controller).toBe('createSupplier');
    });

    it('actualizar proveedor ejecuta updateSupplier con el id entregado', async () => {
      const res = await request(app)
        .post('/private/suppliers/update/50')
        .send({ telefono: '555-1234' });
      expect(res.status).toBe(200);
      expect(mockControllers.updateSupplier).toHaveBeenCalledTimes(1);
      expect(res.body.controller).toBe('updateSupplier');
      expect(res.body.params.id).toBe('50');
    });

    it('eliminar proveedor ejecuta deleteSupplier con el id entregado', async () => {
      const res = await request(app).post('/private/suppliers/delete/50');
      expect(res.status).toBe(200);
      expect(mockControllers.deleteSupplier).toHaveBeenCalledTimes(1);
      expect(res.body.controller).toBe('deleteSupplier');
      expect(res.body.params.id).toBe('50');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 4. ENDPOINTS DE USUARIOS Y CONTROL DE ACCESO ADMIN
  // ════════════════════════════════════════════════════════════════════════════
  describe('endpoints de usuarios y protección requireRole("admin")', () => {
    it('un usuario inifap (no admin) es rechazado con 403 en los 5 endpoints de usuarios sin ejecutar controladores', async () => {
      simulatedUser = { id: 2, role: 'inifap' };

      const getRes = await request(app).get('/private/users');
      expect(getRes.status).toBe(403);
      expect(mockControllers.usersPrivate).not.toHaveBeenCalled();

      const createRes = await request(app).post('/private/users/create');
      expect(createRes.status).toBe(403);
      expect(mockControllers.createUser).not.toHaveBeenCalled();

      const editRes = await request(app).post('/private/users/edit/15');
      expect(editRes.status).toBe(403);
      expect(mockControllers.updateUser).not.toHaveBeenCalled();

      const statusRes = await request(app).post('/private/users/status/15');
      expect(statusRes.status).toBe(403);
      expect(mockControllers.updateUserStatus).not.toHaveBeenCalled();

      const deleteRes = await request(app).post('/private/users/delete/15');
      expect(deleteRes.status).toBe(403);
      expect(mockControllers.deleteUser).not.toHaveBeenCalled();
    });

    it('un usuario admin ejecuta exitosamente los endpoints de gestión de usuarios', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      const editRes = await request(app)
        .post('/private/users/edit/15')
        .send({ role: 'tecnico' });
      expect(editRes.status).toBe(200);
      expect(mockControllers.updateUser).toHaveBeenCalledTimes(1);
      expect(editRes.body.params.id).toBe('15');

      const statusRes = await request(app)
        .post('/private/users/status/15')
        .send({ status: 'inactive' });
      expect(statusRes.status).toBe(200);
      expect(mockControllers.updateUserStatus).toHaveBeenCalledTimes(1);
      expect(statusRes.body.params.id).toBe('15');

      const deleteRes = await request(app).post('/private/users/delete/15');
      expect(deleteRes.status).toBe(200);
      expect(mockControllers.deleteUser).toHaveBeenCalledTimes(1);
      expect(deleteRes.body.params.id).toBe('15');
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 5. RECHAZO DE WORKFLOWS SIN EJECUTAR CONTROLADORES
  // ════════════════════════════════════════════════════════════════════════════
  describe('rechazo estricto de los tres workflows sin ejecutar controladores', () => {
    it('cuando se deniega permiso de workflow, responde 403 y no ejecuta ningún controlador de workflow', async () => {
      simulatedUser = { id: 1, role: 'admin' };
      simulatedPermissions.workflow = false;

      // Workflow de Cultivos
      executionLog.length = 0;
      const cropWfRes = await request(app).post('/private/crops/10/workflow');
      expect(cropWfRes.status).toBe(403);
      expect(mockControllers.updateCropWorkflow).not.toHaveBeenCalled();
      expect(executionLog).toEqual(['auth:crop:workflow']);

      // Workflow de Plagas
      executionLog.length = 0;
      const plagueWfRes = await request(app).post(
        '/private/plagues/20/workflow',
      );
      expect(plagueWfRes.status).toBe(403);
      expect(mockControllers.updatePlagueWorkflow).not.toHaveBeenCalled();
      expect(executionLog).toEqual(['auth:plague:workflow']);

      // Workflow de Productos
      executionLog.length = 0;
      const productWfRes = await request(app).post(
        '/private/products/30/workflow',
      );
      expect(productWfRes.status).toBe(403);
      expect(mockControllers.updateProductWorkflow).not.toHaveBeenCalled();
      expect(executionLog).toEqual(['auth:product:workflow']);
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 6. CADENA ORDENADA Y BLOQUEO DE SUBIDAS (AUTORIZACIÓN -> SUBIDA -> CONTROLADOR)
  // ════════════════════════════════════════════════════════════════════════════
  describe('cadena ordenada de subida y bloqueo ante fallo de autorización', () => {
    const uploadEndpoints = [
      {
        path: '/private/crops/create',
        type: 'crops',
        controller: 'createCrop',
        auth: 'auth:crop:crops.create',
        upload: 'upload:crops',
      },
      {
        path: '/private/crops/update/5',
        type: 'crops',
        controller: 'updateCrop',
        auth: 'auth:crop:crops.edit',
        upload: 'upload:crops',
      },
      {
        path: '/private/plagues/create',
        type: 'plagues',
        controller: 'createPlague',
        auth: 'auth:plague:plagues.create',
        upload: 'upload:plagues',
      },
      {
        path: '/private/plagues/update/5',
        type: 'plagues',
        controller: 'updatePlague',
        auth: 'auth:plague:plagues.edit',
        upload: 'upload:plagues',
      },
      {
        path: '/private/products/create',
        type: 'products',
        controller: 'createProduct',
        auth: 'auth:product:products.create',
        upload: 'upload:products',
      },
      {
        path: '/private/products/update/5',
        type: 'products',
        controller: 'updateProduct',
        auth: 'auth:product:products.edit',
        upload: 'upload:products',
      },
    ];

    it('cuando la autorización falla, ni la subida de archivos ni el controlador se ejecutan', async () => {
      simulatedUser = { id: 1, role: 'admin' };

      for (const endpoint of uploadEndpoints) {
        executionLog.length = 0;
        simulatedPermissions[endpoint.type] = false;

        const res = await request(app).post(endpoint.path);
        expect(res.status).toBe(403);

        // La autorización fue llamada y rechazó; nunca se llamó a upload ni a controller
        expect(executionLog).toEqual([endpoint.auth]);
        expect(executionLog).not.toContain(endpoint.upload);
        expect(executionLog).not.toContain(`controller:${endpoint.controller}`);

        simulatedPermissions[endpoint.type] = true;
      }
    });
  });

  // ════════════════════════════════════════════════════════════════════════════
  // 7. AUTENTICACIÓN GLOBAL Y PANEL PRIVADO
  // ════════════════════════════════════════════════════════════════════════════
  describe('autenticación global y guardia de panel', () => {
    it('solicitud sin sesión redirige 302 a /auth/login sin ejecutar ningún controlador', async () => {
      simulatedUser = null;

      const res = await request(app).get('/dashboard');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('/auth/login');
      expect(mockControllers.dashboard).not.toHaveBeenCalled();
    });

    it('usuario agricultor (sin acceso a panel) accede a /profile pero recibe 403 en el panel privado', async () => {
      simulatedUser = { id: 10, role: 'agricultor' };

      const profileRes = await request(app).get('/profile');
      expect(profileRes.status).toBe(200);
      expect(mockControllers.renderProfile).toHaveBeenCalledTimes(1);

      const dashboardRes = await request(app).get('/dashboard');
      expect(dashboardRes.status).toBe(403);
      expect(mockControllers.dashboard).not.toHaveBeenCalled();

      const cropsRes = await request(app).get('/private/crops');
      expect(cropsRes.status).toBe(403);
      expect(mockControllers.cropsPrivate).not.toHaveBeenCalled();
    });
  });
});
