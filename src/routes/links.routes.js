'use strict';

const { Router } = require('express');
const {
  createLink,
  listLinks,
  getLinkStats,
  deleteLink,
} = require('../controllers/links.controller');
const { linkCreateLimiter } = require('../middleware/rateLimit');
const { validateCodeParam } = require('../middleware/validate');

const router = Router();

// POST /api/links  — create a new short link (rate-limited to 30 req/min)
router.post('/api/links', linkCreateLimiter, createLink);

// GET /api/links   — list all links (newest first, max 100)
router.get('/api/links', listLinks);

// GET /api/links/:code/stats — 7-day click analytics
router.get('/api/links/:code/stats', validateCodeParam, getLinkStats);

// DELETE /api/links/:code  — delete a link by its short code
router.delete('/api/links/:code', deleteLink);

module.exports = router;
