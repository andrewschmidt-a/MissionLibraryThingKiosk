import type { Actions, ServerLoad } from '@sveltejs/kit';
import { checkInByBarcode, listCheckedOut } from '$lib/server/checkout';
import { db } from '$lib/server/db';

export const load: ServerLoad = async ({ url }) => {
  const q = url.searchParams.get('q') ?? '';
  return { rows: listCheckedOut(q), q };
};

export const actions: Actions = {
  checkin: async ({ request }) => {
    const form = await request.formData();
    const checkoutId = Number(form.get('checkout_id') ?? 0);
    if (!checkoutId) return { error: 'Missing checkout id.' };
    const row = db.prepare(`
      SELECT b.title FROM checkouts c
      JOIN copies cp ON cp.id = c.copy_id
      JOIN books b ON b.id = cp.book_id
      WHERE c.id = ? AND c.checked_in_at IS NULL
    `).get(checkoutId) as { title: string } | undefined;
    if (!row) return { error: 'That checkout is no longer active.' };
    db.prepare(`UPDATE checkouts SET checked_in_at = datetime('now') WHERE id = ?`).run(checkoutId);
    return { success: true, message: `Checked in: ${row.title}` };
  },
  checkinBarcode: async ({ request }) => {
    const form = await request.formData();
    const barcode = String(form.get('barcode') ?? '').trim();
    const result = checkInByBarcode(barcode);
    return { ...result };
  }
};
