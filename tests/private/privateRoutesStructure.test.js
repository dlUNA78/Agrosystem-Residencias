import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import privateRouter from '../../src/routes/privateRoutes.js';
import catalogRouter from '../../src/routes/private/catalogRoutes.js';
import landRouter from '../../src/routes/private/landRoutes.js';
import adminRouter from '../../src/routes/private/adminRoutes.js';

const ROUTES_DIR = path.resolve('src/routes');
const PRIVATE_ROUTES_DIR = path.resolve('src/routes/private');

// ══════════════════════════════════════════════════════════════════════════════
// CONTRATO ESPERADO INDEPENDIENTE DERIVADO DEL COMMIT BASE
// Cada endpoint define: método, ruta, dominio, controlador final, middlewares y argumentos de permisos
// ══════════════════════════════════════════════════════════════════════════════
export const EXPECTED_CONTRACT = [
  // ─── AGREGADOR / RAÍZ (5) ──────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/profile',
    domain: 'root',
    controller: 'renderProfile',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/profile',
    domain: 'root',
    controller: 'updateProfile',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'GET',
    path: '/private/profile',
    domain: 'root',
    controller: 'renderProfile',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/profile',
    domain: 'root',
    controller: 'updateProfile',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'GET',
    path: '/dashboard',
    domain: 'root',
    controller: 'dashboard',
    middlewares: [],
    permissionArg: null,
  },

  // ─── CATÁLOGO: CULTIVOS (7) ────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/private/crops',
    domain: 'catalog',
    controller: 'cropsPrivate',
    middlewares: ['requireCropPermission'],
    permissionArg: 'crops.viewPrivate',
  },
  {
    method: 'GET',
    path: '/private/catalog/crops',
    domain: 'catalog',
    controller: 'cropsPrivate',
    middlewares: ['requireCropPermission'],
    permissionArg: 'crops.viewPrivate',
  },
  {
    method: 'GET',
    path: '/private/crops/:id',
    domain: 'catalog',
    controller: 'getCropDetail',
    middlewares: ['requireCropPermission'],
    permissionArg: 'crops.viewPrivate',
  },
  {
    method: 'POST',
    path: '/private/crops/create',
    domain: 'catalog',
    controller: 'createCrop',
    middlewares: ['requireCropPermission', 'uploadCropImages'],
    permissionArg: 'crops.create',
  },
  {
    method: 'POST',
    path: '/private/crops/update/:id',
    domain: 'catalog',
    controller: 'updateCrop',
    middlewares: ['requireCropPermission', 'uploadCropImages'],
    permissionArg: 'crops.edit',
  },
  {
    method: 'POST',
    path: '/private/crops/delete/:id',
    domain: 'catalog',
    controller: 'deleteCrop',
    middlewares: ['requireCropPermission'],
    permissionArg: 'crops.delete',
  },
  {
    method: 'POST',
    path: '/private/crops/:id/workflow',
    domain: 'catalog',
    controller: 'updateCropWorkflow',
    middlewares: ['requireCropWorkflowPermission'],
    permissionArg: null,
  },

  // ─── CATÁLOGO: PLAGAS (8) ──────────────────────────────────────────────────
  {
    method: 'GET',
    path: '/private/plagues',
    domain: 'catalog',
    controller: 'plaguesPrivate',
    middlewares: ['requirePlaguePermission'],
    permissionArg: 'plagues.viewPrivate',
  },
  {
    method: 'GET',
    path: '/private/catalog/plagues',
    domain: 'catalog',
    controller: 'plaguesPrivate',
    middlewares: ['requirePlaguePermission'],
    permissionArg: 'plagues.viewPrivate',
  },
  {
    method: 'GET',
    path: '/private/plagues/:id',
    domain: 'catalog',
    controller: 'getPlagueDetail',
    middlewares: ['requirePlaguePermission'],
    permissionArg: 'plagues.viewPrivate',
  },
  {
    method: 'POST',
    path: '/private/plagues/create',
    domain: 'catalog',
    controller: 'createPlague',
    middlewares: ['requirePlaguePermission', 'uploadPlagueImages'],
    permissionArg: 'plagues.create',
  },
  {
    method: 'POST',
    path: '/private/plagues/update/:id',
    domain: 'catalog',
    controller: 'updatePlague',
    middlewares: ['requirePlaguePermission', 'uploadPlagueImages'],
    permissionArg: 'plagues.edit',
  },
  {
    method: 'POST',
    path: '/private/plagues/delete/:id',
    domain: 'catalog',
    controller: 'deletePlague',
    middlewares: ['requirePlaguePermission'],
    permissionArg: 'plagues.delete',
  },
  {
    method: 'POST',
    path: '/private/plagues/:id/workflow',
    domain: 'catalog',
    controller: 'updatePlagueWorkflow',
    middlewares: ['requirePlagueWorkflowPermission'],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/plagues/:id/relations',
    domain: 'catalog',
    controller: 'updatePlagueRelations',
    middlewares: ['requirePlaguePermission'],
    permissionArg: 'plagues.manageRelations',
  },

  // ─── CATÁLOGO: PRODUCTOS AGROQUÍMICOS (7) ──────────────────────────────────
  {
    method: 'GET',
    path: '/private/products',
    domain: 'catalog',
    controller: 'productsPrivate',
    middlewares: ['requireProductPermission'],
    permissionArg: 'products.viewPrivate',
  },
  {
    method: 'GET',
    path: '/private/catalog/products',
    domain: 'catalog',
    controller: 'productsPrivate',
    middlewares: ['requireProductPermission'],
    permissionArg: 'products.viewPrivate',
  },
  {
    method: 'GET',
    path: '/private/products/:id',
    domain: 'catalog',
    controller: 'getProductDetail',
    middlewares: ['requireProductPermission'],
    permissionArg: 'products.viewPrivate',
  },
  {
    method: 'POST',
    path: '/private/products/create',
    domain: 'catalog',
    controller: 'createProduct',
    middlewares: ['requireProductPermission', 'uploadProductImages'],
    permissionArg: 'products.create',
  },
  {
    method: 'POST',
    path: '/private/products/update/:id',
    domain: 'catalog',
    controller: 'updateProduct',
    middlewares: ['requireProductPermission', 'uploadProductImages'],
    permissionArg: 'products.edit',
  },
  {
    method: 'POST',
    path: '/private/products/delete/:id',
    domain: 'catalog',
    controller: 'deleteProduct',
    middlewares: ['requireProductPermission'],
    permissionArg: 'products.delete',
  },
  {
    method: 'POST',
    path: '/private/products/:id/workflow',
    domain: 'catalog',
    controller: 'updateProductWorkflow',
    middlewares: ['requireProductWorkflowPermission'],
    permissionArg: null,
  },

  // ─── CATÁLOGO: INGREDIENTES ACTIVOS (1) ────────────────────────────────────
  {
    method: 'GET',
    path: '/private/ingredients',
    domain: 'catalog',
    controller: 'ingredientsPrivate',
    middlewares: [],
    permissionArg: null,
  },

  // ─── PARCELAS Y GRANJAS (11) ──────────────────────────────────────────────
  {
    method: 'GET',
    path: '/private/lands',
    domain: 'land',
    controller: 'renderLandsPrivate',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'GET',
    path: '/private/lands/:id/expediente',
    domain: 'land',
    controller: 'landDetail',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/create',
    domain: 'land',
    controller: 'createFarmPrivate',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/update/:id',
    domain: 'land',
    controller: 'updateFarmPrivate',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/archive/:id',
    domain: 'land',
    controller: 'archiveFarmPrivate',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/restore/:id',
    domain: 'land',
    controller: 'restoreFarmPrivate',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/:id/cycles',
    domain: 'land',
    controller: 'createLandCropCycle',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/:id/cycles/advance',
    domain: 'land',
    controller: 'advanceLandCropStage',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/:id/cycles/finish',
    domain: 'land',
    controller: 'finishLandCropCycle',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/:id/health-reports',
    domain: 'land',
    controller: 'createFarmHealthReport',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/lands/:id/applications',
    domain: 'land',
    controller: 'createFarmApplication',
    middlewares: [],
    permissionArg: null,
  },

  // ─── ADMINISTRACIÓN: PROVEEDORES (4) ───────────────────────────────────────
  {
    method: 'GET',
    path: '/private/suppliers',
    domain: 'admin',
    controller: 'suppliersPrivate',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/suppliers/create',
    domain: 'admin',
    controller: 'createSupplier',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/suppliers/update/:id',
    domain: 'admin',
    controller: 'updateSupplier',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'POST',
    path: '/private/suppliers/delete/:id',
    domain: 'admin',
    controller: 'deleteSupplier',
    middlewares: [],
    permissionArg: null,
  },

  // ─── ADMINISTRACIÓN: USUARIOS (5) ──────────────────────────────────────────
  {
    method: 'GET',
    path: '/private/users',
    domain: 'admin',
    controller: 'usersPrivate',
    middlewares: ['requireRole'],
    permissionArg: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/create',
    domain: 'admin',
    controller: 'createUser',
    middlewares: ['requireRole'],
    permissionArg: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/edit/:id',
    domain: 'admin',
    controller: 'updateUser',
    middlewares: ['requireRole'],
    permissionArg: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/status/:id',
    domain: 'admin',
    controller: 'updateUserStatus',
    middlewares: ['requireRole'],
    permissionArg: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/delete/:id',
    domain: 'admin',
    controller: 'deleteUser',
    middlewares: ['requireRole'],
    permissionArg: 'admin',
  },

  // ─── ADMINISTRACIÓN: REPORTES Y AUDITORÍA (2) ─────────────────────────────
  {
    method: 'GET',
    path: '/private/reports',
    domain: 'admin',
    controller: 'reportsPrivate',
    middlewares: [],
    permissionArg: null,
  },
  {
    method: 'GET',
    path: '/private/audit',
    domain: 'admin',
    controller: 'auditPrivate',
    middlewares: [],
    permissionArg: null,
  },
];

