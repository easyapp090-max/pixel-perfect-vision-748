import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/faq")({ component: FaqPage });

function FaqPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">FAQ</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Common questions</h1>
      <div className="mt-8 space-y-4 text-sm text-muted-foreground">
        <div className="border p-5">
          <p className="font-medium uppercase text-foreground">How long does shipping take?</p>
          <p className="mt-2">Within 2–5 business days across Egypt for standard delivery.</p>
        </div>
        <div className="border p-5">
          <p className="font-medium uppercase text-foreground">Can I exchange a product?</p>
          <p className="mt-2">
            Yes, provided it is unworn and in original condition within the returns window.
          </p>
        </div>
        <div className="border p-5">
          <p className="font-medium uppercase text-foreground">Do you support COD?</p>
          <p className="mt-2">
            Yes. Cash on delivery is available for eligible orders in supported areas.
          </p>
        </div>
      </div>
    </div>
  );
}
