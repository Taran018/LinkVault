'use strict';

const express = require('express');
const request = require('supertest');
const { getRateLimitKey, createLinkCreateLimiter } = require('../src/middleware/rateLimit');

describe('Rate limit key generator (getRateLimitKey)', () => {
  describe('Development & Test mode (isProduction: false)', () => {
    it('strictly ignores CF-Connecting-IP and X-Forwarded-For in non-production', () => {
      const mockReq = {
        socket: { remoteAddress: '127.0.0.1' },
        headers: {
          'cf-connecting-ip': '203.0.113.195',
          'x-forwarded-for': '198.51.100.5',
        },
      };

      const key = getRateLimitKey(mockReq, false);
      expect(key).toBe('127.0.0.1');
    });

    it('falls back to 127.0.0.1 if socket address is unavailable in non-production', () => {
      const mockReq = { socket: {}, headers: {} };
      const key = getRateLimitKey(mockReq, false);
      expect(key).toBe('127.0.0.1');
    });
  });

  describe('Production mode (isProduction: true)', () => {
    it('returns exact IPv4 address unchanged when CF-Connecting-IP is valid', () => {
      const mockReq = {
        socket: { remoteAddress: '10.0.0.1' },
        headers: { 'cf-connecting-ip': '198.51.100.1' },
      };

      const key = getRateLimitKey(mockReq, true);
      expect(key).toBe('198.51.100.1');
    });

    it('normalizes valid IPv6 addresses to a consistent /56 CIDR subnet', () => {
      const mockReqA = {
        headers: { 'cf-connecting-ip': '2001:db8:abcd:1200::1' },
      };
      const mockReqB = {
        headers: { 'cf-connecting-ip': '2001:db8:abcd:12ff:ffff:ffff:ffff:ffff' },
      };

      const keyA = getRateLimitKey(mockReqA, true);
      const keyB = getRateLimitKey(mockReqB, true);

      // Both addresses are within 2001:db8:abcd:1200::/56
      expect(keyA).toBe('2001:db8:abcd:1200::/56');
      expect(keyB).toBe('2001:db8:abcd:1200::/56');
      expect(keyA).toBe(keyB);
    });

    it('generates distinct keys for IPv6 addresses in different /56 subnets', () => {
      const mockReqA = {
        headers: { 'cf-connecting-ip': '2001:db8:abcd:1200::1' },
      };
      const mockReqC = {
        headers: { 'cf-connecting-ip': '2001:db8:abcd:1300::1' },
      };

      const keyA = getRateLimitKey(mockReqA, true);
      const keyC = getRateLimitKey(mockReqC, true);

      expect(keyA).toBe('2001:db8:abcd:1200::/56');
      expect(keyC).toBe('2001:db8:abcd:1300::/56');
      expect(keyA).not.toBe(keyC);
    });

    it('ignores X-Forwarded-For when CF-Connecting-IP is present', () => {
      const mockReq = {
        headers: {
          'cf-connecting-ip': '198.51.100.1',
          'x-forwarded-for': '203.0.113.1, 10.0.0.2',
        },
      };

      const key = getRateLimitKey(mockReq, true);
      expect(key).toBe('198.51.100.1');
    });

    it('falls back safely to socket address if CF-Connecting-IP is missing in production', () => {
      const mockReq = {
        socket: { remoteAddress: '10.0.0.5' },
        headers: {},
      };

      const key = getRateLimitKey(mockReq, true);
      expect(key).toBe('10.0.0.5');
    });

    it('falls back safely to socket address if CF-Connecting-IP is malformed in production', () => {
      const mockReq = {
        socket: { remoteAddress: '10.0.0.5' },
        headers: { 'cf-connecting-ip': 'not-an-ip-address' },
      };

      const key = getRateLimitKey(mockReq, true);
      expect(key).toBe('10.0.0.5');
    });

    it('falls back to untrusted-edge-fallback if both CF-Connecting-IP and socket are invalid', () => {
      const mockReq = {
        socket: { remoteAddress: 'invalid-socket' },
        headers: { 'cf-connecting-ip': 'invalid-header' },
      };

      const key = getRateLimitKey(mockReq, true);
      expect(key).toBe('untrusted-edge-fallback');
    });
  });
});

describe('Rate limit middleware integration', () => {
  let appTest;

  beforeEach(() => {
    appTest = express();
    appTest.use(express.json());

    // Test limiter with a low threshold (3 requests/window)
    const testLimiter = createLinkCreateLimiter({
      max: 3,
      windowMs: 60 * 1000,
    });

    appTest.post('/test/create', testLimiter, (req, res) => {
      res.status(201).json({ success: true });
    });

    appTest.get('/test/other', (req, res) => {
      res.status(200).json({ ok: true });
    });
  });

  it('permits requests within limit and returns 429 RATE_LIMITED when threshold exceeded', async () => {
    // Requests 1, 2, 3 succeed
    for (let i = 0; i < 3; i++) {
      const res = await request(appTest).post('/test/create').expect(201);
      expect(res.body.success).toBe(true);
    }

    // Request 4 exceeds limit
    const resThrottled = await request(appTest)
      .post('/test/create')
      .expect(429);

    expect(resThrottled.body).toEqual({
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many link creation requests. Please try again later.',
      },
    });

    // Unrelated route remains accessible
    const resOther = await request(appTest).get('/test/other').expect(200);
    expect(resOther.body.ok).toBe(true);
  });
});
