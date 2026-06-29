import { Router } from "express";
import { upload } from "../middlewares/upload.js";
import {
  getCropDetail,
  getGlyphomaxDetail,
  createProduct,
  deleteProduct,
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
privateRouter.post(
  "/private/products/create",
  upload.single("image"),
  createProduct,
);
privateRouter.get("/private/products/glyphomax-pro-480", getGlyphomaxDetail);
privateRouter.get("/private/reports", reportsPrivate);
privateRouter.get("/private/ingredients", ingredientsPrivate);
privateRouter.get("/private/users", usersPrivate);
privateRouter.get("/private/suppliers", suppliersPrivate);
privateRouter.get("/private/audit", auditPrivate);

export default privateRouter;
