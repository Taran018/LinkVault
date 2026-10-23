'use strict';

const { Router } = require('express');
const { createLink, listLinks, deleteLink } = require('../controllers/links.controller');

const router = Router();

// POST /api/links  — create a new short link
router.post('/api/links', createLink);

// GET /api/links   — list all links (newest first, max 100)
router.get('/api/links', listLinks);

// DELETE /api/links/:code  — delete a link by its short code
router.delete('/api/links/:code', deleteLink);

module.exports = router;
