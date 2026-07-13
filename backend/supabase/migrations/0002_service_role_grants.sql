-- "Automatically expose new tables" was left off when the project was
-- created (intentionally, to keep anon/authenticated locked out), but that
-- setting also skips the default privilege grants Supabase normally gives
-- service_role. RLS alone isn't enough — Postgres denies access before RLS
-- is even evaluated if the role has no table privileges at all. service_role
-- is meant to bypass RLS entirely; grant it full access explicitly here.
grant usage on schema public to service_role;
grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
