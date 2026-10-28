import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/returns")({ component: ReturnsPage });

function ReturnsPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Returns</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Exchanges and returns</h1>
      <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground">
        <p>
          We accept exchanges and returns for unworn items in their original condition within 7 days
          of delivery.
        </p>
        <p>
          Faulty, damaged, or incorrect items may be eligible for free return shipping and store
          credit or replacement depending on review.
        </p>
      </div>
    </div>
  );
}
