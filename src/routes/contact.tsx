import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/contact")({ component: ContactPage });

function ContactPage() {
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Contact</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Let’s talk</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="border p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Email
          </p>
          <p className="mt-2 text-lg">hello@5adsh.store</p>
          <p className="mt-6 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Hours
          </p>
          <p className="mt-2 text-lg">Sun–Thu / 10:00–18:00</p>
        </div>
        <form className="space-y-4 border p-6">
          <input
            placeholder="Name"
            className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
          />
          <input
            placeholder="Email"
            className="w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
          />
          <textarea
            placeholder="Message"
            className="min-h-32 w-full border border-input bg-background px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
          />
          <button
            type="button"
            className="bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
          >
            Send message
          </button>
        </form>
      </div>
    </div>
  );
}
