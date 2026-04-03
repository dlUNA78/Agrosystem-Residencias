import express from "express";
import {
  renderHomeIndex,
  renderPlaguesPublic,
  renderCropsPublic,
  renderProductsPublic,
  renderForumPublic,
} from "../controllers/publicController.js";

const router = express.Router();

// GET /  →  Página de inicio pública
router.get("/", renderHomeIndex);
router.get("/plagues", renderPlaguesPublic);
router.get("/crops", renderCropsPublic);
router.get("/products", renderProductsPublic);
router.get("/forum", renderForumPublic);

export default router;
