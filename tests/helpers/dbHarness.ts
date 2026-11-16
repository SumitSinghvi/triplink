import { vi } from 'vitest';
import { FakeSupabase } from './fakeSupabase';
import { jar } from './cookies';
import type { TripData } from '@/types';

export const A = 'usr_1111111111';
export const B = 'usr_2222222222';
export const C = 'usr_3333333333';
export const DATE = '2026-11-20';
export const MATCH_AB = `match_${A}_${B}_6E214_${DATE}`;

export const trip = (over: Partial<TripData> = {}): TripData => ({
  id: 'trip_local',
  kind: 'flight',
  name: 'Flight 6E 214',
  route: 'AMD → BOM',
  when: DATE,
  travelDate: DATE,
  fromCode: 'AMD',
  toCode: 'BOM',
  vis: { business: true, social: false, twoh: false },
  ...over,
});

export const tripRow = (user: string, over: Record<string, unknown> = {}) => ({
  id: `trip_${user}_6E214_${DATE}`,
  user_id: user,
  train_number: '6E214',
  train_name: 'IndiGo 6E 214',
  travel_date: DATE,
  from_code: 'AMD',
  to_code: 'BOM',
  from_station: 'AMD',
  to_station: 'BOM',
  coach: null,
  mode: 'business',
  visible_business: true,
  visible_social: false,
  show_from: null,
  ticket_verified: false,
  ...over,
});

export const profileRow = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: 'Person ' + id.slice(-2),
  company: 'Co',
  industry: 'Textiles',
  intent: 'Buy',
  cities: [],
  interests: [],
  langs: [],
  ...over,
});

/** Fresh fake DB + freshly imported server modules (they cache schema probes per module instance). */
export async function loadServer(setup?: (fake: FakeSupabase) => void) {
  vi.resetModules();
  const fake = new FakeSupabase();
  setup?.(fake);
  vi.doMock('@/lib/server/supabaseAdmin', () => ({ supabaseAdmin: () => fake }));
  vi.doMock('next/headers', () => ({ cookies: async () => jar }));
  jar.store.clear();
  return {
    fake,
    db: await import('@/lib/server/db'),
    session: await import('@/lib/server/session'),
    route: await import('@/app/api/db/route'),
  };
}

/** Build a BCBP string for one leg: carrier+flight on the given day-of-year. */
export function bcbp(opts: { carrier: string; flight: string; julian: number; from?: string; to?: string; name?: string }) {
  return (
    'M1' +
    (opts.name ?? 'TEST/USER').padEnd(20) +
    'E' +
    'ABC123 ' +
    (opts.from ?? 'AMD') +
    (opts.to ?? 'BOM') +
    opts.carrier.padEnd(3) +
    opts.flight.padStart(4, '0') +
    ' ' +
    String(opts.julian).padStart(3, '0') +
    'Y012C0045 100'
  );
}
