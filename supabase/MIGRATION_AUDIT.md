# Supabase migration dependency audit

## Required order for a new Supabase project

Apply the files in numeric order, in one migration runner:

1. `001_init.sql`
2. `002_secure_store.sql`
3. `003_secure_order_tracking.sql`
4. `004_assistant_permissions.sql`
5. `005_first_owner_setup.sql`

Run migrations in order with a single migration runner. `001` checks that Supabase Auth and Storage are enabled. `002`, `004`, and `005` check their key prerequisites and fail with actionable messages. Migrations `002` and `004` replace policies on managed tables because PostgreSQL ORs permissive policies together. `005` publishes setup availability only; it does not expose an owner-grant RPC.

## Existing/hosted project status

This repository environment has a linked-project reference in the Supabase CLI metadata, but no `supabase` executable or `psql` client was available for a supported, read-only inspection. The hosted project's application tables and expected migration-history table were reported absent in a prior inspection, but this checkout could not independently confirm either finding. Do not treat local SQL files, `.temp` metadata, or that report as proof of hosted schema state. Before any deployment, use an approved Supabase CLI/dashboard workflow to inspect application tables, `supabase_migrations.schema_migrations`, and existing data. Stop and reconcile drift before applying migrations. No hosted SQL was run from this work.

## Deployment and verification

1. Inspect the hosted `public`, `auth`, and `storage` schemas and migration history read-only; record data and any partial migration state.
2. Take/verify a recoverable backup and review each SQL diff against the observed database.
3. For an empty project, apply `001` through `005` in numeric order through Supabase's migration runner. For any nonempty/partially initialized project, do not replay this chain blindly; prepare a forward repair migration based on the inspection.
4. Confirm tables, functions, indexes, policies, the `product-media` bucket, and migration history read-only afterward.
5. Create and email-verify the intended Auth account, then have a trusted database administrator run `supabase/first-owner.sql` once with its Auth UUID. Confirm exactly one owner exists.
6. Smoke-test public catalog, checkout, tracking, customer isolation, owner access, and assistant permissions against the target project.

Local static migration tests do not execute PostgreSQL. This environment could not verify migration execution or application behavior against hosted Supabase.

## Dependency audit

| Dependency | Created by | Used by | Required columns or behavior |
| --- | --- | --- | --- |
| `customers`, `products`, `orders`, `order_items`, `promos` | `001_init.sql` | `002_secure_store.sql` | Legacy compatibility tables; product/order base columns remain in use |
| `profiles` | `002_secure_store.sql` | auth code, admin API, RLS | `id` references `auth.users(id)`, `email`, `full_name`, `phone` |
| `app_roles` | `002_secure_store.sql` | auth code, RLS, `004`, `005` | `user_id` references `auth.users(id)`, role check, `(user_id, role)` primary key |
| `categories` | `002_secure_store.sql` | storefront/admin API, RLS | `id`, `name`, `slug`, `image`, `arabic`, `active` |
| `product_variants` | `002_secure_store.sql` | product API/order RPC, RLS | `product_id`, `size`, `color`, `sku` |
| `inventory` | `002_secure_store.sql` | product API/order RPC, RLS | `variant_id`, `stock_quantity` |
| `collections`, `collection_products` | `002_secure_store.sql` | admin API, RLS | collection/product foreign keys and `position` |
| `coupons` | `002_secure_store.sql` | coupon/order RPC, admin API, RLS | coupon validation fields and constraints |
| `media_assets` | `002_secure_store.sql` | upload API, RLS | storage metadata, uploader, content type, byte size |
| `homepage_content`, `store_settings` | `002_secure_store.sql` | storefront/admin API, order RPC, RLS | singleton rows and settings/content fields |
| order extensions | `002_secure_store.sql` | order API and `003` | `profile_id`, `idempotency_key`, `full_name`, `phone`, `governorate`, `delivery_method`, `coupon_code` |
| `order_items.variant_id` | `002_secure_store.sql` | order RPC and admin reads | product variant reference |
| `handle_auth_user` + auth trigger | `002_secure_store.sql` | Supabase Auth signup/update | creates or updates profile and default customer role |
| `has_store_role`, `set_customer_role`, `validate_store_coupon`, `place_store_order`, `track_store_order(uuid)` | `002_secure_store.sql` | client API | all are created after their referenced tables and granted narrowly |
| `track_store_order(uuid,text)` | `003_secure_order_tracking.sql` | tracking page | checks order UUID and `orders.phone`; revokes UUID-only overload |
| `store_permissions`, owner/permission functions and policies | `004_assistant_permissions.sql` | admin API and RLS | owner gets all permissions through `has_store_permission`; staff/admin are explicit |
| owner unique index | `004_assistant_permissions.sql` | owner bootstrap and role safety | one partial unique owner index on `app_roles.role` |
| owner setup availability | `005_first_owner_setup.sql` | `/admin/setup-owner` | public boolean availability only; no client-callable role grant |

