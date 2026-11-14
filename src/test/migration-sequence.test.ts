import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

const migrationText = (name: string) =>
  readFileSync(resolve(process.cwd(), `supabase/migrations/${name}`), "utf8");

describe("Supabase migration sequence", () => {
  it("creates dependencies before each dependent migration", () => {
    const one = migrationText("001_init.sql");
    const two = migrationText("002_secure_store.sql");
    const three = migrationText("003_secure_order_tracking.sql");
    const four = migrationText("004_assistant_permissions.sql");
    const five = migrationText("005_first_owner_setup.sql");
    const nine = migrationText("009_campaign_images_and_profit_reporting.sql");
    const ten = migrationText("010_admin_customer_lifecycle.sql");

    expect(one).toMatch(/create table if not exists public\.products/i);
    expect(two).toMatch(/create table if not exists public\.app_roles/i);
    expect(two).toMatch(/add column if not exists phone text/i);
    expect(two).toMatch(/add column if not exists delivery_method text/i);
    expect(three).toMatch(/o\.phone = trim/i);
    expect(four.indexOf("do $$")).toBeLessThan(four.indexOf("create unique index"));
    expect(four).toMatch(/create table if not exists public\.store_permissions/i);
    expect(five).toMatch(/to_regclass\('public\.app_roles'\)/i);
    expect(five).toMatch(/create or replace function public\.first_owner_setup_available/i);
    expect(five).not.toMatch(/create (or replace )?function public\.bootstrap_first_owner/i);
    expect(nine).toMatch(/add column if not exists cost_price integer/i);
    expect(nine).toMatch(/add column if not exists unit_cost integer/i);
    expect(nine).toMatch(/before insert on public\.order_items/i);
    expect(nine).toMatch(/campaign_product_id uuid references public\.products/i);
    expect(ten).toMatch(/create or replace function public\.update_customer_profile/i);
    expect(ten).toMatch(/create or replace function public\.delete_customer_account/i);
    expect(ten).toMatch(/public\.is_store_owner\(\)/i);
    expect(ten).toMatch(/full_name = 'Deleted customer'/i);
    expect(ten).toMatch(/profile_id = null/i);
    expect(ten).toMatch(/delete from auth\.users/i);
    expect(one).toMatch(/requires Supabase Auth/i);
    expect(two).toMatch(/requires 001_init\.sql first/i);
    expect(two).toMatch(/pg_policies/i);
    expect(four).toMatch(/pg_policies/i);
  });

  it("does not make the prerequisite guards mutate application data", () => {
    const four = migrationText("004_assistant_permissions.sql");
    const five = migrationText("005_first_owner_setup.sql");
    expect(four.slice(0, four.indexOf("create unique index"))).not.toMatch(
      /insert into|update |delete from/i,
    );
    expect(
      five.slice(0, five.indexOf("create or replace function public.first_owner_setup_available")),
    ).not.toMatch(/insert into|update |delete from/i);
  });
});
