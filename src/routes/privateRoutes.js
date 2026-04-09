import { Router } from "express";
import { dashboard, plaguesPrivate } from "../controllers/privateController.js";

const privateRouter = Router();

privateRouter.get("/dashboard", dashboard);
privateRouter.get("/private/plagues", plaguesPrivate);

export default privateRouter;
