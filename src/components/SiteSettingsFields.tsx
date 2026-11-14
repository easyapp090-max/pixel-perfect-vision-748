import { ExternalLink, Facebook, Instagram, MapPin, Phone, Send } from "lucide-react";

import type { SiteSettings } from "@/lib/store-data";

type Props = {
  settings: SiteSettings;
  onChange: (settings: SiteSettings) => void;
};

const inputClass =
  "w-full border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SiteSettingsFields({ settings, onChange }: Props) {
  const update = <K extends keyof SiteSettings>(key: K, value: SiteSettings[K]) =>
    onChange({ ...settings, [key]: value });

  const social = [
    { key: "instagram" as const, label: "Instagram", icon: Instagram },
    { key: "facebook" as const, label: "Facebook", icon: Facebook },
    { key: "tiktok" as const, label: "TikTok", icon: Send },
  ];

  return (
    <div className="space-y-8" dir="auto">
      <section>
        <h3 className="mb-4 font-display text-2xl uppercase">Homepage Sections</h3>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-3 border border-foreground/10 p-4 font-mono text-xs uppercase tracking-[0.12em]">
            <input
              type="checkbox"
              checked={settings.showBestSellers}
              onChange={(event) => update("showBestSellers", event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span>Show Best Sellers</span>
          </label>
          <label className="flex items-center gap-3 border border-foreground/10 p-4 font-mono text-xs uppercase tracking-[0.12em]">
            <input
              type="checkbox"
              checked={settings.showNewDrops}
              onChange={(event) => update("showNewDrops", event.target.checked)}
              className="h-4 w-4 accent-primary"
            />
            <span>Show New Drops</span>
          </label>
        </div>
      </section>

      <section>
        <h3 className="mb-4 font-display text-2xl uppercase">Contact / بيانات التواصل</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {[
            ["phone", "Primary phone / الهاتف الأساسي", "tel"],
            ["whatsapp", "WhatsApp / واتساب", "tel"],
            ["email", "Contact email / البريد الإلكتروني", "email"],
            ["address", "Address / العنوان", "text"],
            ["googleMapsUrl", "Google Maps URL / رابط الخرائط", "url"],
          ].map(([key, label, type]) => (
            <label key={key} className="space-y-2 text-sm md:last:col-span-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                {label}
              </span>
              <input
                dir="auto"
                type={type}
                value={settings[key as keyof SiteSettings] as string}
                onChange={(event) => update(key as keyof SiteSettings, event.target.value as never)}
                className={inputClass}
              />
            </label>
          ))}
        </div>
      </section>

      <section>
        <h3 className="mb-4 font-display text-2xl uppercase">Social links / السوشيال ميديا</h3>
        <div className="space-y-4">
          {social.map(({ key, label, icon: Icon }) => {
            const urlKey = `${key}Url` as keyof SiteSettings;
            const enabledKey = `${key}Enabled` as keyof SiteSettings;
            const url = settings[urlKey] as string;
            const enabled = settings[enabledKey] as boolean;
            return (
              <div key={key} className="border border-foreground/10 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    <span className="font-medium">{label}</span>
                    {url && enabled ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Preview ${label}`}
                      >
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : null}
                  </div>
                  <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.15em]">
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(event) => update(enabledKey, event.target.checked as never)}
                    />
                    Enabled / مفعّل
                  </label>
                </div>
                <input
                  dir="ltr"
                  type="url"
                  value={url}
                  onChange={(event) => update(urlKey, event.target.value as never)}
                  placeholder={`https://${key}.com/your-account`}
                  className={`${inputClass} mt-3`}
                />
                {url && enabled ? (
                  <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-flex max-w-full items-center gap-1 truncate text-xs underline"
                  >
                    <span className="truncate">{url}</span>
                    <ExternalLink className="h-3 w-3 shrink-0" />
                  </a>
                ) : null}
              </div>
            );
          })}
        </div>
      </section>

      <p className="flex items-center gap-2 text-xs text-muted-foreground">
        <Phone className="h-4 w-4" /> Phone and WhatsApp numbers are clickable on the storefront.
        <MapPin className="ml-2 h-4 w-4" /> Empty or disabled social links stay hidden.
      </p>
    </div>
  );
}
