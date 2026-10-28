import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

import { trackStoreOrder } from "@/lib/store-api";
import { getUserFacingError } from "@/lib/user-messages";

type TrackingOrder = {
  id: string;
  status?: string;
  deliveryMethod?: string;
  tracking?: string;
};

export const Route = createFileRoute("/tracking")({ component: TrackingPage });

function TrackingPage() {
  const [reference, setReference] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<TrackingOrder | null>(null);
  const [error, setError] = useState("");
  const [searched, setSearched] = useState(false);

  const handleLookup = async () => {
    setError("");
    setSearched(true);
    try {
      const order = await trackStoreOrder(reference, phone);
      setResult(
        order
          ? {
              id: `5AD-${order.id.toUpperCase()}`,
              status: order.status,
              deliveryMethod: order.delivery_method,
              tracking: order.tracking,
            }
          : null,
      );
    } catch (cause) {
      setResult(null);
      setError(getUserFacingError(cause, "Order tracking could not be loaded. Please try again."));
    }
  };

  return (
    <div className="mx-auto max-w-[900px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Tracking</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Track your order</h1>
      <div className="mt-8 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
        <input
          value={reference}
          onChange={(event) => setReference(event.target.value)}
          placeholder="Order reference"
          className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />
        <input
          value={phone}
          onChange={(event) => setPhone(event.target.value)}
          placeholder="Phone used at checkout"
          type="tel"
          autoComplete="tel"
          className="border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
        />
        <button
          type="button"
          onClick={handleLookup}
          className="bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
        >
          Check
        </button>
      </div>

      {error ? <p className="mt-6 text-sm text-red-600">{error}</p> : null}

      {result ? (
        <div className="mt-8 border p-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Reference
          </p>
          <h2 className="mt-2 font-display text-3xl uppercase">{result.id}</h2>
          <div className="mt-4 text-sm text-muted-foreground">
            <p>Status: {result.status}</p>
            <p>Delivery: {result.deliveryMethod}</p>
            <p>Tracking: {result.tracking}</p>
          </div>
        </div>
      ) : searched && !error ? (
        <p className="mt-8 text-sm text-muted-foreground">No order was found for that reference.</p>
      ) : null}
    </div>
  );
}
