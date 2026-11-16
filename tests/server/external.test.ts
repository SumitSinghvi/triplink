import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { FakeSupabase } from '../helpers/fakeSupabase';
import { jar } from '../helpers/cookies';
import { todayIso } from '@/lib/travelDate';

let fake: FakeSupabase;
async function load() {
  vi.resetModules();
  vi.doMock('@/lib/server/supabaseAdmin', () => ({ supabaseAdmin: () => fake }));
  vi.doMock('next/headers', () => ({ cookies: async () => jar }));
  return {
    pnrRoute: (await import('@/app/api/pnr/verify/route')).POST,
    flightRoute: (await import('@/app/api/flights/verify/route')).POST,
    scanRoute: (await import('@/app/api/pass/scan/route')).POST,
    flights: await import('@/lib/flightScraper'),
    pnr: await import('@/lib/pnrScraper'),
    cache: (await import('@/lib/pnrScraper/cache')).PnrCache,
    session: await import('@/lib/server/session'),
  };
}
const post = (body: unknown) => new NextRequest('http://localhost/api', { method: 'POST', body: JSON.stringify(body) });

beforeEach(() => {
  fake = new FakeSupabase();
  jar.store.clear();
});
afterEach(() => vi.unstubAllEnvs());

const adbFlight = {
  status: 'Expected',
  airline: { name: 'IndiGo' },
  departure: { airport: { iata: 'BOM', name: 'Mumbai', municipalityName: 'Mumbai' }, scheduledTime: { utc: '2026-11-17 04:10Z', local: '2026-11-17 09:40+05:30' }, terminal: '2' },
  arrival: { airport: { iata: 'SXR', name: 'Srinagar', municipalityName: 'Srinagar' }, scheduledTime: { utc: '2026-11-17 06:50Z', local: '2026-11-17 12:20+05:30' } },
};
const json = (v: unknown, status = 200) => new Response(JSON.stringify(v), { status });

