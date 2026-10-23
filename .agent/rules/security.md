# Security rules
- Validate URL with the `URL` constructor and an http/https allowlist (`src/utils/url.js`).
- Reject URLs longer than 2048 chars and URLs pointing to this service's own host (prevents redirect loops).
- Alias: `^[A-Za-z0-9_-]{3,20}$`; block reserved words: `api`, `health`, `admin`, `static`, `public`.
- Use `helmet`, `express-rate-limit` (create endpoint stricter than redirect), `express.json({ limit: '10kb' })`.
- Do not log full request bodies or secrets.
- Return 404 for unknown codes, 410 for expired, 400 for bad input, 409 for alias conflict, 429 for rate limit.
- Never trust `X-Forwarded-For` blindly; set `app.set('trust proxy', 1)` only for Render.
- Mongo queries use fixed fields only; never pass `req.body` directly into a query (prevents NoSQL injection).
