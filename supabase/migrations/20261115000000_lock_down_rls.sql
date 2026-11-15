-- TripLink: close every table to the public anon/authenticated roles.
-- All access now goes through Next.js API routes using a Supabase secret key, which bypasses RLS.
-- Apply ONLY after the server-side data layer (src/app/api/db) is deployed with
-- SUPABASE_SECRET_KEY and SESSION_SECRET set; older clients that query Supabase
-- directly with the anon key stop working once this runs.

-- 1. Drop the "allow everything" policies -----------------------------------------
drop policy if exists "Allow anon server otp access" on public.auth_otps;
drop policy if exists "Allow public blocks access"   on public.blocks;
drop policy if exists "Allow all access to matches"  on public.matches;
drop policy if exists "Allow all access to messages" on public.messages;
drop policy if exists "Allow all access to profiles" on public.profiles;
drop policy if exists "Allow public reports access"  on public.reports;
drop policy if exists "Allow all access to trips"    on public.trips;

-- 2. Keep RLS on with no policies: anon/authenticated get zero rows and cannot write ----
alter table public.auth_otps enable row level security;
alter table public.blocks    enable row level security;
alter table public.matches   enable row level security;
alter table public.messages  enable row level security;
alter table public.profiles  enable row level security;
alter table public.reports   enable row level security;
alter table public.trips     enable row level security;

-- 3. Defense in depth: no table privileges for the public API roles either --------------
revoke all on public.auth_otps, public.blocks, public.matches, public.messages,
              public.profiles, public.reports, public.trips
  from anon, authenticated;
