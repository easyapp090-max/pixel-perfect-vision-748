do $$
declare
  missing_tables text[];
  missing_columns text[];
begin
  select array_agg(required_table order by required_table)
    into missing_tables
  from unnest(array['customers', 'products', 'orders', 'order_items', 'promos']) required(required_table)
  where to_regclass('public.' || required_table) is null;
  if missing_tables is not null then
    raise exception '002_secure_store.sql requires 001_init.sql first. Missing public tables: %', missing_tables;
  end if;
  select array_agg(required.column_ref order by required.column_ref)
    into missing_columns
  from unnest(array[
    'customers.id', 'customers.email', 'customers.name',
    'products.id', 'products.slug', 'products.name', 'products.category', 'products.subcategory',
    'products.price', 'products.sale_price', 'products.sku', 'products.description', 'products.badge',
    'products.featured', 'products.best_seller', 'products.new_arrival', 'products.images',
    'products.colors', 'products.sizes', 'products.variants', 'products.created_at', 'products.updated_at',
    'orders.id', 'orders.customer_id', 'orders.status', 'orders.subtotal', 'orders.discount',
    'orders.shipping', 'orders.total', 'orders.payment_method', 'orders.payment_status', 'orders.tracking',
    'orders.country', 'orders.city', 'orders.address', 'orders.notes', 'orders.created_at', 'orders.updated_at',
    'order_items.id', 'order_items.order_id', 'order_items.product_id', 'order_items.sku', 'order_items.name',
    'order_items.size', 'order_items.color', 'order_items.price', 'order_items.quantity', 'order_items.created_at',
    'promos.id', 'promos.code', 'promos.type', 'promos.value', 'promos.min_order', 'promos.active',
    'promos.expires_at', 'promos.description', 'promos.created_at'
  ]) as required(column_ref)
  where not exists (
    select 1 from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = split_part(required.column_ref, '.', 1)
      and c.column_name = split_part(required.column_ref, '.', 2)
  );
  if missing_columns is not null then
    raise exception '002_secure_store.sql found incomplete baseline tables. Missing public columns: %', missing_columns;
  end if;
  if to_regclass('auth.users') is null or to_regclass('storage.buckets') is null
     or to_regclass('storage.objects') is null then
    raise exception '002_secure_store.sql requires Supabase Auth and Storage to be enabled.';
  end if;
end;
$$;

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null default '',
  full_name text not null default '',
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.app_roles (
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('customer', 'staff', 'admin', 'owner')),
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

insert into public.profiles (id, full_name, phone)
select
  u.id,
  coalesce(u.raw_user_meta_data ->> 'full_name', ''),
  u.raw_user_meta_data ->> 'phone'
from auth.users u
on conflict (id) do nothing;
update public.profiles p
set email = u.email
from auth.users u
where p.id = u.id and p.email = '';
insert into public.app_roles (user_id, role)
select u.id, 'customer' from auth.users u
on conflict (user_id, role) do nothing;

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  image text,
  arabic text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.products
  add column if not exists category_id uuid references public.categories(id) on delete set null,
  add column if not exists active boolean not null default true;

do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.products'::regclass and conname = 'products_sale_price_check') then
    alter table public.products add constraint products_sale_price_check check (
      sale_price is null or (sale_price >= 0 and sale_price <= price)
    ) not valid;
  end if;
end $$;

insert into public.categories (name, slug)
select distinct p.category,
  lower(trim(both '-' from regexp_replace(p.category, '[^a-zA-Z0-9]+', '-', 'g')))
    || '-' || substr(md5(p.category), 1, 6)
from public.products p
where coalesce(trim(p.category), '') <> ''
on conflict (slug) do nothing;

update public.products p
set category_id = c.id
from public.categories c
where p.category_id is null and lower(c.name) = lower(p.category);

create table if not exists public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  size text not null,
  color text not null,
  sku text unique,
  created_at timestamptz not null default now(),
  unique (product_id, size, color)
);

create table if not exists public.inventory (
  variant_id uuid primary key references public.product_variants(id) on delete cascade,
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  updated_at timestamptz not null default now()
);

insert into public.product_variants (product_id, size, color)
select distinct p.id, variant ->> 'size', variant ->> 'color'
from public.products p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.variants) = 'array' then p.variants else '[]'::jsonb end
) as variant
where nullif(trim(variant ->> 'size'), '') is not null
  and nullif(trim(variant ->> 'color'), '') is not null
