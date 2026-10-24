'use strict';

const request = require('supertest');
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/app');
const Link = require('../src/models/Link');
const Click = require('../src/models/Click');
const { computeUtcDateWindow, getLinkStats } = require('../src/services/stats.service');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
});

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
});

beforeEach(async () => {
  await Link.deleteMany({});
  await Click.deleteMany({});
});

describe('stats.service - computeUtcDateWindow (Deterministic boundaries)', () => {
  it('computes exact 7-day UTC boundaries and ascending dates from a fixed reference date', () => {
    // Reference date: 2026-06-15 at 14:30:00 UTC
    const ref = new Date('2026-06-15T14:30:00.000Z');
    const { startUtc, endExclusiveUtc, dates } = computeUtcDateWindow(ref);

    // startUtc must be 2026-06-09T00:00:00.000Z (6 days before today)
    expect(startUtc.toISOString()).toBe('2026-06-09T00:00:00.000Z');

    // endExclusiveUtc must be 2026-06-16T00:00:00.000Z (start of tomorrow)
    expect(endExclusiveUtc.toISOString()).toBe('2026-06-16T00:00:00.000Z');

    // Exactly 7 ascending dates
    expect(dates).toEqual([
      '2026-06-09',
      '2026-06-10',
      '2026-06-11',
      '2026-06-12',
      '2026-06-13',
      '2026-06-14',
      '2026-06-15',
    ]);
  });
});

describe('stats.service - getLinkStats boundary and zero-fill verification', () => {
  it('accurately includes and excludes clicks based on [startUtc, endExclusiveUtc) interval', async () => {
    const link = await Link.create({
      code: 'boundary-test',
      longUrl: 'https://example.com/target',
      clicks: 10,
    });

    const ref = new Date('2026-06-15T12:00:00.000Z');
    const { startUtc, endExclusiveUtc } = computeUtcDateWindow(ref);

    // 1. Immediately before window start (1 ms before) -> excluded
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(startUtc.getTime() - 1),
    });

    // 2. Exactly at start boundary -> included in dates[0] (2026-06-09)
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(startUtc.getTime()),
    });

    // 3. Middle of period (2026-06-11) -> 2 clicks
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(startUtc.getTime() + 2 * 86400000 + 3600000),
    });
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(startUtc.getTime() + 2 * 86400000 + 7200000),
    });

    // 4. During the final day (2026-06-15) -> included in dates[6]
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(endExclusiveUtc.getTime() - 1000),
    });

    // 5. Exactly at end boundary -> excluded
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(endExclusiveUtc.getTime()),
    });

    // 6. After end boundary -> excluded
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(endExclusiveUtc.getTime() + 10000),
    });

    const stats = await getLinkStats(link.code, ref);

    expect(stats.code).toBe('boundary-test');
    expect(stats.totalClicks).toBe(10); // Atomic Link.clicks
    expect(stats.last7Days).toHaveLength(7);

    expect(stats.last7Days).toEqual([
      { date: '2026-06-09', clicks: 1 }, // Exact start boundary
      { date: '2026-06-10', clicks: 0 }, // Zero-filled
      { date: '2026-06-11', clicks: 2 }, // 2 intermediate clicks
      { date: '2026-06-12', clicks: 0 }, // Zero-filled
      { date: '2026-06-13', clicks: 0 }, // Zero-filled
      { date: '2026-06-14', clicks: 0 }, // Zero-filled
      { date: '2026-06-15', clicks: 1 }, // Final day click
    ]);
  });

  it('returns all zero clicks for a link with no click records', async () => {
    const link = await Link.create({
      code: 'zero-clicks',
      longUrl: 'https://example.com/target',
      clicks: 0,
    });

    const ref = new Date('2026-08-01T00:00:00.000Z');
    const stats = await getLinkStats(link.code, ref);

    expect(stats.totalClicks).toBe(0);
    expect(stats.last7Days).toHaveLength(7);
    stats.last7Days.forEach((item) => {
      expect(item.clicks).toBe(0);
    });
  });

  it('throws 404 NOT_FOUND when link does not exist', async () => {
    await expect(getLinkStats('nonexistent')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
    });
  });
});

describe('GET /api/links/:code/stats HTTP endpoint', () => {
  it('returns 200 with the documented JSON response shape', async () => {
    const link = await Link.create({
      code: 'http-stats-test',
      longUrl: 'https://example.com/site',
      clicks: 5,
    });

    // Seed click for today (current time)
    await Click.create({
      linkId: link._id,
      code: link.code,
      at: new Date(),
    });

    const res = await request(app)
      .get(`/api/links/${link.code}/stats`)
      .expect(200);

    expect(res.body).toHaveProperty('code', 'http-stats-test');
    expect(res.body).toHaveProperty('totalClicks', 5);
    expect(res.body).toHaveProperty('last7Days');
    expect(Array.isArray(res.body.last7Days)).toBe(true);
    expect(res.body.last7Days).toHaveLength(7);

    // Verify ascending order
    for (let i = 1; i < res.body.last7Days.length; i++) {
      expect(res.body.last7Days[i].date > res.body.last7Days[i - 1].date).toBe(true);
    }
  });

  it('returns 400 INVALID_CODE for malformed codes', async () => {
    // Too short (< 3 chars)
    const resShort = await request(app)
      .get('/api/links/ab/stats')
      .expect(400);

    expect(resShort.body).toEqual({
      error: {
        code: 'INVALID_CODE',
        message: expect.stringContaining('3–20 characters'),
      },
    });

    // Invalid characters
    const resInvalid = await request(app)
      .get('/api/links/bad@code!/stats')
      .expect(400);

    expect(resInvalid.body.error.code).toBe('INVALID_CODE');
  });

  it('returns 404 NOT_FOUND for a validly formatted code that does not exist', async () => {
    const res = await request(app)
      .get('/api/links/valid-but-missing/stats')
      .expect(404);

    expect(res.body).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'No link found with code "valid-but-missing".',
      },
    });
  });
});
