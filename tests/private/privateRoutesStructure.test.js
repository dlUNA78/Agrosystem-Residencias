import { describe, expect, it } from '@jest/globals';
import fs from 'node:fs';
import path from 'node:path';

import privateRouter from '../../src/routes/privateRoutes.js';
import catalogRouter from '../../src/routes/private/catalogRoutes.js';
import landRouter from '../../src/routes/private/landRoutes.js';
import adminRouter from '../../src/routes/private/adminRoutes.js';

const ROUTES_DIR = path.resolve('src/routes');
const PRIVATE_ROUTES_DIR = path.resolve('src/routes/private');

// Contrato esperado independiente derivado del commit base
const EXPECTED_CONTRACT = [
  // Rutas directas del agregador
  { method: 'GET', path: '/profile', handlersCount: 1, domain: 'root' },
  { method: 'POST', path: '/profile', handlersCount: 1, domain: 'root' },
  { method: 'GET', path: '/private/profile', handlersCount: 1, domain: 'root' },
  {
    method: 'POST',
    path: '/private/profile',
    handlersCount: 1,
    domain: 'root',
  },
  { method: 'GET', path: '/dashboard', handlersCount: 1, domain: 'root' },

  // Catálogo: Cultivos (7)
  {
    method: 'GET',
    path: '/private/crops',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'GET',
    path: '/private/catalog/crops',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'GET',
    path: '/private/crops/:id',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/crops/create',
    handlersCount: 3,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/crops/update/:id',
    handlersCount: 3,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/crops/delete/:id',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/crops/:id/workflow',
    handlersCount: 2,
    domain: 'catalog',
  },

  // Catálogo: Plagas (8)
  {
    method: 'GET',
    path: '/private/plagues',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'GET',
    path: '/private/catalog/plagues',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'GET',
    path: '/private/plagues/:id',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/plagues/create',
    handlersCount: 3,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/plagues/update/:id',
    handlersCount: 3,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/plagues/delete/:id',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/plagues/:id/workflow',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/plagues/:id/relations',
    handlersCount: 2,
    domain: 'catalog',
  },

  // Catálogo: Productos (7)
  {
    method: 'GET',
    path: '/private/products',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'GET',
    path: '/private/catalog/products',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'GET',
    path: '/private/products/:id',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/products/create',
    handlersCount: 3,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/products/update/:id',
    handlersCount: 3,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/products/delete/:id',
    handlersCount: 2,
    domain: 'catalog',
  },
  {
    method: 'POST',
    path: '/private/products/:id/workflow',
    handlersCount: 2,
    domain: 'catalog',
  },

  // Catálogo: Ingredientes (1)
  {
    method: 'GET',
    path: '/private/ingredients',
    handlersCount: 1,
    domain: 'catalog',
  },

  // Parcelas (11)
  { method: 'GET', path: '/private/lands', handlersCount: 1, domain: 'land' },
  {
    method: 'GET',
    path: '/private/lands/:id/expediente',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/create',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/update/:id',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/archive/:id',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/restore/:id',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/:id/cycles',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/:id/cycles/advance',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/:id/cycles/finish',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/:id/health-reports',
    handlersCount: 1,
    domain: 'land',
  },
  {
    method: 'POST',
    path: '/private/lands/:id/applications',
    handlersCount: 1,
    domain: 'land',
  },

  // Administración: Proveedores (4)
  {
    method: 'GET',
    path: '/private/suppliers',
    handlersCount: 1,
    domain: 'admin',
  },
  {
    method: 'POST',
    path: '/private/suppliers/create',
    handlersCount: 1,
    domain: 'admin',
  },
  {
    method: 'POST',
    path: '/private/suppliers/update/:id',
    handlersCount: 1,
    domain: 'admin',
  },
  {
    method: 'POST',
    path: '/private/suppliers/delete/:id',
    handlersCount: 1,
    domain: 'admin',
  },

  // Administración: Usuarios (5)
  {
    method: 'GET',
    path: '/private/users',
    handlersCount: 2,
    domain: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/create',
    handlersCount: 2,
    domain: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/edit/:id',
    handlersCount: 2,
    domain: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/status/:id',
    handlersCount: 2,
    domain: 'admin',
  },
  {
    method: 'POST',
    path: '/private/users/delete/:id',
    handlersCount: 2,
    domain: 'admin',
  },

  // Administración: Reportes y Auditoría (2)
  {
    method: 'GET',
    path: '/private/reports',
    handlersCount: 1,
    domain: 'admin',
  },
  { method: 'GET', path: '/private/audit', handlersCount: 1, domain: 'admin' },
];