describe('flights: verifyFlightWaterfall', () => {
  it.each([
    ['6E 214', { code: '6E', num: '214' }],
    ['ai-887', { code: 'AI', num: '887' }],
    ['QP1354', { code: 'QP', num: '1354' }],
    ['X', null],
    ['6E 12345', null],
    ['', null],
  ])('parseFlightNumber(%s)', async (input, want) => {
    const { flights } = await load();
    expect(flights.parseFlightNumber(input)).toEqual(want);
  });

  it('cacheTtlMs tightens as departure nears', async () => {
    const { flights } = await load();
    const H = 3600_000;
    expect(flights.cacheTtlMs(true, '2026-12-30', '2026-11-15')).toBe(72 * H);
    expect(flights.cacheTtlMs(true, '2026-11-20', '2026-11-15')).toBe(12 * H);
    expect(flights.cacheTtlMs(true, '2026-11-16', '2026-11-15')).toBe(1 * H);
    expect(flights.cacheTtlMs(false, '2026-12-30', '2026-11-15')).toBe(2 * H);
    expect(flights.cacheTtlMs(false, '2026-11-16', '2026-11-15')).toBe(6 * H);
  });

  it('maps AeroDataBox, caches the answer, then serves from cache', async () => {
    vi.stubEnv('AERODATABOX_API_KEY', 'k');
    const { flights } = await load();
    const f = vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([adbFlight]));
    const r = await flights.verifyFlightWaterfall('6E 214', '2026-11-17');
    expect(String(f.mock.calls[0][0])).toContain('/flights/number/6E214/2026-11-17');
    expect(r.data).toMatchObject({ fromCode: 'BOM', toCode: 'SXR', departureTime: '09:40', arrivalTime: '12:20', duration: '2h 40m', fromTerminal: 'T2', flightNumber: '6E 214', airlineName: 'IndiGo' });
    expect(fake.rows('flight_lookups')).toHaveLength(1);
    await flights.verifyFlightWaterfall('6E 214', '2026-11-17');
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('404/204 = real "not found" and is cached; 500 and timeouts are not cached', async () => {
    vi.stubEnv('AERODATABOX_API_KEY', 'k');
    const { flights } = await load();
    const f = vi.spyOn(globalThis, 'fetch');
    f.mockResolvedValueOnce(new Response(null, { status: 404 }));
    expect((await flights.verifyFlightWaterfall('6E 214', '2026-11-17')).success).toBe(false);
    expect(fake.rows('flight_lookups')).toHaveLength(1);

    fake.tables.flight_lookups = [];
    f.mockResolvedValueOnce(new Response('x', { status: 500 }));
    expect((await flights.verifyFlightWaterfall('6E 214', '2026-11-17')).success).toBe(false);
    f.mockRejectedValueOnce(new Error('timeout'));
    expect((await flights.verifyFlightWaterfall('6E 214', '2026-11-17')).success).toBe(false);
    expect(fake.rows('flight_lookups')).toHaveLength(0);
  });

  it('refetches once the cache entry is older than its TTL', async () => {
    vi.stubEnv('AERODATABOX_API_KEY', 'k');
    const { flights } = await load();
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json([adbFlight]));
    await flights.verifyFlightWaterfall('6E 214', '2026-11-17');
    fake.rows('flight_lookups')[0].fetched_at = new Date(Date.now() - 80 * 3600_000).toISOString();
    await flights.verifyFlightWaterfall('6E 214', '2026-11-17');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('no API key: not found (UI then offers manual entry); bad number: validation message; no date: today', async () => {
    const { flights } = await load();
    expect((await flights.verifyFlightWaterfall('6E 214', '2026-11-17')).error).toMatch(/not found/);
    expect((await flights.verifyFlightWaterfall('nonsense', '2026-11-17')).error).toMatch(/Invalid flight number/);
    expect((await flights.verifyFlightWaterfall('6E 214')).error).toContain(todayIso());
  });

  it('multi-leg: takes the first leg that has both airports', async () => {
    vi.stubEnv('AERODATABOX_API_KEY', 'k');
    const { flights } = await load();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([{ status: 'x', departure: {}, arrival: {} }, adbFlight]));
    expect((await flights.verifyFlightWaterfall('6E 214', '2026-11-17')).data?.fromCode).toBe('BOM');
  });

  it('route: 400 without flightNumber, 404 not found, 200 data, 500 on bad JSON', async () => {
    const { flightRoute } = await load();
    expect((await flightRoute(post({}))).status).toBe(400);
    expect((await flightRoute(post({ flightNumber: '6E 214', date: '2026-11-17' }))).status).toBe(404);
    vi.stubEnv('AERODATABOX_API_KEY', 'k');
    const again = await load();
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(json([adbFlight]));
    const res = await again.flightRoute(post({ flightNumber: '6E 214', date: '2026-11-17' }));
    expect(res.status).toBe(200);
    expect((await res.json()).data.toCode).toBe('SXR');
    expect((await again.flightRoute(new NextRequest('http://x', { method: 'POST', body: '{' }))).status).toBe(500);
  });

  it('known gap: no session needed (anyone can spend the AeroDataBox quota)', async () => {
    const { flightRoute } = await load();
    expect(jar.store.size).toBe(0);
    expect((await flightRoute(post({ flightNumber: '6E 214' }))).status).not.toBe(401);
  });
});

describe('pnr: verifyPNRWaterfall + route', () => {
  const confirmTkt = (over: Record<string, unknown> = {}) => ({
    TrainNo: '12951',
    TrainName: 'Tejas Rajdhani',
    Doj: '20-11-2026',
    From: 'NDLS',
    To: 'MMCT',
    Class: '3A',
    ChartPrepared: true,
    PassengerStatus: [{ Coach: 'B4', Berth: '12', BookingBerthCode: 'SL', CurrentStatus: 'CNF' }],
    ...over,
  });
  const PNR = '1234567890'; // not a demo preset

  it('rejects invalid PNRs before any network call', async () => {
    const { pnr } = await load();
    const f = vi.spyOn(globalThis, 'fetch');
    expect(await pnr.verifyPNRWaterfall('0123456789')).toMatchObject({ success: false, error: 'Invalid PNR' });
    expect(f).not.toHaveBeenCalled();
  });

  it('demo presets resolve offline with today\'s date', async () => {
    const { pnr } = await load();
    const f = vi.spyOn(globalThis, 'fetch');
    const r = await pnr.verifyPNRWaterfall('28 49-102451');
    expect(r).toMatchObject({ success: true, source: 'preset', result: { trainNumber: '12951', travelDate: todayIso(), maskedPnr: '28******51' } });
    expect(f).not.toHaveBeenCalled();
  });

  it('ConfirmTkt: maps fields, then second call is served from cache; forceFresh bypasses', async () => {
    const { pnr } = await load();
    const f = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => json(confirmTkt()));
    const r = await pnr.verifyPNRWaterfall(PNR);
    expect(r).toMatchObject({
      success: true,
      source: 'confirmtkt',
      result: { trainNumber: '12951', travelDate: '2026-11-20', coach: 'B4', berthNumber: 12, berthType: 'Side Lower', status: 'CONFIRMED', fromCode: 'NDLS' },
    });
    expect((await pnr.verifyPNRWaterfall(PNR)).success && (await pnr.verifyPNRWaterfall(PNR) as { source: string }).source).toBe('cache');
    expect(f).toHaveBeenCalledTimes(1);
    await pnr.verifyPNRWaterfall(PNR, { forceFresh: true });
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('waitlisted or pre-chart tickets are never cached', async () => {
    const { pnr, cache } = await load();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async () =>
      json(confirmTkt({ ChartPrepared: false, PassengerStatus: [{ CurrentStatus: 'WL 5' }] }))
    );
    const r = await pnr.verifyPNRWaterfall(PNR);
    expect(r).toMatchObject({ success: true, result: { status: 'WL', chartPrepared: false } });
    expect(cache.size()).toBe(0);
  });

  it.each([
    ['Error field', { Error: 'No such PNR' }, 'No such PNR'],
    ['InformationMessage', { InformationMessage: 'Flushed PNR' }, 'Flushed PNR'],
    ['missing TrainNo', { TrainNo: undefined }, /not found|flushed/i],
    ['unparseable date', { Doj: 'someday' }, /Unrecognized travel date/],
  ])('falls through to EaseMyTrip and reports the reason: %s', async (_n, over, reason) => {
    const { pnr } = await load();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) =>
      String(u).includes('confirmtkt') ? json(confirmTkt(over)) : new Response(null, { status: 500 })
    );
    const r = await pnr.verifyPNRWaterfall(PNR);
    expect(r).toMatchObject({ success: false, error: 'PNR not found' });
    expect((r as { reason: string }).reason).toMatch(reason as RegExp);
  });

  it('EaseMyTrip is used when ConfirmTkt fails', async () => {
    const { pnr } = await load();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) =>
      String(u).includes('confirmtkt')
        ? new Response(null, { status: 503 })
        : json({ TrainNo: '22436', TrainName: 'Vande Bharat', Doj: '2026-11-21', BoardingStation: 'NDLS', ReservationUpto: 'BSB', ChartPrepared: true, PassengerList: [{ BookingCoachId: 'C5', BookingBerthNo: '7', BookingBerthCode: 'SU' }] })
    );
    expect(await pnr.verifyPNRWaterfall(PNR)).toMatchObject({ success: true, source: 'easemytrip', result: { coach: 'C5', berthType: 'Side Upper', travelDate: '2026-11-21' } });
  });

  it('ConfirmTkt timeout reports a timeout reason', async () => {
    const { pnr } = await load();
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (u) => {
      if (String(u).includes('confirmtkt')) throw Object.assign(new Error('abort'), { name: 'AbortError' });
      return new Response(null, { status: 500 });
    });
    expect(((await pnr.verifyPNRWaterfall(PNR)) as { reason: string }).reason).toMatch(/timed out/);
  });

  it('route never returns the raw PNR; 400 without pnr; 404 when not found', async () => {
    const { pnrRoute } = await load();
    expect((await pnrRoute(post({}))).status).toBe(400);
    expect((await pnrRoute(post({ pnr: 123 }))).status).toBe(400);
    const ok = await pnrRoute(post({ pnr: '2849102451' }));
    const text = await ok.text();
    expect(ok.status).toBe(200);
    expect(text).not.toContain('2849102451');
    expect(JSON.parse(text).data.maskedPnr).toBe('28******51');
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 500 }));
    expect((await pnrRoute(post({ pnr: PNR }))).status).toBe(404);
  });

  it('known gap: no session needed', async () => {
    const { pnrRoute } = await load();
    expect((await pnrRoute(post({ pnr: '2849102451' }))).status).toBe(200);
  });
});

