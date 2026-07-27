import { Router } from "express";
import { upload, uploadPlague, uploadCrop } from "../middlewares/upload.js";
import {
  dashboard,
  landsPrivate,
  landDetail,
  ingredientsPrivate,
  reportsPrivate,
  usersPrivate,
  auditPrivate,
} from "../controllers/privateController.js";

import {suppliersPrivate, createSupplier, updateSupplier, deleteSupplier} from "../controllers/private/provedoresController.js";

import {cropsPrivate, getCropDetail, createCrop, updateCrop, deleteCrop} from "../controllers/private/cropController.js";

import {plaguesPrivate, getPestDetail, createPlague, updatePlague, deletePlague, } from "../controllers/private/plagueController.js";

import {productsPrivate, createProduct, updateProduct, deleteProduct, getGlyphomaxDetail} from "../controllers/private/productController.js";

import { isAuthenticated, requirePanelAccess } from "../middlewares/authMiddleware.js";

const privateRouter = Router();

privateRouter.use(isAuthenticated);
privateRouter.use(requirePanelAccess);

privateRouter.get("/dashboard", dashboard);
privateRouter.get("/private/plagues", plaguesPrivate);
privateRouter.get("/private/plagues/pulgon-verde", getPestDetail);
privateRouter.get("/private/crops", cropsPrivate);
privateRouter.get("/private/crops/:id", getCropDetail);
privateRouter.post("/private/crops/create", uploadCrop.array("images", 10), createCrop);
privateRouter.post("/private/crops/update/:id", uploadCrop.array("images", 10), updateCrop);
privateRouter.post("/private/crops/delete/:id", deleteCrop);
privateRouter.get("/private/lands", landsPrivate);
privateRouter.get("/private/lands/:id/expediente", landDetail);
privateRouter.get("/private/products", productsPrivate);
privateRouter.post("/private/products/delete/:id", deleteProduct);
privateRouter.post("/private/products/create", upload.single("image"), createProduct,);
privateRouter.post("/private/plagues/create", uploadPlague.single("image"), createPlague);
privateRouter.post("/private/plagues/update/:id", uploadPlague.single("image"), updatePlague);
privateRouter.post("/private/plagues/delete/:id", deletePlague);
privateRouter.post("/private/products/update/:id", upload.single("image"), updateProduct);
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
