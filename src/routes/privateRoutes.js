import { Router } from "express";
import { dashboard, plaguesPrivate, cropsPrivate, landsPrivate, landDetail, productsPrivate } from "../controllers/privateController.js";

const privateRouter = Router();

privateRouter.get("/dashboard", dashboard);
privateRouter.get("/private/plagues", plaguesPrivate);
privateRouter.get("/private/crops", cropsPrivate);
privateRouter.get("/private/lands", landsPrivate);
privateRouter.get("/private/lands/:id/expediente", landDetail);
privateRouter.get("/private/products", productsPrivate);

export default privateRouter;