on conflict (product_id, size, color) do nothing;

insert into public.inventory (variant_id, stock_quantity)
select pv.id,
  case when coalesce(variant ->> 'stock', '') ~ '^[0-9]+$'
    then (variant ->> 'stock')::integer else 0 end
from public.products p
cross join lateral jsonb_array_elements(
  case when jsonb_typeof(p.variants) = 'array' then p.variants else '[]'::jsonb end
) as variant
join public.product_variants pv
  on pv.product_id = p.id and pv.size = variant ->> 'size' and pv.color = variant ->> 'color'
where nullif(trim(variant ->> 'size'), '') is not null
  and nullif(trim(variant ->> 'color'), '') is not null
on conflict (variant_id) do nothing;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  description text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.collection_products (
  collection_id uuid not null references public.collections(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  position integer not null default 0,
  primary key (collection_id, product_id)
);

create table if not exists public.coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage', 'fixed')),
  value integer not null check (value > 0),
  min_order integer not null default 0 check (min_order >= 0),
  active boolean not null default true,
  expires_at timestamptz,
  description text not null default '',
  created_at timestamptz not null default now(),
  constraint coupons_percentage_check check (type <> 'percentage' or value <= 100)
);

insert into public.coupons (code, type, value, min_order, active, expires_at, description)
select upper(code), type, value, min_order, active, expires_at, coalesce(description, '')
from public.promos
where type in ('percentage', 'fixed')
  and value > 0
  and min_order >= 0
  and (type <> 'percentage' or value <= 100)
on conflict (code) do nothing;

create table if not exists public.media_assets (
  id uuid primary key default gen_random_uuid(),
  storage_path text not null unique,
  bucket text not null default 'product-media',
  alt_text text not null default '',
  content_type text not null,
  byte_size bigint not null check (byte_size > 0),
  uploaded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.homepage_content (
  singleton boolean primary key default true check (singleton),
  hero_title text not null default '',
  hero_subtitle text not null default '',
  primary_cta text not null default 'Shop now',
  secondary_cta text not null default 'Explore new drops',
  announcement text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.homepage_content (singleton, hero_title, hero_subtitle, primary_cta, secondary_cta, announcement)
values (true, 'Wear the mark.', 'Raw streetwear from Cairo.', 'Shop now', 'Explore new drops', '')
on conflict (singleton) do nothing;

create table if not exists public.store_settings (
  singleton boolean primary key default true check (singleton),
  currency text not null default 'EGP',
  shipping_free_threshold integer not null default 2000 check (shipping_free_threshold >= 0),
  standard_shipping integer not null default 120 check (standard_shipping >= 0),
  default_country text not null default 'Egypt',
  allow_cash_on_delivery boolean not null default true,
  support_email text not null default '',
  timezone text not null default 'Africa/Cairo',
  updated_at timestamptz not null default now()
);
insert into public.store_settings (singleton)
values (true)
on conflict (singleton) do nothing;

alter table public.orders
  add column if not exists profile_id uuid references public.profiles(id) on delete set null,
  add column if not exists idempotency_key uuid,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists governorate text,
  add column if not exists delivery_method text not null default 'Standard delivery',
  add column if not exists coupon_code text;

update public.orders o
set profile_id = u.id
from public.customers c
join auth.users u on lower(u.email) = lower(c.email)
where o.profile_id is null and o.customer_id = c.id;

create unique index if not exists orders_idempotency_key_uidx
  on public.orders (idempotency_key) where idempotency_key is not null;
create index if not exists orders_profile_created_idx
  on public.orders (profile_id, created_at desc);
create index if not exists products_category_idx on public.products (category_id);
create index if not exists product_variants_product_idx on public.product_variants (product_id);
create index if not exists collection_products_product_idx on public.collection_products (product_id);
create index if not exists coupons_active_idx on public.coupons (code) where active;
create index if not exists order_items_order_idx on public.order_items (order_id);

alter table public.order_items
  add column if not exists variant_id uuid references public.product_variants(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conrelid = 'public.order_items'::regclass and conname = 'order_items_price_quantity_check') then
    alter table public.order_items add constraint order_items_price_quantity_check
      check (price >= 0 and quantity > 0) not valid;
  end if;
end $$;

create or replace function public.has_store_role(allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.app_roles
    where user_id = auth.uid()
      and role = any (allowed_roles)
  );
$$;
revoke all on function public.has_store_role(text[]) from public;
grant execute on function public.has_store_role(text[]) to anon, authenticated;

create or replace function public.handle_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    new.raw_user_meta_data ->> 'phone'
  )
  on conflict (id) do update
    set email = excluded.email,
        full_name = excluded.full_name,
        phone = excluded.phone,
        updated_at = now();

  insert into public.app_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id, role) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_or_updated on auth.users;
