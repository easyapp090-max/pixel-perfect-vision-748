-- Run once in the Supabase SQL Editor as the project database administrator,
-- after migrations 001 through 004 have completed successfully,
-- after creating and verifying the intended owner account through Supabase Auth.
-- Replace the UUID below with that account's auth.users.id, then run this script.
begin;

do $$
declare
  target_user_id uuid := 'REPLACE-WITH-AUTH-USER-UUID';
begin
  if current_user not in ('postgres', 'supabase_admin') then
    raise exception 'Run first-owner.sql as the Supabase project database administrator.';
  end if;

  perform pg_advisory_xact_lock(hashtext('5adsh-first-owner-bootstrap'));

  if exists (select 1 from public.app_roles where role = 'owner') then
    raise exception 'An owner already exists; first-owner bootstrap is disabled.';
  end if;
  if not exists (select 1 from auth.users where id = target_user_id) then
    raise exception 'No Supabase Auth user exists for the supplied UUID.';
  end if;
  if not exists (
    select 1 from auth.users
    where id = target_user_id and email_confirmed_at is not null
  ) then
    raise exception 'The Auth user email must be verified before owner access is granted.';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'The Auth profile is missing. Ensure the 002 Auth trigger completed before bootstrapping.';
  end if;

  insert into public.app_roles (user_id, role) values (target_user_id, 'owner');
end;
$$;

commit;
