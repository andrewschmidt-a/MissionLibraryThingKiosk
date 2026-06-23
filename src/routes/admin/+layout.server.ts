import { redirect, type ServerLoad } from '@sveltejs/kit';
import { adminIsConfigured } from '$lib/server/auth';

export const load: ServerLoad = async ({ locals, url }) => {
  const isLoginPage = url.pathname === '/admin/login';
  if (!adminIsConfigured() && !isLoginPage) {
    throw redirect(303, '/admin/login');
  }
  if (!locals.isAdmin && !isLoginPage) {
    throw redirect(303, '/admin/login');
  }
  return { isAdmin: locals.isAdmin };
};
