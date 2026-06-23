# Claude Code instructions

This project's full agent guide lives in [`AGENTS.md`](./AGENTS.md). Read it before making changes — it covers the lazy DB Proxy, better-sqlite3 ABI gotchas, Electron packaging quirks, and the catalog import rules.

## Quick rules
- **Never** call `new Database()` at module top level. Use the lazy `db` Proxy from `src/lib/server/db.ts`.
- Server-only code lives under `src/lib/server/` (SvelteKit will refuse to bundle it for the client).
- After `npm install`, run `npm run electron:rebuild` before launching Electron.
- After `electron:rebuild`, plain `npm start` won't work until `npm rebuild better-sqlite3 --build-from-source`.
- Form POSTs in production need `ORIGIN` env matching the served origin or they 403.
- Catalog uploads need `BODY_SIZE_LIMIT=52428800` (~50 MB) — default is 512 KB.
- Native modules (`better-sqlite3`, `@node-rs/bcrypt`, `bindings`) must stay in `package.json.build.asarUnpack`.
- `tailwind.config.js` must use static imports — no top-level await (jiti chokes).
- No comments unless the code is genuinely non-obvious.
- Don't expand scope: single-machine kiosk. No due dates, no multi-user, no network sync.

## When in doubt
- Test changes via `npm run dev` first, then verify with `npm run build` (not `vite build` — the adapter-node post-step matters).
- Use the user's test JSON at `C:\Users\anschmidt\Downloads\librarything_SchmidtLibrary_202606222206.json` (642 books) for end-to-end import testing.
- Don't run `npm run electron:dist:win` locally — it needs Admin/Developer Mode for symlinks. Let CI build installers.
