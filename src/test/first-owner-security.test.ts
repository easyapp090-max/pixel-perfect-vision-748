import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/005_first_owner_setup.sql"),
  "utf8",
);

describe("first-owner setup safeguards", () => {
  it("exposes status but never a public owner mutation RPC", () => {
    expect(migration).toMatch(/first_owner_setup_available\(\)/i);
    expect(migration).toMatch(
      /grant execute on function public\.first_owner_setup_available\(\) to anon, authenticated;/i,
    );
    expect(migration).toMatch(/drop function if exists public\.bootstrap_first_owner\(\)/i);
    expect(migration).not.toMatch(/create (or replace )?function public\.bootstrap_first_owner/i);
  });

  it("requires an email-verified Auth user and a database administrator", () => {
    const bootstrap = readFileSync(resolve(process.cwd(), "supabase/first-owner.sql"), "utf8");
    expect(bootstrap).toMatch(/current_user not in \('postgres', 'supabase_admin'\)/i);
    expect(bootstrap).toMatch(
      /pg_advisory_xact_lock\(hashtext\('5adsh-first-owner-bootstrap'\)\)/i,
    );
    expect(bootstrap).toMatch(/email_confirmed_at is not null/i);
    expect(bootstrap).toMatch(/exists \(select 1 from public\.app_roles where role = 'owner'\)/i);
    expect(bootstrap).toMatch(/insert into public\.app_roles \(user_id, role\)/i);
  });

  it("does not use signup metadata or a client callable role-grant function", () => {
    const auth = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8");
    expect(auth).not.toMatch(/first_owner_setup\s*:/i);
    expect(auth).not.toMatch(/rpc\(["']bootstrap_first_owner["']/i);
  });
});
