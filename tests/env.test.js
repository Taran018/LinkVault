'use strict';

const { validateHost } = require('../src/config/env');

describe('HOST environment validation', () => {
  describe('valid HOST configurations', () => {
    it('accepts a standard local HTTP URL and normalizes to origin', () => {
      expect(validateHost('http://localhost:3000')).toBe('http://localhost:3000');
    });

    it('accepts an HTTPS URL and normalizes to origin', () => {
      expect(validateHost('https://linkvault.onrender.com')).toBe('https://linkvault.onrender.com');
    });

    it('accepts a custom port', () => {
      expect(validateHost('http://127.0.0.1:8080')).toBe('http://127.0.0.1:8080');
    });

    it('normalizes a trailing slash to origin', () => {
      expect(validateHost('http://localhost:3000/')).toBe('http://localhost:3000');
    });

    it('trims leading and trailing whitespace', () => {
      expect(validateHost('  https://linkvault.onrender.com  ')).toBe('https://linkvault.onrender.com');
    });
  });

  describe('invalid HOST configurations (fail-fast)', () => {
    it('rejects an empty string', () => {
      expect(() => validateHost('')).toThrow('HOST must be a non-empty string');
    });

    it('rejects a non-string value', () => {
      expect(() => validateHost(null)).toThrow('HOST must be a non-empty string');
    });

    it('rejects a missing scheme (bare domain)', () => {
      expect(() => validateHost('localhost:3000')).toThrow(/protocol must be "http:" or "https:"/);
    });

    it('rejects a completely malformed URL string', () => {
      expect(() => validateHost('not-a-valid-url')).toThrow(/must be a valid absolute URL/);
    });

    it('rejects an unsupported protocol (ftp:)', () => {
      expect(() => validateHost('ftp://example.com')).toThrow(/protocol must be "http:" or "https:"/);
    });

    it('rejects an unsupported protocol (javascript:)', () => {
      expect(() => validateHost('javascript:alert(1)')).toThrow(/protocol must be "http:" or "https:"/);
    });

    it('rejects embedded credentials', () => {
      expect(() => validateHost('http://user:pass@localhost:3000')).toThrow(
        /must not contain credentials/
      );
    });

    it('rejects a path component other than root /', () => {
      expect(() => validateHost('http://localhost:3000/subpath')).toThrow(
        /must not contain a path component/
      );
    });

    it('rejects a query string', () => {
      expect(() => validateHost('http://localhost:3000?foo=bar')).toThrow(
        /must not contain query parameters/
      );
    });

    it('rejects a fragment identifier', () => {
      expect(() => validateHost('http://localhost:3000#section')).toThrow(
        /must not contain a fragment/
      );
    });
  });
});
