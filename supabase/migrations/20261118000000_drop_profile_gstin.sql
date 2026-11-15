-- TripLink: GST verification feature removed. Drop its profile columns; the app no longer reads or writes them.
alter table public.profiles
  drop column if exists gstin,
  drop column if exists is_verified;
