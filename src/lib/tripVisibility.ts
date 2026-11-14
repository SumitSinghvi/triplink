import type { TripVisibility } from '@/types';

/**
 * When others may start seeing a trip. "2h before" uses the departure time when known,
 * else the start of the travel day in IST. Null = visible as soon as it is added.
 */
export function showFromFor(vis: TripVisibility, travelDate: string, departsAt?: string): string | null {
  if (!vis.twoh) return null;
  const dep = departsAt ? Date.parse(departsAt) : NaN;
  if (!Number.isNaN(dep)) return new Date(dep - 2 * 60 * 60 * 1000).toISOString();
  return new Date(`${travelDate}T00:00:00+05:30`).toISOString();
}

export interface VisibilityRow {
  visible_business?: boolean | null;
  visible_social?: boolean | null;
  show_from?: string | null;
}

/** A viewer sees a co-traveller only in a mode both have switched on, once their show_from has passed. */
export function canSee(viewer: TripVisibility, row: VisibilityRow, now = Date.now()): boolean {
  const sharedMode =
    (viewer.business && row.visible_business !== false) || (viewer.social && row.visible_social === true);
  if (!sharedMode) return false;
  return !row.show_from || Date.parse(row.show_from) <= now;
}
