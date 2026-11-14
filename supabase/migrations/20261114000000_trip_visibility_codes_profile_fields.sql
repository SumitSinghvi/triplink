-- TripLink: trip visibility, station codes, social profile fields, past-trip cleanup.
-- Additive and idempotent: safe to run more than once. Apply before deploying the matching app code.

-- 1. Per-trip visibility -------------------------------------------------------
alter table public.trips
  add column if not exists visible_business boolean not null default true,
  add column if not exists visible_social   boolean not null default false,
  -- When others may start seeing this trip ("show me 2h before departure"); null = always.
  add column if not exists show_from        timestamptz;

-- Backfill legacy social-only trips (defaults already cover business). Re-run safe:
-- the app keeps `mode` consistent with the new columns, so later choices aren't overwritten.
update public.trips
set visible_business = false,
    visible_social   = true
where mode = 'social' and visible_social = false;

-- 2. Station / airport codes for same-route matching -----------------------------
-- from_code / to_code keep the display labels; these hold codes (NDLS, BOM, ...).
-- Old rows stay null and only match on exact train/flight number.
alter table public.trips
  add column if not exists from_station text,
  add column if not exists to_station   text;

create index if not exists trips_route_date_idx
  on public.trips (travel_date, from_station, to_station);

-- 3. Social profile fields ------------------------------------------------------
alter table public.profiles
  add column if not exists first_name    text,
  add column if not exists interests     text[] not null default '{}',
  add column if not exists langs         text[] not null default '{}',
  add column if not exists mode_business boolean not null default true,
  add column if not exists mode_social   boolean not null default false;

-- 4. Delete trips once the journey is over (daily, 00:15 IST = 18:45 UTC) ---------
create extension if not exists pg_cron with schema pg_catalog;

select cron.unschedule(jobid) from cron.job where jobname = 'triplink-delete-past-trips';

select cron.schedule(
  'triplink-delete-past-trips',
  '45 18 * * *',
  $$delete from public.trips
    where travel_date::date < ((now() at time zone 'Asia/Kolkata')::date - 1)$$
);
