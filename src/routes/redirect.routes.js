'use strict';

const { Router } = require('express');
const { handleRedirect } = require('../controllers/redirect.controller');

const router = Router();

// GET /:code — redirect to original longUrl and track click event
router.get('/:code', handleRedirect);

module.exports = router;