const extractRoutesFromRouter = (router) => {
  const routes = [];
  router.stack.forEach((layer) => {
    if (layer.route) {
      const methods = Object.keys(layer.route.methods)
        .map((m) => m.toUpperCase())
        .filter((m) => m !== '_ALL');
      methods.forEach((method) => {
        routes.push({
          method,
          path: layer.route.path,
          handlersCount: layer.route.stack.length,
        });
      });
    } else if (layer.name === 'router' && layer.handle?.stack) {
      routes.push(...extractRoutesFromRouter(layer.handle));
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
    const registeredRoutes = extractRoutesFromRouter(privateRouter);

    it('el total de registros explícitos coincide exactamente con los 50 del contrato base', () => {
      expect(registeredRoutes).toHaveLength(50);
      expect(EXPECTED_CONTRACT).toHaveLength(50);
    });

    it('cada endpoint esperado existe en el router con el método y path exactos', () => {
      EXPECTED_CONTRACT.forEach((expected) => {
        const found = registeredRoutes.find(
          (r) => r.method === expected.method && r.path === expected.path,
        );
        expect(found).toBeDefined();
        expect(found.handlersCount).toBe(expected.handlersCount);
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
      const catalogRoutes = extractRoutesFromRouter(catalogRouter);
      const landRoutes = extractRoutesFromRouter(landRouter);
      const adminRoutes = extractRoutesFromRouter(adminRouter);

      expect(catalogRoutes).toHaveLength(23);
      expect(landRoutes).toHaveLength(11);
      expect(adminRoutes).toHaveLength(11);
    });

    it('ningún path contiene duplicaciones de prefijo como /private/private/', () => {
      registeredRoutes.forEach((r) => {
        expect(r.path).not.toContain('/private/private/');
      });
    });
  });

  describe('contrato del agregador (privateRoutes.js)', () => {
    const rawAggregatorContent = fs.readFileSync(
      path.join(ROUTES_DIR, 'privateRoutes.js'),
      'utf8',
    );

    it('conserva el orden estricto de autenticación y acceso al panel', () => {
      const authIdx = rawAggregatorContent.indexOf(
        'privateRouter.use(isAuthenticated)',
      );
      const profileGetIdx = rawAggregatorContent.indexOf(
        "privateRouter.get('/profile'",
      );
      const profilePostIdx = rawAggregatorContent.indexOf(
        "privateRouter.post('/profile'",
      );
      const panelIdx = rawAggregatorContent.indexOf(
        'privateRouter.use(requirePanelAccess)',
      );
      const privProfileGetIdx = rawAggregatorContent.indexOf(
        "privateRouter.get('/private/profile'",
      );
      const dashboardIdx = rawAggregatorContent.indexOf(
        "privateRouter.get('/dashboard'",
      );
      const catalogMountIdx = rawAggregatorContent.indexOf(
        'privateRouter.use(catalogRoutes)',
      );
      const landMountIdx = rawAggregatorContent.indexOf(
        'privateRouter.use(landRoutes)',
      );
      const adminMountIdx = rawAggregatorContent.indexOf(
        'privateRouter.use(adminRoutes)',
      );

      expect(authIdx).toBeGreaterThan(-1);
      expect(profileGetIdx).toBeGreaterThan(authIdx);
      expect(profilePostIdx).toBeGreaterThan(authIdx);

      // /profile debe estar ANTES de requirePanelAccess
      expect(profileGetIdx).toBeLessThan(panelIdx);
      expect(profilePostIdx).toBeLessThan(panelIdx);

      // /private/profile y /dashboard deben estar DESPUÉS de requirePanelAccess
      expect(privProfileGetIdx).toBeGreaterThan(panelIdx);
      expect(dashboardIdx).toBeGreaterThan(panelIdx);

      // Los routers de dominio deben montarse DESPUÉS de requirePanelAccess
      expect(catalogMountIdx).toBeGreaterThan(panelIdx);
      expect(landMountIdx).toBeGreaterThan(panelIdx);
      expect(adminMountIdx).toBeGreaterThan(panelIdx);
    });

    it('los routers de dominio no aplican isAuthenticated ni requirePanelAccess duplicados', () => {
      const catalogContent = fs.readFileSync(
        path.join(PRIVATE_ROUTES_DIR, 'catalogRoutes.js'),
        'utf8',
      );
      const landContent = fs.readFileSync(
        path.join(PRIVATE_ROUTES_DIR, 'landRoutes.js'),
        'utf8',
      );
      const adminContent = fs.readFileSync(
        path.join(PRIVATE_ROUTES_DIR, 'adminRoutes.js'),
        'utf8',
      );

      [catalogContent, landContent, adminContent].forEach((content) => {
        expect(content).not.toMatch(/router\.use\(\s*isAuthenticated\s*\)/i);
        expect(content).not.toMatch(/router\.use\(\s*requirePanelAccess\s*\)/i);
      });
    });

    it('adminRoutes no aplica requireRole("admin") globalmente a nivel de router', () => {
      const adminContent = fs.readFileSync(
        path.join(PRIVATE_ROUTES_DIR, 'adminRoutes.js'),
        'utf8',
      );

      expect(adminContent).not.toMatch(/adminRouter\.use\(/);
      expect(adminContent).not.toMatch(/router\.use\(\s*requireRole/);
    });
  });
});
