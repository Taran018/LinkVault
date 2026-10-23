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
- 404 `NOT_FOUND`

## DELETE /api/links/:code
- 204 no body | 404 `NOT_FOUND`

## GET /:code
- 302 redirect to `longUrl` (click recorded) — always issued regardless of `Accept` header.
- 404 `NOT_FOUND` | 410 `EXPIRED`
- **Content negotiation for errors:** return a minimal static HTML page when `Accept` contains `text/html` with a positive quality value (typical browser request). Return JSON `{ error: { code, message } }` when `Accept` is absent, is `*/*` only, or contains no `text/html` entry. HTML error pages never render unescaped user-controlled data.

## GET /health
- 200: `{ "status": "ok" }`
