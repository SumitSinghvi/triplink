import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jar } from '../helpers/cookies';

async function load() {
  vi.resetModules();
  vi.doMock('next/headers', () => ({ cookies: async () => jar }));
  return import('@/lib/server/session');
}

beforeEach(() => jar.store.clear());
afterEach(() => vi.unstubAllEnvs());

describe('session cookie', () => {
  const uid = 'usr_9876543210';

  it('round-trips a user id', async () => {
    const s = await load();
    expect(s.decodeSession(s.encodeSession(uid))).toBe(uid);
  });

  it('rejects missing, malformed and tampered values', async () => {
    const s = await load();
    const good = s.encodeSession(uid);
    const [id, exp, sig] = good.split('.');
    expect(s.decodeSession(undefined)).toBeNull();
    expect(s.decodeSession('a.b')).toBeNull();
    expect(s.decodeSession(`usr_1111111111.${exp}.${sig}`)).toBeNull(); // other user, same sig
    expect(s.decodeSession(`${id}.${Number(exp) + 1}.${sig}`)).toBeNull(); // extended expiry
    expect(s.decodeSession(`${id}.${exp}.${sig.slice(0, -1)}x`)).toBeNull();
  });

  it('rejects expired sessions', async () => {
    const s = await load();
    const good = s.encodeSession(uid, 0);
    expect(s.decodeSession(good, 1000)).toBe(uid);
    expect(s.decodeSession(good, 31 * 24 * 3600 * 1000)).toBeNull();
  });

  it('rejects ids that are not usr_<10 digits>, even when correctly signed', async () => {
    const s = await load();
    expect(s.decodeSession(s.encodeSession('usr_123'))).toBeNull();
    expect(s.decodeSession(s.encodeSession('admin'))).toBeNull();
  });

  it('refuses to sign without a long secret', async () => {
    vi.stubEnv('SESSION_SECRET', 'short');
    const s = await load();
    expect(() => s.encodeSession(uid)).toThrow(/SESSION_SECRET/);
  });

  it('a cookie signed with another secret is rejected', async () => {
    const s = await load();
    const forged = s.encodeSession(uid);
    vi.stubEnv('SESSION_SECRET', 'another-secret-another-secret-another-1');
    const s2 = await load();
    expect(s2.decodeSession(forged)).toBeNull();
  });

  it('set/get/clear via cookies()', async () => {
    const s = await load();
    expect(await s.getSessionUserId()).toBeNull();
    await s.setSession(uid);
    expect(await s.getSessionUserId()).toBe(uid);
    await s.clearSession();
    expect(await s.getSessionUserId()).toBeNull();
  });
});
