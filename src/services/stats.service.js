'use strict';

const Link = require('../models/Link');
const Click = require('../models/Click');
const AppError = require('../utils/AppError');

// WHY UTC DATE BOUNDARIES?
// Users access links globally across many timezones. Using UTC as a single,
// consistent reference ensures that daily click statistics are grouped identically
// for all clients regardless of local server or user time.

/**
 * Compute the 7-day UTC date window and generated date strings.
 *
 * The window represents today in UTC plus the preceding 6 UTC calendar days,
 * evaluated as a start-inclusive, end-exclusive interval [startUtc, endExclusiveUtc).
 *
 * @param {Date} [referenceDate=new Date()] Optional reference date for deterministic testing
 * @returns {{ startUtc: Date, endExclusiveUtc: Date, dates: string[] }}
 */
function computeUtcDateWindow(referenceDate = new Date()) {
  const year = referenceDate.getUTCFullYear();
  const month = referenceDate.getUTCMonth();
  const date = referenceDate.getUTCDate();

  // Start of today in UTC: 00:00:00.000Z
  const todayUtc = Date.UTC(year, month, date);

  // Start boundary: 6 full days before today at 00:00:00.000Z (inclusive)
  const startUtc = new Date(todayUtc - 6 * 86400000);

  // End boundary: start of tomorrow at 00:00:00.000Z (exclusive)
  const endExclusiveUtc = new Date(todayUtc + 86400000);

  // Build the 7 ascending YYYY-MM-DD date strings: [T-6, T-5, T-4, T-3, T-2, T-1, T-0]
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(todayUtc - i * 86400000);
    dates.push(d.toISOString().slice(0, 10));
  }

  return { startUtc, endExclusiveUtc, dates };
}

/**
 * Fetch click analytics for a short link.
 *
 * WHY MONGODB AGGREGATION?
 * MongoDB aggregation pipelines allow us to filter, group, and sum documents
 * directly on the database engine rather than loading thousands of individual
 * click documents into Node.js memory.
 *
 * @param {string} code Short link code
 * @param {Date} [referenceDate=new Date()] Injectable clock for deterministic tests
 * @returns {Promise<{ code: string, totalClicks: number, last7Days: Array<{ date: string, clicks: number }> }>}
 * @throws {AppError} 404 NOT_FOUND
 */
async function getLinkStats(code, referenceDate = new Date()) {
  // 1. Verify link existence
  const link = await Link.findOne({ code }).lean();
  if (!link) {
    throw new AppError(404, 'NOT_FOUND', `No link found with code "${code}".`);
  }

  // 2. Compute date boundaries
  const { startUtc, endExclusiveUtc, dates } = computeUtcDateWindow(referenceDate);

  // 3. Aggregate daily clicks using the compound index { linkId: 1, at: -1 }
  const dailyAgg = await Click.aggregate([
    {
      $match: {
        linkId: link._id,
        at: {
          $gte: startUtc,
          $lt: endExclusiveUtc,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: { format: '%Y-%m-%d', date: '$at', timezone: 'UTC' },
        },
        clicks: { $sum: 1 },
      },
    },
  ]);

  // 4. Zero-fill missing dates
  const countMap = Object.create(null);
  for (const item of dailyAgg) {
    countMap[item._id] = item.clicks;
  }

  const last7Days = dates.map((dateStr) => ({
    date: dateStr,
    clicks: countMap[dateStr] || 0,
  }));

  // totalClicks comes from the authoritative atomic counter Link.clicks
  return {
    code: link.code,
    totalClicks: link.clicks,
    last7Days,
  };
}

module.exports = { getLinkStats, computeUtcDateWindow };
