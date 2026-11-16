import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { A, B, C, DATE, bcbp, loadServer, profileRow, trip, tripRow } from '../helpers/dbHarness';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'], now: Date.parse('2026-11-16T06:00:00Z') });
});
afterEach(() => vi.useRealTimers());

// 2026-11-20 is day 324 of the year.
const J = 324;

describe('syncUserTrip / fetchUserTrips', () => {
  it('stores a normalised row with visibility and show_from', async () => {
    const { db, fake } = await loadServer();
    const t = trip({ departsAt: `${DATE}T08:20:00+05:30`, vis: { business: true, social: true, twoh: true } });
    expect(await db.syncUserTrip(A, t)).toBe(true);
    expect(fake.rows('trips')).toMatchObject([
      {
        id: `trip_${A}_6E214_${DATE}`,
        user_id: A,
        train_number: '6E214',
        from_code: 'AMD',
        to_code: 'BOM',
        from_station: 'AMD',
        visible_business: true,
        visible_social: true,
        show_from: '2026-11-20T00:50:00.000Z',
        mode: 'business',
      },
    ]);
  });

  it('is idempotent per user+journey+date', async () => {
    const { db, fake } = await loadServer();
    await db.syncUserTrip(A, trip());
    await db.syncUserTrip(A, trip({ id: 'other_local_id' }));
    expect(fake.rows('trips')).toHaveLength(1);
  });

  it('refuses a trip with no usable date, and surfaces DB errors as false', async () => {
    const { db, fake } = await loadServer();
    expect(await db.syncUserTrip(A, trip({ travelDate: undefined, when: 'soon' }))).toBe(false);
    fake.failNext('trips', { message: 'x' }, 'upsert');
    expect(await db.syncUserTrip(A, trip())).toBe(false);
  });

  it('social-only trip gets the legacy mode label "social"', async () => {
    const { db, fake } = await loadServer();
    await db.syncUserTrip(A, trip({ vis: { business: false, social: true, twoh: false } }));
    expect(fake.rows('trips')[0].mode).toBe('social');
  });

  it('fetchUserTrips returns only upcoming trips, ordered, with kind and visibility', async () => {
    const { db } = await loadServer((f) =>
      f.seed('trips', [
        tripRow(A, { id: 'late', travel_date: '2026-12-01' }),
        tripRow(A, { id: 'early', travel_date: '2026-11-17', train_number: '12951', train_name: 'Tejas (12951)', show_from: '2026-11-17T00:00:00Z' }),
        tripRow(A, { id: 'past', travel_date: '2026-11-01' }),
        tripRow(B, { id: 'not_mine' }),
      ])
    );
    const trips = await db.fetchUserTrips(A);
    expect(trips.map((t) => t.id)).toEqual(['early', 'late']);
    expect(trips[0]).toMatchObject({ kind: 'train', travelDate: '2026-11-17', vis: { business: true, social: false, twoh: true } });
    expect(trips[1].kind).toBe('flight');
  });

  it('legacy schema (no v2 columns): writes/reads only legacy columns, visibility derived from mode', async () => {
    const { db, fake } = await loadServer((f) => {
      f.missingColumns = { trips: ['visible_business', 'visible_social', 'show_from', 'from_station', 'to_station', 'ticket_verified'], profiles: ['first_name', 'mode_business'] };
    });
    expect(await db.syncUserTrip(A, trip({ vis: { business: false, social: true, twoh: false } }))).toBe(true);
    expect(fake.rows('trips')[0]).not.toHaveProperty('visible_business');
    const [t] = await db.fetchUserTrips(A);
    expect(t.vis).toEqual({ business: false, social: true, twoh: false });
  });

  it('retries the schema probe after a network error instead of caching "legacy"', async () => {
    const { db, fake } = await loadServer();
    fake.failNext('trips', { message: 'network down' }); // first probe
    expect(await db.hasV2Schema()).toBe(false);
    expect(await db.hasV2Schema()).toBe(true);
  });
});

describe('syncUserProfile', () => {
  it('falls back name -> first -> Traveler and intent -> Partner', async () => {
    const { db, fake } = await loadServer();
    const base = { name: '', company: '', industry: '', look: [], cities: [], first: '', interests: [], langs: [] };
    await db.syncUserProfile(A, base);
    expect(fake.rows('profiles')[0]).toMatchObject({ name: 'Traveler', intent: 'Partner', company: null });
    await db.syncUserProfile(A, { ...base, first: 'Asha', look: ['Sell', 'Buy'] }, { business: false, social: true });
    expect(fake.rows('profiles')[0]).toMatchObject({ name: 'Asha', intent: 'Sell', mode_business: false, mode_social: true });
  });
  it('returns false on DB error', async () => {
    const { db, fake } = await loadServer();
    fake.failNext('profiles', { message: 'x' }, 'upsert');
    expect(await db.syncUserProfile(A, { name: 'x', company: '', industry: '', look: [], cities: [], first: '', interests: [], langs: [] })).toBe(false);
  });
});

