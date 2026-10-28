import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/about")({ component: AboutPage });

function AboutPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
        About 5ADSH
      </p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Built to leave a mark</h1>
      <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground">
        <p>
          5ADSH — خدش — is a Cairo-based streetwear label rooted in movement, texture, and restless
          design.
        </p>
        <p>
          We work in small runs, keep a stern black-and-white identity, and favor silhouettes that
          carry real wear rather than polished perfection.
        </p>
        <p>
          Each collection is designed to feel familiar and raw at once: oversized layers, distressed
          finishes, and tactile fabrics that hold a story long after the first wear.
        </p>
      </div>
    </div>
  );
}
