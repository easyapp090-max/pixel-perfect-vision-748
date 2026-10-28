import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/lib/supabase", () => ({
  getSupabaseClient: () => ({ rpc }),
}));

import { placeOrder } from "@/lib/store-api";

const migration = readFileSync(
  resolve(process.cwd(), "supabase/migrations/002_secure_store.sql"),
  "utf8",
);

describe("order creation safeguards", () => {
  it("sends identifiers and quantities, not client-controlled financial values", async () => {
    rpc.mockResolvedValueOnce({
      data: {
        id: "123e4567-e89b-12d3-a456-426614174000",
        total: 2120,
        duplicate: false,
      },
      error: null,
    });

    await placeOrder({
      idempotencyKey: "123e4567-e89b-12d3-a456-426614174001",
      customer: {
        fullName: "Mona Hassan",
        phone: "0123456789",
        governorate: "Cairo",
        city: "Dokki",
        address: "12 Street 9",
        notes: "",
      },
      items: [
        {
          productId: "123e4567-e89b-12d3-a456-426614174002",
          size: "M",
          color: "Black",
          quantity: 1,
        },
      ],
      couponCode: "DROP10",
      deliveryMethod: "Standard delivery",
      paymentMethod: "Cash on delivery",
    });

    const payload = rpc.mock.calls[0]?.[1] as Record<string, unknown>;
    const item = (payload["p_items"] as Array<Record<string, unknown>>)[0];
    expect(item).toMatchObject({
      product_id: "123e4567-e89b-12d3-a456-426614174002",
      quantity: 1,
      size: "M",
      color: "Black",
    });
    expect(item).not.toHaveProperty("price");
    expect(item).not.toHaveProperty("discount");
    expect(item).not.toHaveProperty("shipping");
    expect(item).not.toHaveProperty("total");
  });

  it("contains server-side validation and authoritative pricing in the RPC", () => {
    expect(migration).toMatch(
      /p_items is null or jsonb_typeof\(p_items\) is distinct from 'array'/i,
    );
    expect(migration).toMatch(/v_quantity is null or v_quantity not between 1 and 99/i);
    expect(migration).toMatch(/join public\.products p on p\.id = pv\.product_id and p\.active/i);
    expect(migration).toMatch(/coalesce\(p\.sale_price, p\.price\)/i);
    expect(migration).toMatch(/where code = v_coupon_code and active/i);
    expect(migration).toMatch(/v_shipping := case when v_subtotal >= v_free_threshold/i);
    expect(migration).toMatch(/idempotency_key uuid/i);
  });

  it("contains the database uniqueness guard for idempotency keys", () => {
    expect(migration).toMatch(
      /create unique index if not exists orders_idempotency_key_uidx[\s\S]*?on public\.orders \(idempotency_key\) where idempotency_key is not null/i,
    );
  });
});
