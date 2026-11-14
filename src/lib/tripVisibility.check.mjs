// Self-check: node src/lib/tripVisibility.check.mjs
import assert from 'node:assert/strict';
import { showFromFor, canSee } from './tripVisibility.ts';

const vis = (business, social, twoh = false) => ({ business, social, twoh });

// show_from: off -> null; departure known -> 2h earlier; unknown -> start of IST travel day
assert.equal(showFromFor(vis(true, false), '2026-11-20'), null);
assert.equal(showFromFor(vis(true, false, true), '2026-11-20', '2026-11-20T08:20:00+05:30'), '2026-11-20T00:50:00.000Z');
assert.equal(showFromFor(vis(true, false, true), '2026-11-20'), '2026-11-19T18:30:00.000Z');

const now = Date.parse('2026-11-20T01:00:00Z');
// shared mode required
assert.equal(canSee(vis(true, false), { visible_business: true, visible_social: false }, now), true);
assert.equal(canSee(vis(true, false), { visible_business: false, visible_social: true }, now), false);
assert.equal(canSee(vis(false, true), { visible_business: false, visible_social: true }, now), true);
assert.equal(canSee(vis(false, false), { visible_business: true, visible_social: true }, now), false);
// legacy rows without columns behave as business-visible
assert.equal(canSee(vis(true, false), {}, now), true);
// show_from gate
assert.equal(canSee(vis(true, false), { visible_business: true, show_from: '2026-11-20T02:00:00Z' }, now), false);
assert.equal(canSee(vis(true, false), { visible_business: true, show_from: '2026-11-20T00:50:00Z' }, now), true);
console.log('tripVisibility: ok');
