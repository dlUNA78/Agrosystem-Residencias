import { Router } from 'express';

import { requireRole } from '../../middlewares/authMiddleware.js';
import {
  suppliersPrivate,
  createSupplier,
  updateSupplier,
  deleteSupplier,
} from '../../controllers/private/suppliersController.js';
import {
  usersPrivate,
  createUser,
  updateUser,
  updateUserStatus,
  deleteUser,
} from '../../controllers/private/usersController.js';
import { reportsPrivate } from '../../controllers/private/reportsController.js';
import { auditPrivate } from '../../controllers/private/auditController.js';

const adminRouter = Router();

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: PROVEEDORES
// ══════════════════════════════════════════════════════════════════════════════
adminRouter.get('/private/suppliers', suppliersPrivate);
adminRouter.post('/private/suppliers/create', createSupplier);
adminRouter.post('/private/suppliers/update/:id', updateSupplier);
adminRouter.post('/private/suppliers/delete/:id', deleteSupplier);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: USUARIOS (Admin Only)
// ══════════════════════════════════════════════════════════════════════════════
adminRouter.get('/private/users', requireRole('admin'), usersPrivate);
adminRouter.post('/private/users/create', requireRole('admin'), createUser);
adminRouter.post('/private/users/edit/:id', requireRole('admin'), updateUser);
adminRouter.post(
  '/private/users/status/:id',
  requireRole('admin'),
  updateUserStatus,
);
adminRouter.post('/private/users/delete/:id', requireRole('admin'), deleteUser);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: REPORTES
// ══════════════════════════════════════════════════════════════════════════════
adminRouter.get('/private/reports', reportsPrivate);

// ══════════════════════════════════════════════════════════════════════════════
// MÓDULO: AUDITORÍA
// ══════════════════════════════════════════════════════════════════════════════
adminRouter.get('/private/audit', auditPrivate);

export default adminRouter;
