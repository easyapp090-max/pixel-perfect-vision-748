-- Safe setup-status endpoint only. Role assignment is intentionally not
-- exposed to PostgREST; the one-time grant is performed by a database admin
-- using supabase/first-owner.sql after verifying the Auth user's email.
do $$
begin
  if to_regclass('public.app_roles') is null or to_regclass('public.profiles') is null then
    raise exception '005_first_owner_setup.sql requires migrations 001_init.sql through 004_assistant_permissions.sql first.';
  end if;
end;
$$;

create or replace function public.first_owner_setup_available()
returns boolean
language sql
stable
security definer
set search_path = pg_catalog, public
as $$
  select not exists (select 1 from public.app_roles where role = 'owner');
$$;

revoke all on function public.first_owner_setup_available() from public;
grant execute on function public.first_owner_setup_available() to anon, authenticated;

-- Remove the insecure legacy function if an earlier draft was applied.
drop function if exists public.bootstrap_first_owner();
