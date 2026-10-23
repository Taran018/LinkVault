# Architecture

## Overview
```
Browser (public/ HTML+CSS+JS)
   |  fetch JSON                      ^ 302 redirect
   v                                  |
Express app (Render)  --------------------------
   routes -> controllers -> services -> models
                                          |
                                     MongoDB Atlas
                                   (links, clicks)
```

## Request flows

**Create link:** `POST /api/links` -> validate body -> normalise URL -> generate code (retry on duplicate key) -> save -> `201 { code, shortUrl, ... }`.

**Redirect:** `GET /:code` -> find link -> missing: 404 -> expired: 410 -> `findOneAndUpdate({ code }, { $inc: { clicks: 1 } })` -> insert `Click` -> `302 Location: longUrl`.

## Data model

`links`
| field | type | notes |
|---|---|---|
| code | String | unique index, 3-20 chars |
| longUrl | String | http/https only |
| clicks | Number | default 0, atomic `$inc` |
| expiresAt | Date or null | null = never expires |
| createdAt | Date | |

`clicks` (one document per visit)
| field | type | notes |
|---|---|---|
| linkId | ObjectId | required, indexed together with at |
| code | String | indexed snapshot of code at visit time |
| at | Date | default Date.now |
| referrer | String | optional, truncated to 2048 chars |
| userAgent | String | optional, truncated to 512 chars |

## Key decisions (with trade-offs)
| Decision | Why | Trade-off |
|---|---|---|
| Server-side 302 | Works for all clients, no JS needed, standard behaviour | Each click hits our server |
| 302 not 301 | Browsers do not cache 302, so every click is counted | Slightly more load |
| Random 7-char code with unique index | Simple, collision-safe via retry | Not sequential, not guessable |
| Atomic `$inc` with database-side `$$NOW` | Correct under concurrent clicks; evaluates expiry on database engine | Requires MongoDB 4.2+ |
| Best-effort Click event persistence | Redirects are never blocked if event logging fails | Link counter increment and Click event insertion are separate operations; an insertion failure can cause a discrepancy between summary clicks and event logs that persists indefinitely (no retry or reconciliation mechanism) |
| Separate `clicks` collection | Enables time-series stats with stable `linkId` | Extra write per click |
| 410 Gone for expired | Tells clients the link existed and is gone | Record kept, so storage grows |
| One service serves API and frontend | Single deploy, no CORS | Cannot scale them independently |
| MongoDB | Flexible, free Atlas tier, easy for first backend | Relational DB also fine |
| Content negotiation via `Accept` header (Gap 4) | Valid short codes always 302 regardless of Accept. For 404/410, return minimal HTML only when client explicitly requests `text/html` with positive quality factor ($q > 0$). Missing header or `*/*` defaults to JSON. HTML responses never contain unescaped user data. | Slightly more logic in the redirect controller |
| URL normalisation via WHATWG `URL` constructor (Gap 6) | Trim whitespace; reject missing or non-http(s) schemes (no auto-prepend); use `new URL()` for hostname case-folding and default-port stripping; preserve path, query, fragment and trailing-slash as submitted. | WHATWG parser is built into Node — no extra dependency |

## Folder structure
```
linkvault/
  AGENTS.md  README.md  package.json  .env.example  .gitignore
  .agent/rules/  .agent/workflows/
  docs/  prompts/
  src/
    app.js  server.js
    config/      env.js  db.js
    models/      Link.js  Click.js
    routes/      links.routes.js  redirect.routes.js
    controllers/ links.controller.js  redirect.controller.js
    services/    link.service.js  stats.service.js
    middleware/  errorHandler.js  rateLimit.js  validate.js  (rateLimit.js and validate.js added in Phase 5)
    utils/       code.js  url.js  AppError.js
  public/        index.html  css/style.css  js/api.js  js/app.js
  tests/         links.test.js  redirect.test.js  url.test.js
```
