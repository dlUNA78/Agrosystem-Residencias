import express from "express";
import { renderHomeIndex }                        from "../controllers/public/homeController.js";
import { renderPlaguesPublic, renderPlagueDetail, getPlaguesData } from "../controllers/public/plagueController.js";
import { renderCropsPublic, renderCropDetail }     from "../controllers/public/cropController.js";
import { renderProductsPublic, renderProductDetail } from "../controllers/public/productController.js";
import { renderForumPublic }                      from "../controllers/public/forumController.js";

const publicRouter = express.Router();

publicRouter.get("/",              renderHomeIndex);
publicRouter.get("/api/plagues",   getPlaguesData);
publicRouter.get("/plagues",       renderPlaguesPublic);
publicRouter.get("/plagues/:id",   renderPlagueDetail);   // ⚠️ después de /plagues
publicRouter.get("/crops",         renderCropsPublic);
publicRouter.get("/crops/:id",     renderCropDetail);
publicRouter.get("/products",      renderProductsPublic);
publicRouter.get("/products/:id",  renderProductDetail);
publicRouter.get("/forum",         renderForumPublic);

export default publicRouter;