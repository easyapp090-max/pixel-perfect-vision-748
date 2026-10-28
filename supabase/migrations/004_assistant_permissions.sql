-- Replace broad staff/admin access with explicit owner-managed permissions.
-- This migration intentionally does not change existing roles or grant any
-- permissions automatically. Existing assistants must be reviewed by the owner.

do $$
declare
  missing_tables text[];
begin
  select array_agg(required_table order by required_table)
  into missing_tables
  from unnest(array[
    'app_roles', 'profiles', 'categories', 'product_variants', 'inventory',
    'collections', 'collection_products', 'coupons', 'media_assets',
    'homepage_content', 'store_settings', 'orders', 'order_items', 'promos'
  ]) as required(required_table)
  where to_regclass('public.' || required_table) is null;

  if missing_tables is not null then
    raise exception '004_assistant_permissions.sql requires 001_init.sql, 002_secure_store.sql, and 003_secure_order_tracking.sql first. Missing public tables: %', missing_tables;
  end if;
end;
$$;

create unique index if not exists app_roles_single_owner_idx
  on public.app_roles (role)
  where role = 'owner';

create table if not exists public.store_permissions (
  user_id uuid not null references auth.users(id) on delete cascade,
  permission text not null check (permission in (
    'manage_products',
    'manage_orders',
    'view_customers',
    'manage_discounts',
    'manage_content',
    'manage_settings'
  )),
  created_at timestamptz not null default now(),
  primary key (user_id, permission)
);

alter table public.store_permissions enable row level security;

-- Remove every prior policy on tables whose authorization model is replaced.
-- Permissive policies combine with OR, so deleting only known names is unsafe.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'products', 'categories', 'product_variants', 'inventory', 'collections',
        'collection_products', 'profiles', 'app_roles', 'orders', 'order_items',
        'coupons', 'media_assets', 'homepage_content', 'store_settings', 'promos',
        'store_permissions'
      ])
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'storage' and tablename = 'objects'
      and (coalesce(qual, '') || coalesce(with_check, '')) like '%product-media%'
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create or replace function public.is_store_owner()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_roles
    where user_id = auth.uid() and role = 'owner'
  );
$$;

create or replace function public.has_store_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_store_owner()
    or exists (
      select 1
      from public.store_permissions
      where user_id = auth.uid()
        and permission = required_permission
    );
$$;

revoke all on function public.is_store_owner() from public;
grant execute on function public.is_store_owner() to anon, authenticated;
revoke all on function public.has_store_permission(text) from public;
grant execute on function public.has_store_permission(text) to anon, authenticated;

create or replace function public.enforce_store_assistant_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  assistant_role_added boolean;
begin
  if TG_OP = 'INSERT' then
    assistant_role_added := new.role = 'staff';
  else
    assistant_role_added := new.role = 'staff' and old.role is distinct from 'staff';
  end if;

  if assistant_role_added then
    -- Serialize every staff-role insertion/conversion before counting.
    perform pg_advisory_xact_lock(hashtext('5adsh-assistant-limit'));
    if (select count(*) from public.app_roles where role = 'staff') >= 5 then
      raise exception 'The store can have no more than five assistants.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_store_assistant_limit on public.app_roles;
create trigger enforce_store_assistant_limit
  before insert or update of role on public.app_roles
  for each row execute function public.enforce_store_assistant_limit();

