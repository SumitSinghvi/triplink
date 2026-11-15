-- TripLink: cache AeroDataBox flight lookups (flight number + date) to save API credits.
-- data = the VerifiedFlight JSON, or null when the API said the flight doesn't exist that day.
-- Server-only (secret key bypasses RLS); closed to anon/authenticated like every other table.
create table if not exists public.flight_lookups (
  flight_key  text        not null,  -- "6E214"
  travel_date date        not null,
  data        jsonb,
  fetched_at  timestamptz not null default now(),
  primary key (flight_key, travel_date)
);

alter table public.flight_lookups enable row level security;
revoke all on public.flight_lookups from anon, authenticated;