## Function, trigger, and policy inventory

Functions required by the application and their migration owners:

- `002`: `has_store_role(text[])`, `handle_auth_user()`, `touch_updated_at()`,
  `set_customer_role(uuid,text)`, `validate_store_coupon(text,integer)`,
  `place_store_order(uuid,jsonb,jsonb,text,text,text)`, and the temporary
  `track_store_order(uuid)` overload.
- `003`: the secure `track_store_order(uuid,text)` overload; the UUID-only
  overload is revoked there.
- `004`: `is_store_owner()`, `has_store_permission(text)`,
  `enforce_store_assistant_limit()`, `set_assistant_access(uuid,boolean)`,
  `set_assistant_permissions(uuid,text[])`, and the owner-only replacement for
  `set_customer_role(uuid,text)`.
- `005`: `first_owner_setup_available()` only. The grant is performed by the
  database-admin-only `supabase/first-owner.sql` script.

Triggers required by the application:

- `002`: `on_auth_user_created_or_updated` on `auth.users` keeps `profiles` and
  the default customer role synchronized; `*_touch_updated_at` triggers cover
  profiles, products, collections, homepage content, store settings, and
  inventory.
- `004`: `enforce_store_assistant_limit` on `app_roles` serializes and caps
  staff-role additions at five.

Final RLS policy groups installed after the base migration are:

- public active reads for products, categories, product variants, inventory,
  collections, collection products, homepage content, store settings, and
  product-media objects;
- owner/permission-holder management for products, categories, variants,
  inventory, collections, collection links, orders, coupons, media metadata,
  homepage content, settings, and legacy promos;
- self-only profile, role, order, order-item, and permission reads, with owner
  or matching permission expansion where required;
- authenticated owner-only role/assistant RPC execution and no client insert,
  update, or delete policy for `app_roles` or `store_permissions`;
- storage write policies restricted to authenticated users with the relevant
  owner/permission check.

No dependency is intentionally missing in the final state. The only objects
that may appear absent during an interrupted deployment are objects from later
numbered migrations; the guards in `004` and `005` now identify that condition.

## Inconsistencies resolved by the sequence

- `orders.phone` and `orders.delivery_method` are added before the secure
  tracking function and order RPC use them.
- `orders.profile_id` is additive and preserves the legacy `customer_id`
  relationship and data. Existing rows are backfilled when their customer email
  matches an Auth user.
- `order_items.variant_id` is added before order creation inserts it.
- `app_roles` keeps its per-user/per-role primary key and receives the single
  owner partial unique index only after the table exists.
- The Auth trigger is created after `profiles` and `app_roles`, and the owner
  bootstrap RPC is created after the owner/permission security functions.
- `003` revokes the insecure UUID-only tracking overload created in `002`.

## Existing-database upgrade guidance

Do not paste `005` into a database that has no application tables and do not
blindly rerun already-applied migrations. First inspect the migration history
and public schema. For an inspected, empty database with no application tables
or migration records, apply all five
files in order. For a partially migrated database, stop and compare the
objects/columns against this audit; complete only the missing numbered
migrations or prepare an explicit repair migration reviewed against existing
data. If duplicate owner rows already exist, resolve that data issue before
creating the unique owner index.
