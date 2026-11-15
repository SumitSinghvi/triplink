// Self-check: node src/lib/bcbp.check.mjs
import assert from 'node:assert/strict';
import { parseBcbp, julianToIso, nameMatches } from './bcbp.ts';

// IATA spec sample (single leg, no conditional data)
const spec = parseBcbp('M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100');
assert.deepEqual(spec, {
  passengerName: 'DESMARAIS/LUC',
  legs: [{ pnr: 'ABC123', fromCode: 'YUL', toCode: 'FRA', carrier: 'AC', flightNumber: '834', julianDay: 326, seat: '1A' }],
});

// Two legs with conditional data (size "0A" hex = 10 chars) on leg 1
const two = parseBcbp(
  'M2SINGH/SUMIT MR      EXYZ987 AMDBOM6E 0214 319Y012C0045 10A>518000W  XYZ987 BOMBLR6E 0457 319Y003F0012 100'
);
assert.equal(two.legs.length, 2);
assert.equal(two.legs[0].carrier + two.legs[0].flightNumber, '6E214');
assert.equal(two.legs[1].fromCode + two.legs[1].toCode, 'BOMBLR');
assert.equal(two.legs[1].seat, '3F');

// Garbage / truncated / non-BCBP QR text
assert.equal(parseBcbp('https://example.com'), null);
assert.equal(parseBcbp('M1SHORT'), null);
assert.equal(parseBcbp('M1DESMARAIS/LUC       EABC123 Y1LFRAAC 0834 326J001A0025 100'), null);

// Julian day -> nearest date
assert.equal(julianToIso(326, '2026-11-15'), '2026-11-22');
assert.equal(julianToIso(2, '2026-12-30'), '2027-01-02');
assert.equal(julianToIso(364, '2027-01-02'), '2026-12-30');
assert.equal(julianToIso(366, '2026-11-15'), ''); // no leap year within ±1y -> invalid
assert.equal(julianToIso(366, '2028-11-15'), '2028-12-31');

assert.equal(nameMatches('SINGH/SUMIT MR', 'Sumit Singhvi'), true);
assert.equal(nameMatches('DESMARAIS/LUC', 'Sumit Singhvi'), false);
console.log('bcbp: ok');
