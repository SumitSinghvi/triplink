import { describe, expect, it } from 'vitest';
import { parseBcbp, julianToIso } from '@/lib/bcbp';
import { mergeChat, countNewIncoming } from '@/lib/chatMerge';
import { normalizeTravelDate, todayIso } from '@/lib/travelDate';
import { showFromFor, canSee } from '@/lib/tripVisibility';
import {
  buildDeterministicMatchId,
  calculateCoachProximity,
  extractJourneyKey,
  isPastTrip,
  tripKey,
  tripTravelDate,
} from '@/lib/journey';
import { maskPNR, validatePNR } from '@/lib/pnr';
import type { TripData } from '@/types';

describe('bcbp', () => {
  it('parses the IATA spec sample', () => {
    expect(parseBcbp('M1DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100')).toEqual({
      passengerName: 'DESMARAIS/LUC',
      legs: [{ pnr: 'ABC123', fromCode: 'YUL', toCode: 'FRA', carrier: 'AC', flightNumber: '834', julianDay: 326, seat: '1A' }],
    });
  });

  it('walks two legs past conditional data', () => {
    const two = parseBcbp(
      'M2SINGH/SUMIT MR      EXYZ987 AMDBOM6E 0214 319Y012C0045 10A>518000W  XYZ987 BOMBLR6E 0457 319Y003F0012 100'
    )!;
    expect(two.legs.map((l) => l.carrier + l.flightNumber)).toEqual(['6E214', '6E457']);
    expect(two.legs[1].fromCode + two.legs[1].toCode).toBe('BOMBLR');
    expect(two.legs[1].seat).toBe('3F');
  });

  it.each([
    ['url', 'https://example.com'],
    ['truncated', 'M1SHORT'],
    ['bad airport code', 'M1DESMARAIS/LUC       EABC123 Y1LFRAAC 0834 326J001A0025 100'],
    ['zero legs', 'M0DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100'],
    ['five legs', 'M5DESMARAIS/LUC       EABC123 YULFRAAC 0834 326J001A0025 100'],
    ['lowercase', 'm1desmarais/luc       eabc123 yulfraac 0834 326j001a0025 100'],
  ])('rejects %s', (_n, raw) => {
    expect(parseBcbp(raw)).toBeNull();
  });

  it('julianToIso picks the nearest year and rejects impossible days', () => {
    expect(julianToIso(326, '2026-11-15')).toBe('2026-11-22');
    expect(julianToIso(2, '2026-12-30')).toBe('2027-01-02');
    expect(julianToIso(364, '2027-01-02')).toBe('2026-12-30');
    expect(julianToIso(366, '2026-11-15')).toBe('');
    expect(julianToIso(366, '2028-06-01')).toBe('2028-12-31'); // leap year
  });
});

describe('chatMerge', () => {
  const s1 = { id: 'a', from: 'them' as const, text: 'hi' };
  const s2 = { id: 'b', from: 'me' as const, text: 'yo' };
  const pending = { id: 'c', from: 'me' as const, text: 'sending', status: 'pending' as const };
  const failed = { id: 'd', from: 'me' as const, text: 'lost', status: 'failed' as const };

  it('keeps unsynced local messages and does not duplicate acked ones', () => {
    expect(mergeChat([s1, s2], [s1, { ...s2, status: 'pending' }, pending, failed])).toEqual([s1, s2, pending, failed]);
  });
  it('drops sent local messages the server no longer has', () => {
    expect(mergeChat([s1], [s1, { id: 'x', from: 'me', text: 'old' }])).toEqual([s1]);
  });
  it('counts only new messages from the other person', () => {
    expect(countNewIncoming([s1], [s1, s2, { id: 'e', from: 'them', text: 'new' }])).toBe(1);
    expect(countNewIncoming([], [s1])).toBe(1);
    expect(countNewIncoming([], [s2])).toBe(0);
  });
});

describe('travelDate', () => {
  it.each([
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
  ])('normalizes %s', (input, want) => {
    expect(normalizeTravelDate(input)).toBe(want);
  });

  it('todayIso is IST', () => {
    expect(todayIso(Date.parse('2026-11-13T20:00:00Z'))).toBe('2026-11-14');
    expect(todayIso(Date.parse('2026-11-13T18:00:00Z'))).toBe('2026-11-13');
  });
});

