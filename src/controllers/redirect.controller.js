'use strict';

const redirectService = require('../services/redirect.service');
const { wantsHtml, renderErrorPage } = require('../utils/html');

/**
 * Handle short-link redirection: GET /:code
 * - On success: always returns HTTP 302 redirect to longUrl regardless of Accept.
 * - On 404 or 410: negotiates content format using Accept header:
 *   - Minimal HTML page if client explicitly accepts text/html with q > 0.
 *   - Standard JSON error format otherwise.
 */
async function handleRedirect(req, res, next) {
  try {
    const { code } = req.params;
    const userAgent = req.headers['user-agent'];
    const referrer = req.headers['referer'] || req.headers['referrer'];

    const { targetUrl } = await redirectService.getAndTrackRedirect({
      code,
      userAgent,
      referrer,
    });

    // Server-side redirect with HTTP 302 (Found)
    res.redirect(302, targetUrl);
  } catch (err) {
    // Content negotiation for 404 Not Found and 410 Gone errors
    if (wantsHtml(req.headers.accept) && (err.status === 404 || err.status === 410)) {
      const title = err.status === 410 ? 'Link Expired' : 'Link Not Found';
      const html = renderErrorPage({
        status: err.status,
        title,
        code: req.params.code,
        message: err.message,
      });

      return res.status(err.status).type('text/html').send(html);
    }

    // Default: pass to global error handler for standard JSON response
    next(err);
  }
}

module.exports = { handleRedirect };