/**
 * Extrae todas las rutas registradas recorriendo recursivamente la pila (stack) de Express Router.
 */
const extractDetailedRoutes = (router) => {
  const routes = [];
  router.stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .map((m) => m.toUpperCase())
        .filter((m) => m !== '_ALL');
      const handlers = layer.route.stack.map(
        (h) => h.handle.name || h.name || 'anonymous',
      );
      const lastHandler = layer.route.stack[layer.route.stack.length - 1];
      const controllerName = lastHandler?.handle?.name || 'anonymous';
      const middlewareHandlers = layer.route.stack.slice(0, -1);

      methods.forEach((method) => {
        routes.push({
          method,
          path: layer.route.path,
          handlersCount: layer.route.stack.length,
          handlers,
          controllerName,
          middlewareCount: middlewareHandlers.length,
          middlewareNames: middlewareHandlers.map(
            (h) => h.handle.name || h.name || 'anonymous',
          ),
        });
      });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      routes.push(...extractDetailedRoutes(layer.handle));
    }
  });
  return routes;
};

describe('pruebas estructurales y de inventario de rutas privadas por dominio', () => {
  describe('archivos del refactor y organización', () => {
    it('los cuatro archivos de rutas existen en sus ubicaciones correspondientes', () => {
      expect(fs.existsSync(path.join(ROUTES_DIR, 'privateRoutes.js'))).toBe(
        true,
      );
      expect(
        fs.existsSync(path.join(PRIVATE_ROUTES_DIR, 'catalogRoutes.js')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(PRIVATE_ROUTES_DIR, 'landRoutes.js')),
      ).toBe(true);
      expect(
        fs.existsSync(path.join(PRIVATE_ROUTES_DIR, 'adminRoutes.js')),
      ).toBe(true);
    });

    it('cada router secundario exporta una instancia válida de Router de Express', () => {
      expect(typeof catalogRouter).toBe('function');
      expect(typeof catalogRouter.stack).toBe('object');
      expect(typeof landRouter).toBe('function');
      expect(typeof landRouter.stack).toBe('object');
      expect(typeof adminRouter).toBe('function');
      expect(typeof adminRouter.stack).toBe('object');
      expect(typeof privateRouter).toBe('function');
      expect(typeof privateRouter.stack).toBe('object');
    });

    it('los archivos modulares no superan las 300 líneas recomendadas en RULES.MD', () => {
      const files = [
        path.join(ROUTES_DIR, 'privateRoutes.js'),
        path.join(PRIVATE_ROUTES_DIR, 'catalogRoutes.js'),
        path.join(PRIVATE_ROUTES_DIR, 'landRoutes.js'),
        path.join(PRIVATE_ROUTES_DIR, 'adminRoutes.js'),
      ];

      files.forEach((file) => {
        const lineCount = fs.readFileSync(file, 'utf8').split('\n').length;
        expect(lineCount).toBeLessThanOrEqual(300);
      });
    });
  });

  describe('equivalencia del inventario de rutas (50 endpoints)', () => {
    const registeredRoutes = extractDetailedRoutes(privateRouter);

    it('el total de registros explícitos coincide exactamente con los 50 del contrato base', () => {
      expect(registeredRoutes).toHaveLength(50);
      expect(EXPECTED_CONTRACT).toHaveLength(50);
    });

    it('cada endpoint esperado existe con el método, path, controlador final y middlewares exactos', () => {
      EXPECTED_CONTRACT.forEach((expected) => {
        const found = registeredRoutes.find(
          (r) => r.method === expected.method && r.path === expected.path,
        );
        expect(found).toBeDefined();

        // 1. Verifica el nombre del controlador final
        expect(found.controllerName).toBe(expected.controller);

        // 2. Verifica la cantidad exacta de middlewares previos
        expect(found.middlewareCount).toBe(expected.middlewares.length);

        // 3. Verifica el total de manejadores (middlewares + controlador)
        expect(found.handlersCount).toBe(expected.middlewares.length + 1);

        // 4. Si hay middlewares con nombre explícito (ej: requireCropWorkflowPermission, uploadProductImages), verificar coincidencia
        expected.middlewares.forEach((mwName, idx) => {
          const registeredMwName = found.middlewareNames[idx];
          if (
            mwName.startsWith('require') &&
            mwName.endsWith('WorkflowPermission')
          ) {
            expect(registeredMwName).toBe(mwName);
          } else if (mwName === 'uploadProductImages') {
            expect(registeredMwName).toBe(mwName);
          }
        });
      });
    });

    it('no existen rutas adicionales, huérfanas ni duplicadas en el router compuesto', () => {
      const routeKeys = registeredRoutes.map((r) => `${r.method} ${r.path}`);
      const uniqueKeys = new Set(routeKeys);
      expect(uniqueKeys.size).toBe(50);

      registeredRoutes.forEach((route) => {
        const expected = EXPECTED_CONTRACT.find(
          (e) => e.method === route.method && e.path === route.path,
        );
        expect(expected).toBeDefined();
      });
    });

    it('los routers por dominio contienen la distribución exacta de rutas', () => {
      const catalogRoutes = extractDetailedRoutes(catalogRouter);
      const landRoutes = extractDetailedRoutes(landRouter);
      const adminRoutes = extractDetailedRoutes(adminRouter);

      expect(catalogRoutes).toHaveLength(23);
      expect(landRoutes).toHaveLength(11);
      expect(adminRoutes).toHaveLength(11);

      // 23 catálogo + 11 parcelas + 11 admin + 5 agregador raíz = 50
      const totalModularRoutes =
        catalogRoutes.length + landRoutes.length + adminRoutes.length + 5;
      expect(totalModularRoutes).toBe(50);
    });

    it('las 11 rutas de parcelas apuntan a sus controladores correspondientes (incluyendo archive/restore)', () => {
      const landRoutes = extractDetailedRoutes(landRouter);

      const archiveRoute = landRoutes.find(
        (r) => r.method === 'POST' && r.path === '/private/lands/archive/:id',
      );
      expect(archiveRoute).toBeDefined();
      expect(archiveRoute.controllerName).toBe('archiveFarmPrivate');

      const restoreRoute = landRoutes.find(
        (r) => r.method === 'POST' && r.path === '/private/lands/restore/:id',
      );
      expect(restoreRoute).toBeDefined();
      expect(restoreRoute.controllerName).toBe('restoreFarmPrivate');

      const cycleRoute = landRoutes.find(
        (r) => r.method === 'POST' && r.path === '/private/lands/:id/cycles',
      );
      expect(cycleRoute).toBeDefined();
      expect(cycleRoute.controllerName).toBe('createLandCropCycle');

      const healthRoute = landRoutes.find(
        (r) =>
          r.method === 'POST' && r.path === '/private/lands/:id/health-reports',
      );
      expect(healthRoute).toBeDefined();
      expect(healthRoute.controllerName).toBe('createFarmHealthReport');

      const appRoute = landRoutes.find(
        (r) =>
          r.method === 'POST' && r.path === '/private/lands/:id/applications',
      );
      expect(appRoute).toBeDefined();
      expect(appRoute.controllerName).toBe('createFarmApplication');
    });
  });

  describe('preservación del orden de middlewares en el enrutador agregador', () => {
    it('el primer middleware global es isAuthenticated', () => {
      const firstLayer = privateRouter.stack[0];
      expect(firstLayer.name).toBe('isAuthenticated');
    });

    it('las rutas /profile (GET y POST) se registran ANTES de requirePanelAccess', () => {
      let profileGetIndex = -1;
      let profilePostIndex = -1;
      let requirePanelAccessIndex = -1;

      privateRouter.stack.forEach((layer, index) => {
        if (layer.route?.path === '/profile') {
          if (layer.route.methods.get) profileGetIndex = index;
          if (layer.route.methods.post) profilePostIndex = index;
        }
        if (
          !layer.route &&
          typeof layer.handle === 'function' &&
          index > 0 &&
          index < 5
        ) {
          requirePanelAccessIndex = index;
        }
      });

      expect(profileGetIndex).toBeGreaterThan(-1);
      expect(profilePostIndex).toBeGreaterThan(-1);
      expect(requirePanelAccessIndex).toBeGreaterThan(-1);
      expect(profileGetIndex).toBeLessThan(requirePanelAccessIndex);
      expect(profilePostIndex).toBeLessThan(requirePanelAccessIndex);
    });

    it('ningún sub-router por dominio duplica isAuthenticated ni requirePanelAccess en su pila raíz', () => {
      const checkNoDuplicateGuards = (router) => {
        router.stack.forEach((layer) => {
          if (!layer.route) {
            expect(layer.name).not.toBe('isAuthenticated');
            expect(layer.name).not.toBe('requirePanelAccess');
          }
        });
      };

      checkNoDuplicateGuards(catalogRouter);
      checkNoDuplicateGuards(landRouter);
      checkNoDuplicateGuards(adminRouter);
    });

    it('adminRoutes no aplica requireRole("admin") a nivel de router sino por endpoint', () => {
      adminRouter.stack.forEach((layer) => {
        if (!layer.route) {
          expect(layer.name).not.toBe('requireRole');
        }
      });
    });
  });
});
