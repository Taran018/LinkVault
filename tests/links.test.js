'use strict';

// MongoMemoryServer starts a real MongoDB process in memory for tests.
// WHY NOT a mocked DB?
//   Real Mongoose queries against a real (in-memory) MongoDB catch issues
//   that mocks can't: index violations, schema coercion, query behaviour.
const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const request = require('supertest');
const app = require('../src/app');

// MongoMemoryServer downloads a MongoDB binary on first run.
// 30 s gives it plenty of time to start, even on a slow connection.
jest.setTimeout(60000);

let mongod;

beforeAll(async () => {
  mongod = await MongoMemoryServer.create();
  // Connect Mongoose to the in-memory server instead of the real Atlas URI.
  await mongoose.connect(mongod.getUri());
}, 60000);

afterAll(async () => {
  await mongoose.disconnect();
  await mongod.stop();
}, 30000);

beforeEach(async () => {
  // Wipe every collection between tests so each test starts with a clean slate.
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// ── POST /api/links ──────────────────────────────────────────────────────────

describe('POST /api/links', () => {
  it('creates a link with a random code and returns 201', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com/long-path' });

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      longUrl: 'https://example.com/long-path',
      clicks: 0,
      expiresAt: null,
    });
    expect(res.body.code).toHaveLength(7);
    expect(res.body.shortUrl).toMatch(/^http:\/\/localhost:3000\//);
    expect(res.body.createdAt).toBeDefined();
  });

  it('creates a link with a custom alias and returns 201', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', alias: 'my-alias' });

    expect(res.status).toBe(201);
    expect(res.body.code).toBe('my-alias');
    expect(res.body.shortUrl).toBe('http://localhost:3000/my-alias');
  });

  it('creates a link with an expiry date and returns 201', async () => {
    const future = new Date(Date.now() + 86400000).toISOString(); // +1 day
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', expiresAt: future });

    expect(res.status).toBe(201);
    expect(res.body.expiresAt).toBe(future);
  });

  it('returns 409 ALIAS_TAKEN when the alias is already used', async () => {
    await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', alias: 'taken' });

    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://other.com', alias: 'taken' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALIAS_TAKEN');
  });

  it('returns 400 INVALID_URL for a javascript: URL', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'javascript:alert(1)' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('returns 400 INVALID_URL for a URL with no scheme', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'example.com/no-scheme' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('returns 400 INVALID_URL when url is missing', async () => {
    const res = await request(app).post('/api/links').send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_URL');
  });

  it('returns 400 INVALID_ALIAS for a too-short alias', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', alias: 'ab' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ALIAS');
  });

  it('returns 400 INVALID_ALIAS for a reserved alias', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', alias: 'api' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_ALIAS');
  });

  it('returns 400 INVALID_EXPIRY for a past expiry date', async () => {
    const past = new Date(Date.now() - 1000).toISOString();
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', expiresAt: past });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EXPIRY');
  });

  it('returns 400 INVALID_EXPIRY for a non-date expiry string', async () => {
    const res = await request(app)
      .post('/api/links')
      .send({ url: 'https://example.com', expiresAt: 'not-a-date' });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_EXPIRY');
  });
});

// ── GET /api/links ──────────────────────────────────────────────────────────

describe('GET /api/links', () => {
  it('returns an empty list when no links exist', async () => {
    const res = await request(app).get('/api/links');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ links: [] });
  });

  it('returns created links newest first with status field', async () => {
    await request(app).post('/api/links').send({ url: 'https://first.com', alias: 'first' });
    await request(app).post('/api/links').send({ url: 'https://second.com', alias: 'second' });

    const res = await request(app).get('/api/links');

    expect(res.status).toBe(200);
    expect(res.body.links).toHaveLength(2);
    // newest first
    expect(res.body.links[0].code).toBe('second');
    expect(res.body.links[1].code).toBe('first');
    // every item has the status field
    res.body.links.forEach(link => {
      expect(['active', 'expired']).toContain(link.status);
    });
  });

  it('marks an already-expired link as "expired"', async () => {
    // Insert a link directly with a past expiresAt via the model.
    const Link = require('../src/models/Link');
    await Link.create({
      code: 'old-link',
      longUrl: 'https://old.com',
      expiresAt: new Date(Date.now() - 1000),
    });

    const res = await request(app).get('/api/links');

    expect(res.status).toBe(200);
    expect(res.body.links[0].status).toBe('expired');
  });
});

// ── DELETE /api/links/:code ──────────────────────────────────────────────────

describe('DELETE /api/links/:code', () => {
  it('deletes an existing link and returns 204', async () => {
    await request(app).post('/api/links').send({ url: 'https://example.com', alias: 'to-delete' });

    const res = await request(app).delete('/api/links/to-delete');

    expect(res.status).toBe(204);
    expect(res.text).toBe('');
  });

  it('returns 404 NOT_FOUND when the code does not exist', async () => {
    const res = await request(app).delete('/api/links/nonexistent');

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('removes the link from the list after deletion', async () => {
    await request(app).post('/api/links').send({ url: 'https://example.com', alias: 'gone' });
    await request(app).delete('/api/links/gone');

    const res = await request(app).get('/api/links');
    expect(res.body.links).toHaveLength(0);
  });
});
