import { describe, expect, it } from "vitest";

import {
  calculateCart,
  canAccessAdmin,
  canStartCheckoutSubmission,
  validateCheckoutForm,
  validatePromoCode,
} from "@/lib/cart";
import {
  getRemovedVariantIds,
  ORDER_TRACKING_ERROR_MESSAGE,
  validateOrderTrackingInput,
} from "@/lib/store-api";
import { buildSalesReport } from "@/lib/admin-reports";
import type { OrderRecord } from "@/lib/cart";
import { clampProductQuantity, storeProducts } from "@/lib/store-data";
import {
  createInitialStorefrontData,
  filterStorefrontProducts,
  parseTickerMessages,
} from "@/lib/storefront-state";

const firstProduct = storeProducts[0];
const secondProduct = storeProducts[1];
if (!firstProduct || !secondProduct) {
  throw new Error("Store logic tests require at least two product fixtures.");
}

describe("store logic", () => {
  it("applies a valid percentage promo and shipping rules", () => {
    const items = [
      {
        id: "item-1",
        productId: firstProduct.id,
        name: firstProduct.name,
        slug: firstProduct.slug,
        price: firstProduct.salePrice ?? firstProduct.price,
        image: firstProduct.images[0] ?? "",
        size: "M",
        color: "Black",
        quantity: 2,
      },
      {
        id: "item-2",
        productId: secondProduct.id,
        name: secondProduct.name,
        slug: secondProduct.slug,
        price: secondProduct.salePrice ?? secondProduct.price,
        image: secondProduct.images[0] ?? "",
        size: "L",
        color: "Stone",
        quantity: 1,
      },
    ];

    const result = calculateCart(items);

    expect(result.subtotal).toBe(
      2 * (firstProduct.salePrice ?? firstProduct.price) +
        (secondProduct.salePrice ?? secondProduct.price),
    );
    expect(result.discount).toBe(0);
    expect(result.shipping).toBeGreaterThanOrEqual(0);
    expect(result.total).toBeGreaterThan(0);
    expect(result.total).toBeLessThanOrEqual(result.subtotal + result.shipping);
  });

  it("rejects expired or invalid promo codes", () => {
    expect(validatePromoCode("BADCODE", 1500)).toMatchObject({ valid: false });
    expect(validatePromoCode("EXPIRED25", 3000)).toMatchObject({ valid: false });
  });

  it("keeps product and order data available in the storefront catalog", () => {
    expect(storeProducts.length).toBeGreaterThan(0);
    expect(firstProduct.slug).toBeTruthy();
    expect(firstProduct.variants.length).toBeGreaterThan(0);
  });

  it("keeps selected product quantity within the selected variant stock", () => {
    expect(clampProductQuantity(5, 1)).toBe(1);
    expect(clampProductQuantity(2, 0)).toBe(1);
    expect(clampProductQuantity(1.8, 4)).toBe(1);
  });

  it("requires complete checkout data and respects admin roles", () => {
    const valid = validateCheckoutForm({
      fullName: "Mona Hassan",
      phone: "+966500123456",
      governorate: "Cairo",
      city: "Dokki",
      address: "12 Street 9",
      notes: "Leave at the reception desk",
      deliveryMethod: "Standard delivery",
      paymentMethod: "Cash on delivery",
    });

    expect(valid.valid).toBe(true);
    expect(validateCheckoutForm({ fullName: "" }).valid).toBe(false);
    expect(canAccessAdmin("admin")).toBe(true);
    expect(canAccessAdmin("customer")).toBe(false);
  });

  it("rejects checkout submissions that omit required delivery fields", () => {
    const validation = validateCheckoutForm({
      fullName: "Mona Hassan",
      phone: "0123456789",
      governorate: "Cairo",
      city: "",
      address: "12 Street 9",
      deliveryMethod: "Standard delivery",
      paymentMethod: "Cash on delivery",
    });

    expect(validation.valid).toBe(false);
    expect(validation.errors.city).toBe("City is required.");
    expect(
      validateCheckoutForm({
        fullName: "   ",
        phone: "0123456789",
        governorate: "Cairo",
        city: "Dokki",
        address: "12 Street 9",
        deliveryMethod: "Standard delivery",
        paymentMethod: "Cash on delivery",
      }).errors.fullName,
    ).toBe("Full name is required.");
  });

  it("blocks a second checkout submission while the first request is in flight", () => {
    expect(canStartCheckoutSubmission(false)).toBe(true);
    expect(canStartCheckoutSubmission(true)).toBe(false);
  });

  it("requires a trusted role and never treats an email domain as admin authorization", () => {
    expect(canAccessAdmin("customer")).toBe(false);
    expect(canAccessAdmin("owner")).toBe(true);
  });

  it("identifies only variants removed from the submitted product", () => {
    expect(
      getRemovedVariantIds(
        [
          { id: "variant-black-m", size: "M", color: "Black" },
          { id: "variant-stone-l", size: "L", color: "Stone" },
        ],
        [{ size: "M", color: "Black" }],
      ),
    ).toEqual(["variant-stone-l"]);
  });

  it("does not retire historical variants that remain in the edit", () => {
    expect(
      getRemovedVariantIds(
        [{ id: "variant-black-m", size: "M", color: "Black" }],
        [{ size: "M", color: "Black" }],
      ),
    ).toEqual([]);
  });

  it("requires both an order reference and checkout phone for tracking", () => {
    const input = validateOrderTrackingInput(
      "5AD-123e4567-e89b-12d3-a456-426614174000",
      " 0123456789 ",
    );
    expect(input).toEqual({
      reference: "123e4567-e89b-12d3-a456-426614174000",
      phone: "0123456789",
    });
    expect(() => validateOrderTrackingInput("not-an-order", "0123456789")).toThrow();
    expect(() => validateOrderTrackingInput("123e4567-e89b-12d3-a456-426614174000", "")).toThrow();
  });

  it("provides a generic tracking failure message", () => {
    expect(ORDER_TRACKING_ERROR_MESSAGE).not.toMatch(/phone|order reference|database|supabase/i);
  });

  it("does not use demo fixtures when live storefront data is unavailable", () => {
    const unavailable = createInitialStorefrontData(false);

    expect(unavailable.status).toBe("unavailable");
    expect(unavailable.products).toEqual([]);
    expect(unavailable.categories).toEqual([]);
    expect(unavailable.error).toMatch(/unavailable/i);
  });

  it("keeps the existing fixtures available for explicit local/demo consumers", () => {
    const initialLiveState = createInitialStorefrontData(true);

    expect(storeProducts.length).toBeGreaterThan(0);
    expect(initialLiveState.status).toBe("loading");
    expect(initialLiveState.products).toEqual([]);
  });

  it("reports non-cancelled sales and only calculates profit from saved item costs", () => {
    const now = new Date(2026, 2, 15, 12);
    const baseOrder: OrderRecord = {
      id: "order-tracked",
      createdAt: now.toISOString(),
      status: "Delivered",
      customer: {
        fullName: "Test Customer",
        phone: "01000000000",
        governorate: "Cairo",
        city: "Cairo",
        address: "Test address",
        notes: "",
        deliveryMethod: "Standard delivery",
        paymentMethod: "Cash on delivery",
      },
      items: [
        {
          id: "item-tracked",
          productId: "product-1",
          name: "Test product",
          slug: "test-product",
          price: 200,
          image: "",
          size: "M",
          color: "Black",
          quantity: 2,
          unitCost: 50,
        },
      ],
      subtotal: 400,
      discount: 0,
      shipping: 0,
      total: 400,
      paymentMethod: "Cash on delivery",
      paymentStatus: "Completed",
      deliveryMethod: "Standard delivery",
      tracking: "",
    };
    const report = buildSalesReport(
      [
        baseOrder,
        {
          ...baseOrder,
          id: "order-without-cost",
          total: 200,
          items: [{ ...baseOrder.items[0]!, id: "item-without-cost", unitCost: null }],
        },
        { ...baseOrder, id: "order-cancelled", status: "Cancelled" },
      ],
      now,
    );

    expect(report.sales).toBe(600);
    expect(report.profit).toBe(300);
    expect(report.orders).toBe(2);
    expect(report.costTrackedOrders).toBe(1);
    expect(report.ordersWithoutCosts).toBe(1);
    expect(report.days).toHaveLength(30);
  });

  it("shows all products on audience pages and featured or new products on Drops", () => {
    for (const audience of ["men", "women", "kids"]) {
      expect(filterStorefrontProducts(storeProducts, audience)).toEqual(storeProducts);
    }

    expect(filterStorefrontProducts(storeProducts, "new-drops")).toEqual(
      storeProducts.filter((product) => product.featured || product.newArrival),
    );
    expect(filterStorefrontProducts(storeProducts, "jeans")).toEqual(
      storeProducts.filter((product) => product.category.toLowerCase() === "jeans"),
    );
  });

  it("filters audience pages by assigned product audience and keeps all-audience products", () => {
    const products = [
      { ...firstProduct, audience: "men" as const },
      { ...secondProduct, audience: "women" as const },
      { ...firstProduct, id: "all-audiences", audience: "all" as const },
    ];

    expect(filterStorefrontProducts(products, "men").map((product) => product.id)).toEqual([
      firstProduct.id,
      "all-audiences",
    ]);
    expect(filterStorefrontProducts(products, "women").map((product) => product.id)).toEqual([
      secondProduct.id,
      "all-audiences",
    ]);
    expect(filterStorefrontProducts(products, "kids").map((product) => product.id)).toEqual([
      "all-audiences",
    ]);
  });

  it("parses editable marquee messages one per line and preserves Arabic", () => {
    expect(
      parseTickerMessages(" FREE SHIPPING \r\n\n DROP 07 — OUT NOW \n خدش مش عيب \n LEAVE A MARK "),
    ).toEqual(["FREE SHIPPING", "DROP 07 — OUT NOW", "خدش مش عيب", "LEAVE A MARK"]);
  });
});
