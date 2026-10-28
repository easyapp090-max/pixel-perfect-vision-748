import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({ component: TermsPage });

function TermsPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Terms</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Terms and conditions</h1>
      <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground">
        <p>
          All products remain the property of 5ADSH until payment is completed and delivery is
          confirmed for COD orders.
        </p>
        <p>
          Customers are responsible for providing accurate contact and delivery details. We reserve
          the right to cancel an order when required documentation or payment conditions are not
          met.
        </p>
      </div>
    </div>
  );
}
