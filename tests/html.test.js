'use strict';

const { parseQ, wantsHtml, escapeHtml, renderErrorPage } = require('../src/utils/html');

describe('html utils', () => {
  describe('parseQ', () => {
    it('defaults undefined to 1.0', () => {
      expect(parseQ(undefined)).toBe(1.0);
    });

    it('accepts integer 1 and 0', () => {
      expect(parseQ('1')).toBe(1.0);
      expect(parseQ('0')).toBe(0.0);
    });

    it('accepts fractional qualities up to 3 decimal places', () => {
      expect(parseQ('0.8')).toBe(0.8);
      expect(parseQ('0.85')).toBe(0.85);
      expect(parseQ('0.852')).toBe(0.852);
      expect(parseQ('1.000')).toBe(1.0);
    });

    it('rejects values with more than 3 decimal places', () => {
      expect(parseQ('0.1234')).toBeNull();
    });

    it('rejects numbers greater than 1', () => {
      expect(parseQ('2')).toBeNull();
      expect(parseQ('1.001')).toBeNull();
      expect(parseQ('1.1')).toBeNull();
    });

    it('rejects negative numbers', () => {
      expect(parseQ('-0.1')).toBeNull();
      expect(parseQ('-1')).toBeNull();
    });

    it('rejects non-numeric strings', () => {
      expect(parseQ('banana')).toBeNull();
      expect(parseQ('')).toBeNull();
    });
  });

  describe('wantsHtml', () => {
    it('returns true for plain text/html', () => {
      expect(wantsHtml('text/html')).toBe(true);
    });

    it('returns true for positive quality text/html', () => {
      expect(wantsHtml('text/html;q=0.8')).toBe(true);
      expect(wantsHtml('text/html;q=1')).toBe(true);
      expect(wantsHtml('text/html;q=0.001')).toBe(true);
    });

    it('returns true for standard browser Accept header', () => {
      expect(
        wantsHtml('text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
      ).toBe(true);
    });

    it('returns false for text/html;q=0 (disabled quality)', () => {
      expect(wantsHtml('text/html;q=0')).toBe(false);
      expect(wantsHtml('text/html;q=0.0')).toBe(false);
      expect(wantsHtml('text/html;q=0.000')).toBe(false);
    });

    it('returns false when text/html;q=0 overrides */*;q=1', () => {
      expect(wantsHtml('text/html;q=0, */*;q=1')).toBe(false);
      expect(wantsHtml('*/*;q=1, text/html;q=0')).toBe(false);
    });

    it('returns false for malformed parameter with extra equals (text/html;q=0.5=garbage)', () => {
      expect(wantsHtml('text/html;q=0.5=garbage')).toBe(false);
      expect(wantsHtml('text/html;q==1')).toBe(false);
    });

    it('returns false for duplicate q parameters (text/html;q=0;q=1)', () => {
      expect(wantsHtml('text/html;q=0;q=1')).toBe(false);
      expect(wantsHtml('text/html;q=0.8;q=0.9')).toBe(false);
    });

    it('returns false for malformed and out-of-range q values', () => {
      expect(wantsHtml('text/html;q=banana')).toBe(false);
      expect(wantsHtml('text/html;q=2')).toBe(false);
      expect(wantsHtml('text/html;q=-0.1')).toBe(false);
      expect(wantsHtml('text/html;q=1.001')).toBe(false);
    });

    it('returns false for missing or non-string Accept header', () => {
      expect(wantsHtml(undefined)).toBe(false);
      expect(wantsHtml(null)).toBe(false);
      expect(wantsHtml('')).toBe(false);
    });

    it('returns false for wildcard alone (*/*)', () => {
      expect(wantsHtml('*/*')).toBe(false);
      expect(wantsHtml('*/*;q=1')).toBe(false);
      expect(wantsHtml('*/*;q=0.8')).toBe(false);
    });

    it('returns false for application/json', () => {
      expect(wantsHtml('application/json')).toBe(false);
      expect(wantsHtml('application/json, text/plain')).toBe(false);
    });
  });

  describe('escapeHtml', () => {
    it('escapes &, <, >, ", and \'', () => {
      expect(escapeHtml('<script>alert("XSS & \'attack\'")</script>')).toBe(
        '&lt;script&gt;alert(&quot;XSS &amp; &#039;attack&#039;&quot;)&lt;/script&gt;'
      );
    });

    it('handles non-string inputs gracefully', () => {
      expect(escapeHtml(null)).toBe('');
      expect(escapeHtml(undefined)).toBe('');
    });
  });

  describe('renderErrorPage', () => {
    it('renders a full HTML document with status, title, and escaped code', () => {
      const html = renderErrorPage({
        status: 404,
        title: 'Link Not Found',
        code: '<alert>',
        message: 'The requested short link does not exist.',
      });

      expect(html).toContain('<!DOCTYPE html>');
      expect(html).toContain('404 - Link Not Found');
      expect(html).toContain('&lt;alert&gt;');
      expect(html).not.toContain('<alert>');
    });
  });
});
