do $$
begin
  if to_regclass('public.profiles') is null
    or to_regclass('public.app_roles') is null
    or to_regclass('public.orders') is null
    or to_regclass('public.customers') is null
    or to_regprocedure('public.is_store_owner()') is null then
    raise exception '010_admin_customer_lifecycle.sql requires 002_secure_store.sql and 004_assistant_permissions.sql first.';
  end if;
end;
$$;

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
  if not public.is_store_owner() then
    raise exception 'Only the store owner can edit customer profiles.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'The owner cannot edit their own profile from customer management.';
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
    where user_id = p_user_id and role in ('owner', 'admin', 'staff')
  ) then
    raise exception 'Administrator and assistant accounts cannot be deleted here.';
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
