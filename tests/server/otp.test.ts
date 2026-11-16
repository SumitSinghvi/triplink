import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { FakeSupabase } from '../helpers/fakeSupabase';
import { jar } from '../helpers/cookies';

let fake: FakeSupabase;

async function load() {
  vi.resetModules();
  vi.doMock('@/lib/server/supabaseAdmin', () => ({ supabaseAdmin: () => fake }));
  vi.doMock('next/headers', () => ({ cookies: async () => jar }));
  return {
    store: await import('@/lib/otpStore'),
    send: (await import('@/app/api/auth/send-otp/route')).POST,
    verify: (await import('@/app/api/auth/verify-otp/route')).POST,
    session: await import('@/lib/server/session'),
  };
}
const post = (body: unknown) =>
  new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });

const PHONE = '9876543210';

beforeEach(() => {
  fake = new FakeSupabase();
  jar.store.clear();
});
afterEach(() => vi.unstubAllEnvs());

describe('otpStore.verifyOtp', () => {
  // NODE_ENV=production + SMS key => demo code 1234 only for DEMO_PHONES
  const prod = () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FAST2SMS_API_KEY', 'k');
  };

  it('accepts the right code once, then it is gone', async () => {
    prod();
    const { store } = await load();
    await store.saveOtp(PHONE, '5555');
    expect(await store.verifyOtp(PHONE, '5555')).toEqual({ valid: true });
    expect(await store.verifyOtp(PHONE, '5555')).toEqual({ valid: false, reason: 'OTP expired or not requested' });
  });

  it('counts wrong attempts and locks after 5', async () => {
    prod();
    const { store } = await load();
    await store.saveOtp(PHONE, '5555');
    for (let i = 0; i < 5; i++) expect((await store.verifyOtp(PHONE, '0000')).reason).toBe('Incorrect OTP');
    const locked = await store.verifyOtp(PHONE, '5555'); // even the right code is refused now
    expect(locked.valid).toBe(false);
    expect(locked.reason).toMatch(/Too many/);
    expect(fake.rows('auth_otps')).toHaveLength(0);
  });

  it('expires after the TTL', async () => {
    prod();
    vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-11-16T10:00:00Z') });
    const { store } = await load();
    await store.saveOtp(PHONE, '5555', 300);
    vi.setSystemTime(Date.parse('2026-11-16T10:05:01Z'));
    expect((await store.verifyOtp(PHONE, '5555')).reason).toBe('OTP has expired');
    vi.useRealTimers();
  });

  it('1234 is refused in production with an SMS key, except for demo phones', async () => {
    prod();
    const { store } = await load();
    expect((await store.verifyOtp(PHONE, '1234')).valid).toBe(false);
    expect((await store.verifyOtp('8610539925', '1234')).valid).toBe(true);
  });

  it('1234 works in dev and in production without an SMS key (documented demo mode)', async () => {
    const { store } = await load();
    expect((await store.verifyOtp(PHONE, '1234')).valid).toBe(true);
    vi.stubEnv('NODE_ENV', 'production');
    const prodNoKey = await load();
    expect((await prodNoKey.store.verifyOtp(PHONE, '1234')).valid).toBe(true);
  });

  it('formats: strips non-digits, uses last 10', async () => {
    prod();
    const { store } = await load();
    await store.saveOtp('+91 98765-43210', '5555');
    expect((await store.verifyOtp(`+91${PHONE}`, ' 5555 ')).valid).toBe(true);
  });

  it('known gap: when Supabase throws, the in-memory fallback has no attempt limit', async () => {
    prod();
    const { store } = await load();
    await store.saveOtp(PHONE, '5555');
    fake.from = () => {
      throw new Error('down');
    };
    for (let i = 0; i < 10; i++) expect((await store.verifyOtp(PHONE, '0000')).reason).toBe('Incorrect OTP');
    expect((await store.verifyOtp(PHONE, '5555')).valid).toBe(true);
  });

  it('known gap: OTP is stored in plaintext in otp_hash', async () => {
    prod();
    const { store } = await load();
    await store.saveOtp(PHONE, '5555');
    expect(fake.rows('auth_otps')[0].otp_hash).toBe('5555');
  });
});

describe('POST /api/auth/send-otp', () => {
  it('rejects short numbers', async () => {
    const { send } = await load();
    const res = await send(post({ phone: '12345' }));
    expect(res.status).toBe(400);
  });

  it('dev without SMS key: demo message + devOtp, OTP saved for the last 10 digits', async () => {
    const { send } = await load();
    const body = await (await send(post({ phone: `+91 ${PHONE}` }))).json();
    expect(body).toMatchObject({ success: true, message: 'Demo mode: enter code 1234' });
    expect(body.devOtp).toMatch(/^\d{4}$/);
    expect(fake.rows('auth_otps')[0].phone).toBe(PHONE);
  });

  it('production demo mode never echoes the generated OTP', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const { send } = await load();
    const body = await (await send(post({ phone: PHONE }))).json();
    expect(body.success).toBe(true);
    expect(body).not.toHaveProperty('devOtp');
  });

  it('SMS provider ok / refusing', async () => {
    vi.stubEnv('FAST2SMS_API_KEY', 'k');
    const { send } = await load();
    const fetchMock = vi.spyOn(globalThis, 'fetch');
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ return: true })));
    const ok = await send(post({ phone: PHONE }));
    expect(ok.status).toBe(200);
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string)).toMatchObject({ route: 'otp', numbers: PHONE });

    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({ return: false })));
    expect((await send(post({ phone: PHONE }))).status).toBe(502);
  });

  it('SMS network failure -> 500', async () => {
    vi.stubEnv('FAST2SMS_API_KEY', 'k');
    const { send } = await load();
    vi.spyOn(globalThis, 'fetch').mockRejectedValueOnce(new Error('net'));
    expect((await send(post({ phone: PHONE }))).status).toBe(500);
  });

  it('known gap: no rate limit, any number of sends succeeds', async () => {
    const { send } = await load();
    for (let i = 0; i < 20; i++) expect((await send(post({ phone: PHONE }))).status).toBe(200);
  });
});

describe('POST /api/auth/verify-otp', () => {
  it('400 on missing/short input', async () => {
    const { verify } = await load();
    expect((await verify(post({ phone: '123', otp: '1234' }))).status).toBe(400);
    expect((await verify(post({ phone: PHONE }))).status).toBe(400);
  });

  it('wrong code -> 400 with reason, no cookie', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FAST2SMS_API_KEY', 'k');
    const { verify } = await load();
    const res = await verify(post({ phone: PHONE, otp: '9999' }));
    expect(res.status).toBe(400);
    expect(jar.store.size).toBe(0);
  });

  it('new user: sets session cookie, profile null', async () => {
    const { verify, session } = await load();
    const body = await (await verify(post({ phone: PHONE, otp: '1234' }))).json();
    expect(body).toMatchObject({ success: true, userId: `usr_${PHONE}`, profile: null });
    expect(await session.getSessionUserId()).toBe(`usr_${PHONE}`);
  });

  it('returning user: profile row is returned', async () => {
    fake.seed('profiles', [{ id: `usr_${PHONE}`, name: 'Asha', company: 'Asha Textiles' }]);
    const { verify } = await load();
    const body = await (await verify(post({ phone: PHONE, otp: '1234' }))).json();
    expect(body.profile).toMatchObject({ name: 'Asha' });
  });
});
