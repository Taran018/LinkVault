# Implementation plan: LinkVault

## Goal
A deployed full-stack URL shortener that meets all four required features and shows engineering maturity: layered backend, tests, validation, security basics, documentation, live demo.

## Required features (from the task)
1. Unique short-link generation
2. Redirection
3. Click tracking
4. Optional link expiry

## Stretch features (only after phase 6 is done)
- Custom alias (already in the plan as part of phase 2)
- Clicks-over-time chart (phase 5)
- QR code for each link
- Delete token so only the creator can delete (simple ownership without full login)

## Phases (approx. 5 to 6 working days)

| Phase | Name | Output | Time |
|---|---|---|---|
| 0 | Setup and design | repo, agent files, docs, Atlas cluster | 0.5 day |
| 1 | Backend skeleton | Express app, DB connection, health route, error handler | 0.5 day |
| 2 | Core API | create link, list, delete, validation | 1 day |
| 3 | Redirect and tracking | `GET /:code` with 302, 404, 410, atomic click count, click events | 1 day |
| 4 | Frontend | form, result card, dashboard table, states and errors | 1 day |
| 5 | Stats and polish | per-link stats endpoint, small chart, rate limits, helmet | 0.5 day |
| 6 | Tests and deploy | Jest tests, Render deploy, README with live URL | 0.5 day |
| 7 | Interview prep | demo script, architecture diagram, Q&A notes | 0.5 day |

## Phase details and acceptance checks

### Phase 0: Setup
- Create GitHub repo, copy this kit in, `npm init`, install deps.
- Create a free MongoDB Atlas cluster, add a DB user, allow network access, copy the connection string to `.env`.
- Check: `node -v` is 20+, `.env` exists and is git-ignored.

### Phase 1: Backend skeleton
- `src/app.js`, `src/server.js`, `config/env.js`, `config/db.js`, `middleware/errorHandler.js`, `GET /health`.
- Check: `curl localhost:3000/health` returns `{"status":"ok"}` and the log says DB connected.

### Phase 2: Core API
- `Link` model with unique index on `code`, `utils/code.js` (nanoid 7 chars), `utils/url.js`, `linkService`, `POST /api/links`, `GET /api/links`, `DELETE /api/links/:code`.
- Check: create with and without alias, duplicate alias gives 409, `javascript:alert(1)` gives 400, past expiry gives 400.

### Phase 3: Redirect and tracking
- `GET /:code`: 404 not found, 410 expired, else atomic `$inc` on `clicks` and a `Click` document (timestamp, referrer, user agent), then 302.
- Check: open short URL in a browser, clicks goes up by 1 per visit, expired link shows 410 page.

### Phase 4: Frontend
- Move old static files into `public/`; replace `store.js` with `api.js` that calls the API.
- Check: create, copy, open, delete from the UI; empty, loading, and error states all display.

### Phase 5: Stats and polish
- `GET /api/links/:code/stats` returns total clicks and clicks per day for 7 days; small bar chart in the UI (plain canvas or SVG).
- Add `helmet`, rate limits, request size limit.
- Check: 31st create request in a minute gets 429.

### Phase 6: Tests and deploy
- Jest + Supertest with in-memory Mongo: create, validation, duplicate alias, redirect, expiry, click increment.
- Deploy to Render, set env vars, test live.
- Check: `npm test` green, live URL works end to end.

### Phase 7: Interview prep
- Fill `docs/INTERVIEW_NOTES.md`, draw the architecture diagram, rehearse a 3-minute demo.

## Risks
| Risk | Mitigation |
|---|---|
| Never used backend before | Agent explains each concept; read `docs/INTERVIEW_NOTES.md` daily |
| Atlas connection fails | Allow 0.0.0.0/0 for the task; check password URL-encoding |
| Render free tier sleeps | Mention it in README; open the URL before the demo |
| Over-building | Do not start stretch features before phase 6 passes |
