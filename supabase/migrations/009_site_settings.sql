-- Reuse the existing singleton store_settings row for public site contact data.
-- This migration is intentionally prepared but must be reviewed before applying
-- it to the hosted Supabase project.
do $$
begin
  if to_regclass('public.store_settings') is null then
    raise exception '009_site_settings.sql requires 002_secure_store.sql first.';
  end if;
end;
$$;

alter table public.store_settings
  add column if not exists phone text not null default '',
  add column if not exists whatsapp text not null default '',
  add column if not exists address text not null default '',
  add column if not exists email text not null default '',
  add column if not exists google_maps_url text not null default '',
  add column if not exists instagram_url text not null default '',
  add column if not exists facebook_url text not null default '',
  add column if not exists tiktok_url text not null default '',
  add column if not exists instagram_enabled boolean not null default true,
  add column if not exists facebook_enabled boolean not null default true,
  add column if not exists tiktok_enabled boolean not null default true,
  add column if not exists show_best_sellers boolean not null default true,
  add column if not exists show_new_drops boolean not null default true,
  add column if not exists updated_by uuid references auth.users(id) on delete set null;

insert into public.store_settings (singleton)
values (true)
on conflict (singleton) do nothing;

comment on table public.store_settings is
  'Singleton commerce and public site settings. Public columns contain display-only contact data.';
