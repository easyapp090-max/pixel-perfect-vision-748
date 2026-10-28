import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/004_assistant_permissions.sql"),
  "utf8",
);

describe("assistant permission migration safeguards", () => {
  it("enforces one owner at the database level", () => {
    expect(migration).toMatch(
      /create unique index if not exists app_roles_single_owner_idx[\s\S]*where role = 'owner';/i,
    );
  });

  it("makes assistant management owner-only", () => {
    expect(migration).toMatch(
      /if not public\.is_store_owner\(\) then[\s\S]*Only the store owner can manage assistants\./i,
    );
    expect(migration).toMatch(
      /if not public\.is_store_owner\(\) then[\s\S]*Only the store owner can manage assistant permissions\./i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_assistant_access\(uuid, boolean\) to authenticated;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.set_assistant_permissions\(uuid, text\[\]\) to authenticated;/i,
    );
  });

  it("keeps legacy role changes owner-only and excludes owner assignment", () => {
    expect(migration).toMatch(
      /create or replace function public\.set_customer_role\(p_user_id uuid, p_role text\)[\s\S]*?if not public\.is_store_owner\(\) then/i,
    );
    expect(migration).toMatch(/p_role not in \('customer', 'staff', 'admin'\)/i);
    expect(migration).toMatch(/role can only be managed by the database administrator/i);
    expect(migration).toMatch(
      /delete from public\.app_roles where user_id = p_user_id and role in \('staff', 'admin'\)/i,
    );
  });

  it("does not grant permissions automatically to staff or legacy admin roles", () => {
    expect(migration).toMatch(/create table if not exists public\.store_permissions/i);
    expect(migration).not.toMatch(/insert into public\.store_permissions[\s\S]*select.*staff/i);
    expect(migration).toMatch(/has_store_permission\('manage_products'\)/i);
    expect(migration).toMatch(/has_store_permission\('manage_orders'\)/i);
  });

  it("limits the assistant count at the database boundary", () => {
    expect(migration).toMatch(/no more than five assistants/i);
    expect(migration).toMatch(/create trigger enforce_store_assistant_limit/i);
    expect(migration).toMatch(/pg_advisory_xact_lock\(hashtext\('5adsh-assistant-limit'\)\)/i);
    expect(migration).toMatch(/before insert or update of role on public\.app_roles/i);
  });

  it("keeps role priority deterministic and blocks permissionless admin sessions", () => {
    const authSource = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8");
    const adminSource = readFileSync(resolve(process.cwd(), "src/routes/admin.tsx"), "utf8");

    expect(authSource).toMatch(
      /const rolePriority: AccountRole\[\] = \["owner", "staff", "admin", "customer"\]/,
    );
    expect(authSource).toMatch(/assignedRoles = new Set\(roles\?\.map\(\(row\) => row\.role\)\)/);
    expect(adminSource).toMatch(/hasAdminAccess\(session\)/);
    expect(adminSource).toMatch(/No permissions assigned/);
  });
});
