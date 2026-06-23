import type { Handle } from '@sveltejs/kit';
import { isAdminAuthenticated } from '$lib/server/auth';

export const handle: Handle = async ({ event, resolve }) => {
  event.locals.isAdmin = isAdminAuthenticated(event.cookies);
  return resolve(event);
};
