import { fail, type Actions } from '@sveltejs/kit';
import {
  createCheckout,
  createPatron,
  findPatronByPhone,
  isCopyCheckedOut,
  normalizePhone,
  resolveCopyByBarcode
} from '$lib/server/checkout';

export const actions: Actions = {
  lookup: async ({ request }) => {
    const form = await request.formData();
    const phoneRaw = String(form.get('phone') ?? '');
    const barcodeRaw = String(form.get('barcode') ?? '');
    const phone = normalizePhone(phoneRaw);
    const barcode = barcodeRaw.trim();

    if (!phone || phone.length < 7) {
      return fail(400, { phone: phoneRaw, barcode: barcodeRaw, error: 'Please enter a valid phone number.' });
    }
    if (!barcode) {
      return fail(400, { phone: phoneRaw, barcode: barcodeRaw, error: 'Please enter or scan a barcode.' });
    }

    const resolved = resolveCopyByBarcode(barcode);
    if (!resolved) {
      return fail(404, { phone: phoneRaw, barcode: barcodeRaw, error: `Barcode "${barcode}" was not found in the catalog.` });
    }

    if (isCopyCheckedOut(resolved.copy.id)) {
      return fail(409, {
        phone: phoneRaw,
        barcode: barcodeRaw,
        error: `"${resolved.book.title}" is already checked out.`,
        title: resolved.book.title,
        author: resolved.book.primary_author
      });
    }

    const patron = findPatronByPhone(phone);
    if (!patron) {
      return {
        needsPatron: true,
        phone,
        barcode,
        copyId: resolved.copy.id,
        title: resolved.book.title,
        author: resolved.book.primary_author
      };
    }

    createCheckout(resolved.copy.id, patron.id);
    return {
      success: true,
      title: resolved.book.title,
      author: resolved.book.primary_author,
      patronName: [patron.first_name, patron.last_name].filter(Boolean).join(' ') || patron.phone
    };
  },

  registerAndCheckout: async ({ request }) => {
    const form = await request.formData();
    const phone = normalizePhone(String(form.get('phone') ?? ''));
    const first = String(form.get('first_name') ?? '').trim();
    const last = String(form.get('last_name') ?? '').trim();
    const copyId = Number(form.get('copy_id') ?? 0);
    const title = String(form.get('title') ?? '');
    const author = String(form.get('author') ?? '');

    if (!phone || !copyId) {
      return fail(400, { error: 'Missing phone or barcode info.', needsPatron: true, phone, copyId, title, author });
    }
    if (!first || !last) {
      return fail(400, {
        error: 'Please enter both first and last name.',
        needsPatron: true,
        phone,
        copyId,
        title,
        author,
        first_name: first,
        last_name: last
      });
    }

    if (isCopyCheckedOut(copyId)) {
      return fail(409, { error: 'This item was just checked out by someone else.', title, author });
    }

    let patron = findPatronByPhone(phone);
    if (!patron) patron = createPatron(phone, first, last);
    createCheckout(copyId, patron.id);

    return {
      success: true,
      title,
      author,
      patronName: [patron.first_name, patron.last_name].filter(Boolean).join(' ') || patron.phone
    };
  }
};
