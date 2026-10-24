'use strict';

const express = require('express');
const helmet = require('helmet');
const healthRouter = require('./routes/health.routes');
const linksRouter = require('./routes/links.routes');
const redirectRouter = require('./routes/redirect.routes');
const errorHandler = require('./middleware/errorHandler');

// app.js creates and configures the Express application object but does NOT
// call app.listen().  Keeping these separate makes it easy to import the app
// in tests without accidentally starting a real server on a port.
const app = express();

// Disable Express proxy trust by default; client IP resolution is handled
// explicitly and securely in rateLimit.js.
app.set('trust proxy', false);

// ── Security Headers (Helmet) ────────────────────────────────────────────────
// WHY HELMET?
// Helmet sets HTTP headers that guard against well-known web vulnerabilities like
// cross-site scripting (XSS), clickjacking, and MIME-type sniffing.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ['\'self\''],
        scriptSrc: ['\'self\''], // Safe: api.js and app.js are ES modules served locally; no inline scripts
        styleSrc: ['\'self\'', 'https://fonts.googleapis.com'],
        fontSrc: ['\'self\'', 'https://fonts.gstatic.com'],
        imgSrc: ['\'self\'', 'data:'],
        connectSrc: ['\'self\''],
        objectSrc: ['\'none\''],
        baseUri: ['\'self\''],
        formAction: ['\'self\''],
        frameAncestors: ['\'none\''],
        // In local development / test, keep null so http://localhost:3000 is never forced to https
        upgradeInsecureRequests:
          process.env.NODE_ENV === 'production' ? [] : null,
      },
    },
    crossOriginEmbedderPolicy: false, // Ensures Google Fonts stylesheets load cleanly across origins
    xFrameOptions: { action: 'deny' }, // Strong clickjacking protection
  })
);

// ── Middleware ──────────────────────────────────────────────────────────────

// Parse incoming JSON request bodies.
// The 10 kb size limit is a basic security measure to prevent very large
// payloads from using up server memory.
app.use(express.json({ limit: '10kb' }));

// Serve static files from /public (Phase 4: frontend HTML/CSS/JS lives here).
// express.static is built into Express; it reads files from disk and sends them
// with the correct Content-Type header.
app.use(express.static('public'));

// ── Routes ──────────────────────────────────────────────────────────────────

app.use('/', healthRouter);
app.use('/', linksRouter);
// Short-code redirect (GET /:code) MUST be mounted after specific routes
// so /health and /api/... are never intercepted by /:code
app.use('/', redirectRouter);

// 404 catch-all — if no route matched, create an operational error and hand
// it to the error handler below.
app.use((req, res, next) => {
  const AppError = require('./utils/AppError');
  next(new AppError(404, 'NOT_FOUND', `Route ${req.method} ${req.path} not found`));
});

// ── Global error handler ────────────────────────────────────────────────────
// Must be the LAST app.use() call so it catches errors from all routes above.
app.use(errorHandler);

module.exports = app;
