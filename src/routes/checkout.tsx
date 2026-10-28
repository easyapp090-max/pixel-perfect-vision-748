import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";

import {
  calculateCart,
  canStartCheckoutSubmission,
  clearCart,
  getStoredCart,
  validateCheckoutForm,
  type CustomerCheckoutFields,
} from "@/lib/cart";
import { placeOrder, validateStoreCoupon } from "@/lib/store-api";
import { getUserFacingError } from "@/lib/user-messages";

export const Route = createFileRoute("/checkout")({
  component: CheckoutPage,
});

function CheckoutPage() {
  const navigate = useNavigate();
  const items = getStoredCart();
  const [promoCode, setPromoCode] = useState("");
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderNumber, setOrderNumber] = useState("");
  const [orderTotal, setOrderTotal] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const submissionInFlight = useRef(false);
  const [error, setError] = useState("");
  const [idempotencyKey, setIdempotencyKey] = useState("");
  const [appliedCode, setAppliedCode] = useState("");
  const [verifiedDiscount, setVerifiedDiscount] = useState<number>();
  const [promoMessage, setPromoMessage] = useState("");
  const [customer, setCustomer] = useState<CustomerCheckoutFields>({
    fullName: "",
    phone: "",
    governorate: "Cairo",
    city: "",
    address: "",
    notes: "",
    deliveryMethod: "Standard delivery",
    paymentMethod: "Cash on delivery",
  });

  const summary = useMemo(
    () => calculateCart(items, appliedCode, verifiedDiscount),
    [items, appliedCode, verifiedDiscount],
  );

  const handleApplyPromo = async () => {
    setPromoMessage("");
    try {
      const result = await validateStoreCoupon(promoCode, summary.subtotal);
      setAppliedCode(result.code);
      setVerifiedDiscount(result.discount);
      setPromoMessage(result.description || `${result.code} applied.`);
    } catch (cause) {
      setAppliedCode("");
      setVerifiedDiscount(undefined);
      setPromoMessage(getUserFacingError(cause, "Coupon validation failed. Please try again."));
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canStartCheckoutSubmission(submissionInFlight.current)) return;
    const validation = validateCheckoutForm(customer);
    if (!validation.valid) {
      setError(Object.values(validation.errors)[0] ?? "Please complete the required fields.");
      return;
    }
    submissionInFlight.current = true;
    setSubmitting(true);
    setError("");
    try {
      const requestKey =
        idempotencyKey ||
        window.sessionStorage.getItem("5adsh-checkout-idempotency") ||
        window.crypto.randomUUID();
      setIdempotencyKey(requestKey);
      window.sessionStorage.setItem("5adsh-checkout-idempotency", requestKey);
      const result = await placeOrder({
        idempotencyKey: requestKey,
        customer,
        items: items.map((item) => ({
          productId: item.productId,
          size: item.size,
          color: item.color,
          quantity: item.quantity,
        })),
        couponCode: appliedCode,
        deliveryMethod: customer.deliveryMethod,
        paymentMethod: customer.paymentMethod,
      });
      setOrderNumber(`5AD-${result.id.toUpperCase()}`);
      setOrderTotal(result.total);
      setOrderPlaced(true);
      window.sessionStorage.removeItem("5adsh-checkout-idempotency");
      clearCart();
    } catch (cause) {
      setError(getUserFacingError(cause, "The order could not be placed. Please try again."));
    } finally {
      submissionInFlight.current = false;
      setSubmitting(false);
    }
  };

  if (items.length === 0 && !orderPlaced) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-20 text-center">
        <h1 className="font-display text-5xl uppercase">No order to place</h1>
        <Link
          to="/products"
          className="mt-8 inline-block border px-5 py-3 font-mono text-xs uppercase tracking-[0.2em]"
        >
          Head back to shop
        </Link>
      </div>
    );
  }

  if (orderPlaced) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-20 text-center">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Order confirmed
        </p>
        <h1 className="mt-4 font-display text-5xl uppercase">Thank you for shopping 5ADSH</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Your order reference is {orderNumber}. Total confirmed by the store: EGP{" "}
          {(orderTotal ?? 0).toLocaleString("en-US")}.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/account"
            className="border px-5 py-3 font-mono text-xs uppercase tracking-[0.2em]"
          >
            View orders
          </Link>
          <button
            type="button"
            onClick={() => navigate({ to: "/" })}
            className="bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            Back home
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] px-4 py-10 md:px-8">
      <div className="mb-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Checkout
        </p>
        <h1 className="font-display text-5xl uppercase md:text-7xl">Complete your order</h1>
      </div>

      <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]">
        {error ? (
          <p className="border border-red-500 p-3 text-sm text-red-600 lg:col-span-2">{error}</p>
        ) : null}
        <div className="space-y-6">
          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Customer details</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <input
                value={customer.fullName}
                onChange={(event) => setCustomer({ ...customer, fullName: event.target.value })}
                placeholder="Full name"
                className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
                required
              />
              <input
                value={customer.phone}
                onChange={(event) => setCustomer({ ...customer, phone: event.target.value })}
                placeholder="Egyptian phone number"
                className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
                required
              />
              <input
                value={customer.governorate}
                onChange={(event) => setCustomer({ ...customer, governorate: event.target.value })}
                placeholder="Governorate"
                className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={customer.city}
                onChange={(event) => setCustomer({ ...customer, city: event.target.value })}
                placeholder="City"
                className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
              />
              <textarea
                value={customer.address}
                onChange={(event) => setCustomer({ ...customer, address: event.target.value })}
                placeholder="Street address"
                className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none md:col-span-2"
                required
              />
              <textarea
                value={customer.notes}
                onChange={(event) => setCustomer({ ...customer, notes: event.target.value })}
                placeholder="Delivery instructions"
                className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none md:col-span-2"
              />
            </div>
          </div>

          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Delivery</h2>
            <div className="space-y-3 font-mono text-[10px] uppercase tracking-[0.2em]">
              {(["Standard delivery", "Express delivery"] as const).map((method) => (
                <label key={method} className="flex items-center gap-3 border p-3">
                  <input
                    type="radio"
                    name="deliveryMethod"
                    checked={customer.deliveryMethod === method}
                    onChange={() => setCustomer({ ...customer, deliveryMethod: method })}
                  />
                  <span>{method}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Payment</h2>
            <label className="flex items-center gap-3 border p-3 font-mono text-[10px] uppercase tracking-[0.2em]">
              <input
                type="radio"
                name="paymentMethod"
                checked={customer.paymentMethod === "Cash on delivery"}
                onChange={() => setCustomer({ ...customer, paymentMethod: "Cash on delivery" })}
              />
              <span>Cash on delivery</span>
            </label>
            <p className="mt-4 text-sm text-muted-foreground">
              A payment provider integration is prepared for supported Egyptian providers, but no
              live credentials are configured in this workspace.
            </p>
          </div>
        </div>

        <aside className="border bg-card p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Order summary
          </p>
          <div className="mt-4 space-y-3 text-sm">
            {items.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-medium uppercase">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.size} / {item.color} × {item.quantity}
                  </p>
                </div>
                <span>EGP {(item.price * item.quantity).toLocaleString("en-US")}</span>
              </div>
            ))}
          </div>
          <div className="mt-6 space-y-3 border-t pt-4 text-sm">
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
            <div className="flex justify-between text-base font-medium">
              <span>Total</span>
              <span>EGP {summary.total.toLocaleString("en-US")}</span>
            </div>
          </div>

          <input
            value={promoCode}
            onChange={(event) => {
              setPromoCode(event.target.value);
              setAppliedCode("");
              setVerifiedDiscount(undefined);
              setPromoMessage("");
            }}
            placeholder="Add discount code"
            className="mt-6 w-full border border-input bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
          />
          <button
            type="button"
            onClick={handleApplyPromo}
            className="mt-2 w-full border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Verify discount code
          </button>
          {promoMessage ? (
            <p className="mt-2 text-xs text-muted-foreground">{promoMessage}</p>
          ) : null}

          <button
            type="submit"
            formAction=""
            disabled={submitting}
            className="mt-6 block w-full bg-primary px-5 py-3 text-center font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            {submitting ? "Submitting…" : "Place order"}
          </button>
        </aside>
      </form>
    </div>
  );
}
