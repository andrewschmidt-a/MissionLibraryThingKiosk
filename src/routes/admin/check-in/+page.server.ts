import type { Actions } from '@sveltejs/kit';
import { checkInByBarcode } from '$lib/server/checkout';

export const actions: Actions = {
  default: async ({ request }) => {
    const form = await request.formData();
    const barcode = String(form.get('barcode') ?? '').trim();
    if (!barcode) return { ok: false, message: 'Please enter a barcode.' };
    const result = checkInByBarcode(barcode);
    const patronName = result.patron
      ? [result.patron.first_name, result.patron.last_name].filter(Boolean).join(' ') || result.patron.phone
      : null;
    return { ...result, patronName };
  }
};
