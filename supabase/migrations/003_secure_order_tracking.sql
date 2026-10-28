-- Secure guest order tracking with a second verification factor.
-- Apply after 002_secure_store.sql and before deploying the matching client.
-- The original UUID-only overload is explicitly revoked below so it cannot
-- continue to authorize anonymous or ordinary authenticated callers.

create or replace function public.track_store_order(p_order_id uuid, p_phone text)
returns table (id uuid, status text, delivery_method text, tracking text)
language sql
security definer
set search_path = public
as $$
  select o.id, o.status, o.delivery_method, o.tracking
  from public.orders o
  where o.id = p_order_id
    and o.phone = trim(coalesce(p_phone, ''))
    and length(trim(coalesce(p_phone, ''))) between 3 and 40;
$$;

revoke all on function public.track_store_order(uuid, text) from public;
grant execute on function public.track_store_order(uuid, text) to anon, authenticated;

revoke execute on function public.track_store_order(uuid) from public, anon, authenticated;
