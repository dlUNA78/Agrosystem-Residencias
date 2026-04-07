import express from "express";
import {
  renderHomeIndex,
  renderPlaguesPublic,
  renderCropsPublic,
  renderProductsPublic,
  renderForumPublic,
} from "../controllers/publicController.js";

const publicRouter = express.Router();

// GET /  →  Página de inicio pública
publicRouter.get("/", renderHomeIndex);
publicRouter.get("/plagues", renderPlaguesPublic);
publicRouter.get("/crops", renderCropsPublic);
publicRouter.get("/products", renderProductsPublic);
publicRouter.get("/forum", renderForumPublic);

export default publicRouter;
