'use strict';

// Global error handler middleware.
// Express recognises a 4-argument function as an error handler — the extra
// first argument (`err`) receives whatever was passed to `next(err)`.
//
// We distinguish two kinds of errors:
//   Operational  – thrown intentionally with AppError (bad input, not found…)
//   Programming  – unexpected bugs (undefined variable, DB schema mismatch…)
//
// Both return the same JSON shape so the frontend always knows what to expect.
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // Default to 500 Internal Server Error for unexpected problems.
  const status = err.isOperational ? err.status : 500;
  const code = err.isOperational ? err.code : 'INTERNAL_ERROR';
  const message = err.isOperational
    ? err.message
    : 'Something went wrong. Please try again.';

  // Only log the full stack for unexpected errors — operational errors are
  // intentional so a stack trace would just be noise in the logs.
  if (!err.isOperational) {
    console.error('[Unhandled error]', err);
  }

  res.status(status).json({ error: { code, message } });
}

module.exports = errorHandler;