describe('boarding-pass verification', () => {
  const ticket = (over = {}) => bcbp({ carrier: '6E', flight: '214', julian: J, ...over });

  it('syncUserTrip with a matching pass sets ticket_verified; the raw pass is never stored', async () => {
    const { db, fake } = await loadServer();
    await db.syncUserTrip(A, trip(), ticket());
    expect(fake.rows('trips')[0].ticket_verified).toBe(true);
    expect(JSON.stringify(fake.tables)).not.toContain('TEST/USER');
    expect(JSON.stringify(fake.tables)).not.toContain('ABC123');
  });

  it.each([
    ['other flight', { flight: '215' }],
    ['other carrier', { carrier: 'AI' }],
    ['other day', { julian: J + 1 }],
  ])('does not verify with a pass for %s', async (_n, over) => {
    const { db, fake } = await loadServer();
    await db.syncUserTrip(A, trip(), ticket(over));
    expect(fake.rows('trips')[0]).not.toHaveProperty('ticket_verified');
  });

  it('garbage pass is ignored but the trip is still saved', async () => {
    const { db, fake } = await loadServer();
    expect(await db.syncUserTrip(A, trip(), 'https://example.com')).toBe(true);
    expect(fake.rows('trips')).toHaveLength(1);
    expect(fake.rows('trips')[0]).not.toHaveProperty('ticket_verified');
  });

  it('verifyTripTicket creates the row if missing and returns true only for a valid pass', async () => {
    const { db, fake } = await loadServer();
    expect(await db.verifyTripTicket(A, trip(), ticket({ julian: J + 1 }))).toBe(false);
    expect(fake.rows('trips')).toHaveLength(0);
    expect(await db.verifyTripTicket(A, trip(), ticket())).toBe(true);
    expect(fake.rows('trips')[0].ticket_verified).toBe(true);
  });

  it('a later re-sync without a pass never un-verifies', async () => {
    const { db, fake } = await loadServer();
    await db.verifyTripTicket(A, trip(), ticket());
    await db.syncUserTrip(A, trip({ departsAt: `${DATE}T09:00:00+05:30` }));
    expect(fake.rows('trips')[0].ticket_verified).toBe(true);
  });

  it('without the ticket_verified column nothing verifies', async () => {
    const { db } = await loadServer((f) => (f.missingColumns = { trips: ['ticket_verified'] }));
    expect(await db.verifyTripTicket(A, trip(), ticket())).toBe(false);
  });

  it('known gap: passenger name is not checked, any pass for the flight verifies', async () => {
    const { db } = await loadServer();
    expect(await db.verifyTripTicket(A, trip(), ticket({ name: 'SOMEONE/ELSE' }))).toBe(true);
  });
});

