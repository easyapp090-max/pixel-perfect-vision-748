do $$
declare
  missing_tables text[];
begin
  select array_agg(required_table order by required_table)
  into missing_tables
  from unnest(array['app_roles', 'profiles', 'store_permissions']) as required(required_table)
  where to_regclass('public.' || required_table) is null;

  if missing_tables is not null then
    raise exception '011_account_access_management.sql requires 004_assistant_permissions.sql first. Missing public tables: %', missing_tables;
  end if;
end;
$$;

create or replace function public.set_account_access(
  p_user_id uuid,
  p_role text,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_owner() then
    raise exception 'Only the store owner can manage account access.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'The owner cannot change their own account access.';
  end if;
  if p_role is null or p_role not in ('customer', 'staff', 'admin') then
    raise exception 'Only customer, admin, and assistant roles can be assigned.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'The requested account does not exist.';
  end if;
  if exists (select 1 from public.app_roles where user_id = p_user_id and role = 'owner') then
    raise exception 'The owner role cannot be managed as an account.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_permissions, '{}'::text[])) permission
    where permission is null or permission not in (
      'manage_products', 'manage_orders', 'view_customers',
      'manage_discounts', 'manage_content', 'manage_settings'
    )
  ) then
    raise exception 'The requested permissions are not supported.';
  end if;
  if p_role = 'customer' and cardinality(coalesce(p_permissions, '{}'::text[])) > 0 then
    raise exception 'Customer accounts cannot have administrator permissions.';
  end if;

  if p_role = 'staff' then
    perform pg_advisory_xact_lock(hashtext('5adsh-assistant-limit'));
    if (
      select count(*)
      from public.app_roles
      where role = 'staff' and user_id <> p_user_id
    ) >= 5 then
      raise exception 'The store can have no more than five assistants.';
    end if;
  end if;

  delete from public.store_permissions where user_id = p_user_id;
  delete from public.app_roles
  where user_id = p_user_id and role in ('customer', 'staff', 'admin');
  insert into public.app_roles (user_id, role) values (p_user_id, p_role);
  insert into public.store_permissions (user_id, permission)
  select p_user_id, permission
  from unnest(coalesce(p_permissions, '{}'::text[])) permission
  where p_role in ('staff', 'admin')
  on conflict (user_id, permission) do nothing;
end;
$$;

revoke all on function public.set_account_access(uuid, text, text[]) from public;
grant execute on function public.set_account_access(uuid, text, text[]) to authenticated;
