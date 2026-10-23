'use strict';

const { Router } = require('express');
const { getHealth } = require('../controllers/health.controller');

const router = Router();

// GET /health
// Used by monitoring services and developers to confirm the server is running.
router.get('/health', getHealth);

module.exports = router;
