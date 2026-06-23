import { db } from './db';

type RawBook = {
  books_id?: string;
  title?: string;
  primaryauthor?: string;
  authors?: Array<{ lf?: string; fl?: string; role?: string }>;
  originalisbn?: string;
  isbn?: Record<string, string> | string[];
  ean?: string[] | Record<string, string>;
  barcode?: Record<string, string> | string[];
  copies?: string | number;
};

export type ImportSummary = {
  booksAdded: number;
  booksUpdated: number;
  booksRemoved: number;
  booksKeptDueToActiveCheckouts: number;
  copiesAdded: number;
  copiesRemoved: number;
  bySource: { explicit: number; isbn: number; none: number };
  warnings: string[];
};

export type PlanCopyChange = {
  barcode: string | null;
  source: 'explicit' | 'isbn' | 'none';
  hasActiveCheckout: boolean;
};

export type PlanBookAdd = {
  id: string;
  title: string;
  primary_author: string | null;
  copies: number;
  bySource: { explicit: number; isbn: number; none: number };
};

export type PlanBookUpdate = {
  id: string;
  title: string;
  primary_author: string | null;
  fieldsChanged: string[];
  copiesToAdd: PlanCopyChange[];
  copiesToRemove: PlanCopyChange[];
};

export type PlanBookDelete = {
  id: string;
  title: string;
  primary_author: string | null;
  copies: number;
  activeCheckouts: number;
};

export type CatalogPlan = {
  add: PlanBookAdd[];
  update: PlanBookUpdate[];
  delete: PlanBookDelete[];
  totals: {
    booksAdded: number;
    booksUpdated: number;
    booksRemoved: number;
    booksWithActiveBlockingDelete: number;
    copiesAdded: number;
    copiesRemoved: number;
    copiesRemovedWithActive: number;
    bySource: { explicit: number; isbn: number; none: number };
  };
};

function collectStrings(v: unknown, out: string[]): void {
  if (v == null) return;
  if (typeof v === 'string') {
    const s = v.trim();
    if (s) out.push(s);
    return;
  }
  if (Array.isArray(v)) {
    for (const item of v) collectStrings(item, out);
    return;
  }
  if (typeof v === 'object') {
    for (const item of Object.values(v as Record<string, unknown>)) collectStrings(item, out);
  }
}

function collectIsbns(rec: RawBook): string[] {
  const out: string[] = [];
  collectStrings(rec.originalisbn, out);
  collectStrings(rec.isbn, out);
  collectStrings(rec.ean, out);
  return Array.from(new Set(out));
}

function collectBarcodes(rec: RawBook): string[] {
  const out: string[] = [];
  collectStrings(rec.barcode, out);
  return Array.from(new Set(out));
}

function copiesCount(rec: RawBook): number {
  const c = rec.copies;
  if (typeof c === 'number') return Math.max(1, Math.floor(c));
  if (typeof c === 'string') {
    const n = parseInt(c, 10);
    return Number.isFinite(n) && n > 0 ? n : 1;
  }
  return 1;
}

type DesiredCopy = { barcode: string | null; source: 'explicit' | 'isbn' | 'none' };

function computeDesiredCopies(rec: RawBook, id: string, primaryIsbn: string | null): DesiredCopy[] {
  const explicit = collectBarcodes(rec);
  const out: DesiredCopy[] = [];
  if (explicit.length > 0) {
    for (const bc of explicit) out.push({ barcode: bc, source: 'explicit' });
  } else if (primaryIsbn) {
    const n = copiesCount(rec);
    if (n === 1) out.push({ barcode: `_isbn_${id}`, source: 'isbn' });
    else for (let i = 1; i <= n; i++) out.push({ barcode: `_isbn_${id}_${i}`, source: 'isbn' });
  } else {
    const n = copiesCount(rec);
    for (let i = 0; i < n; i++) out.push({ barcode: null, source: 'none' });
  }
  return out;
}

type ExtractedBook = {
  id: string;
  title: string;
  primaryAuthor: string | null;
  isbns: string[];
  primaryIsbn: string | null;
  rec: RawBook;
};

