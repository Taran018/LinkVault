'use strict';

// nanoid v3 supports CommonJS require().  nanoid v4+ switched to ESM only,
// which would require adding "type":"module" to package.json and rewriting
// all files.  We pin to v3 to stay compatible with the CommonJS stack.
const { nanoid } = require('nanoid');

// The default nanoid alphabet is: A-Za-z0-9_-  (64 URL-safe characters).
// At 7 characters the number of possible codes is 64^7 ≈ 4.4 trillion,
// making accidental collisions astronomically unlikely.
const CODE_LENGTH = 7;

/**
 * Generate a random 7-character URL-safe short code.
 * @returns {string}
 */
function generateCode() {
  return nanoid(CODE_LENGTH);
}

module.exports = { generateCode };
