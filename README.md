# 5ADSH

5ADSH (خدش) is a Cairo streetwear storefront with catalog browsing, cart and checkout flows, customer authentication, order tracking, and a role-protected store administration dashboard.

## Development

Requirements: Node.js and npm.

```sh
npm install
npm run dev
```

Available scripts:

- `npm run dev` — start the Vite development server
- `npm run build` — create the production client and server build
- `npm run preview` — preview the production build
- `npm test` — run the Vitest suite once
- `npm run test:watch` — run Vitest in watch mode
- `npm run lint` — run ESLint
- `npm run format` — format the project with Prettier

## Application routes

The storefront is available at `/`, with catalog and commerce routes including `/products`, `/products/:category`, `/product/:slug`, `/cart`, `/checkout`, and `/tracking`.

Customer account routes include `/login`, `/register`, `/account`, `/forgot-password`, and `/reset-password`. Store administration is available at `/admin` and `/admin/login` for authenticated users with an appropriate store role.

## Supabase configuration

Copy `.env.example` to `.env` and provide the public Supabase project URL and publishable key:

```sh
VITE_APP_NAME=5ADSH
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_SUPABASE_PUBLISHABLE_KEY
```

The legacy `VITE_SUPABASE_ANON_KEY` variable remains supported for existing projects. Never place service-role keys or other private credentials in client-exposed environment variables.

### Local staging

Vite supports a separate `staging` mode. Copy `.env.staging.example` to `.env.staging.local` and fill it yourself using the URL, publishable key, and Project Ref from the separate staging project's dashboard:

```sh
cp .env.staging.example .env.staging.local
npm run dev -- --mode staging
```

The staging mode reads only these variables and never falls back to the production variables above:

```sh
VITE_SUPABASE_STAGING_URL=https://YOUR_STAGING_PROJECT_REF.supabase.co
VITE_SUPABASE_STAGING_PUBLISHABLE_KEY=YOUR_STAGING_PUBLISHABLE_KEY
VITE_SUPABASE_STAGING_PROJECT_REF=YOUR_STAGING_PROJECT_REF
```

The URL hostname must match the staging Project Ref exactly. If staging variables are missing or invalid, the app fails closed and does not initialize Supabase. `.env.staging.local` is ignored and must never be committed. Do not put service-role keys or other private credentials in it.

The database migrations live in `supabase/migrations/` and are not applied automatically by the application. Review [supabase/MIGRATION_AUDIT.md](./supabase/MIGRATION_AUDIT.md) before deployment and apply migrations only after a read-only schema and migration-history inspection.

### First owner setup

Create the intended account through `/admin/setup-owner` and verify its email using the configured Supabase Auth flow. This public page creates an ordinary customer account only; it cannot grant a role. A trusted project database administrator must verify the Auth user and run `supabase/first-owner.sql` with that user's UUID substituted for the placeholder. The SQL serializes concurrent claims and refuses to run when an owner already exists or the account email is unverified. Never run it as an application user or expose database credentials in the browser. Recovery or owner replacement requires a separate explicit database-administrator action.
