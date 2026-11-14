import { createFileRoute } from "@tanstack/react-router";

import { useSiteSettings } from "@/hooks/use-site-settings";

export const Route = createFileRoute("/contact")({ component: ContactPage });

function ContactPage() {
  const settings = useSiteSettings();
  return (
    <div className="mx-auto max-w-[1100px] px-4 py-12 md:px-8">
      <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Contact</p>
      <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">Let’s talk</h1>
      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <div className="border p-6">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Email
          </p>
          {settings.email ? (
            <a className="mt-2 block text-lg underline" href={`mailto:${settings.email}`}>
              {settings.email}
            </a>
          ) : null}
          {settings.phone ? (
            <a className="mt-4 block text-lg underline" href={`tel:${settings.phone}`}>
              {settings.phone}
            </a>
          ) : null}
          {settings.whatsapp ? (
            <a
              className="mt-2 block text-lg underline"
              href={`https://wa.me/${settings.whatsapp.replace(/\D/g, "")}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              WhatsApp
            </a>
          ) : null}
          {settings.address ? (
            settings.googleMapsUrl ? (
              <a
                className="mt-4 block text-lg underline"
                href={settings.googleMapsUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {settings.address}
              </a>
            ) : (
              <p className="mt-4 text-lg">{settings.address}</p>
            )
          ) : null}
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
