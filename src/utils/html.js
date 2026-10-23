'use strict';

// RFC 9110: qvalue = ( "0" [ "." 0*3DIGIT ] ) / ( "1" [ "." 0*3("0") ] )
const Q_REGEX = /^(0(\.\d{1,3})?|1(\.0{1,3})?)$/;

/**
 * Parse an RFC 9110 quality parameter string.
 *
 * @param {string|undefined} qStr
 * @returns {number|null} Valid float in [0, 1] or null if invalid/out-of-range
 */
function parseQ(qStr) {
  if (qStr === undefined) return 1.0;
  const trimmed = qStr.trim();
  if (!Q_REGEX.test(trimmed)) {
    return null; // Malformed or out of range (e.g. banana, 2, -0.1, 1.001)
  }
  return parseFloat(trimmed);
}

/**
 * Determine if an error request should render HTML instead of JSON.
 * Returns true ONLY if client explicitly lists text/html with a valid positive quality factor.
 *
 * Rules:
 * - Missing header or empty string -> false (JSON default).
 * - Wildcard (any type) alone or without explicit text/html -> false (JSON default).
 * - "text/html;q=0" or disabled quality -> false (JSON default).
 * - Malformed parameters (extra equals signs, duplicate q) -> false (JSON default).
 * - Explicit "text/html" with positive quality (q > 0) -> true (HTML).
 *
 * @param {string|undefined} acceptHeader
 * @returns {boolean}
 */
function wantsHtml(acceptHeader) {
  if (!acceptHeader || typeof acceptHeader !== 'string') return false;

  const entries = acceptHeader.split(',').map(e => e.trim()).filter(Boolean);
  let htmlExplicit = false;
  let htmlQ = null;
  let hasDuplicateQ = false;
  let isParamMalformed = false;

  for (const entry of entries) {
    const [mediaType, ...params] = entry.split(';').map(s => s.trim());
    if (mediaType.toLowerCase() === 'text/html') {
      htmlExplicit = true;
      let qCount = 0;
      let rawQ;

      for (const param of params) {
        // Enforce exactly one '=' separating parameter name and value
        const firstEq = param.indexOf('=');
        const lastEq = param.lastIndexOf('=');
        if (firstEq === -1 || firstEq !== lastEq) {
          isParamMalformed = true;
          continue;
        }

        const key = param.slice(0, firstEq).trim();
        const value = param.slice(firstEq + 1).trim();

        if (key.toLowerCase() === 'q') {
          qCount++;
          rawQ = value;
        }
      }

      if (qCount > 1) {
        hasDuplicateQ = true;
      } else {
        htmlQ = parseQ(rawQ);
      }
    }
  }

  // Reject if not explicitly present, if duplicate/malformed params exist, or if q is invalid
  if (!htmlExplicit || hasDuplicateQ || isParamMalformed || htmlQ === null) {
    return false;
  }

  return htmlQ > 0;
}

/**
 * Escape unsafe characters for safe insertion into HTML.
 *
 * @param {string} text
 * @returns {string} HTML-escaped string
 */
function escapeHtml(text) {
  if (typeof text !== 'string') return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Render a minimal, static HTML error page.
 *
 * @param {object} options
 * @param {number} options.status - HTTP status code (e.g. 404, 410)
 * @param {string} options.title  - Page title
 * @param {string} options.code   - Short code (will be escaped)
 * @param {string} options.message - Human-friendly description
 * @returns {string} Full HTML document
 */
function renderErrorPage({ status, title, code, message }) {
  const safeTitle = escapeHtml(title);
  const safeCode = escapeHtml(code);
  const safeMessage = escapeHtml(message);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${status} - ${safeTitle} | LinkVault</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; background: #0f172a; color: #f8fafc; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 1rem; box-sizing: border-box; }
    .card { background: #1e293b; border: 1px solid #334155; border-radius: 8px; padding: 2rem; max-width: 480px; width: 100%; text-align: center; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }
    h1 { margin: 0 0 1rem; font-size: 1.5rem; color: #ef4444; }
    p { margin: 0 0 1.5rem; color: #94a3b8; line-height: 1.5; }
    code { background: #0f172a; padding: 0.2rem 0.4rem; border-radius: 4px; color: #38bdf8; font-size: 0.95em; word-break: break-all; }
  </style>
</head>
<body>
  <div class="card">
    <h1>${status} - ${safeTitle}</h1>
    <p>${safeMessage} ${safeCode ? `(<code>${safeCode}</code>)` : ''}</p>
  </div>
</body>
</html>`;
}

module.exports = { parseQ, wantsHtml, escapeHtml, renderErrorPage };
