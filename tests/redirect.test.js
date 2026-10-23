'use strict';

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');
const Link = require('../src/models/Link');
const Click = require('../src/models/Click');

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  await mongoose.connect(mongod.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
}, 30000);

beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

describe('GET /:code — Redirect and Click Tracking', () => {
  describe('Successful redirection', () => {
    it('redirects with HTTP 302 to the longUrl for an active link', async () => {
      const link = await Link.create({
        code: 'google',
        longUrl: 'https://www.google.com',
      });

      const res = await request(app).get('/google');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://www.google.com');

      // Verify click count was incremented atomically
      const updated = await Link.findById(link._id);
      expect(updated.clicks).toBe(1);

      // Verify Click event document was created
      const clickDoc = await Click.findOne({ linkId: link._id });
      expect(clickDoc).not.toBeNull();
      expect(clickDoc.linkId.toString()).toBe(link._id.toString());
      expect(clickDoc.code).toBe('google');
      expect(clickDoc.at).toBeInstanceOf(Date);
    });

    it('records User-Agent and Referrer headers in Click document', async () => {
      const link = await Link.create({
        code: 'ua-test',
        longUrl: 'https://example.com/ua',
      });

      const res = await request(app)
        .get('/ua-test')
        .set('User-Agent', 'CustomTestAgent/1.0')
        .set('Referer', 'https://news.ycombinator.com/');

      expect(res.status).toBe(302);

      const clickDoc = await Click.findOne({ linkId: link._id });
      expect(clickDoc.userAgent).toBe('CustomTestAgent/1.0');
      expect(clickDoc.referrer).toBe('https://news.ycombinator.com/');
    });

    it('handles missing User-Agent and Referer gracefully (defaults to null)', async () => {
      const link = await Link.create({
        code: 'no-headers',
        longUrl: 'https://example.com/no-headers',
      });

      const res = await request(app).get('/no-headers');

      expect(res.status).toBe(302);

      const clickDoc = await Click.findOne({ linkId: link._id });
      expect(clickDoc.userAgent).toBeNull();
      expect(clickDoc.referrer).toBeNull();
    });

    it('truncates oversized User-Agent and Referer headers to schema limits', async () => {
      const link = await Link.create({
        code: 'long-headers',
        longUrl: 'https://example.com/long-headers',
      });

      const longUa = 'A'.repeat(600); // schema limit 512
      const longRef = 'https://example.com/' + 'b'.repeat(2100); // schema limit 2048

      const res = await request(app)
        .get('/long-headers')
        .set('User-Agent', longUa)
        .set('Referer', longRef);

      expect(res.status).toBe(302);

      const clickDoc = await Click.findOne({ linkId: link._id });
      expect(clickDoc.userAgent).toHaveLength(512);
      expect(clickDoc.referrer).toHaveLength(2048);
    });

    it('always issues HTTP 302 regardless of the client Accept header', async () => {
      await Link.create({ code: 'accept-html', longUrl: 'https://example.com/html' });
      await Link.create({ code: 'accept-json', longUrl: 'https://example.com/json' });
      await Link.create({ code: 'accept-all', longUrl: 'https://example.com/all' });

      const resHtml = await request(app).get('/accept-html').set('Accept', 'text/html');
      expect(resHtml.status).toBe(302);
      expect(resHtml.headers.location).toBe('https://example.com/html');

      const resJson = await request(app).get('/accept-json').set('Accept', 'application/json');
      expect(resJson.status).toBe(302);
      expect(resJson.headers.location).toBe('https://example.com/json');

      const resAll = await request(app).get('/accept-all').set('Accept', '*/*');
      expect(resAll.status).toBe(302);
      expect(resAll.headers.location).toBe('https://example.com/all');
    });

    it('successfully redirects for permanent links (expiresAt: null)', async () => {
      const link = await Link.create({
        code: 'permanent',
        longUrl: 'https://example.com/permanent',
        expiresAt: null,
      });

      const res = await request(app).get('/permanent');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://example.com/permanent');

      const updated = await Link.findById(link._id);
      expect(updated.clicks).toBe(1);
    });

    it('successfully redirects for links with future expiry', async () => {
      const link = await Link.create({
        code: 'future-link',
        longUrl: 'https://example.com/future',
        expiresAt: new Date(Date.now() + 86400000), // +1 day
      });

      const res = await request(app).get('/future-link');
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://example.com/future');

      const updated = await Link.findById(link._id);
      expect(updated.clicks).toBe(1);
    });
  });

  describe('Atomic concurrency', () => {
    it('correctly increments click count and logs separate events under concurrent requests', async () => {
      const link = await Link.create({
        code: 'concurrent',
        longUrl: 'https://example.com/concurrent',
      });

      // Fire 10 simultaneous requests
      await Promise.all(
        Array.from({ length: 10 }, () => request(app).get('/concurrent'))
      );

      const updated = await Link.findById(link._id);
      expect(updated.clicks).toBe(10);

      const clickCount = await Click.countDocuments({ linkId: link._id });
      expect(clickCount).toBe(10);
    });
  });

  describe('Click event failure handling (best-effort)', () => {
    it('still returns HTTP 302 redirect and increments counter when Click.create fails', async () => {
      const link = await Link.create({
        code: 'failure-sim',
        longUrl: 'https://example.com/failure-sim',
      });

      // Mock Click.create to simulate database event write failure
      const createSpy = jest
        .spyOn(Click, 'create')
        .mockRejectedValueOnce(new Error('Simulated database write error'));

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const res = await request(app).get('/failure-sim');

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe('https://example.com/failure-sim');

      // Counter was still atomically incremented
      const updated = await Link.findById(link._id);
      expect(updated.clicks).toBe(1);

      // Error was safely logged without leaking target URL
      expect(consoleSpy).toHaveBeenCalled();
      const loggedMsg = consoleSpy.mock.calls[0][0];
      expect(loggedMsg).toContain('failure-sim');
      expect(loggedMsg).not.toContain('https://example.com/failure-sim');

      createSpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  describe('Nonexistent and expired links', () => {
    it('returns 404 NOT_FOUND for unknown short code and does not record clicks', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('NOT_FOUND');

      const count = await Click.countDocuments();
      expect(count).toBe(0);
    });

    it('returns 410 EXPIRED for expired short code and does not increment clicks or record events', async () => {
      const link = await Link.create({
        code: 'expired-code',
        longUrl: 'https://example.com/expired',
        expiresAt: new Date(Date.now() - 5000), // expired 5 seconds ago
      });

      const res = await request(app).get('/expired-code');

      expect(res.status).toBe(410);
      expect(res.body.error).toBeDefined();
      expect(res.body.error.code).toBe('EXPIRED');

      // Click counter was NOT incremented
      const unchanged = await Link.findById(link._id);
      expect(unchanged.clicks).toBe(0);

      // Click event was NOT created
      const clickCount = await Click.countDocuments({ linkId: link._id });
      expect(clickCount).toBe(0);
    });
  });

  describe('Content negotiation for errors', () => {
    it('returns minimal HTML error page for 404 when Accept: text/html', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .set('Accept', 'text/html');

      expect(res.status).toBe(404);
      expect(res.type).toBe('text/html');
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('404 - Link Not Found');
      expect(res.text).toContain('nonexistent');
    });

    it('returns minimal HTML error page for 410 when Accept: text/html', async () => {
      await Link.create({
        code: 'expired-html',
        longUrl: 'https://example.com/exp-html',
        expiresAt: new Date(Date.now() - 5000),
      });

      const res = await request(app)
        .get('/expired-html')
        .set('Accept', 'text/html');

      expect(res.status).toBe(410);
      expect(res.type).toBe('text/html');
      expect(res.text).toContain('<!DOCTYPE html>');
      expect(res.text).toContain('410 - Link Expired');
    });

    it('returns JSON error for text/html;q=0 (disabled quality)', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .set('Accept', 'text/html;q=0');

      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns JSON error when text/html;q=0 overrides */*;q=1', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .set('Accept', 'text/html;q=0, */*;q=1');

      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns JSON error for malformed Accept: text/html;q=0.5=garbage', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .set('Accept', 'text/html;q=0.5=garbage');

      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns JSON error for duplicate q parameters: text/html;q=0;q=1', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .set('Accept', 'text/html;q=0;q=1');

      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns JSON error for wildcard Accept: */*', async () => {
      const res = await request(app)
        .get('/nonexistent')
        .set('Accept', '*/*');

      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns JSON error when Accept header is missing', async () => {
      const res = await request(app).get('/nonexistent');

      expect(res.status).toBe(404);
      expect(res.type).toBe('application/json');
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('Route ordering & non-interference', () => {
    it('preserves GET /health without interception by /:code', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ status: 'ok' });
    });

    it('preserves GET /api/links without interception by /:code', async () => {
      const res = await request(app).get('/api/links');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('links');
    });
  });
});
