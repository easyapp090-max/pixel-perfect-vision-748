do $$
begin
  if to_regclass('public.app_roles') is null
    or to_regclass('public.profiles') is null
    or to_regclass('public.store_permissions') is null
    or to_regprocedure('public.set_account_access(uuid, text, text[])') is null
    or to_regprocedure('public.has_store_permission(text)') is null then
    raise exception '012_delegated_account_management.sql requires 011_account_access_management.sql first.';
  end if;
end;
$$;

alter table public.app_roles
  drop constraint if exists app_roles_role_check;
alter table public.app_roles
  add constraint app_roles_role_check
  check (role in ('customer', 'staff', 'admin', 'moderator', 'owner'));

alter table public.store_permissions
  drop constraint if exists store_permissions_permission_check;
alter table public.store_permissions
  add constraint store_permissions_permission_check
  check (permission in (
    'manage_products',
    'manage_orders',
    'view_customers',
    'manage_discounts',
    'manage_content',
    'manage_settings',
    'manage_accounts'
  ));

create or replace function public.can_manage_store_accounts()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_store_owner()
    or exists (
      select 1 from public.app_roles
      where user_id = auth.uid() and role = 'admin'
    )
    or public.has_store_permission('manage_accounts');
$$;

revoke all on function public.can_manage_store_accounts() from public;
grant execute on function public.can_manage_store_accounts() to authenticated;

drop policy if exists "Account managers read profiles" on public.profiles;
create policy "Account managers read profiles" on public.profiles
  for select to authenticated using (public.can_manage_store_accounts());

drop policy if exists "Account managers read roles" on public.app_roles;
create policy "Account managers read roles" on public.app_roles
  for select to authenticated using (public.can_manage_store_accounts());

drop policy if exists "Account managers read permissions" on public.store_permissions;
create policy "Account managers read permissions" on public.store_permissions
  for select to authenticated using (public.can_manage_store_accounts());

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
  if not public.can_manage_store_accounts() then
    raise exception 'Only the owner or an account manager can manage account access.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'Account managers cannot change their own account access.';
  end if;
  if p_role is null or p_role not in ('customer', 'staff', 'admin', 'moderator') then
    raise exception 'Only customer, admin, assistant, and moderator roles can be assigned.';
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
      'manage_discounts', 'manage_content', 'manage_settings',
      'manage_accounts'
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
  where user_id = p_user_id and role in ('customer', 'staff', 'admin', 'moderator');
  insert into public.app_roles (user_id, role) values (p_user_id, p_role);
  insert into public.store_permissions (user_id, permission)
  select p_user_id, permission
  from unnest(coalesce(p_permissions, '{}'::text[])) permission
  where p_role in ('staff', 'admin', 'moderator')
  on conflict (user_id, permission) do nothing;
end;
$$;

revoke all on function public.set_account_access(uuid, text, text[]) from public;
grant execute on function public.set_account_access(uuid, text, text[]) to authenticated;

create or replace function public.update_customer_profile(
  p_user_id uuid,
  p_full_name text,
  p_phone text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.can_manage_store_accounts() then
    raise exception 'Only the owner or an account manager can edit customer profiles.';
  end if;
  if p_user_id = auth.uid() and public.is_store_owner() then
    raise exception 'The owner cannot edit their own profile from account management.';
  end if;
  if coalesce(length(trim(p_full_name)), 0) < 2 then
    raise exception 'A customer name must contain at least two characters.';
  end if;
  if not exists (
    select 1
    from public.profiles p
    where p.id = p_user_id
      and not exists (
        select 1 from public.app_roles r
        where r.user_id = p_user_id and r.role = 'owner'
      )
  ) then
    raise exception 'The requested account is not editable.';
  end if;

  update public.profiles
  set full_name = trim(p_full_name),
      phone = nullif(trim(coalesce(p_phone, '')), '')
  where id = p_user_id;
end;
$$;

revoke all on function public.update_customer_profile(uuid, text, text) from public;
grant execute on function public.update_customer_profile(uuid, text, text) to authenticated;

create or replace function public.delete_customer_account(p_user_id uuid)
returns uuid[]
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text;
  v_order_ids uuid[];
begin
  if not public.is_store_owner() then
    raise exception 'Only the store owner can permanently delete customer accounts.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'The owner cannot delete their own account from customer management.';
  end if;
  if exists (
    select 1 from public.app_roles
    where user_id = p_user_id and role in ('owner', 'admin', 'staff', 'moderator')
  ) then
    raise exception 'Administrator, assistant, and moderator accounts cannot be deleted here.';
  end if;

  select email into v_email from auth.users where id = p_user_id;
  if not found then
    raise exception 'The requested customer account does not exist.';
  end if;

  select coalesce(array_agg(id), '{}'::uuid[])
  into v_order_ids
  from public.orders
  where profile_id = p_user_id
     or customer_id in (
       select id from public.customers where lower(email) = lower(v_email)
     );

  update public.orders
  set profile_id = null,
      full_name = 'Deleted customer',
      phone = '',
      governorate = '',
      city = null,
      address = null,
      notes = null
  where id = any(v_order_ids);

  delete from public.customers where lower(email) = lower(v_email);
  delete from auth.users where id = p_user_id;
  return v_order_ids;
end;
$$;

revoke all on function public.delete_customer_account(uuid) from public;
grant execute on function public.delete_customer_account(uuid) to authenticated;
