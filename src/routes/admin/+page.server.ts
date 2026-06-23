import type { ServerLoad } from '@sveltejs/kit';
import { db } from '$lib/server/db';

export const load: ServerLoad = async () => {
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM books) AS books,
        (SELECT COUNT(*) FROM copies) AS copies,
        (SELECT COUNT(*) FROM copies WHERE barcode IS NULL) AS copies_no_barcode,
        (SELECT COUNT(*) FROM copies WHERE barcode_source = 'isbn') AS copies_isbn,
        (SELECT COUNT(*) FROM copies WHERE barcode_source = 'explicit') AS copies_explicit,
        (SELECT COUNT(*) FROM patrons) AS patrons,
        (SELECT COUNT(*) FROM checkouts WHERE checked_in_at IS NULL) AS active_checkouts,
        (SELECT COUNT(*) FROM checkouts) AS total_checkouts
      `
    )
    .get() as Record<string, number>;
  return { counts };
};
