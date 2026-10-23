'use strict';

// url.js only uses Node's built-in URL constructor and config/env.js.
// No database connection needed — these are pure unit tests.
const { validateUrl, validateAlias } = require('../src/utils/url');

// ── validateUrl ──────────────────────────────────────────────────────────────

describe('validateUrl', () => {
  describe('valid URLs', () => {
    it('accepts a plain https URL and returns it normalised', () => {
      expect(validateUrl('https://example.com/path')).toBe('https://example.com/path');
    });

    it('accepts a plain http URL', () => {
      expect(validateUrl('http://example.com')).toBe('http://example.com/');
    });

    it('trims leading and trailing whitespace', () => {
      expect(validateUrl('  https://example.com  ')).toBe('https://example.com/');
    });

    it('lowercases the hostname (WHATWG normalisation)', () => {
      expect(validateUrl('https://EXAMPLE.COM/Path')).toBe('https://example.com/Path');
    });

    it('strips the default port for https (443)', () => {
      expect(validateUrl('https://example.com:443/path')).toBe('https://example.com/path');
    });

    it('strips the default port for http (80)', () => {
      expect(validateUrl('http://example.com:80/')).toBe('http://example.com/');
    });

    it('preserves a non-default port', () => {
      expect(validateUrl('https://example.com:8080/path')).toBe('https://example.com:8080/path');
    });

    it('preserves query string', () => {
      expect(validateUrl('https://example.com/search?q=hello+world')).toBe(
        'https://example.com/search?q=hello+world'
      );
    });

    it('preserves fragment', () => {
      expect(validateUrl('https://example.com/page#section')).toBe(
        'https://example.com/page#section'
      );
    });

    it('preserves trailing slash when present', () => {
      expect(validateUrl('https://example.com/path/')).toBe('https://example.com/path/');
    });
  });

  describe('invalid URLs', () => {
    it('rejects javascript: scheme with INVALID_URL', () => {
      expect(() => validateUrl('javascript:alert(1)')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('rejects data: scheme', () => {
      expect(() => validateUrl('data:text/html,<h1>hi</h1>')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('rejects a bare domain with no scheme', () => {
      expect(() => validateUrl('example.com')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('rejects an empty string', () => {
      expect(() => validateUrl('')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('rejects whitespace-only input', () => {
      expect(() => validateUrl('   ')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('rejects a URL longer than 2048 characters', () => {
      const long = 'https://example.com/' + 'a'.repeat(2030);
      expect(() => validateUrl(long)).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('rejects a non-string value', () => {
      expect(() => validateUrl(42)).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('rejects URLs pointing to this service (redirect loop prevention)', () => {
      // HOST is set to http://localhost:3000 in tests/setup.js
      expect(() => validateUrl('http://localhost:3000/anything')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
      expect(() => validateUrl('http://localhost:3000')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
      expect(() => validateUrl('http://localhost:3000/nested/path?q=1#frag')).toThrow(
        expect.objectContaining({ code: 'INVALID_URL' })
      );
    });

    it('permits URLs with different origin than this service', () => {
      // Different port
      expect(validateUrl('http://localhost:8080/path')).toBe('http://localhost:8080/path');
      // Different protocol
      expect(validateUrl('https://localhost:3000/path')).toBe('https://localhost:3000/path');
    });
  });
});

// ── validateAlias ────────────────────────────────────────────────────────────

describe('validateAlias', () => {
  it('accepts a valid alias', () => {
    expect(() => validateAlias('my-link')).not.toThrow();
  });

  it('accepts numbers and underscores', () => {
    expect(() => validateAlias('link_2024')).not.toThrow();
  });

  it('rejects an alias shorter than 3 chars', () => {
    expect(() => validateAlias('ab')).toThrow(
      expect.objectContaining({ code: 'INVALID_ALIAS' })
    );
  });

  it('rejects an alias longer than 20 chars', () => {
    expect(() => validateAlias('a'.repeat(21))).toThrow(
      expect.objectContaining({ code: 'INVALID_ALIAS' })
    );
  });

  it('rejects an alias with spaces', () => {
    expect(() => validateAlias('my link')).toThrow(
      expect.objectContaining({ code: 'INVALID_ALIAS' })
    );
  });

  it('rejects reserved word "api"', () => {
    expect(() => validateAlias('api')).toThrow(
      expect.objectContaining({ code: 'INVALID_ALIAS' })
    );
  });

  it('rejects reserved word "health" (case-insensitive)', () => {
    expect(() => validateAlias('Health')).toThrow(
      expect.objectContaining({ code: 'INVALID_ALIAS' })
    );
  });
});
