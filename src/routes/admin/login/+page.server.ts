import { fail, redirect, type Actions, type ServerLoad } from '@sveltejs/kit';
import {
  adminIsConfigured,
  createSession,
  destroySession,
  setAdminPassword,
  verifyAdminPassword
} from '$lib/server/auth';

export const load: ServerLoad = async ({ locals }) => {
  return {
    configured: adminIsConfigured(),
    isAdmin: locals.isAdmin
  };
};

export const actions: Actions = {
  setup: async ({ request, cookies }) => {
    if (adminIsConfigured()) return fail(400, { error: 'Admin password already set.' });
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    const confirm = String(form.get('confirm') ?? '');
    if (password.length < 4) return fail(400, { error: 'Password must be at least 4 characters.' });
    if (password !== confirm) return fail(400, { error: 'Passwords do not match.' });
    await setAdminPassword(password);
    createSession(cookies);
    throw redirect(303, '/admin');
  },
  login: async ({ request, cookies }) => {
    const form = await request.formData();
    const password = String(form.get('password') ?? '');
    const ok = await verifyAdminPassword(password);
    if (!ok) return fail(401, { error: 'Incorrect password.' });
    createSession(cookies);
    throw redirect(303, '/admin');
  },
  logout: async ({ cookies }) => {
    destroySession(cookies);
    throw redirect(303, '/admin/login');
  }
};
