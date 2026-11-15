// Signed, httpOnly session cookie: "<userId>.<expiresMs>.<hmac>". Issued after OTP verification.
import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';

const COOKIE = 'tl_session';
const MAX_AGE_S = 30 * 24 * 60 * 60;

// User ids are server-generated (usr_<10 digits>); anything else is rejected everywhere.
export const USER_ID_RE = /^usr_\d{10}$/;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s || s.length < 32) throw new Error('SESSION_SECRET (32+ chars) must be set on the server');
  return s;
}

function sign(payload: string): string {
  return createHmac('sha256', secret()).update(payload).digest('base64url');
}

export function encodeSession(userId: string, now = Date.now()): string {
  const payload = `${userId}.${now + MAX_AGE_S * 1000}`;
  return `${payload}.${sign(payload)}`;
}

export function decodeSession(value: string | undefined, now = Date.now()): string | null {
  if (!value) return null;
  const parts = value.split('.');
  if (parts.length !== 3) return null;
  const [userId, exp, sig] = parts;
  const expected = Buffer.from(sign(`${userId}.${exp}`));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  if (!USER_ID_RE.test(userId) || !(Number(exp) > now)) return null;
  return userId;
}

export async function getSessionUserId(): Promise<string | null> {
  return decodeSession((await cookies()).get(COOKIE)?.value);
}

export async function setSession(userId: string): Promise<void> {
  (await cookies()).set(COOKIE, encodeSession(userId), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: MAX_AGE_S,
  });
}

export async function clearSession(): Promise<void> {
  (await cookies()).delete(COOKIE);
}
