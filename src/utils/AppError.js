'use strict';

// AppError is a custom error class that carries an HTTP status code and a
// machine-readable error code alongside the human-readable message.
//
// WHY a custom class?
//   Express's default error handler can't tell an "intentional" 404 apart from
//   an unexpected crash.  By tagging errors with `isOperational: true` we can
//   let the global error handler send a clean JSON response instead of a 500.
class AppError extends Error {
  /**
   * @param {number} status   - HTTP status code (e.g. 400, 404, 409)
   * @param {string} code     - Machine-readable code (e.g. 'INVALID_URL')
   * @param {string} message  - Human-readable description
   */
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
    // Mark as an expected, intentional error so the error handler doesn't
    // treat it as an unhandled crash and log a full stack trace.
    this.isOperational = true;
  }
}

module.exports = AppError;
