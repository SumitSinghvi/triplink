// Self-check for the AeroDataBox mapping (mocked API). Run: node src/lib/flightScraper/aerodatabox.check.mjs
import assert from 'node:assert';
import { fileURLToPath } from 'node:url';
import { createJiti } from 'jiti';

const jiti = createJiti(import.meta.url, { alias: { '@': fileURLToPath(new URL('../..', import.meta.url)) } });
process.env.AERODATABOX_API_KEY = 'test';
let url = '';
delete process.env.SUPABASE_SECRET_KEY; // no cache: always hit the (mocked) API
delete process.env.SUPABASE_SERVICE_ROLE_KEY;
globalThis.fetch = async (u) => {
  if (!String(u).includes('aerodatabox')) throw new Error('unexpected fetch ' + u);
  url = u;
  return new Response(JSON.stringify([{
    status: 'Expected', airline: { name: 'IndiGo' },
    departure: { airport: { iata: 'BOM', name: 'Mumbai', municipalityName: 'Mumbai' }, scheduledTime: { utc: '2026-11-17 04:10Z', local: '2026-11-17 09:40+05:30' }, terminal: '2' },
    arrival: { airport: { iata: 'SXR', name: 'Srinagar', municipalityName: 'Srinagar' }, scheduledTime: { utc: '2026-11-17 06:50Z', local: '2026-11-17 12:20+05:30' } },
  }]), { status: 200 });
};
const { verifyFlightWaterfall, cacheTtlMs } = await jiti.import('./index.ts');
const H = 3600_000;
assert.strictEqual(cacheTtlMs(true, '2026-12-30', '2026-11-15'), 72 * H); // weeks out
assert.strictEqual(cacheTtlMs(true, '2026-11-20', '2026-11-15'), 12 * H); // this week
assert.strictEqual(cacheTtlMs(true, '2026-11-16', '2026-11-15'), 1 * H); // tomorrow
assert.strictEqual(cacheTtlMs(false, '2026-12-30', '2026-11-15'), 2 * H); // miss, far out
assert.strictEqual(cacheTtlMs(false, '2026-11-16', '2026-11-15'), 6 * H); // miss, near
const r = await verifyFlightWaterfall('6E 214', '2026-11-17');
assert.ok(url.includes('/flights/number/6E214/2026-11-17'));
assert.deepStrictEqual(
  [r.data?.fromCode, r.data?.toCode, r.data?.departureTime, r.data?.arrivalTime, r.data?.duration, r.data?.fromTerminal],
  ['BOM', 'SXR', '09:40', '12:20', '2h 40m', 'T2']
);
delete process.env.AERODATABOX_API_KEY;
assert.strictEqual((await verifyFlightWaterfall('6E 214', '2026-11-17')).success, false);
console.log('ok');
