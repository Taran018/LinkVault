# AGENTS.md: LinkVault

Read this file fully before every task. Rules in `.agent/rules/` add detail.

## Project
LinkVault is a full-stack URL shortener: short-link generation, server-side redirection, click tracking, optional link expiry.
Built for a college club technical recruitment task. The owner is a frontend developer (HTML/CSS/JS) learning backend, so:
- Explain every new backend concept in 2-3 sentences in code comments or the task summary.
- Prefer simple, readable code over clever code. No unnecessary abstractions.

## Stack (do not change without asking)
- Runtime: Node.js 20+, Express 4, CommonJS modules
- Database: MongoDB Atlas via Mongoose
- Frontend: plain HTML, CSS, vanilla JS in `/public` (no framework, no build step)
- Tests: Jest + Supertest (+ mongodb-memory-server)
- Deploy: Render (single web service serving API and `/public`)

## Folder map
- `src/app.js` builds the Express app (no listen call); `src/server.js` connects DB and listens
- `src/routes/` URL mapping only; `src/controllers/` HTTP in/out; `src/services/` business logic; `src/models/` Mongoose schemas
- `src/middleware/` validation, rate limit, error handler; `src/utils/` pure helpers
- `public/` static frontend; `tests/` mirrors `src/`
- `docs/` plan, architecture, API contract; `prompts/` phase prompts

## Commands
- `npm run dev` start with nodemon
- `npm start` production start
- `npm test` run all tests (must pass before a phase is "done")
- `npm run lint` ESLint

## Hard rules
1. Redirects are done by the server with HTTP 302, never by client-side JS.
2. Only `http:` and `https:` target URLs are accepted. Reject everything else (no `javascript:`, `data:`).
3. Click increments use atomic `$inc`. Never read-modify-write.
4. Secrets only in `.env`; never commit it. Keep `.env.example` current.
5. Every endpoint validates input and returns the JSON error shape in `docs/API.md`.
6. Never use `innerHTML` with user data in the frontend; use `textContent`.
7. Do not add dependencies without saying why in the task summary.
8. Keep `docs/API.md` and `README.md` in sync with any behaviour change.

## Workflow expectations
- Work one phase at a time from `docs/PLAN.md`. Do not start the next phase.
- Make a short plan first, list files you will touch, then implement.
- Finish each task with: what changed, how to test it manually, what is left.
- Commit message style: `feat: ...`, `fix: ...`, `docs: ...`, `test: ...`.

## Definition of done (per phase)
Code runs, `npm test` passes, manual check steps from the phase pass, docs updated, no console errors.
