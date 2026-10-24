# API contract

Base URL: `http://localhost:3000` (local) or the Render URL.
Error shape for every failure: `{ "error": { "code": "INVALID_URL", "message": "Enter a full http(s) link." } }`

## POST /api/links
Body: `{ "url": "https://example.com/long", "alias": "join-club" (optional), "expiresAt": "2026-12-31T18:30:00Z" (optional) }`
- 201: `{ "code": "join-club", "shortUrl": "http://host/join-club", "longUrl": "...", "clicks": 0, "expiresAt": null, "createdAt": "..." }`
- 400 `INVALID_URL`, `INVALID_ALIAS`, `INVALID_EXPIRY` | 409 `ALIAS_TAKEN` | 429 `RATE_LIMITED`

## GET /api/links
- 200: `{ "links": [ { code, shortUrl, longUrl, clicks, expiresAt, createdAt, status: "active" | "expired" } ] }` newest first, max 100.

## GET /api/links/:code/stats
- 200: `{ "code": "...", "totalClicks": 12, "last7Days": [ { "date": "2026-10-20", "clicks": 3 } ] }`
- 400 `INVALID_CODE` (malformed `:code` parameter) | 404 `NOT_FOUND`

## DELETE /api/links/:code
- 204 no body | 404 `NOT_FOUND`

## GET /:code
- 302 Found: redirect to `longUrl` (`Location: <longUrl>`), atomic `$inc` click counter, best-effort `Click` event logged. Always issued for valid, unexpired short links regardless of `Accept` header.
- 404 `NOT_FOUND`: link does not exist.
- 410 `EXPIRED`: link exists but has expired according to database cluster time (`$$NOW`).
- **Content negotiation for 404/410 errors:**
  - Returns a minimal, sanitized HTML error page only when `Accept` explicitly specifies `text/html` with a valid positive quality factor ($q > 0$).
  - Defaults to JSON `{ "error": { "code": "...", "message": "..." } }` when `Accept` is missing, is `*/*` only, specifies `text/html;q=0`, or contains malformed parameters.
  - HTML error pages render sanitized HTML entities to prevent XSS.

## GET /health
- 200: `{ "status": "ok" }`
