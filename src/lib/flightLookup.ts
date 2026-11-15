// Browser-side flight lookup via /api/flights/verify (AeroDataBox, cached server-side).
import type { AddTripModalState } from '@/types';

export type FoundTrip = NonNullable<AddTripModalState['found']>;
export type FlightLookup = { ok: true; found: FoundTrip } | { ok: false; status: number; error?: string };

// 404 = unknown flight -> manual entry is offered.
export async function lookupFlight(flightNumber: string, date: string): Promise<FlightLookup> {
  const res = await fetch('/api/flights/verify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ flightNumber, date }),
  });
  const json = await res.json();
  if (!json?.success || !json.data) return { ok: false, status: res.status, error: json?.error };
  const d = json.data;
  const fromTerm = d.fromTerminal ? ` (${d.fromTerminal})` : '';
  const toTerm = d.toTerminal ? ` (${d.toTerminal})` : '';
  return {
    ok: true,
    found: {
      kind: 'flight',
      name: `${d.airlineName} ${d.flightNumber}`,
      route: `${d.fromCity} (${d.fromCode})${fromTerm} → ${d.toCity} (${d.toCode})${toTerm}`,
      when: `${d.travelDate} · ${d.departureTime} - ${d.arrivalTime} (${d.duration})`,
      travelDate: d.travelDate,
      fromCode: d.fromCode,
      toCode: d.toCode,
      // ponytail: assumes IST departure (domestic corridor); use airport tz for international.
      departsAt: d.departureTime ? `${d.travelDate}T${d.departureTime}:00+05:30` : undefined,
      flightStatus: d.status,
    },
  };
}

// AeroDataBox statuses: Canceled, CanceledUncertain, Delayed, Diverted, Expected, ...
export const isCancelled = (status?: string) => /^cancel/i.test(status ?? '');
export const isDelayed = (status?: string) => /^(delayed|diverted)$/i.test(status ?? '');
