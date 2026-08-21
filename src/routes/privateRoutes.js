import { Router } from 'express';

// ─── Middlewares de subida de archivos ────────────────────────────────────────
// upload        → imágenes genéricas (productos)
// uploadPlague  → imágenes de plagas
// uploadCrop    → imágenes de cultivos (acepta múltiples archivos)
import { upload, uploadPlague, uploadCrop } from '../middlewares/upload.js';

// ─── Controladores del módulo principal (privateController) ───────────────────
// Contiene todos los handlers que aún no han sido extraídos a sub-controladores
import {
  // Vistas de panel
  dashboard,
  ingredientsPrivate,
  reportsPrivate,
  // Auditoría
  auditPrivate,
} from '../controllers/privateController.js';

// ─── Controladores del módulo de plagas (sub-controlador modular) ────────────
import {
  plaguesPrivate,
  getPlagueDetail,
  createPlague,
  updatePlague,
  deletePlague,
} from '../controllers/private/plagueController.js';

// ─── Controladores del módulo de proveedores (sub-controlador modular) ────────
import {
  suppliersPrivate,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../controllers/private/provedoresController.js';

// ─── Controladores del módulo de cultivos (sub-controlador modular) ────────────
import {
  cropsPrivate,
  getCropDetail,
  createCrop,
  updateCrop,
  deleteCrop,
} from '../controllers/private/cropsController.js';

// ─── Controladores del módulo de productos (sub-controlador modular) ────────────
import {
  productsPrivate,
  getProductDetail,
  createProduct,
  updateProduct,
  deleteProduct,
} from '../controllers/private/productsController.js';

// ─── Controladores del módulo de parcelas (sub-controlador modular) ────────────
import {
  renderLandsPrivate, // Lista todas las parcelas
  landDetail, // Expediente detallado de una parcela por ID
  createFarmPrivate, // Crea una nueva parcela/granja
} from '../controllers/private/landsController.js';

// ─── Middlewares de autenticación y autorización ──────────────────────────────
// isAuthenticated   → verifica que el usuario tenga sesión activa
// requirePanelAccess → verifica que el usuario tenga rol con acceso al panel privado
import {
  isAuthenticated,
  requirePanelAccess,
} from '../middlewares/authMiddleware.js';

// ─── Instancia del router privado ─────────────────────────────────────────────
const privateRouter = Router();

// Aplica el middleware de verificación de sesión activa a TODAS las rutas
privateRouter.use(isAuthenticated);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PERFIL PÚBLICO (Accesible para cualquier usuario autenticado)
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/profile', renderProfile);
privateRouter.post('/profile', updateProfile);

// Aplica el bloqueo del panel privado (Solo INIFAP y Admin a partir de este punto)
privateRouter.use(requirePanelAccess);

// Perfil dentro del Panel Privado (Solo INIFAP y Admin)
privateRouter.get('/private/profile', renderProfile);
privateRouter.post('/private/profile', updateProfile);

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
// Pantalla principal del panel de administración
privateRouter.get('/dashboard', dashboard);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: CULTIVOS
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/crops', cropsPrivate); // Lista todos los cultivos
privateRouter.get('/private/catalog/crops', cropsPrivate); // Alias catálogo cultivos
privateRouter.get('/private/crops/:id', getCropDetail); // Detalle de un cultivo por ID
privateRouter.post(
  '/private/crops/create',
  uploadCrop.array('images', 10),
  createCrop,
); // Crear cultivo (hasta 10 imágenes)
privateRouter.post(
  '/private/crops/update/:id',
  uploadCrop.array('images', 10),
  updateCrop,
); // Actualizar cultivo
privateRouter.post('/private/crops/delete/:id', deleteCrop); // Eliminar cultivo

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PARCELAS / GRANJAS
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/lands', renderLandsPrivate); // Lista de parcelas (ruta con prefijo /private)
privateRouter.get('/private/lands/:id/expediente', landDetail); // Expediente de una parcela específica
privateRouter.get('/lands', renderLandsPrivate); // Alias de lista de parcelas (sin prefijo)
privateRouter.post('/lands/create', createFarmPrivate); // Crear nueva parcela

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PLAGAS
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/plagues', plaguesPrivate); // Lista todas las plagas
privateRouter.get('/private/catalog/plagues', plaguesPrivate); // Alias catálogo plagas
privateRouter.get('/private/plagues/:id', getPlagueDetail); // Detalle de una plaga específica
privateRouter.post(
  '/private/plagues/create',
  uploadPlague.single('image'),
  createPlague,
); // Crear plaga (1 imagen)
privateRouter.post(
  '/private/plagues/update/:id',
  uploadPlague.single('image'),
  updatePlague,
); // Actualizar plaga
privateRouter.post('/private/plagues/delete/:id', deletePlague); // Eliminar plaga

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PRODUCTOS AGROQUÍMICOS
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/products', productsPrivate); // Lista todos los productos
privateRouter.get('/private/catalog/products', productsPrivate); // Alias catálogo productos
privateRouter.get('/private/products/:id', getProductDetail); // Detalle de producto por ID
privateRouter.post(
  '/private/products/create',
  upload.single('image'),
  createProduct,
); // Crear producto (1 imagen genérica)
privateRouter.post(
  '/private/products/update/:id',
  upload.single('image'),
  updateProduct,
); // Actualizar producto
privateRouter.post('/private/products/delete/:id', deleteProduct); // Eliminar producto

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: INGREDIENTES
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/ingredients', ingredientsPrivate); // Lista de ingredientes activos

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PROVEEDORES
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/suppliers', suppliersPrivate); // Lista todos los proveedores
privateRouter.post('/private/suppliers/create', createSupplier); // Crear proveedor
privateRouter.post('/private/suppliers/update/:id', updateSupplier); // Actualizar proveedor
privateRouter.post('/private/suppliers/delete/:id', deleteSupplier); // Eliminar proveedor

// ─── Controladores del módulo de usuarios (sub-controlador modular) ────────────
import {
  usersPrivate,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
  renderProfile,
  updateProfile,
} from '../controllers/private/usersController.js';

import { requireRole } from '../middlewares/authMiddleware.js';

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: USUARIOS (Admin Only)
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/users', requireRole('admin'), usersPrivate);
privateRouter.post('/private/users/create', requireRole('admin'), createUser);
privateRouter.post('/private/users/edit/:id', requireRole('admin'), updateUser);
privateRouter.post(
  '/private/users/status/:id',
  requireRole('admin'),
  updateUserStatus,
);
privateRouter.post(
  '/private/users/delete/:id',
  requireRole('admin'),
  deleteUser,
);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: REPORTES
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/reports', reportsPrivate); // Vista de reportes y estadísticas

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: AUDITORÍA
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/audit', auditPrivate); // Registro de actividad y bitácora del sistema

export default privateRouter;
