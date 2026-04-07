import { Router } from "express";
import { dashboard } from "../controllers/privateController.js";

const privateRouter = Router();

privateRouter.get("/dashboard", dashboard);

export default privateRouter;