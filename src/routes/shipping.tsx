import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/shipping")({ component: ShippingPage });

function ShippingPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Shipping</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Delivery policy</h1>
      <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground">
        <p>
          Standard delivery is available throughout Egypt, with service windows depending on
          governorate and order volume.
        </p>
        <p>
          Orders above EGP 2,000 qualify for complimentary delivery, subject to support by the
          chosen courier and area.
        </p>
        <p>All shipping fees and delivery coverage remain configurable from the admin dashboard.</p>
      </div>
    </div>
  );
}
