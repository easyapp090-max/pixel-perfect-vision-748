import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

import { calculateCart, getStoredCart, removeCartItem, updateCartItemQuantity } from "@/lib/cart";
import { validateStoreCoupon } from "@/lib/store-api";
import { getUserFacingError } from "@/lib/user-messages";

export const Route = createFileRoute("/cart")({
  component: CartPage,
});

function CartPage() {
  const [items, setItems] = useState(() => getStoredCart());
  const [promoCode, setPromoCode] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [verifiedDiscount, setVerifiedDiscount] = useState<number>();
  const [promoMessage, setPromoMessage] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);

  const summary = useMemo(
    () => calculateCart(items, appliedCode, verifiedDiscount),
    [items, appliedCode, verifiedDiscount],
  );

  const handleApplyPromo = async () => {
    setPromoBusy(true);
    setPromoMessage("");
    try {
      const result = await validateStoreCoupon(promoCode, summary.subtotal);
      setAppliedCode(result.code);
      setVerifiedDiscount(result.discount);
      setPromoMessage(result.description || `${result.code} applied successfully.`);
    } catch (cause) {
      setAppliedCode("");
      setVerifiedDiscount(undefined);
      setPromoMessage(getUserFacingError(cause, "Coupon validation failed. Please try again."));
    } finally {
      setPromoBusy(false);
    }
  };

  const handleQuantityChange = (id: string, adjustment: number) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const nextQuantity = item.quantity + adjustment;
    const nextItems = updateCartItemQuantity(id, nextQuantity);
    setItems(nextItems);
    setAppliedCode("");
    setVerifiedDiscount(undefined);
  };

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Cart</p>
        <h1 className="mt-4 font-display text-5xl uppercase">Your bag is empty</h1>
        <Link
          to="/products"
          className="mt-8 inline-block border px-5 py-3 font-mono text-xs uppercase tracking-[0.2em]"
        >
          Continue shopping
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <h1 className="mb-8 font-display text-5xl uppercase md:text-7xl">Your cart</h1>
      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-4">
          {items.map((item) => (
            <div key={item.id} className="flex gap-4 border p-4">
              <img src={item.image} alt={item.name} className="h-32 w-24 object-cover" />
              <div className="flex-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {item.color}
                    </p>
                    <h2 className="mt-1 text-xl font-medium uppercase">{item.name}</h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setItems(removeCartItem(item.id));
                      setAppliedCode("");
                      setVerifiedDiscount(undefined);
                    }}
                    className="text-muted-foreground"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Size {item.size}
                    </span>
                    <div className="flex items-center border">
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, -1)}
                        className="p-2"
                      >
                        <Minus className="h-3 w-3" />
                      </button>
                      <span className="min-w-8 text-center font-mono text-sm">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleQuantityChange(item.id, 1)}
                        className="p-2"
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                  <span className="font-mono text-sm">
                    EGP {(item.price * item.quantity).toLocaleString("en-US")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <aside className="border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Summary
          </p>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>EGP {summary.subtotal.toLocaleString("en-US")}</span>
            </div>
            <div className="flex justify-between">
              <span>Shipping</span>
              <span>
                {summary.shipping === 0
                  ? "Free"
                  : `EGP ${summary.shipping.toLocaleString("en-US")}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-EGP {summary.discount.toLocaleString("en-US")}</span>
            </div>
            <div className="flex justify-between border-t pt-3 text-base font-medium">
              <span>Total</span>
              <span>EGP {summary.total.toLocaleString("en-US")}</span>
            </div>
          </div>

          <div className="mt-6 flex gap-2">
            <input
              value={promoCode}
              onChange={(event) => {
                setPromoCode(event.target.value);
                setAppliedCode("");
                setVerifiedDiscount(undefined);
              }}
              placeholder="Promo code"
              className="flex-1 border border-input bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
            />
            <button
              type="button"
              onClick={handleApplyPromo}
              disabled={promoBusy}
              className="border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
            >
              {promoBusy ? "Checking…" : "Apply"}
            </button>
          </div>
          {promoMessage ? (
            <p className="mt-3 text-xs text-muted-foreground">{promoMessage}</p>
          ) : null}

          <Link
            to="/checkout"
            className="mt-6 block bg-primary px-5 py-3 text-center font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            Proceed to checkout
          </Link>
        </aside>
      </div>
    </div>
  );
}
