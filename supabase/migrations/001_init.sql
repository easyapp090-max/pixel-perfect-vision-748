-- Legacy initial schema. Apply supabase/migrations/002_secure_store.sql after this migration.
-- Do not use this baseline by itself in a live deployment.
do $$
begin
  if to_regclass('auth.users') is null then
    raise exception '001_init.sql requires Supabase Auth (auth.users). Enable Auth before applying migrations.';
  end if;
  if to_regclass('storage.buckets') is null or to_regclass('storage.objects') is null then
    raise exception '001_init.sql requires Supabase Storage (storage.buckets and storage.objects). Enable Storage before applying migrations.';
  end if;
end;
$$;

create extension if not exists pgcrypto;

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  name text not null,
  phone text,
  role text not null default 'customer' check (role in ('customer', 'staff', 'admin')),
  status text not null default 'active' check (status in ('active', 'blocked')),
  created_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  category text not null,
  subcategory text not null,
  price integer not null check (price >= 0),
  sale_price integer,
  sku text not null unique,
  description text not null default '',
  badge text,
  featured boolean not null default false,
  best_seller boolean not null default false,
  new_arrival boolean not null default false,
  images jsonb not null default '[]'::jsonb,
  colors jsonb not null default '[]'::jsonb,
  sizes jsonb not null default '[]'::jsonb,
  variants jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  status text not null default 'Pending' check (status in ('Pending', 'Confirmed', 'Packed', 'Shipped', 'Delivered', 'Cancelled')),
  subtotal integer not null default 0,
  discount integer not null default 0,
  shipping integer not null default 0,
  total integer not null default 0,
  payment_method text not null default 'Cash on delivery',
  payment_status text not null default 'Pending' check (payment_status in ('Pending', 'Completed', 'Failed')),
  tracking text,
  country text not null default 'Egypt',
  city text,
  address text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  sku text,
  name text not null,
  size text,
  color text,
  price integer not null,
  quantity integer not null default 1,
  created_at timestamptz not null default now()
);

create table if not exists public.promos (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  type text not null check (type in ('percentage', 'fixed')),
  value integer not null default 0,
  min_order integer not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  description text,
  created_at timestamptz not null default now()
);

alter table public.customers enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.promos enable row level security;

-- Policies are intentionally installed by 002_secure_store.sql after the
-- Auth-backed profile/role model exists. Leaving these tables with RLS enabled
-- and no policies during the base migration prevents a permissive transitional
-- policy from being exposed if the migration sequence is interrupted.