create or replace function public.set_assistant_access(p_user_id uuid, p_enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_owner() then
    raise exception 'Only the store owner can manage assistants.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'The owner cannot change their own assistant access.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'The requested account does not exist.';
  end if;
  if exists (select 1 from public.app_roles where user_id = p_user_id and role = 'owner') then
    raise exception 'The owner role cannot be managed as an assistant.';
  end if;

  if p_enabled then
    insert into public.app_roles (user_id, role) values (p_user_id, 'staff')
    on conflict (user_id, role) do nothing;
  else
    delete from public.store_permissions where user_id = p_user_id;
    delete from public.app_roles where user_id = p_user_id and role = 'staff';
  end if;
end;
$$;

create or replace function public.set_assistant_permissions(
  p_user_id uuid,
  p_permissions text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_owner() then
    raise exception 'Only the store owner can manage assistant permissions.';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'The owner cannot change their own assistant permissions.';
  end if;
  if not exists (select 1 from public.app_roles where user_id = p_user_id and role = 'staff') then
    raise exception 'The requested account is not an active assistant.';
  end if;
  if exists (
    select 1
    from unnest(coalesce(p_permissions, '{}'::text[])) permission
    where permission not in (
      'manage_products', 'manage_orders', 'view_customers',
      'manage_discounts', 'manage_content', 'manage_settings'
    )
  ) then
    raise exception 'The requested permissions are not supported.';
  end if;

  delete from public.store_permissions where user_id = p_user_id;
  insert into public.store_permissions (user_id, permission)
  select p_user_id, permission
  from unnest(coalesce(p_permissions, '{}'::text[])) permission
  on conflict (user_id, permission) do nothing;
end;
$$;

revoke all on function public.set_assistant_access(uuid, boolean) from public;
grant execute on function public.set_assistant_access(uuid, boolean) to authenticated;
revoke all on function public.set_assistant_permissions(uuid, text[]) from public;
grant execute on function public.set_assistant_permissions(uuid, text[]) to authenticated;

-- Keep the legacy RPC callable for compatibility, but make role changes
-- owner-only. It does not create or grant owner roles.
create or replace function public.set_customer_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_store_owner() then
    raise exception 'Only the store owner can manage account roles.';
  end if;
  if p_role not in ('customer', 'staff', 'admin') then
    raise exception 'Only customer, staff, and legacy admin roles can be assigned.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'The requested account does not exist.';
  end if;
  if exists (select 1 from public.app_roles where user_id = p_user_id and role = 'owner') then
    raise exception 'The owner role can only be managed by the database administrator.';
  end if;
  delete from public.app_roles where user_id = p_user_id and role in ('staff', 'admin');
  if p_role <> 'customer' then
    insert into public.app_roles (user_id, role) values (p_user_id, p_role);
  end if;
end;
$$;

revoke all on function public.set_customer_role(uuid, text) from public;
grant execute on function public.set_customer_role(uuid, text) to authenticated;

drop policy if exists "Store administrators manage products" on public.products;
drop policy if exists "Store administrators manage categories" on public.categories;
drop policy if exists "Store administrators manage product variants" on public.product_variants;
drop policy if exists "Store administrators manage inventory" on public.inventory;
drop policy if exists "Store administrators manage collections" on public.collections;
drop policy if exists "Store administrators manage collection products" on public.collection_products;
drop policy if exists "Store administrators can read profiles" on public.profiles;
drop policy if exists "Store administrators can read roles" on public.app_roles;
drop policy if exists "Store administrators manage orders" on public.orders;
drop policy if exists "Store administrators manage coupons" on public.coupons;
drop policy if exists "Store administrators manage media metadata" on public.media_assets;
drop policy if exists "Store administrators manage homepage content" on public.homepage_content;
drop policy if exists "Store administrators manage settings" on public.store_settings;
drop policy if exists "Store administrators manage legacy promos" on public.promos;

create policy "Permission holders manage products" on public.products
  for all to authenticated
  using (public.has_store_permission('manage_products'))
  with check (public.has_store_permission('manage_products'));
create policy "Permission holders manage categories" on public.categories
  for all to authenticated
  using (public.has_store_permission('manage_products'))
  with check (public.has_store_permission('manage_products'));
create policy "Permission holders manage product variants" on public.product_variants
  for all to authenticated
  using (public.has_store_permission('manage_products'))
  with check (public.has_store_permission('manage_products'));
create policy "Permission holders manage inventory" on public.inventory
  for all to authenticated
  using (public.has_store_permission('manage_products'))
  with check (public.has_store_permission('manage_products'));
create policy "Permission holders manage collections" on public.collections
  for all to authenticated
  using (public.has_store_permission('manage_products'))
  with check (public.has_store_permission('manage_products'));
create policy "Permission holders manage collection products" on public.collection_products
  for all to authenticated
  using (public.has_store_permission('manage_products'))
  with check (public.has_store_permission('manage_products'));
create policy "Permission holders read profiles" on public.profiles
  for select to authenticated using (public.has_store_permission('view_customers'));
create policy "Owner reads all roles" on public.app_roles
  for select to authenticated using (public.is_store_owner());
create policy "Permission holders manage orders" on public.orders
  for update to authenticated
  using (public.has_store_permission('manage_orders'))
  with check (public.has_store_permission('manage_orders'));
create policy "Permission holders read all orders" on public.orders
  for select to authenticated using (public.has_store_permission('manage_orders'));
create policy "Permission holders read all order items" on public.order_items
  for select to authenticated using (public.has_store_permission('manage_orders'));
create policy "Permission holders manage coupons" on public.coupons
  for all to authenticated
  using (public.has_store_permission('manage_discounts'))
  with check (public.has_store_permission('manage_discounts'));
create policy "Permission holders manage media metadata" on public.media_assets
  for all to authenticated
  using (public.has_store_permission('manage_content'))
  with check (public.has_store_permission('manage_content'));
create policy "Permission holders manage homepage content" on public.homepage_content
  for all to authenticated
  using (public.has_store_permission('manage_content'))
  with check (public.has_store_permission('manage_content'));
create policy "Permission holders manage settings" on public.store_settings
  for all to authenticated
  using (public.has_store_permission('manage_settings'))
  with check (public.has_store_permission('manage_settings'));
create policy "Permission holders manage legacy promos" on public.promos
  for all to authenticated
  using (public.has_store_permission('manage_discounts'))
  with check (public.has_store_permission('manage_discounts'));

create policy "Users read own store permissions" on public.store_permissions
  for select to authenticated using (user_id = auth.uid());
create policy "Owners read all store permissions" on public.store_permissions
  for select to authenticated using (public.is_store_owner());

drop policy if exists "Store administrators upload product media" on storage.objects;
drop policy if exists "Store administrators update product media" on storage.objects;
drop policy if exists "Store administrators delete product media" on storage.objects;
create policy "Permission holders upload product media" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'product-media' and public.has_store_permission('manage_products')
  );
create policy "Permission holders update product media" on storage.objects
  for update to authenticated using (
    bucket_id = 'product-media' and public.has_store_permission('manage_products')
  ) with check (
    bucket_id = 'product-media' and public.has_store_permission('manage_products')
  );
create policy "Permission holders delete product media" on storage.objects
  for delete to authenticated using (
    bucket_id = 'product-media' and public.has_store_permission('manage_products')
  );
