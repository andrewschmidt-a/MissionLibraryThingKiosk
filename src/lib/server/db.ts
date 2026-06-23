import Database, { type Database as DatabaseInstance } from 'better-sqlite3';
import { mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

let _db: DatabaseInstance | null = null;

function dbPath(): string {
  return process.env.LIBRARY_DB_PATH ?? resolve(process.cwd(), 'data', 'library.db');
}

function openDb(): DatabaseInstance {
  const p = dbPath();
  if (!existsSync(dirname(p))) mkdirSync(dirname(p), { recursive: true });
  const conn = new Database(p);
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  conn.exec(`
CREATE TABLE IF NOT EXISTS books (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  primary_author  TEXT,
  authors_json    TEXT,
  isbn            TEXT,
  isbn_all_json   TEXT,
  raw_json        TEXT
);

CREATE TABLE IF NOT EXISTS copies (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id         TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  barcode         TEXT UNIQUE,
  barcode_source  TEXT NOT NULL DEFAULT 'explicit'
);
CREATE INDEX IF NOT EXISTS idx_copies_book ON copies(book_id);
CREATE INDEX IF NOT EXISTS idx_copies_barcode ON copies(barcode);

CREATE TABLE IF NOT EXISTS patrons (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  phone       TEXT NOT NULL UNIQUE,
  first_name  TEXT,
  last_name   TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS checkouts (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  copy_id         INTEGER NOT NULL REFERENCES copies(id) ON DELETE CASCADE,
  patron_id       INTEGER NOT NULL REFERENCES patrons(id) ON DELETE RESTRICT,
  checked_out_at  TEXT NOT NULL DEFAULT (datetime('now')),
  checked_in_at   TEXT
);
CREATE INDEX IF NOT EXISTS idx_checkouts_open ON checkouts(checked_in_at);
CREATE INDEX IF NOT EXISTS idx_checkouts_copy ON checkouts(copy_id);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash TEXT PRIMARY KEY,
  expires_at INTEGER NOT NULL
);
`);
  return conn;
}

// Lazy proxy so `import { db } from './db'` does not open the DB at module-eval time.
// This matters during build (svelte-kit / vite may evaluate server modules) and when
// the native binding has not yet been rebuilt for the host runtime.
export const db = new Proxy({} as DatabaseInstance, {
  get(_target, prop, receiver) {
    if (!_db) _db = openDb();
    const value = Reflect.get(_db, prop, _db);
    return typeof value === 'function' ? value.bind(_db) : value;
  }
});

export type BookRow = {
  id: string;
  title: string;
  primary_author: string | null;
  authors_json: string | null;
  isbn: string | null;
  isbn_all_json: string | null;
  raw_json: string | null;
};

export type CopyRow = {
  id: number;
  book_id: string;
  barcode: string | null;
  barcode_source: 'explicit' | 'isbn' | 'none';
};

export type Patron = {
  id: number;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  created_at: string;
};

export type CheckoutRow = {
  id: number;
  copy_id: number;
  patron_id: number;
  checked_out_at: string;
  checked_in_at: string | null;
};

export function getSetting(key: string): string | null {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare('INSERT INTO settings(key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}