function extractBook(key: string, rec: RawBook): ExtractedBook | null {
  const id = String(rec.books_id ?? key).trim();
  if (!id) return null;
  const title = (rec.title ?? '').toString().trim() || '(Untitled)';
  const primaryAuthor = (rec.primaryauthor ?? '').toString().trim() || null;
  const isbns = collectIsbns(rec);
  const primaryIsbn = rec.originalisbn?.toString().trim() || isbns[0] || null;
  return { id, title, primaryAuthor, isbns, primaryIsbn, rec };
}

export function importCatalog(jsonText: string): ImportSummary {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Catalog JSON must be an object keyed by book id');
  }

  const summary: ImportSummary = {
    booksAdded: 0,
    booksUpdated: 0,
    booksRemoved: 0,
    booksKeptDueToActiveCheckouts: 0,
    copiesAdded: 0,
    copiesRemoved: 0,
    bySource: { explicit: 0, isbn: 0, none: 0 },
    warnings: []
  };

  const incomingIds = new Set<string>();

  const tx = db.transaction(() => {
    const existsStmt = db.prepare('SELECT 1 FROM books WHERE id = ?');
    const upsertBook = db.prepare(`
      INSERT INTO books (id, title, primary_author, authors_json, isbn, isbn_all_json, raw_json)
      VALUES (@id, @title, @primary_author, @authors_json, @isbn, @isbn_all_json, @raw_json)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        primary_author = excluded.primary_author,
        authors_json = excluded.authors_json,
        isbn = excluded.isbn,
        isbn_all_json = excluded.isbn_all_json,
        raw_json = excluded.raw_json
    `);

    const existingCopies = db.prepare('SELECT id, barcode, barcode_source FROM copies WHERE book_id = ?');
    const insertCopy = db.prepare('INSERT INTO copies (book_id, barcode, barcode_source) VALUES (?, ?, ?)');
    const deleteCopyById = db.prepare('DELETE FROM copies WHERE id = ?');
    const copyHasActive = db.prepare(`SELECT 1 FROM checkouts WHERE copy_id = ? AND checked_in_at IS NULL LIMIT 1`);

    for (const [key, rawUnknown] of Object.entries(parsed)) {
      const ex = extractBook(key, rawUnknown as RawBook);
      if (!ex) continue;
      const { id, title, primaryAuthor, isbns, primaryIsbn, rec } = ex;
      incomingIds.add(id);

      const wasExisting = existsStmt.get(id) !== undefined;
      upsertBook.run({
        id,
        title,
        primary_author: primaryAuthor,
        authors_json: rec.authors ? JSON.stringify(rec.authors) : null,
        isbn: primaryIsbn,
        isbn_all_json: JSON.stringify(isbns),
        raw_json: JSON.stringify(rec)
      });
      if (wasExisting) summary.booksUpdated++;
      else summary.booksAdded++;

      const desired = computeDesiredCopies(rec, id, primaryIsbn);

      // Reconcile with existing copies
      const existing = existingCopies.all(id) as Array<{ id: number; barcode: string | null; barcode_source: string }>;
      const existingByBarcode = new Map<string, { id: number; barcode_source: string }>();
      const existingNullCopies: Array<{ id: number; barcode_source: string }> = [];
      for (const c of existing) {
        if (c.barcode === null) existingNullCopies.push({ id: c.id, barcode_source: c.barcode_source });
        else existingByBarcode.set(c.barcode, { id: c.id, barcode_source: c.barcode_source });
      }

      const keepIds = new Set<number>();
      const nullPool = [...existingNullCopies];

      for (const d of desired) {
        if (d.barcode !== null && existingByBarcode.has(d.barcode)) {
          keepIds.add(existingByBarcode.get(d.barcode)!.id);
          existingByBarcode.delete(d.barcode);
          summary.bySource[d.source]++;
        } else if (d.barcode === null && nullPool.length > 0) {
          keepIds.add(nullPool.shift()!.id);
          summary.bySource[d.source]++;
        } else {
          insertCopy.run(id, d.barcode, d.source);
          summary.copiesAdded++;
          summary.bySource[d.source]++;
        }
      }

      // Remove leftover existing copies that aren't desired (unless they have active checkouts)
      const leftovers = [...existingByBarcode.values(), ...nullPool];
      for (const c of leftovers) {
        if (keepIds.has(c.id)) continue;
        if (copyHasActive.get(c.id)) {
          summary.warnings.push(`Book ${id} ("${title}"): copy ${c.id} kept because it has an active checkout.`);
          continue;
        }
        deleteCopyById.run(c.id);
        summary.copiesRemoved++;
      }
    }

    // Remove books no longer in JSON (only if no active checkouts on any copy)
    const allExisting = db.prepare('SELECT id, title FROM books').all() as Array<{ id: string; title: string }>;
    const bookHasActive = db.prepare(`
      SELECT 1 FROM checkouts c
      JOIN copies cp ON cp.id = c.copy_id
      WHERE cp.book_id = ? AND c.checked_in_at IS NULL LIMIT 1
    `);
    const deleteBook = db.prepare('DELETE FROM books WHERE id = ?');
    for (const b of allExisting) {
      if (incomingIds.has(b.id)) continue;
      if (bookHasActive.get(b.id)) {
        summary.booksKeptDueToActiveCheckouts++;
        summary.warnings.push(`Book ${b.id} ("${b.title}") not in new catalog but kept due to active checkouts.`);
        continue;
      }
      deleteBook.run(b.id);
      summary.booksRemoved++;
    }
  });

  tx();
  return summary;
}

