'use strict';

const AppError = require('../utils/AppError');

// Code must be 3-20 characters using only URL-safe chars (letters, numbers, hyphens, underscores).
const CODE_PATTERN = /^[A-Za-z0-9_-]{3,20}$/;

/**
 * Middleware to validate :code route parameter.
 *
 * Reusable parameter validator: if :code is missing or malformed, rejects with
 * HTTP 400 INVALID_CODE so services receive clean, safe code parameters.
 */
function validateCodeParam(req, res, next) {
  const { code } = req.params;
  if (!code || !CODE_PATTERN.test(code)) {
    return next(
      new AppError(
        400,
        'INVALID_CODE',
        'code must be 3–20 characters: letters, numbers, hyphens, and underscores only.'
      )
    );
  }
  next();
}

module.exports = { validateCodeParam, CODE_PATTERN };
