'use strict';

// api.js — thin fetch wrapper for the LinkVault API.
//
// This module has NO DOM access. Every exported function either returns
// a parsed JSON value on success, or throws a plain Error on failure.
// All error messages come from the server's error.message field where
// available, falling back to the HTTP status text.
//
// Why a separate module?
//   Keeping network logic here means app.js only deals with the DOM.
//   If the API base URL or error shape ever changes, we update one file.

const BASE = ''; // same origin — Express serves both API and frontend

/**
 * Core fetch wrapper.
 *
 * @param {string} method  HTTP verb ('GET', 'POST', 'DELETE', …)
 * @param {string} path    Absolute path, e.g. '/api/links'
 * @param {object} [body]  Optional request body (will be JSON-stringified)
 * @returns {Promise<any>} Parsed JSON response body, or undefined for 204
 * @throws {Error} On network failure or non-2xx HTTP status
 */
async function request(method, path, body) {
  const options = {
    method,
    headers: { 'Content-Type': 'application/json' },
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(BASE + path, options);
  } catch {
    // fetch() itself only throws on a network-level failure
    // (e.g. no connection, DNS failure), not on HTTP error status codes.
    throw new Error('Network error – check your connection and try again.');
  }

  // 204 No Content (DELETE success) has no body to parse.
  if (response.status === 204) {
    return undefined;
  }

  let json;
  try {
    json = await response.json();
  } catch {
    throw new Error(`Server returned an unexpected response (HTTP ${response.status}).`);
  }

  if (!response.ok) {
    // The API always returns { error: { code, message } } on failure.
    const msg = json?.error?.message ?? `Request failed (HTTP ${response.status}).`;
    throw new Error(msg);
  }

  return json;
}

/**
 * Create a new short link.
 *
 * @param {{ url: string, alias?: string, expiresAt?: string }} params
 * @returns {Promise<object>} Created link object from the server
 */
export async function createLink({ url, alias, expiresAt }) {
  const body = { url };
  // Only include optional fields when the user actually supplied them.
  if (alias) body.alias = alias;
  if (expiresAt) body.expiresAt = expiresAt;
  return request('POST', '/api/links', body);
}

/**
 * Fetch all links (newest first, max 100).
 *
 * @returns {Promise<{ links: object[] }>}
 */
export async function listLinks() {
  return request('GET', '/api/links');
}

/**
 * Delete a link by its short code.
 *
 * @param {string} code
 * @returns {Promise<undefined>} Resolves on 204 success
 */
export async function deleteLink(code) {
  return request('DELETE', `/api/links/${encodeURIComponent(code)}`);
}
