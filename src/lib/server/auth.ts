import { hash, verify } from '@node-rs/bcrypt';
import { randomBytes, createHash } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { db, getSetting, setSetting } from './db';

const ADMIN_HASH_KEY = 'admin_password_hash';
const SESSION_COOKIE = 'mlc_admin';
const SESSION_TTL_MS = 12 * 60 * 60 * 1000; // 12h

export function adminIsConfigured(): boolean {
  return getSetting(ADMIN_HASH_KEY) !== null;
}

export async function setAdminPassword(password: string): Promise<void> {
  if (!password || password.length < 4) throw new Error('Password must be at least 4 characters.');
  const h = await hash(password, 10);
  setSetting(ADMIN_HASH_KEY, h);
}

export async function verifyAdminPassword(password: string): Promise<boolean> {
  const h = getSetting(ADMIN_HASH_KEY);
  if (!h) return false;
  return verify(password, h);
}

function hashToken(t: string): string {
  return createHash('sha256').update(t).digest('hex');
}

export function createSession(cookies: Cookies): void {
  const token = randomBytes(32).toString('hex');
  const expires = Date.now() + SESSION_TTL_MS;
  db.prepare('INSERT INTO admin_sessions (token_hash, expires_at) VALUES (?, ?)').run(hashToken(token), expires);
  cookies.set(SESSION_COOKIE, token, {
    path: '/',
    httpOnly: true,
    sameSite: 'lax',
    secure: false, // local kiosk
    maxAge: Math.floor(SESSION_TTL_MS / 1000)
  });
}

export function destroySession(cookies: Cookies): void {
  const token = cookies.get(SESSION_COOKIE);
  if (token) db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token));
  cookies.delete(SESSION_COOKIE, { path: '/' });
}

export function isAdminAuthenticated(cookies: Cookies): boolean {
  const token = cookies.get(SESSION_COOKIE);
  if (!token) return false;
  const row = db.prepare('SELECT expires_at FROM admin_sessions WHERE token_hash = ?').get(hashToken(token)) as
    | { expires_at: number }
    | undefined;
  if (!row) return false;
  if (row.expires_at < Date.now()) {
    db.prepare('DELETE FROM admin_sessions WHERE token_hash = ?').run(hashToken(token));
    return false;
  }
  return true;
}
