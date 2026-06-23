# Agent guide — Mission Library Checkout

Read this before making changes. It captures the non-obvious things you need to know to develop on this project safely.

## What this is
Kiosk-style library checkout app for a single Win/Mac machine. SvelteKit 2 + Svelte 5 + SQLite (better-sqlite3) + TailwindCSS. Ships as a Node server (`adapter-node`) **or** as a packaged Electron desktop app.

## Stack & key files
- **Server logic:** `src/lib/server/`
  - `db.ts` — SQLite schema + **lazy** connection via `Proxy` (do not break this — see "Gotchas"). Exports `db`, types (`BookRow`, `CopyRow`, `Patron`, `CheckoutRow`), `getSetting`, `setSetting`.
  - `auth.ts` — admin password (bcrypt cost 10) + 256-bit session tokens (SHA-256 hashed, 12h TTL). `admin_sessions` table is in `db.ts`, **not** here.
  - `catalog.ts` — `planCatalog()` (dry run) and `importCatalog()` (apply). Has `previewCache` (in-memory Map, 15 min TTL, 10-entry cap, keyed by random 32-char hex token).
  - `checkout.ts` — `resolveCopyByBarcode`, `createCheckout`, `findPatronByPhone`, `createPatron`, `listCheckedOut`, `checkInByBarcode`.
- **Routes:**
  - `src/routes/+page.svelte` — public kiosk (phone + barcode).
  - `src/routes/admin/` — password-gated admin (catalog replace, checked-out list, check-in).
- **Hooks:** `src/hooks.server.ts` sets `event.locals.isAdmin` via `isAdminAuthenticated(cookies)`.
- **Electron:** `electron/main.cjs` — boots SvelteKit handler in-process on `127.0.0.1:3000`, opens BrowserWindow. Sets `process.env.LIBRARY_DB_PATH` **before** importing the handler. `MLC_KIOSK=1` → fullscreen.
- **CI:** `.github/workflows/build.yml` — matrix Windows/macOS builds, uploads installers as artifacts.

## How catalog import works
Each book in the LibraryThing JSON → one `books` row. Copies:
1. Explicit `barcode` field → one copy per barcode value.
2. No barcode but has ISBN → synthesized **placeholder barcode** `_isbn_<bookId>` (or `_isbn_<bookId>_<n>` for multiple copies). The kiosk's ISBN fallback in `resolveCopyByBarcode` still resolves real ISBN scans via `books.isbn_all_json LIKE %"<code>"%`. Placeholder format uses `bookId` (not raw ISBN) so two books sharing an ISBN don't collide.
3. Neither → copy with no barcode, flagged "needs barcode", not scannable.

Re-import replaces ISBN-derived copies with explicit barcodes once added. Books/copies missing from the new JSON are deleted **unless** they have active checkouts — those are kept and surfaced in the dry-run preview with a ⚠ warning.

## Dev workflow

```powershell
npm install
npm run dev              # SvelteKit dev server, port 5173
```

Production server (system Node):
```powershell
npm run build
$env:ORIGIN = "http://localhost:3000"
$env:BODY_SIZE_LIMIT = "52428800"   # 50 MB — catalogs are ~1.4 MB; default is 512 KB
npm start
```

Electron:
```powershell
npm run electron:rebuild   # MUST run after every `npm install`
npm run electron:start
```

## Gotchas (high-impact)

### 1. Lazy DB — do not eagerly call `new Database()` at module top level
Vite's SSR build evaluates server modules. If `db.ts` opens the SQLite connection at import time, it crashes when:
- The native binary is built for a different Node ABI (e.g., after `electron:rebuild`).
- Electron hasn't yet set `LIBRARY_DB_PATH`.

The `Proxy` in `db.ts` defers `openDb()` until the first property access. Keep it that way. Any new server code should access the DB via the exported `db` proxy, never instantiate `Database` directly.

### 2. better-sqlite3 ABI mismatch
- System Node 23.x → `NODE_MODULE_VERSION=131`
- Electron 33.x → `NODE_MODULE_VERSION=130`

`electron:rebuild` compiles for 130. After that, `npm start` fails. To switch back: `npm rebuild better-sqlite3 --build-from-source`. Document this in any PR that touches build scripts.

### 3. Stale `node build/index.js` processes lock the .node file on Windows
`electron:rebuild` fails with EPERM on `unlink` if any prior `node build/index.js` is still running. Always `Get-Process node | Stop-Process -Id $_.Id` before rebuilding.

### 4. SvelteKit CSRF + body limit (adapter-node only)
- `ORIGIN` env var **must** match the served origin exactly, or form POSTs return 403 "Cross-site POST form submissions are forbidden".
- `BODY_SIZE_LIMIT=52428800` is required for catalog uploads (~1.4 MB > default 512 KB).
- Both are baked into `electron/main.cjs` so Electron users don't need to set them.

### 5. Tailwind config — no top-level await
`tailwind.config.js` uses a static `import forms from '@tailwindcss/forms'`. Do not change to dynamic import — jiti chokes on top-level await.

### 6. Electron asar + native modules
Native modules (`better-sqlite3`, `@node-rs/bcrypt`, `bindings`) **must** be in `package.json.build.asarUnpack` — they can't be loaded from inside an asar archive. The Electron handler import uses `pathToFileURL(handlerPath).href` so asar paths resolve correctly.

### 7. Windows electron-builder needs symlink permission
`npm run electron:dist:win` locally requires PowerShell **as Administrator** or Windows **Developer Mode enabled** — electron-builder extracts macOS symlinks from its winCodeSign archive. GitHub Actions runners are unaffected. Don't fight this locally; use the CI workflow.

## Database location
- Server mode: `data/library.db` (override with `LIBRARY_DB_PATH`).
- Electron:
  - Windows: `%APPDATA%\Mission Library Checkout\data\library.db`
  - macOS: `~/Library/Application Support/Mission Library Checkout/data/library.db`
  - Linux: `~/.config/Mission Library Checkout/data/library.db`

Sensitive: contains patron phone numbers + bcrypt admin hash. Don't commit, don't ship sample DBs. `data/` is gitignored.

## Test data
`C:\Users\anschmidt\Downloads\librarything_SchmidtLibrary_202606222206.json` (1.4 MB, 642 books). Use for end-to-end import testing.

## Conventions
- Server-only modules live in `src/lib/server/` (enforced by SvelteKit — never accidentally imported into client bundles).
- Phone numbers stored as digits only, displayed formatted.
- No comments unless something is genuinely non-obvious (the lazy-DB Proxy, ABI notes, ISBN placeholder format).
- Use `npm run build` (not `vite build`) to ensure the adapter-node post-step runs.

## CI
`.github/workflows/build.yml` runs on push to `main`, PRs, and manual dispatch. Produces unsigned installers as workflow artifacts. To enable signing later, set `CSC_LINK`/`CSC_KEY_PASSWORD` (Win) or Apple Developer secrets (Mac) and remove `CSC_IDENTITY_AUTO_DISCOVERY: 'false'`.

## What this app is **not**
- No due dates, no overdue notifications.
- No multi-user admin / per-librarian audit log.
- No network sync — single-machine SQLite.
- No PWA / mobile. Kiosk only.

Keep it that way unless the user explicitly asks otherwise.
