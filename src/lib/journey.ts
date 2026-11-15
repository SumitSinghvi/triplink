// Pure journey/match helpers shared by the browser and the server (no database access).
import type { TripData } from '@/types';
import { normalizeTravelDate, todayIso } from './travelDate';

export type { IncomingRequestItem } from '@/types';

// Normalize journey number (removes spaces/hyphens for reliable matching)
export function normalizeJourneyKey(raw: string): string {
  return raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

// Robust journey key extractor (extracts train number or flight code)
export function extractJourneyKey(name: string): string {
  // 1. Train number in parenthesis e.g. "VANDE BHARAT EXP (20901)"
  const parenMatch = name.match(/\(([A-Z0-9\s]+)\)/i);
  if (parenMatch && parenMatch[1]) {
    const clean = parenMatch[1].replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (clean.length >= 3) return clean;
  }

  // 2. Flight IATA pattern e.g. "6E 214", "AI 887", "QP 1302", "SG 8169", "UK 945"
  const flightMatch = name.match(/\b([A-Z0-9]{2})\s*([0-9]{1,4})\b/i);
  if (flightMatch) {
    return `${flightMatch[1].toUpperCase()}${flightMatch[2]}`;
  }

  // 3. Indian Railways 5-digit train number e.g. "20901" or "12951"
  const trainMatch = name.match(/\b(\d{5})\b/);
  if (trainMatch) {
    return trainMatch[1];
  }

  return normalizeJourneyKey(name);
}

// Matching date for a trip. Legacy trips (pre-travelDate) fall back to parsing `when`;
// null means unknown -> skip matching rather than silently assume today.
export function tripTravelDate(trip: TripData): string | null {
  return trip.travelDate || normalizeTravelDate(trip.when);
}

// Travel date strictly before today. Unknown dates are treated as not past.
export function isPastTrip(trip: TripData): boolean {
  const d = tripTravelDate(trip);
  return !!d && d < todayIso();
}

// Identity of a journey for dedupe: same vehicle on same day.
export function tripKey(trip: TripData): string {
  return `${extractJourneyKey(trip.name)}_${tripTravelDate(trip) ?? trip.when}`;
}

// Helper to check coach proximity (used for fit score only; coach is never shown to others)
export function calculateCoachProximity(userCoach?: string, otherCoach?: string): {
  isSameCoach: boolean;
  isAdjacentCoach: boolean;
} {
  const none = { isSameCoach: false, isAdjacentCoach: false };
  if (!userCoach || !otherCoach) return none;
  const u = userCoach.trim().toUpperCase();
  const o = otherCoach.trim().toUpperCase();
  if (u === o) return { isSameCoach: true, isAdjacentCoach: false };
  const uMatch = u.match(/^([A-Z]+)(\d+)$/);
  const oMatch = o.match(/^([A-Z]+)(\d+)$/);
  if (uMatch && oMatch && uMatch[1] === oMatch[1]) {
    if (Math.abs(parseInt(uMatch[2], 10) - parseInt(oMatch[2], 10)) === 1) {
      return { isSameCoach: false, isAdjacentCoach: true };
    }
  }
  return none;
}

export function buildDeterministicMatchId(
  userA: string,
  userB: string,
  journeyKey: string,
  travelDate: string
): string {
  const [u1, u2] = [userA, userB].sort();
  return `match_${u1}_${u2}_${journeyKey}_${travelDate}`;
}

export function newMessageId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
}
