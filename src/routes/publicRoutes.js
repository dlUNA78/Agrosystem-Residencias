'use strict';

const express = require('express');
const router  = express.Router();

const { homeIndex } = require('../controllers/homePublicController');

// GET /  →  Página de inicio pública
router.get('/', homeIndex);

module.exports = router;