create trigger on_auth_user_created_or_updated
  after insert or update of raw_user_meta_data, email on auth.users
  for each row execute function public.handle_auth_user();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles
  for each row execute function public.touch_updated_at();
drop trigger if exists products_touch_updated_at on public.products;
create trigger products_touch_updated_at before update on public.products
  for each row execute function public.touch_updated_at();
drop trigger if exists collections_touch_updated_at on public.collections;
create trigger collections_touch_updated_at before update on public.collections
  for each row execute function public.touch_updated_at();
drop trigger if exists homepage_content_touch_updated_at on public.homepage_content;
create trigger homepage_content_touch_updated_at before update on public.homepage_content
  for each row execute function public.touch_updated_at();
drop trigger if exists store_settings_touch_updated_at on public.store_settings;
create trigger store_settings_touch_updated_at before update on public.store_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists inventory_touch_updated_at on public.inventory;
create trigger inventory_touch_updated_at before update on public.inventory
  for each row execute function public.touch_updated_at();

alter table public.profiles enable row level security;
alter table public.app_roles enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_variants enable row level security;
alter table public.inventory enable row level security;
alter table public.collections enable row level security;
alter table public.collection_products enable row level security;
alter table public.coupons enable row level security;
alter table public.media_assets enable row level security;
alter table public.homepage_content enable row level security;
alter table public.store_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.customers enable row level security;
alter table public.promos enable row level security;

-- Remove unknown legacy policies on the application tables before installing
-- the canonical set below. PostgreSQL ORs permissive policies together.
do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname from pg_policies
    where schemaname = 'public'
      and tablename = any(array[
        'customers', 'products', 'orders', 'order_items', 'promos', 'profiles',
        'app_roles', 'categories', 'product_variants', 'inventory', 'collections',
        'collection_products', 'coupons', 'media_assets', 'homepage_content', 'store_settings'
      ])
  loop
    execute format('drop policy %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

drop policy if exists "Public read access to products" on public.products;
drop policy if exists "Admin manage products" on public.products;
drop policy if exists "Customers may read own account" on public.customers;
drop policy if exists "Admin manage customers" on public.customers;
drop policy if exists "Customers may read own orders" on public.orders;
drop policy if exists "Admin manage orders" on public.orders;
drop policy if exists "Public read access to promos" on public.promos;
drop policy if exists "Admin manage promos" on public.promos;
drop policy if exists "Public read active products" on public.products;
drop policy if exists "Store administrators manage products" on public.products;
drop policy if exists "Public read active categories" on public.categories;
drop policy if exists "Store administrators manage categories" on public.categories;
drop policy if exists "Public read product variants" on public.product_variants;
drop policy if exists "Store administrators manage product variants" on public.product_variants;
drop policy if exists "Public read inventory" on public.inventory;
drop policy if exists "Store administrators manage inventory" on public.inventory;
drop policy if exists "Public read active collections" on public.collections;
drop policy if exists "Store administrators manage collections" on public.collections;
drop policy if exists "Public read collection products" on public.collection_products;
drop policy if exists "Store administrators manage collection products" on public.collection_products;
drop policy if exists "Profiles can be read by their owner" on public.profiles;
drop policy if exists "Store administrators can read profiles" on public.profiles;
drop policy if exists "Profiles can be updated by their owner" on public.profiles;
drop policy if exists "Users can read own roles" on public.app_roles;
drop policy if exists "Store administrators can read roles" on public.app_roles;
drop policy if exists "Customers read own orders" on public.orders;
drop policy if exists "Store administrators manage orders" on public.orders;
drop policy if exists "Customers read own order items" on public.order_items;
drop policy if exists "Store administrators manage coupons" on public.coupons;
drop policy if exists "Store administrators manage media metadata" on public.media_assets;
drop policy if exists "Public read homepage content" on public.homepage_content;
drop policy if exists "Store administrators manage homepage content" on public.homepage_content;
drop policy if exists "Public read store settings" on public.store_settings;
drop policy if exists "Store administrators manage settings" on public.store_settings;
drop policy if exists "Legacy customer rows are not exposed" on public.customers;
drop policy if exists "Store administrators manage legacy promos" on public.promos;

create policy "Public read active products" on public.products
  for select to anon, authenticated using (active);
create policy "Store administrators manage products" on public.products
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Public read active categories" on public.categories
  for select to anon, authenticated using (active);
create policy "Store administrators manage categories" on public.categories
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Public read product variants" on public.product_variants
  for select to anon, authenticated using (
    exists (select 1 from public.products p where p.id = product_id and p.active)
  );
create policy "Store administrators manage product variants" on public.product_variants
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Public read inventory" on public.inventory
  for select to anon, authenticated using (
    exists (
      select 1 from public.product_variants v
      join public.products p on p.id = v.product_id
      where v.id = variant_id and p.active
    )
  );
create policy "Store administrators manage inventory" on public.inventory
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Public read active collections" on public.collections
  for select to anon, authenticated using (active);
create policy "Store administrators manage collections" on public.collections
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Public read collection products" on public.collection_products
  for select to anon, authenticated using (
    exists (select 1 from public.collections c where c.id = collection_id and c.active)
  );
create policy "Store administrators manage collection products" on public.collection_products
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));

