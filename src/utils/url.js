'use strict';

const { HOST } = require('../config/env');
const AppError = require('./AppError');

// Maximum URL length accepted.  2048 chars covers all real-world URLs while
// capping the amount of data we store per link.
const MAX_URL_LENGTH = 2048;

// Reserved aliases that would conflict with existing API routes or static paths.
const RESERVED_ALIASES = new Set(['api', 'health', 'admin', 'static', 'public']);

// Alias must be 3-20 characters using only URL-safe chars.
const ALIAS_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

/**
 * Validate and normalise a submitted URL.
 *
 * Rules (Gap 6 decision, 2026-10-23):
 *  - Trim leading/trailing whitespace.
 *  - Reject empty strings and strings over MAX_URL_LENGTH.
 *  - Parse with the WHATWG URL constructor (built into Node).
 *    This normalises: hostname to lowercase, removes default ports (e.g.
 *    :80 on http), and encodes invalid characters.
 *  - Reject any scheme other than http: or https:.  Never auto-prepend.
 *  - Block URLs whose origin matches this service's own HOST to prevent
 *    redirect loops.
 *  - Preserve path, query, fragment and trailing-slash as submitted.
 *
 * @param {string} rawUrl
 * @returns {string} normalised URL (url.href from WHATWG URL)
 * @throws {AppError} 400 INVALID_URL
 */
function validateUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    throw new AppError(400, 'INVALID_URL', 'url must be a string.');
  }

  const trimmed = rawUrl.trim();

  if (trimmed.length === 0) {
    throw new AppError(400, 'INVALID_URL', 'url is required.');
  }

  if (trimmed.length > MAX_URL_LENGTH) {
    throw new AppError(
      400,
      'INVALID_URL',
      `url must be ${MAX_URL_LENGTH} characters or fewer.`
    );
  }

  // The WHATWG URL constructor throws a TypeError for any invalid URL,
  // including those with missing or malformed schemes.
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new AppError(
      400,
      'INVALID_URL',
      'Enter a full http(s) URL (e.g. https://example.com).'
    );
  }

  // Only http and https are safe redirect targets.  javascript:, data:,
  // vbscript: and others can execute code in the browser.
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new AppError(
      400,
      'INVALID_URL',
      'Only http:// and https:// URLs are accepted.'
    );
  }

  // Prevent redirect loops: block URLs that point back at this service.
  // We compare normalised origins (scheme + host + port). HOST is validated at startup.
  const serviceOrigin = new URL(HOST).origin;
  if (parsed.origin === serviceOrigin) {
    throw new AppError(
      400,
      'INVALID_URL',
      'URLs pointing to this service are not allowed.'
    );
  }

  // Return the WHATWG-normalised URL string.
  // This gives us lowercase hostname, removed default ports, etc.
  return parsed.href;
}

/**
 * Validate a custom alias string.
 *
 * @param {string} alias
 * @throws {AppError} 400 INVALID_ALIAS
 */
function validateAlias(alias) {
  if (!ALIAS_PATTERN.test(alias)) {
    throw new AppError(
      400,
      'INVALID_ALIAS',
      'alias must be 3–20 characters: letters, numbers, hyphens, underscores only.'
    );
  }
  if (RESERVED_ALIASES.has(alias.toLowerCase())) {
    throw new AppError(
      400,
      'INVALID_ALIAS',
      `"${alias}" is a reserved word and cannot be used as an alias.`
    );
  }
}

module.exports = { validateUrl, validateAlias };
