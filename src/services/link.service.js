'use strict';

const Link = require('../models/Link');
const { generateCode } = require('../utils/code');
const { validateUrl, validateAlias } = require('../utils/url');
const AppError = require('../utils/AppError');
const { HOST } = require('../config/env');

// Services contain all business logic.  They receive plain values, call the
// database through Mongoose models, and return plain objects or throw AppError.
// They never touch req or res — that's the controller's job.

/**
 * Build the public-facing representation of a link document.
 * shortUrl is computed from HOST + code; it is not stored in MongoDB.
 * status is computed from expiresAt; it is not stored in MongoDB.
 *
 * @param {object} link  - plain object (from .lean()) or Mongoose document
 * @param {boolean} withStatus - include active/expired status (for list endpoint)
 */
function formatLink(link, withStatus = false) {
  const result = {
    code: link.code,
    shortUrl: `${HOST}/${link.code}`,
    longUrl: link.longUrl,
    clicks: link.clicks,
    expiresAt: link.expiresAt,
    createdAt: link.createdAt,
  };
  if (withStatus) {
    result.status =
      link.expiresAt && link.expiresAt < new Date() ? 'expired' : 'active';
  }
  return result;
}

/**
 * Create a new short link.
 *
 * @param {object} params
 * @param {string} params.url       - long URL submitted by the user
 * @param {string} [params.alias]   - optional custom short code
 * @param {string} [params.expiresAt] - optional ISO-8601 expiry date string
 * @returns {object} formatted link
 * @throws {AppError} 400 INVALID_URL | INVALID_ALIAS | INVALID_EXPIRY
 * @throws {AppError} 409 ALIAS_TAKEN
 */
async function createLink({ url, alias, expiresAt }) {
  // Validate and normalise the long URL.
  const longUrl = validateUrl(url);

  // Validate alias if provided.
  if (alias !== undefined && alias !== null && alias !== '') {
    validateAlias(alias);
  } else {
    alias = null; // normalise absent/empty alias to null
  }

  // Validate expiry date if provided.
  let expiry = null;
  if (expiresAt) {
    expiry = new Date(expiresAt);
    if (isNaN(expiry.getTime())) {
      throw new AppError(
        400,
        'INVALID_EXPIRY',
        'expiresAt must be a valid ISO 8601 date string (e.g. 2026-12-31T18:30:00Z).'
      );
    }
    if (expiry <= new Date()) {
      throw new AppError(
        400,
        'INVALID_EXPIRY',
        'expiresAt must be a date in the future.'
      );
    }
  }

  const code = alias || generateCode();

  try {
    const link = await Link.create({ code, longUrl, expiresAt: expiry });
    return formatLink(link);
  } catch (err) {
    // MongoDB duplicate-key error code.
    // WHY err.code === 11000?
    //   MongoDB signals a unique index violation with this numeric code.
    //   We catch it here and convert it to a meaningful HTTP error.
    if (err.code === 11000) {
      if (alias) {
        // User chose an alias that is already taken — tell them explicitly.
        throw new AppError(
          409,
          'ALIAS_TAKEN',
          `The alias "${alias}" is already in use. Please choose a different one.`
        );
      }
      // Auto-generated code collided (extremely rare with 7-char nanoid).
      // Retry once with a fresh code.
      const retryCode = generateCode();
      const link = await Link.create({ code: retryCode, longUrl, expiresAt: expiry });
      return formatLink(link);
    }
    throw err;
  }
}

/**
 * Return all links, newest first, max 100.
 *
 * @returns {object[]} formatted links with `status` field
 */
async function listLinks() {
  // .lean() returns plain JS objects instead of full Mongoose documents.
  // It is faster for read-only operations because Mongoose skips building
  // its change-tracking machinery.
  const links = await Link.find().sort({ createdAt: -1 }).limit(100).lean();
  return links.map(link => formatLink(link, true));
}

/**
 * Delete a link by its short code.
 *
 * @param {string} code
 * @throws {AppError} 404 NOT_FOUND
 */
async function deleteLinkByCode(code) {
  const deleted = await Link.findOneAndDelete({ code });
  if (!deleted) {
    throw new AppError(404, 'NOT_FOUND', `No link found with code "${code}".`);
  }
}

module.exports = { createLink, listLinks, deleteLinkByCode };