create policy "Profiles can be read by their owner" on public.profiles
  for select to authenticated using (id = auth.uid());
create policy "Store administrators can read profiles" on public.profiles
  for select to authenticated using (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Profiles can be updated by their owner" on public.profiles
  for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "Users can read own roles" on public.app_roles
  for select to authenticated using (user_id = auth.uid());
create policy "Store administrators can read roles" on public.app_roles
  for select to authenticated using (public.has_store_role(array['owner', 'admin', 'staff']));

create policy "Customers read own orders" on public.orders
  for select to authenticated using (
    profile_id = auth.uid() or public.has_store_role(array['owner', 'admin', 'staff'])
  );
create policy "Store administrators manage orders" on public.orders
  for update to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Customers read own order items" on public.order_items
  for select to authenticated using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (o.profile_id = auth.uid() or public.has_store_role(array['owner', 'admin', 'staff']))
    )
  );

create policy "Store administrators manage coupons" on public.coupons
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Store administrators manage media metadata" on public.media_assets
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Public read homepage content" on public.homepage_content
  for select to anon, authenticated using (true);
create policy "Store administrators manage homepage content" on public.homepage_content
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Public read store settings" on public.store_settings
  for select to anon, authenticated using (true);
create policy "Store administrators manage settings" on public.store_settings
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));
create policy "Legacy customer rows are not exposed" on public.customers
  for select to authenticated using (
    auth.uid() = id or public.has_store_role(array['owner', 'admin', 'staff'])
  );
create policy "Store administrators manage legacy promos" on public.promos
  for all to authenticated
  using (public.has_store_role(array['owner', 'admin', 'staff']))
  with check (public.has_store_role(array['owner', 'admin', 'staff']));