// ---- Dry-run planning + cache ----

export function planCatalog(jsonText: string): CatalogPlan {
  const parsed = JSON.parse(jsonText);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Catalog JSON must be an object keyed by book id');
  }

  const plan: CatalogPlan = {
    add: [],
    update: [],
    delete: [],
    totals: {
      booksAdded: 0,
      booksUpdated: 0,
      booksRemoved: 0,
      booksWithActiveBlockingDelete: 0,
      copiesAdded: 0,
      copiesRemoved: 0,
      copiesRemovedWithActive: 0,
      bySource: { explicit: 0, isbn: 0, none: 0 }
    }
  };

  const incomingIds = new Set<string>();

  const getBook = db.prepare('SELECT id, title, primary_author, isbn, isbn_all_json FROM books WHERE id = ?');
  const getCopiesForBook = db.prepare('SELECT id, barcode, barcode_source FROM copies WHERE book_id = ?');
  const copyHasActive = db.prepare('SELECT 1 FROM checkouts WHERE copy_id = ? AND checked_in_at IS NULL LIMIT 1');
  const countActiveForBook = db
    .prepare(`SELECT COUNT(*) AS n FROM checkouts c JOIN copies cp ON cp.id = c.copy_id WHERE cp.book_id = ? AND c.checked_in_at IS NULL`);

  for (const [key, rawUnknown] of Object.entries(parsed)) {
    const ex = extractBook(key, rawUnknown as RawBook);
    if (!ex) continue;
    const { id, title, primaryAuthor, isbns, primaryIsbn, rec } = ex;
    incomingIds.add(id);

    const desired = computeDesiredCopies(rec, id, primaryIsbn);
    const existingBook = getBook.get(id) as
      | { id: string; title: string; primary_author: string | null; isbn: string | null; isbn_all_json: string | null }
      | undefined;

    if (!existingBook) {
      const bySource = { explicit: 0, isbn: 0, none: 0 };
      for (const d of desired) {
        bySource[d.source]++;
        plan.totals.bySource[d.source]++;
      }
      plan.add.push({
        id,
        title,
        primary_author: primaryAuthor,
        copies: desired.length,
        bySource
      });
      plan.totals.booksAdded++;
      plan.totals.copiesAdded += desired.length;
      continue;
    }

    // Existing book → compute diff
    const existingCopies = getCopiesForBook.all(id) as Array<{ id: number; barcode: string | null; barcode_source: string }>;
    const existingByBarcode = new Map<string, { id: number; source: string }>();
    const existingNulls: Array<{ id: number; source: string }> = [];
    for (const c of existingCopies) {
      if (c.barcode === null) existingNulls.push({ id: c.id, source: c.barcode_source });
      else existingByBarcode.set(c.barcode, { id: c.id, source: c.barcode_source });
    }

    const matched = new Set<number>();
    const copiesToAdd: PlanCopyChange[] = [];
    const nullPool = [...existingNulls];

    for (const d of desired) {
      if (d.barcode !== null && existingByBarcode.has(d.barcode)) {
        matched.add(existingByBarcode.get(d.barcode)!.id);
        existingByBarcode.delete(d.barcode);
      } else if (d.barcode === null && nullPool.length > 0) {
        matched.add(nullPool.shift()!.id);
      } else {
        copiesToAdd.push({ barcode: d.barcode, source: d.source, hasActiveCheckout: false });
      }
      plan.totals.bySource[d.source]++;
    }

    const leftovers = [
      ...[...existingByBarcode.entries()].map(([bc, v]) => ({ id: v.id, barcode: bc, source: v.source })),
      ...nullPool.map((n) => ({ id: n.id, barcode: null as string | null, source: n.source }))
    ];
    const copiesToRemove: PlanCopyChange[] = [];
    for (const c of leftovers) {
      if (matched.has(c.id)) continue;
      const active = !!copyHasActive.get(c.id);
      copiesToRemove.push({
        barcode: c.barcode,
        source: (c.source as 'explicit' | 'isbn' | 'none') ?? 'explicit',
        hasActiveCheckout: active
      });
    }

    const fieldsChanged: string[] = [];
    if ((existingBook.title ?? '') !== title) fieldsChanged.push('title');
    if ((existingBook.primary_author ?? '') !== (primaryAuthor ?? '')) fieldsChanged.push('author');
    if ((existingBook.isbn ?? '') !== (primaryIsbn ?? '')) fieldsChanged.push('isbn');
    if ((existingBook.isbn_all_json ?? '') !== JSON.stringify(isbns)) fieldsChanged.push('isbn_list');

    if (fieldsChanged.length === 0 && copiesToAdd.length === 0 && copiesToRemove.length === 0) {
      continue; // unchanged
    }

    plan.update.push({
      id,
      title,
      primary_author: primaryAuthor,
      fieldsChanged,
      copiesToAdd,
      copiesToRemove
    });
    plan.totals.booksUpdated++;
    plan.totals.copiesAdded += copiesToAdd.length;
    plan.totals.copiesRemoved += copiesToRemove.length;
    plan.totals.copiesRemovedWithActive += copiesToRemove.filter((c) => c.hasActiveCheckout).length;
  }

  // Books to delete
  const allExisting = db.prepare('SELECT id, title, primary_author FROM books').all() as Array<{
    id: string;
    title: string;
    primary_author: string | null;
  }>;
  for (const b of allExisting) {
    if (incomingIds.has(b.id)) continue;
    const copies = (db.prepare('SELECT COUNT(*) AS n FROM copies WHERE book_id = ?').get(b.id) as { n: number }).n;
    const active = (countActiveForBook.get(b.id) as { n: number }).n;
    plan.delete.push({
      id: b.id,
      title: b.title,
      primary_author: b.primary_author,
      copies,
      activeCheckouts: active
    });
    plan.totals.booksRemoved++;
    if (active > 0) {
      plan.totals.booksWithActiveBlockingDelete++;
      plan.totals.copiesRemovedWithActive += active;
    }
  }

  return plan;
}

// In-memory cache of uploaded JSON so user can preview then apply without re-uploading.
const previewCache = new Map<string, { json: string; size: number; expires: number }>();
const PREVIEW_TTL_MS = 15 * 60 * 1000;

function sweepCache(): void {
  const now = Date.now();
  for (const [k, v] of previewCache) if (v.expires < now) previewCache.delete(k);
}

export function cachePreview(json: string): string {
  sweepCache();
  // Avoid unbounded memory: cap to 10 cached uploads
  if (previewCache.size >= 10) {
    const oldest = [...previewCache.entries()].sort((a, b) => a[1].expires - b[1].expires)[0];
    if (oldest) previewCache.delete(oldest[0]);
  }
  const token = randomToken();
  previewCache.set(token, { json, size: json.length, expires: Date.now() + PREVIEW_TTL_MS });
  return token;
}

export function getCachedPreview(token: string): string | null {
  sweepCache();
  const entry = previewCache.get(token);
  return entry ? entry.json : null;
}

export function clearCachedPreview(token: string): void {
  previewCache.delete(token);
}

function randomToken(): string {
  // 16-byte hex without importing node:crypto at module top (already imported elsewhere is fine, but keep local)
  const bytes = new Uint8Array(16);
  for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
