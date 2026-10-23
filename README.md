# LinkVault

A full-stack URL shortener built for a college club recruitment task.

## Features
- Short-link generation (random 7-char code or custom alias)
- Server-side HTTP 302 redirect
- Atomic click counting
- Optional link expiry (410 Gone when expired)
- Per-link stats (total clicks + 7-day breakdown)

## Stack
- **Backend:** Node.js 20+, Express 4, MongoDB Atlas (Mongoose), CommonJS
- **Frontend:** Plain HTML, CSS, vanilla JS (no build step)
- **Tests:** Jest + Supertest + mongodb-memory-server
- **Deploy:** Render

## Setup

```bash
# 1. Clone and install
git clone <repo-url>
cd linkvault
npm install

# 2. Create your .env from the template
cp .env.example .env
# Fill in MONGO_URI with your Atlas connection string

# 3. Start the dev server
npm run dev
# → http://localhost:3000/health should return {"status":"ok"}
```

## Frontend

After `npm run dev`, open **http://localhost:3000** in a browser.

The single-page dashboard lets you:
- **Create** a short link (optional custom alias, optional expiry date)
- **Copy** the short URL to your clipboard with one click
- **Open** a short link — the server issues the HTTP 302 redirect
- **Delete** a link (with confirmation dialog)

Empty, loading, and error states are all handled in the UI.  
No framework, no build step — plain HTML, CSS, and vanilla JS in `public/`.

## Scripts
| Command | What it does |
|---------|-------------|
| `npm run dev` | Start with nodemon (auto-restart) |
| `npm start` | Production start |
| `npm test` | Run all Jest tests |
| `npm run lint` | ESLint |

## Live URL
_To be added after Render deploy (Phase 6)._
