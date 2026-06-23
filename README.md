# Mission Library Checkout

A simple, kiosk-style library checkout system. Single Windows or Mac machine, single SQLite file.

## Features
- **Public kiosk** (`/`): patron enters phone + barcode (scanner-friendly), sees the book title/author, and is checked out. First-time patrons are prompted for their name.
- **Admin** (`/admin`, shared password):
  - Replace the catalog from a LibraryThing JSON export.
  - View everything currently checked out, with search.
  - Check books in by barcode (or from the checked-out list).

## How catalog import works
Each book in the JSON becomes a `books` row. Copies are created as follows:
1. If the record has an explicit `barcode` field → one copy per barcode value.
2. Else if it has an ISBN → unique placeholder barcodes are synthesized (`_isbn_<bookId>` or `_isbn_<bookId>_<n>`) and the book remains checkoutable via the kiosk's ISBN fallback lookup. These placeholders never collide across books even when two books share an ISBN.
3. Else → the copy has no barcode and is flagged in the dashboard as "needs barcode" (not scannable until real barcodes are added).

Re-importing replaces ISBN-derived copies with explicit barcodes once you add them. Books or copies that disappear from the new JSON are removed **unless** they have active checkouts (those are kept and surfaced as warnings).

## Setup

```powershell
npm install
npm run build
# Required env vars for adapter-node:
$env:ORIGIN = "http://localhost:3000"
$env:BODY_SIZE_LIMIT = "52428800"   # 50 MB (catalogs can be large)
npm start                            # serves on http://localhost:3000
```

On macOS / Linux:

```bash
ORIGIN=http://localhost:3000 BODY_SIZE_LIMIT=52428800 npm start
```

First visit to `/admin/login` prompts you to set the admin password.

The database lives at `data/library.db` (override with `LIBRARY_DB_PATH`).

## Desktop app (Electron)

The app can also run as a standalone desktop application via Electron — no need to set env vars or run a separate server.

### Run locally

```powershell
npm install
npm run electron:rebuild   # rebuild better-sqlite3 for Electron's Node ABI (run after every npm install)
npm run electron:start     # builds SvelteKit + launches Electron window
```

Set `MLC_KIOSK=1` to launch fullscreen kiosk mode (no chrome, no exit shortcuts beyond Alt+F4):

```powershell
$env:MLC_KIOSK = "1"; npm run electron:start
```

The SQLite database is stored under the OS user-data dir:
- **Windows:** `%APPDATA%\Mission Library Checkout\data\library.db`
- **macOS:** `~/Library/Application Support/Mission Library Checkout/data/library.db`
- **Linux:** `~/.config/Mission Library Checkout/data/library.db`

### Build installers

```powershell
npm run electron:dist:win    # NSIS installer + portable .exe in dist-electron/
npm run electron:dist:mac    # DMG (arm64 + x64) — must run on macOS
```

**Windows note:** electron-builder downloads a code-signing toolchain that contains macOS symlinks. Extracting symlinks on Windows requires either:
- Running PowerShell **as Administrator**, or
- Enabling **Developer Mode** (Settings → Privacy & security → For developers → Developer Mode).

Without one of these, the `electron:dist:win` step fails during the winCodeSign extraction. `electron:start` (running the app locally) is unaffected.

### Switching back to `npm start`

After `electron:rebuild`, the native better-sqlite3 binary is compiled for Electron's Node ABI and plain `npm start` (system Node) will no longer load it. To switch back:

```powershell
npm rebuild better-sqlite3 --build-from-source
```

## Development

```powershell
npm run dev
```

## Notes
- Phone numbers are stored as digits only, displayed formatted.
- Barcode lookup precedence: exact barcode match → fallback ISBN/EAN match (picks first available copy).
- No due dates, no overdue notifications, no multi-user admin — by design (v1).
