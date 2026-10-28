import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import { ORDER_TRACKING_ERROR_MESSAGE, trackStoreOrder } from "@/lib/store-api";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/003_secure_order_tracking.sql"),
  "utf8",
);

describe("order tracking migration safeguards", () => {
  it("explicitly revokes the UUID-only overload from every public caller role", () => {
    expect(migration).toMatch(
      /revoke execute on function public\.track_store_order\(uuid\) from public, anon, authenticated;/i,
    );
  });

  it("limits the phone-aware overload to anonymous and authenticated callers", () => {
    expect(migration).toMatch(
      /revoke all on function public\.track_store_order\(uuid, text\) from public;/i,
    );
    expect(migration).toMatch(
      /grant execute on function public\.track_store_order\(uuid, text\) to anon, authenticated;/i,
    );
  });

  it("maps RPC failures to a generic customer-safe error", async () => {
    rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "private database detail for order 123" },
    });

    const error = await trackStoreOrder("123e4567-e89b-12d3-a456-426614174000", "0123456789").catch(
      (cause: unknown) => cause,
    );
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toBe(ORDER_TRACKING_ERROR_MESSAGE);
    expect((error as Error).message).not.toContain("private database detail");
  });
});
