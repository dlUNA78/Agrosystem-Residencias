import express from 'express';
import { homeIndex } from '../controllers/homePublicController.js';

const router = express.Router();

// GET /  →  Página de inicio pública
router.get('/', homeIndex);

export default router;
