# 5ADSH Launch Completion Plan

## Current state

- The storefront routes, catalog, product details, cart, checkout, tracking, customer account, and admin routes are implemented.
- Supabase access is explicit and fails closed when required public configuration is missing or invalid. Demo fixtures remain available only to explicit local/demo consumers; the live storefront does not silently present them as inventory.
- Authentication and safe user-facing error mapping are implemented for customers and administrators.
- Admin authorization has database-backed roles and granular permissions in migration 004. Owner uniqueness is enforced by a partial unique index, and assistant creation is serialized with a transaction advisory lock.
- Local tests, TypeScript, lint, production build, and diff checks pass. Lint still reports six existing Fast Refresh warnings.

## Completed local work

1. Brand identity, metadata, favicon, and shared Wordmark usage.
2. TanStack Start/Vite path resolution and `/admin/login` routing.
3. Explicit live-backend unavailable/error state and staging-only configuration separation.
4. Safe user-facing error messages without raw Supabase/database errors.
5. Checkout/order validation, idempotency-key reuse, and secure order tracking client flow.
6. Owner-only assistant management, granular permissions, deterministic role priority, and permissionless-admin blocking.
7. Local source-level regression tests for the above behavior.

## Remaining work by priority

### P0 — Required before launch

1. Prepare an isolated PostgreSQL/Supabase test environment. The repository currently has no Supabase CLI, `psql`, or `supabase/config.toml`; Docker is installed but no test service has been started.
2. Apply and test migrations 001 through 004 only in that isolated environment. Verify RLS, RPC grants, Storage policies, Owner uniqueness, the five-assistant concurrency limit, order creation, and phone-verified tracking.
3. Confirm Production migration state and schema with read-only checks before any Production change. Do not infer it from local SQL files.
4. Confirm an approved restore point/backup before any Production migration.
5. Apply migrations in order, stop on any unexpected object or data difference, then run read-only post-migration checks.
6. Create the first Owner only after confirming the intended Auth user exists and no Owner already exists, using `supabase/first-owner.sql` through an approved database-admin workflow.

### P1 — Required operational validation

1. Configure the Production public URL and publishable key without exposing service-role credentials.
2. Verify Auth redirects, Storage bucket visibility, product-media policies, and checkout/payment operational decisions.
3. Run authenticated smoke tests for customer registration/login, browsing, cart, checkout, tracking, admin login, each permission, and permission revocation.
4. Confirm monitoring, backups, support contact, order fulfillment, and rollback procedures.

### P2 — Improvements after the first safe release

1. Replace source-level permission checks with repeatable isolated database integration tests in CI.
2. Decide whether the legacy `admin` role should remain for compatibility or be retired after a migration review.
3. Resolve the six existing Fast Refresh lint warnings if they provide operational value.
4. Add an approved invitation/account-provisioning flow if Owners must create Auth accounts from the dashboard.

## Release gate

The project is not launch-ready based on a successful frontend build alone. Release requires isolated database/RLS testing, confirmed Production schema state, a recoverable backup/restore point, Owner bootstrap, and authenticated manual smoke tests. No Production database or deployment action is authorized by this document.
