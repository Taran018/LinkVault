'use strict';

const Link = require('../models/Link');
const Click = require('../models/Click');
const AppError = require('../utils/AppError');

// WHY DATABASE-SIDE $$NOW?
// MongoDB's `$$NOW` is a built-in system variable that resolves to the database
// server's current datetime when the operation begins execution.
// Using `$$NOW` ensures that link expiration is evaluated directly by the database engine
// rather than relying on application process clocks or in-flight transit times.

/**
 * Atomically validate, record click, and return destination for a short link.
 *
 * @param {object} params
 * @param {string} params.code      - Short link code requested
 * @param {string} [params.userAgent] - HTTP User-Agent header
 * @param {string} [params.referrer]  - HTTP Referer header
 * @returns {Promise<{ targetUrl: string }>}
 * @throws {AppError} 404 NOT_FOUND | 410 EXPIRED
 */
async function getAndTrackRedirect({ code, userAgent, referrer }) {
  // 1. Atomic lookup + click increment on eligible (unexpired) link.
  // The query succeeds only if the code matches AND (expiresAt is null OR expiresAt > $$NOW).
  const link = await Link.findOneAndUpdate(
    {
      code,
      $expr: {
        $or: [
          // Permanent link (null or missing expiresAt)
          { $eq: [{ $ifNull: ['$expiresAt', null] }, null] },
          // Active link (expiresAt strictly in the future according to database time)
          { $gt: ['$expiresAt', '$$NOW'] },
        ],
      },
    },
    { $inc: { clicks: 1 } },
    { returnDocument: 'after' }
  );

  // 2. If eligible link is found: log event (best-effort) and return destination.
  if (link) {
    try {
      await Click.create({
        linkId: link._id,
        code: link.code,
        at: new Date(),
        referrer: referrer ? String(referrer).slice(0, 2048) : null,
        userAgent: userAgent ? String(userAgent).slice(0, 512) : null,
      });
    } catch (err) {
      // Safe error logging: never log sensitive headers or full target URLs.
      console.error(
        `[Click logging warning] Failed to record click event for code "${code}": ${err.message}`
      );
    }

    return { targetUrl: link.longUrl };
  }

  // 3. Link not eligible — distinguish between 404 (not found) and 410 (expired)
  // using consistent database-side $$NOW time comparison.
  const expiredLink = await Link.findOne({
    code,
    $expr: {
      $and: [
        { $ne: [{ $ifNull: ['$expiresAt', null] }, null] },
        { $lte: ['$expiresAt', '$$NOW'] },
      ],
    },
  }).lean();

  if (expiredLink) {
    throw new AppError(410, 'EXPIRED', 'This short link has expired.');
  }

  const anyLink = await Link.findOne({ code }).lean();
  if (!anyLink) {
    throw new AppError(404, 'NOT_FOUND', `No link found with code "${code}".`);
  }

  // Edge-case fallback: link was updated or deleted concurrently between operations
  throw new AppError(404, 'NOT_FOUND', `No link found with code "${code}".`);
}

module.exports = { getAndTrackRedirect };
