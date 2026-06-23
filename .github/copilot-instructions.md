# Copilot instructions

See [`AGENTS.md`](../AGENTS.md) for the full developer guide. Quick rules:

- **Never** call `new Database()` at module top level. Use the lazy `db` Proxy from `src/lib/server/db.ts`.
- Server-only modules live under `src/lib/server/`.
- After `npm install`, always run `npm run electron:rebuild` before launching Electron.
- After `electron:rebuild`, `npm start` (system Node) won't work until `npm rebuild better-sqlite3 --build-from-source`.
- Form POSTs in production need `ORIGIN` env var matching the served origin, or they return 403.
- Catalog uploads need `BODY_SIZE_LIMIT=52428800` (≈50 MB) — defaults are too small.
- Native modules (better-sqlite3, @node-rs/bcrypt, bindings) must stay in `package.json.build.asarUnpack`.
- Don't add comments unless the code is genuinely non-obvious.
- Don't expand scope: no due dates, no multi-user, no network sync. Single-machine kiosk.
- Tailwind config must use static imports — no top-level await.
