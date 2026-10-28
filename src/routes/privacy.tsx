import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({ component: PrivacyPage });

function PrivacyPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Privacy</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Privacy policy</h1>
      <div className="mt-8 space-y-5 text-sm leading-7 text-muted-foreground">
        <p>
          We keep customer contact and order information strictly for operational, support, and
          fulfillment needs.
        </p>
        <p>
          We do not expose passwords, tokens, or secret credentials in the storefront or admin UI.
          Access controls are managed server-side when connected to a real backend.
        </p>
      </div>
    </div>
  );
}
