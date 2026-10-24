'use strict';

const request = require('supertest');
const app = require('../src/app');

describe('Security headers (Helmet & CSP)', () => {
  it('sets standard defensive security headers on responses', async () => {
    const res = await request(app).get('/health');

    // MIME sniffing prevention
    expect(res.headers['x-content-type-options']).toBe('nosniff');

    // Clickjacking protection (X-Frame-Options or CSP frame-ancestors)
    expect(res.headers['x-frame-options']).toBe('DENY');

    // DNS prefetch control
    expect(res.headers['x-dns-prefetch-control']).toBe('off');
  });

  it('includes Content-Security-Policy with required origins for fonts and local assets', async () => {
    const res = await request(app).get('/health');
    const csp = res.headers['content-security-policy'];

    expect(csp).toBeDefined();
    expect(csp).toContain('default-src \'self\'');
    expect(csp).toContain('script-src \'self\'');
    expect(csp).toContain('style-src \'self\' https://fonts.googleapis.com');
    expect(csp).toContain('font-src \'self\' https://fonts.gstatic.com');
    expect(csp).toContain('frame-ancestors \'none\'');

    // upgrade-insecure-requests should NOT be enabled in non-production (avoids breaking http://localhost:3000)
    expect(csp).not.toContain('upgrade-insecure-requests');
  });
});