describe('POST /api/pass/scan', () => {
  const upload = (blob?: Blob) => {
    const fd = new FormData();
    if (blob) fd.append('file', blob, 'x.png');
    return new NextRequest('http://localhost/api/pass/scan', { method: 'POST', body: fd });
  };

  it('401 without a session', async () => {
    const { scanRoute } = await load();
    expect((await scanRoute(upload(new Blob(['x'])))).status).toBe(401);
  });

  it('400 for missing file or over 15 MB', async () => {
    const { scanRoute, session } = await load();
    jar.store.set('tl_session', session.encodeSession('usr_1111111111'));
    expect((await scanRoute(upload())).status).toBe(400);
    expect((await scanRoute(upload(new Blob([new Uint8Array(15 * 1024 * 1024 + 1)])))).status).toBe(400);
  });

  it('422 for something that is not an image', async () => {
    const { scanRoute, session } = await load();
    jar.store.set('tl_session', session.encodeSession('usr_1111111111'));
    expect((await scanRoute(upload(new Blob(['definitely not an image'])))).status).toBe(422);
  });

  it('a valid image with no barcode returns raw:null', async () => {
    const { scanRoute, session } = await load();
    jar.store.set('tl_session', session.encodeSession('usr_1111111111'));
    const sharp = (await import('sharp')).default;
    const png = await sharp({ create: { width: 200, height: 200, channels: 3, background: '#fff' } }).png().toBuffer();
    const res = await scanRoute(upload(new Blob([new Uint8Array(png)], { type: 'image/png' })));
    expect(await res.json()).toEqual({ raw: null });
  });
});
