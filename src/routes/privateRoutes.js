import { Router } from 'express';

// ─── Middlewares de subida de archivos ────────────────────────────────────────
// upload        → imágenes genéricas (productos)
// uploadPlague  → imágenes de plagas
// uploadCrop    → imágenes de cultivos (acepta múltiples archivos)
import { upload, uploadPlague, uploadCrop } from '../middlewares/upload.js';

// ─── Controladores del módulo principal (privateController) ───────────────────
// Contiene todos los handlers que aún no han sido extraídos a sub-controladores
import {
  // Plagas
  createPlague,
  updatePlague,
  deletePlague,
  getPestDetail,
  // Vistas de panel
  dashboard,
  plaguesPrivate,
  ingredientsPrivate,
  reportsPrivate,
  usersPrivate,
  suppliersPrivate,
  // Proveedores
  createSupplier,
  updateSupplier,
  deleteSupplier,
  // Auditoría
  auditPrivate,
} from '../controllers/privateController.js';

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

// Aplica los middlewares de seguridad a TODAS las rutas de este router
privateRouter.use(isAuthenticated);
privateRouter.use(requirePanelAccess);

// ══════════════════════════════════════════════════════════════════════════════
// DASHBOARD
// ══════════════════════════════════════════════════════════════════════════════
// Pantalla principal del panel de administración
privateRouter.get('/dashboard', dashboard);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: CULTIVOS
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/crops', cropsPrivate); // Lista todos los cultivos
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
privateRouter.get('/private/plagues/pulgon-verde', getPestDetail); // Detalle hardcoded de plaga (pulgón verde)
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

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: USUARIOS
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/users', usersPrivate); // Lista todos los usuarios del sistema

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: REPORTES
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/reports', reportsPrivate); // Vista de reportes y estadísticas

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: AUDITORÍA
// ══════════════════════════════════════════════════════════════════════════════
privateRouter.get('/private/audit', auditPrivate); // Registro de actividad y bitácora del sistema

export default privateRouter;
