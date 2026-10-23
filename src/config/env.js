'use strict';

// dotenv reads the .env file and puts every key into process.env so the rest
// of the app can access secrets without hard-coding them in source files.
require('dotenv').config();

// Fail fast: if MONGO_URI is missing, throw during startup so the developer
// sees a clear message instead of a cryptic Mongoose connection error later.
if (!process.env.MONGO_URI) {
  throw new Error(
    'Missing MONGO_URI in .env.  Copy .env.example to .env and fill it in.'
  );
}

/**
 * Validate and normalize the HOST configuration value.
 *
 * Rules:
 *  - Must be a valid absolute URL.
 *  - Protocol must be http: or https:.
 *  - No credentials (username / password).
 *  - No path other than empty or '/' (e.g. reject /prefix).
 *  - No query string (?foo=bar).
 *  - No fragment (#section).
 *  - Normalized to its origin (scheme + host[:port]).
 *
 * @param {string} rawHost
 * @returns {string} normalized origin (e.g. 'http://localhost:3000')
 * @throws {Error} on any validation failure
 */
function validateHost(rawHost) {
  if (typeof rawHost !== 'string' || rawHost.trim().length === 0) {
    throw new Error('HOST must be a non-empty string.');
  }

  const trimmed = rawHost.trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(
      `Invalid HOST "${trimmed}": must be a valid absolute URL (e.g. http://localhost:3000 or https://linkvault.onrender.com).`
    );
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error(
      `Invalid HOST "${trimmed}": protocol must be "http:" or "https:", received "${parsed.protocol}".`
    );
  }

  if (parsed.username || parsed.password) {
    throw new Error(
      `Invalid HOST "${trimmed}": must not contain credentials (username/password).`
    );
  }

  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    throw new Error(
      `Invalid HOST "${trimmed}": must not contain a path component (received "${parsed.pathname}").`
    );
  }

  if (parsed.search) {
    throw new Error(
      `Invalid HOST "${trimmed}": must not contain query parameters (received "${parsed.search}").`
    );
  }

  if (parsed.hash) {
    throw new Error(
      `Invalid HOST "${trimmed}": must not contain a fragment (received "${parsed.hash}").`
    );
  }

  return parsed.origin;
}

const validatedHost = validateHost(process.env.HOST || 'http://localhost:3000');

const env = {
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  MONGO_URI: process.env.MONGO_URI,
  // HOST is the public base URL, used when building short links and to reject
  // URLs that would redirect back to this service (redirect-loop prevention).
  HOST: validatedHost,
  validateHost,
};

module.exports = env;

