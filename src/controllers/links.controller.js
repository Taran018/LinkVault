'use strict';

const linkService = require('../services/link.service');
const statsService = require('../services/stats.service');

// Controllers are thin: parse the request, call a service, send the response.
// They never touch the database directly and never contain business logic.

/**
 * POST /api/links
 * Body: { url, alias?, expiresAt? }
 * Response 201: link object
 */
async function createLink(req, res, next) {
  try {
    const { url, alias, expiresAt } = req.body;
    const link = await linkService.createLink({ url, alias, expiresAt });
    res.status(201).json(link);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/links
 * Response 200: { links: [...] }
 */
async function listLinks(req, res, next) {
  try {
    const links = await linkService.listLinks();
    res.status(200).json({ links });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/links/:code/stats
 * Response 200: { code, totalClicks, last7Days: [...] }
 */
async function getLinkStats(req, res, next) {
  try {
    const stats = await statsService.getLinkStats(req.params.code);
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/links/:code
 * Response 204: no body
 */
async function deleteLink(req, res, next) {
  try {
    await linkService.deleteLinkByCode(req.params.code);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}

module.exports = { createLink, listLinks, getLinkStats, deleteLink };