describe('tripVisibility', () => {
  const vis = (business: boolean, social: boolean, twoh = false) => ({ business, social, twoh });
  const now = Date.parse('2026-11-20T01:00:00Z');

  it('showFromFor', () => {
    expect(showFromFor(vis(true, false), '2026-11-20')).toBeNull();
    expect(showFromFor(vis(true, false, true), '2026-11-20', '2026-11-20T08:20:00+05:30')).toBe('2026-11-20T00:50:00.000Z');
    expect(showFromFor(vis(true, false, true), '2026-11-20')).toBe('2026-11-19T18:30:00.000Z');
  });

  it('canSee needs a shared mode', () => {
    expect(canSee(vis(true, false), { visible_business: true, visible_social: false }, now)).toBe(true);
    expect(canSee(vis(true, false), { visible_business: false, visible_social: true }, now)).toBe(false);
    expect(canSee(vis(false, true), { visible_business: false, visible_social: true }, now)).toBe(true);
    expect(canSee(vis(false, false), { visible_business: true, visible_social: true }, now)).toBe(false);
    expect(canSee(vis(true, false), {}, now)).toBe(true); // legacy row
    // social viewer never sees a legacy row (visible_social unset)
    expect(canSee(vis(false, true), {}, now)).toBe(false);
  });

  it('canSee honours show_from', () => {
    expect(canSee(vis(true, false), { visible_business: true, show_from: '2026-11-20T02:00:00Z' }, now)).toBe(false);
    expect(canSee(vis(true, false), { visible_business: true, show_from: '2026-11-20T00:50:00Z' }, now)).toBe(true);
  });
});

describe('journey helpers', () => {
  const trip = (over: Partial<TripData>): TripData => ({
    id: 't', kind: 'train', name: 'X', route: 'A → B', when: '', vis: { business: true, social: false, twoh: false }, ...over,
  });

  it.each([
    ['VANDE BHARAT EXP (20901)', '20901'],
    ['Tejas Rajdhani Express (12951)', '12951'],
    ['Flight 6E 214', '6E214'],
    ['IndiGo 6E 214', '6E214'],
    ['Flight AI 887', 'AI887'],
    ['Express 20901', '20901'],
  ])('extractJourneyKey(%s)', (name, key) => {
    expect(extractJourneyKey(name)).toBe(key);
  });

  it('tripTravelDate prefers travelDate, falls back to `when`, else null', () => {
    expect(tripTravelDate(trip({ travelDate: '2026-11-20', when: '2026-11-21' }))).toBe('2026-11-20');
    expect(tripTravelDate(trip({ when: '21-11-2026' }))).toBe('2026-11-21');
    expect(tripTravelDate(trip({ when: 'soon' }))).toBeNull();
  });

  it('isPastTrip treats unknown dates as not past', () => {
    const today = todayIso();
    expect(isPastTrip(trip({ travelDate: '2000-01-01' }))).toBe(true);
    expect(isPastTrip(trip({ travelDate: today }))).toBe(false);
    expect(isPastTrip(trip({ when: 'soon' }))).toBe(false);
  });

  it('tripKey identifies vehicle + day', () => {
    expect(tripKey(trip({ name: 'Flight 6E 214', travelDate: '2026-11-20' }))).toBe('6E214_2026-11-20');
  });

  it('match id is identical from both sides', () => {
    expect(buildDeterministicMatchId('usr_b', 'usr_a', '6E214', '2026-11-20')).toBe(
      buildDeterministicMatchId('usr_a', 'usr_b', '6E214', '2026-11-20')
    );
  });

  it('coach proximity', () => {
    expect(calculateCoachProximity('B4', 'b4')).toEqual({ isSameCoach: true, isAdjacentCoach: false });
    expect(calculateCoachProximity('B4', 'B5')).toEqual({ isSameCoach: false, isAdjacentCoach: true });
    expect(calculateCoachProximity('B4', 'B6').isAdjacentCoach).toBe(false);
    expect(calculateCoachProximity('B4', 'C5').isAdjacentCoach).toBe(false);
    expect(calculateCoachProximity(undefined, 'B4')).toEqual({ isSameCoach: false, isAdjacentCoach: false });
  });
});

describe('pnr', () => {
  it('validatePNR', () => {
    expect(validatePNR('2849102451')).toBe(true);
    expect(validatePNR('28-49 102451')).toBe(true);
    expect(validatePNR('0849102451')).toBe(false);
    expect(validatePNR('284910245')).toBe(false);
    expect(validatePNR('28491024511')).toBe(false);
    expect(validatePNR('abcdefghij')).toBe(false);
  });
  it('maskPNR keeps first two and last two digits', () => {
    expect(maskPNR('2849102451')).toBe('28******51');
    expect(maskPNR('123')).toBe('******');
  });
});
