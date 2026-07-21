import { Router } from "express";
import { upload, uploadPlague } from "../middlewares/upload.js";
import {
  getCropDetail,
  getGlyphomaxDetail,
  createProduct,
  updateProduct,
  deleteProduct,
  createPlague,
  updatePlague,
  deletePlague,
  getPestDetail,
  dashboard,
  plaguesPrivate,
  cropsPrivate,
  landsPrivate,
  landDetail,
  productsPrivate,
  ingredientsPrivate,
  reportsPrivate,
  usersPrivate,
  suppliersPrivate,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  auditPrivate,
} from "../controllers/privateController.js";
import { isAuthenticated, requirePanelAccess } from "../middlewares/authMiddleware.js";

const privateRouter = Router();

privateRouter.use(isAuthenticated);
privateRouter.use(requirePanelAccess);

privateRouter.get("/dashboard", dashboard);
privateRouter.get("/private/plagues", plaguesPrivate);
privateRouter.get("/private/plagues/pulgon-verde", getPestDetail);
privateRouter.get("/private/crops", cropsPrivate);
privateRouter.get("/private/crops/maiz", getCropDetail);
privateRouter.get("/private/lands", landsPrivate);
privateRouter.get("/private/lands/:id/expediente", landDetail);
privateRouter.get("/private/products", productsPrivate);
privateRouter.post("/private/products/delete/:id", deleteProduct);
privateRouter.post("/private/products/create", upload.single("image"), createProduct,);
privateRouter.post("/private/plagues/create", uploadPlague.single("image"), createPlague);
privateRouter.post("/private/plagues/update/:id", uploadPlague.single("image"), updatePlague);
privateRouter.post("/private/plagues/delete/:id", deletePlague);
privateRouter.post("/private/products/update/:id",upload.single("image"), updateProduct);
privateRouter.get("/private/products/glyphomax-pro-480", getGlyphomaxDetail);
privateRouter.get("/private/reports", reportsPrivate);
privateRouter.get("/private/ingredients", ingredientsPrivate);
privateRouter.get("/private/users", usersPrivate);
privateRouter.get("/private/suppliers", suppliersPrivate);
privateRouter.post("/private/suppliers/create", createSupplier);
privateRouter.post("/private/suppliers/update/:id", updateSupplier);
privateRouter.post("/private/suppliers/delete/:id", deleteSupplier);
privateRouter.get("/private/audit", auditPrivate);

export default privateRouter;
