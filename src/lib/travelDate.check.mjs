// Self-check: node src/lib/travelDate.check.mjs
import assert from 'node:assert/strict';
import { normalizeTravelDate } from './travelDate.ts';

const cases = [
  ['2026-11-14', '2026-11-14'],
  ['2026-11-14 · 08:20 - 09:35 (1h 15m)', '2026-11-14'],
  ['14-11-2026', '2026-11-14'],
  ['4/1/2027', '2027-01-04'],
  ['14.11.2026', '2026-11-14'],
  ['14-Nov-2026', '2026-11-14'],
  ['14 November 2026', '2026-11-14'],
  ['Nov 14, 2026', '2026-11-14'],
  ['31-13-2026', null],
  ['Today', null],
  [undefined, null],
];

for (const [input, want] of cases) assert.equal(normalizeTravelDate(input), want, String(input));
console.log(`travelDate: ${cases.length} cases ok`);
