import { fail, type Actions } from '@sveltejs/kit';
import {
  cachePreview,
  clearCachedPreview,
  getCachedPreview,
  importCatalog,
  planCatalog,
  type CatalogPlan,
  type ImportSummary
} from '$lib/server/catalog';

export const actions: Actions = {
  preview: async ({ request }) => {
    const form = await request.formData();
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) {
      return fail(400, { error: 'Please choose a catalog JSON file.' });
    }
    let text: string;
    try {
      text = await file.text();
    } catch (e) {
      return fail(400, { error: 'Could not read file: ' + (e as Error).message });
    }
    let plan: CatalogPlan;
    try {
      plan = planCatalog(text);
    } catch (e) {
      return fail(400, { error: 'Could not analyze catalog: ' + (e as Error).message });
    }
    const token = cachePreview(text);
    return { plan, token, fileName: file.name, fileSize: file.size };
  },

  apply: async ({ request }) => {
    const form = await request.formData();
    const token = String(form.get('token') ?? '');
    const json = getCachedPreview(token);
    if (!json) {
      return fail(400, { error: 'Preview expired. Please upload the file again.' });
    }
    let summary: ImportSummary;
    try {
      summary = importCatalog(json);
    } catch (e) {
      return fail(400, { error: 'Import failed: ' + (e as Error).message });
    }
    clearCachedPreview(token);
    return { summary };
  },

  cancel: async ({ request }) => {
    const form = await request.formData();
    const token = String(form.get('token') ?? '');
    if (token) clearCachedPreview(token);
    return { cancelled: true };
  }
};
