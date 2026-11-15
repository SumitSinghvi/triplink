-- TripLink: per-trip "ticket verified" flag, set server-side when a scanned boarding pass
-- (IATA BCBP barcode) names the trip's flight, date and the user. Additive and idempotent.
-- The app works before this runs; it just won't store or show the flag.
alter table public.trips
  add column if not exists ticket_verified boolean not null default false;
