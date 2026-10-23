# Interview notes
Update this after every phase. Read it before the interview.

## 30-second pitch
"LinkVault is a full-stack URL shortener. Express and MongoDB handle link creation, a server-side 302 redirect, atomic click counting, and optional expiry. The frontend is plain JavaScript. It is tested with Jest, rate-limited, and deployed on Render."

## 3-minute demo script
1. Create a link with an expiry two minutes out. 2. Open it three times in new tabs. 3. Show clicks = 3 and the stats chart. 4. Show the Mongo document in Atlas. 5. Wait for expiry and show the 410 page. 6. Show the test run and the architecture diagram.

## Likely questions and answers (fill in as you build)
- Why 302 and not 301? (browsers cache 301, so later clicks would bypass the server and not be counted)
- How do you avoid duplicate codes? (unique index plus retry on duplicate key error)
- What if two people click at the same instant? (atomic `$inc`, no lost updates)
- How do you stop malicious links? (http/https allowlist, length limit, rate limiting; not a full safe-browsing check)
- How would you scale it? (cache hot codes in Redis, write clicks asynchronously via a queue, add an index on `code`, shard by code)
- What would you add with more time? (auth, per-user dashboards, QR codes, safe-browsing check, custom domains)

## Decisions log
| Date | Decision | Why | Trade-off |
|---|---|---|---|
|  |  |  |  |
