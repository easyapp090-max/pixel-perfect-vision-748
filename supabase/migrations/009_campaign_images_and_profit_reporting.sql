begin;

do $$
declare
  missing_tables text[];
begin
  select array_agg(required_table order by required_table)
  into missing_tables
  from unnest(array['products', 'order_items', 'homepage_content']) as required(required_table)
  where to_regclass('public.' || required_table) is null;

  if missing_tables is not null then
    raise exception '009_campaign_images_and_profit_reporting.sql requires migrations 001 and 002 first. Missing public tables: %', missing_tables;
  end if;
end;
$$;

alter table public.products
  add column if not exists cost_price integer
  check (cost_price is null or cost_price >= 0);

alter table public.order_items
  add column if not exists unit_cost integer
  check (unit_cost is null or unit_cost >= 0);

alter table public.homepage_content
  add column if not exists hero_image text not null default '',
  add column if not exists campaign_image text not null default '',
  add column if not exists campaign_eyebrow text not null default '(05) LIMITED — 150 PIECES ONLY',
  add column if not exists campaign_title text not null default 'The Fracture Run',
  add column if not exists campaign_description text not null default
    'Hand-cracked screen print on 280gsm washed cotton. Numbered inside the neck. The next drop is configured from the admin dashboard.',
  add column if not exists campaign_cta text not null default 'CLAIM YOURS',
  add column if not exists campaign_product_id uuid references public.products(id) on delete set null;

create or replace function public.snapshot_order_item_cost()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.product_id is null then
    new.unit_cost := null;
    return new;
  end if;

  select cost_price into new.unit_cost
  from public.products
  where id = new.product_id;

  if not found then
    raise exception 'The order item product does not exist.';
  end if;
  return new;
end;
$$;

revoke all on function public.snapshot_order_item_cost() from public;

drop trigger if exists snapshot_order_item_cost on public.order_items;
create trigger snapshot_order_item_cost
  before insert on public.order_items
  for each row execute function public.snapshot_order_item_cost();

commit;