describe('fetchLiveCoTravelers', () => {
  const seed = (extra: (f: import('../helpers/fakeSupabase').FakeSupabase) => void = () => {}) => (f: import('../helpers/fakeSupabase').FakeSupabase) => {
    f.seed('profiles', [profileRow(A), profileRow(B, { name: 'Bina Shah', company: 'Shah Mills', interests: ['Cricket'] }), profileRow(C)]);
    extra(f);
  };

  it('same journey + date, excluding self', async () => {
    const { db } = await loadServer(seed((f) => f.seed('trips', [tripRow(A), tripRow(B), tripRow(C, { travel_date: '2026-11-21' })])));
    const res = await db.fetchLiveCoTravelers(trip(), A, 'Textiles');
    expect(res).toMatchObject([
      { id: `match_${B}`, name: 'Bina Shah', ini: 'BS', company: 'Shah Mills', type: 'Business', line: 'Shah Mills • Traveling on Flight 6E 214' },
    ]);
  });

  it('fit score: 80 base, +12 same industry, +6 same coach, +3 adjacent, capped at 98', async () => {
    const mk = async (coachB: string | null, industryA?: string) => {
      const { db } = await loadServer(seed((f) => f.seed('trips', [tripRow(B, { coach: coachB })])));
      return (await db.fetchLiveCoTravelers(trip({ coach: 'B4' }), A, industryA))[0].fit;
    };
    expect(await mk(null)).toBe(80);
    expect(await mk(null, 'textiles')).toBe(92);
    expect(await mk('B4')).toBe(86);
    expect(await mk('B5')).toBe(83);
    expect(await mk('B4', 'Textiles')).toBe(98);
  });

  it('exposes the ticketVerified flag and never the coach', async () => {
    const { db } = await loadServer(seed((f) => f.seed('trips', [tripRow(B, { ticket_verified: true, coach: 'B4' })])));
    const [m] = await db.fetchLiveCoTravelers(trip(), A);
    expect(m.ticketVerified).toBe(true);
    expect(JSON.stringify(m)).not.toContain('B4');
  });

  it('hides blocked users in both directions', async () => {
    const { db } = await loadServer(seed((f) => f.seed('trips', [tripRow(A), tripRow(B), tripRow(C)])));
    await db.blockUserInSupabase(B, A); // B blocked A
    expect((await db.fetchLiveCoTravelers(trip(), A)).map((m) => m.id)).toEqual([`match_${C}`]); // A no longer sees B
    expect((await db.fetchLiveCoTravelers(trip(), B)).map((m) => m.id)).toEqual([`match_${C}`]); // B no longer sees A
  });

  it('respects visibility modes and show_from', async () => {
    const { db } = await loadServer(
      seed((f) =>
        f.seed('trips', [
          tripRow(B, { visible_business: false, visible_social: true }),
          tripRow(C, { show_from: '2026-11-15T00:00:00Z' }),
        ])
      )
    );
    // Business-only viewer: B is social-only (hidden); C is business and show_from has passed.
    expect((await db.fetchLiveCoTravelers(trip(), A)).map((m) => m.id)).toEqual([`match_${C}`]);
    // Social viewer sees B (as Social), not C (business-only).
    const social = await db.fetchLiveCoTravelers(trip({ vis: { business: false, social: true, twoh: false } }), A);
    expect(social).toMatchObject([{ id: `match_${B}`, type: 'Social' }]);
  });

  it('future show_from keeps a traveller hidden until the window opens', async () => {
    const { db } = await loadServer(seed((f) => f.seed('trips', [tripRow(B, { show_from: '2026-11-20T00:50:00.000Z' })])));
    expect(await db.fetchLiveCoTravelers(trip(), A)).toEqual([]);
    vi.setSystemTime(Date.parse('2026-11-20T01:00:00Z'));
    expect(await db.fetchLiveCoTravelers(trip(), A)).toHaveLength(1);
  });

  it('falls back to the same station pair on another vehicle only when nobody shares the journey', async () => {
    const other = { train_number: 'AI887', train_name: 'Air India AI 887' };
    const { db } = await loadServer(seed((f) => f.seed('trips', [tripRow(B, other)])));
    const [m] = await db.fetchLiveCoTravelers(trip(), A);
    expect(m.line).toContain('Same Route Corridor (Air India AI 887)');

    const both = await loadServer(seed((f) => f.seed('trips', [tripRow(B, other), tripRow(C)])));
    expect((await both.db.fetchLiveCoTravelers(trip(), A)).map((x) => x.id)).toEqual([`match_${C}`]);
  });

  it('corridor fallback needs both station codes', async () => {
    const { db } = await loadServer(seed((f) => f.seed('trips', [tripRow(B, { train_number: 'AI887' })])));
    expect(await db.fetchLiveCoTravelers(trip({ fromCode: undefined }), A)).toEqual([]);
  });

  it('one entry per person even with several trips', async () => {
    const { db } = await loadServer(
      seed((f) => f.seed('trips', [tripRow(B, { id: 'x1', train_number: 'AI887' }), tripRow(B, { id: 'x2', train_number: 'AI888' })]))
    );
    expect(await db.fetchLiveCoTravelers(trip(), A)).toHaveLength(1);
  });

  it('missing profile row becomes a "Co-Passenger"', async () => {
    const { db } = await loadServer((f) => f.seed('trips', [tripRow(B)]));
    expect(await db.fetchLiveCoTravelers(trip(), A)).toMatchObject([{ name: 'Co-Passenger', ini: 'C' }]) // quirk: initials of the placeholder name is 'C';
  });

  it('throws on DB error (route answers 500, client keeps its cache)', async () => {
    const { db, fake } = await loadServer();
    await db.hasV2Schema();
    fake.failNext('trips', { message: 'down' }, 'select'); // ticket_verified probe (not cached on network errors)
    fake.failNext('trips', { message: 'down' }, 'select'); // the real query
    await expect(db.fetchLiveCoTravelers(trip(), A)).rejects.toBeTruthy();
  });

  it('unknown date -> empty, not "today"', async () => {
    const { db } = await loadServer((f) => f.seed('trips', [tripRow(B)]));
    expect(await db.fetchLiveCoTravelers(trip({ travelDate: undefined, when: 'soon' }), A)).toEqual([]);
  });
});