create or replace function public.set_customer_role(p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.has_store_role(array['owner', 'admin']) then
    raise exception 'Administrator permission is required.';
  end if;
  if p_role not in ('customer', 'staff', 'admin') then
    raise exception 'Only customer, staff, and admin roles can be assigned here.';
  end if;
  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'The requested account does not exist.';
  end if;
  if exists (select 1 from public.app_roles where user_id = p_user_id and role = 'owner') then
    raise exception 'The first owner role can only be managed by a project database administrator.';
  end if;
  delete from public.app_roles
  where user_id = p_user_id and role in ('staff', 'admin');
  if p_role <> 'customer' then
    insert into public.app_roles (user_id, role) values (p_user_id, p_role);
  end if;
end;
$$;
revoke all on function public.set_customer_role(uuid, text) from public;
grant execute on function public.set_customer_role(uuid, text) to authenticated;

create or replace function public.validate_store_coupon(p_code text, p_subtotal integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_coupon public.coupons%rowtype;
  v_discount integer;
begin
  if p_subtotal is null or p_subtotal < 0 then
    raise exception 'Subtotal must be a non-negative amount.';
  end if;
  select * into v_coupon from public.coupons
  where code = upper(trim(coalesce(p_code, '')))
    and active
    and (expires_at is null or expires_at > now());
  if not found then
    raise exception 'The coupon code is invalid or expired.';
  end if;
  if p_subtotal < v_coupon.min_order then
    raise exception 'The order does not meet the coupon minimum.';
  end if;
  v_discount := case when v_coupon.type = 'percentage'
    then floor(p_subtotal * v_coupon.value / 100.0)::integer
    else least(v_coupon.value, p_subtotal)
  end;
  return jsonb_build_object(
    'code', v_coupon.code,
    'type', v_coupon.type,
    'value', v_coupon.value,
    'discount', v_discount,
    'description', v_coupon.description
  );
end;
$$;
revoke all on function public.validate_store_coupon(text, integer) from public;
grant execute on function public.validate_store_coupon(text, integer) to anon, authenticated;

create or replace function public.place_store_order(
  p_idempotency_key uuid,
  p_customer jsonb,
  p_items jsonb,
  p_coupon_code text default null,
  p_delivery_method text default 'Standard delivery',
  p_payment_method text default 'Cash on delivery'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_existing public.orders%rowtype;
  v_order_id uuid;
  v_profile_id uuid := auth.uid();
  v_subtotal bigint := 0;
  v_discount bigint := 0;
  v_shipping integer;
  v_total bigint;
  v_free_threshold integer;
  v_standard_shipping integer;
  v_coupon public.coupons%rowtype;
  v_coupon_code text := nullif(upper(trim(coalesce(p_coupon_code, ''))), '');
  v_item jsonb;
  v_quantity integer;
  v_product_id uuid;
  v_variant_id uuid;
  v_inventory_id uuid;
  v_product_name text;
  v_product_sku text;
  v_price integer;
  v_stock integer;
begin
  if p_idempotency_key is null then
    raise exception 'An idempotency key is required.';
  end if;
  select * into v_existing from public.orders where idempotency_key = p_idempotency_key;
  if found then
    return jsonb_build_object('id', v_existing.id, 'total', v_existing.total, 'duplicate', true);
  end if;
  if p_items is null or jsonb_typeof(p_items) is distinct from 'array' then
    raise exception 'Order items must be provided as an array.';
  end if;
  if jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Order must contain between 1 and 50 distinct items.';
  end if;
  if p_customer is null or jsonb_typeof(p_customer) is distinct from 'object' then
    raise exception 'Customer details must be provided.';
  end if;
  if coalesce(length(trim(p_customer ->> 'full_name')), 0) not between 1 and 200
    or coalesce(length(trim(p_customer ->> 'phone')), 0) not between 3 and 40
    or coalesce(length(trim(p_customer ->> 'address')), 0) not between 1 and 1000 then
    raise exception 'Customer name, phone, and delivery address are required.';
  end if;
  if coalesce(p_delivery_method, '') not in ('Standard delivery', 'Express delivery')
    or coalesce(p_payment_method, '') <> 'Cash on delivery' then
    raise exception 'The selected delivery or payment method is not available.';
  end if;
  select shipping_free_threshold, standard_shipping
  into v_free_threshold, v_standard_shipping
  from public.store_settings where singleton = true;
  v_free_threshold := coalesce(v_free_threshold, 2000);
  v_standard_shipping := coalesce(v_standard_shipping, 120);

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    if v_quantity is null or v_quantity not between 1 and 99 then
      raise exception 'Item quantity must be between 1 and 99.';
    end if;
    select pv.id, inv.variant_id, p.name, p.sku,
      coalesce(p.sale_price, p.price), inv.stock_quantity
    into v_variant_id, v_inventory_id, v_product_name, v_product_sku, v_price, v_stock
    from public.product_variants pv
    join public.products p on p.id = pv.product_id and p.active
    join public.inventory inv on inv.variant_id = pv.id
    where p.id = v_product_id
      and pv.size = v_item ->> 'size'
      and pv.color = v_item ->> 'color'
    for update of inv;
    if not found then
      raise exception 'A requested product variant is no longer available.';
    end if;
    if v_stock < v_quantity then
      raise exception 'Insufficient stock for % (% / %).', v_product_name, v_item ->> 'size', v_item ->> 'color';
    end if;
    v_subtotal := v_subtotal + (v_price::bigint * v_quantity);
    if v_subtotal > 2147483647 then
      raise exception 'Order total exceeds the supported amount.';
    end if;
  end loop;

  if v_coupon_code is not null then
    select * into v_coupon from public.coupons
    where code = v_coupon_code and active and (expires_at is null or expires_at > now());
    if not found then
      raise exception 'The coupon code is invalid or expired.';
    end if;
    if v_subtotal < v_coupon.min_order then
      raise exception 'The order does not meet the coupon minimum.';
    end if;
    v_discount := case when v_coupon.type = 'percentage'
      then floor(v_subtotal * v_coupon.value / 100.0)::bigint
      else least(v_coupon.value, v_subtotal)
    end;
  end if;
  v_shipping := case when v_subtotal >= v_free_threshold then 0 else v_standard_shipping end;
  if p_delivery_method = 'Express delivery' then
    v_shipping := v_shipping + v_standard_shipping;
  end if;
  v_total := v_subtotal - v_discount + v_shipping;
  if v_total > 2147483647 then
    raise exception 'Order total exceeds the supported amount.';
  end if;

  insert into public.orders (
    idempotency_key, profile_id, status, subtotal, discount, shipping, total,
    payment_method, payment_status, country, city, address, notes, full_name,
    phone, governorate, delivery_method, coupon_code
  )
  values (
    p_idempotency_key, v_profile_id, 'Pending', v_subtotal, v_discount, v_shipping, v_total,
    p_payment_method, 'Pending', coalesce(nullif(trim(p_customer ->> 'country'), ''), 'Egypt'),
    nullif(trim(p_customer ->> 'city'), ''), trim(p_customer ->> 'address'),
    nullif(trim(p_customer ->> 'notes'), ''), trim(p_customer ->> 'full_name'),
    trim(p_customer ->> 'phone'), nullif(trim(p_customer ->> 'governorate'), ''),
    p_delivery_method, v_coupon_code
  )
  returning id into v_order_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_product_id := (v_item ->> 'product_id')::uuid;
    v_quantity := (v_item ->> 'quantity')::integer;
    select pv.id, inv.stock_quantity, p.name, p.sku, coalesce(p.sale_price, p.price)
    into v_variant_id, v_stock, v_product_name, v_product_sku, v_price
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    join public.inventory inv on inv.variant_id = pv.id
    where p.id = v_product_id and pv.size = v_item ->> 'size' and pv.color = v_item ->> 'color'
    for update of inv;
    update public.inventory
    set stock_quantity = stock_quantity - v_quantity
    where variant_id = v_variant_id and stock_quantity >= v_quantity;
    if not found then
      raise exception 'Stock changed while placing the order. Please try again.';
    end if;
    insert into public.order_items (
      order_id, product_id, variant_id, sku, name, size, color, price, quantity
    )
    values (
      v_order_id, v_product_id, v_variant_id, v_product_sku, v_product_name,
      v_item ->> 'size', v_item ->> 'color', v_price, v_quantity
    );
  end loop;

  return jsonb_build_object('id', v_order_id, 'total', v_total, 'duplicate', false);
end;
$$;
revoke all on function public.place_store_order(uuid, jsonb, jsonb, text, text, text) from public;
grant execute on function public.place_store_order(uuid, jsonb, jsonb, text, text, text) to anon, authenticated;

create or replace function public.track_store_order(p_order_id uuid)
returns table (id uuid, status text, delivery_method text, tracking text)
language sql
security definer
set search_path = public
as $$
  select o.id, o.status, o.delivery_method, o.tracking
  from public.orders o
  where o.id = p_order_id;
$$;
revoke all on function public.track_store_order(uuid) from public;
grant execute on function public.track_store_order(uuid) to anon, authenticated;

insert into storage.buckets (id, name, public)
values ('product-media', 'product-media', true)
on conflict (id) do update set public = true;

drop policy if exists "Public read product media" on storage.objects;
drop policy if exists "Store administrators upload product media" on storage.objects;
drop policy if exists "Store administrators update product media" on storage.objects;
drop policy if exists "Store administrators delete product media" on storage.objects;
create policy "Public read product media" on storage.objects
  for select to anon, authenticated using (bucket_id = 'product-media');
create policy "Store administrators upload product media" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'product-media'
    and public.has_store_role(array['owner', 'admin', 'staff'])
  );
create policy "Store administrators update product media" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'product-media'
    and public.has_store_role(array['owner', 'admin', 'staff'])
  )
  with check (
    bucket_id = 'product-media'
    and public.has_store_role(array['owner', 'admin', 'staff'])
  );
create policy "Store administrators delete product media" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'product-media'
    and public.has_store_role(array['owner', 'admin', 'staff'])
  );
