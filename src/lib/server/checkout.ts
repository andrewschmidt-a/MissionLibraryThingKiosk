import { db, type BookRow, type CopyRow, type Patron } from './db';

export function normalizePhone(input: string): string {
  return (input ?? '').replace(/\D+/g, '');
}

export function formatPhone(digits: string): string {
  const d = normalizePhone(digits);
  if (d.length === 10) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length === 11 && d.startsWith('1')) return `+1 (${d.slice(1, 4)}) ${d.slice(4, 7)}-${d.slice(7)}`;
  return digits;
}

export function findPatronByPhone(phone: string): Patron | null {
  const p = normalizePhone(phone);
  if (!p) return null;
  const row = db.prepare('SELECT * FROM patrons WHERE phone = ?').get(p) as Patron | undefined;
  return row ?? null;
}

export function createPatron(phone: string, firstName: string, lastName: string): Patron {
  const p = normalizePhone(phone);
  const info = db
    .prepare('INSERT INTO patrons (phone, first_name, last_name) VALUES (?, ?, ?)')
    .run(p, firstName.trim(), lastName.trim());
  return db.prepare('SELECT * FROM patrons WHERE id = ?').get(info.lastInsertRowid) as Patron;
}

export type ResolvedCopy = {
  copy: CopyRow;
  book: BookRow;
  matchedBy: 'barcode' | 'isbn';
};

export function resolveCopyByBarcode(input: string): ResolvedCopy | null {
  const code = (input ?? '').trim();
  if (!code) return null;

  // 1. exact barcode match
  const copy = db.prepare('SELECT * FROM copies WHERE barcode = ?').get(code) as CopyRow | undefined;
  if (copy) {
    const book = db.prepare('SELECT * FROM books WHERE id = ?').get(copy.book_id) as BookRow;
    return { copy, book, matchedBy: 'barcode' };
  }

  // 2. ISBN/EAN fallback: scan books with matching isbn primary first, then isbn_all_json
  const byPrimary = db.prepare('SELECT * FROM books WHERE isbn = ?').get(code) as BookRow | undefined;
  let book: BookRow | undefined = byPrimary;
  if (!book) {
    // LIKE search in isbn_all_json — small DB, fine
    const rows = db
      .prepare(`SELECT * FROM books WHERE isbn_all_json LIKE ?`)
      .all(`%"${code}"%`) as BookRow[];
    book = rows[0];
  }
  if (!book) return null;

  // Pick an available copy of that book (no active checkout)
  const available = db
    .prepare(
      `SELECT cp.* FROM copies cp
       WHERE cp.book_id = ?
         AND NOT EXISTS (
           SELECT 1 FROM checkouts c WHERE c.copy_id = cp.id AND c.checked_in_at IS NULL
         )
       ORDER BY cp.id LIMIT 1`
    )
    .get(book.id) as CopyRow | undefined;
  if (!available) {
    // All copies are out; return first copy to allow the caller to report "already checked out"
    const any = db.prepare('SELECT * FROM copies WHERE book_id = ? ORDER BY id LIMIT 1').get(book.id) as CopyRow | undefined;
    if (!any) return null;
    return { copy: any, book, matchedBy: 'isbn' };
  }
  return { copy: available, book, matchedBy: 'isbn' };
}

export function isCopyCheckedOut(copyId: number): boolean {
  return !!db.prepare('SELECT 1 FROM checkouts WHERE copy_id = ? AND checked_in_at IS NULL').get(copyId);
}

export function createCheckout(copyId: number, patronId: number): number {
  const info = db
    .prepare('INSERT INTO checkouts (copy_id, patron_id) VALUES (?, ?)')
    .run(copyId, patronId);
  return Number(info.lastInsertRowid);
}

export type CheckedOutRow = {
  checkout_id: number;
  copy_id: number;
  barcode: string | null;
  book_id: string;
  title: string;
  primary_author: string | null;
  patron_id: number;
  patron_first: string | null;
  patron_last: string | null;
  phone: string;
  checked_out_at: string;
};

export function listCheckedOut(search?: string): CheckedOutRow[] {
  const q = (search ?? '').trim();
  const base = `
    SELECT
      c.id AS checkout_id,
      cp.id AS copy_id,
      cp.barcode AS barcode,
      b.id AS book_id,
      b.title AS title,
      b.primary_author AS primary_author,
      p.id AS patron_id,
      p.first_name AS patron_first,
      p.last_name AS patron_last,
      p.phone AS phone,
      c.checked_out_at AS checked_out_at
    FROM checkouts c
    JOIN copies cp ON cp.id = c.copy_id
    JOIN books b ON b.id = cp.book_id
    JOIN patrons p ON p.id = c.patron_id
    WHERE c.checked_in_at IS NULL
  `;
  if (!q) {
    return db.prepare(base + ' ORDER BY c.checked_out_at DESC').all() as CheckedOutRow[];
  }
  const like = `%${q}%`;
  return db
    .prepare(base + ` AND (b.title LIKE ? OR b.primary_author LIKE ? OR p.first_name LIKE ? OR p.last_name LIKE ? OR p.phone LIKE ? OR cp.barcode LIKE ?) ORDER BY c.checked_out_at DESC`)
    .all(like, like, like, like, like, like) as CheckedOutRow[];
}

export type CheckInResult = {
  ok: boolean;
  message: string;
  book?: BookRow;
  patron?: Patron;
};

export function checkInByBarcode(input: string): CheckInResult {
  const resolved = resolveCopyByBarcode(input);
  if (!resolved) return { ok: false, message: 'Barcode not found in catalog.' };
  const open = db
    .prepare(`SELECT id, patron_id FROM checkouts WHERE copy_id = ? AND checked_in_at IS NULL`)
    .get(resolved.copy.id) as { id: number; patron_id: number } | undefined;
  if (!open) return { ok: false, message: `"${resolved.book.title}" is not currently checked out.` };
  db.prepare(`UPDATE checkouts SET checked_in_at = datetime('now') WHERE id = ?`).run(open.id);
  const patron = db.prepare('SELECT * FROM patrons WHERE id = ?').get(open.patron_id) as Patron;
  return { ok: true, message: `Checked in: ${resolved.book.title}`, book: resolved.book, patron };
}
