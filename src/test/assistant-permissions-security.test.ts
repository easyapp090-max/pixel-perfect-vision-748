import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/004_assistant_permissions.sql"),
  "utf8",
);
const storefrontPoliciesMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/006_restore_public_read_policies.sql"),
  "utf8",
);
const accountAccessMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/011_account_access_management.sql"),
  "utf8",
);
const delegatedAccountAccessMigration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/012_delegated_account_management.sql"),
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

  it("allows authenticated users to read only their own role", () => {
    expect(storefrontPoliciesMigration).toMatch(
      /create policy users_read_own_roles on public\.app_roles[\s\S]*for select to authenticated using \(user_id = auth\.uid\(\)\)/i,
    );
  });

  it("limits the assistant count at the database boundary", () => {
    expect(migration).toMatch(/no more than five assistants/i);
    expect(migration).toMatch(/create trigger enforce_store_assistant_limit/i);
    expect(migration).toMatch(/pg_advisory_xact_lock\(hashtext\('5adsh-assistant-limit'\)\)/i);
    expect(migration).toMatch(/before insert or update of role on public\.app_roles/i);
  });

  it("keeps admin and assistant access owner-managed and permission-scoped", () => {
    expect(accountAccessMigration).toMatch(
      /create or replace function public\.set_account_access[\s\S]*?if not public\.is_store_owner\(\) then/i,
    );
    expect(accountAccessMigration).toMatch(/p_role not in \('customer', 'staff', 'admin'\)/i);
    expect(accountAccessMigration).toMatch(/role = 'staff' and user_id <> p_user_id/i);
    expect(accountAccessMigration).toMatch(
      /delete from public\.store_permissions where user_id = p_user_id;[\s\S]*?insert into public\.store_permissions/i,
    );
    expect(accountAccessMigration).toMatch(
      /p_role = 'customer' and cardinality\(coalesce\(p_permissions, '\{\}'::text\[\]\)\) > 0/i,
    );
    expect(accountAccessMigration).toMatch(/p_role in \('staff', 'admin'\)/i);
    expect(accountAccessMigration).toMatch(
      /grant execute on function public\.set_account_access\(uuid, text, text\[\]\) to authenticated;/i,
    );
  });

  it("allows only explicitly authorized managers to manage accounts", () => {
    expect(delegatedAccountAccessMigration).toMatch(
      /if not public\.can_manage_store_accounts\(\) then/i,
    );
    expect(delegatedAccountAccessMigration).toMatch(
      /create or replace function public\.can_manage_store_accounts[\s\S]*?role = 'admin'[\s\S]*?has_store_permission\('manage_accounts'\)/i,
    );
    expect(delegatedAccountAccessMigration).toMatch(
      /p_role not in \('customer', 'staff', 'admin', 'moderator'\)/i,
    );
    expect(delegatedAccountAccessMigration).toMatch(
      /create policy "Account managers read profiles"[\s\S]*?can_manage_store_accounts\(\)/i,
    );
    expect(delegatedAccountAccessMigration).toMatch(
      /create policy "Account managers read roles"[\s\S]*?can_manage_store_accounts\(\)/i,
    );
    expect(delegatedAccountAccessMigration).toMatch(
      /create policy "Account managers read permissions"[\s\S]*?can_manage_store_accounts\(\)/i,
    );
    expect(delegatedAccountAccessMigration).toMatch(
      /role in \('owner', 'admin', 'staff', 'moderator'\)/i,
    );
    expect(delegatedAccountAccessMigration).toMatch(
      /p_user_id = auth\.uid\(\) and public\.is_store_owner\(\)/i,
    );

    const adminSource = readFileSync(resolve(process.cwd(), "src/routes/admin.tsx"), "utf8");
    expect(adminSource).toMatch(/permissions\.includes\("manage_accounts"\)/);
    expect(adminSource).toMatch(/disabled={!canManageAccounts \|\| customer\.role === "owner"}/);
    expect(adminSource).toMatch(/<option value="moderator">Moderator<\/option>/);
  });

  it("keeps role priority deterministic and restricts account access to allowed roles", () => {
    const authSource = readFileSync(resolve(process.cwd(), "src/lib/auth.ts"), "utf8");
    const adminSource = readFileSync(resolve(process.cwd(), "src/routes/admin.tsx"), "utf8");

    expect(authSource).toMatch(
      /const rolePriority: AccountRole\[\] = \["owner", "admin", "staff", "moderator", "customer"\]/,
    );
    expect(authSource).toMatch(
      /return session\.role === "owner" \|\| session\.role === "admin" \|\| session\.permissions\.length > 0/,
    );
    expect(authSource).toMatch(/assignedRoles = new Set\(roles\?\.map\(\(row\) => row\.role\)\)/);
    expect(adminSource).toMatch(/hasAdminAccess\(session\)/);
    expect(adminSource).toMatch(/No permissions assigned/);
  });

  it("restores anonymous reads for active storefront products and related public data", () => {
    expect(storefrontPoliciesMigration).toMatch(
      /create policy "Public read active products" on public\.products[\s\S]*using \(active\)/i,
    );
    expect(storefrontPoliciesMigration).toMatch(
      /create policy "Public read product variants" on public\.product_variants[\s\S]*p\.active/i,
    );
    expect(storefrontPoliciesMigration).toMatch(
      /create policy "Public read inventory" on public\.inventory[\s\S]*p\.active/i,
    );
    expect(storefrontPoliciesMigration).toMatch(
      /create policy users_read_own_roles on public\.app_roles[\s\S]*user_id = auth\.uid\(\)/i,
    );
  });
});
