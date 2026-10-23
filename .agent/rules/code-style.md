# Code style
- 2-space indent, semicolons, single quotes, `const` by default.
- async/await only; no raw callbacks or `.then` chains.
- Functions do one job and stay under ~40 lines.
- Controllers never touch the database directly; they call services.
- Services never touch `req`/`res`.
- Throw `AppError(status, code, message)` from services; the error handler formats the response.
- Name things plainly: `createLink`, `getLinkByCode`, `recordClick`.
- Comment the "why", not the "what". Add a short comment for every non-obvious backend concept (index, TTL, atomic update, status codes).
- Frontend: small modules, `fetch` wrapped in `public/js/api.js`, no inline event handlers in HTML.
