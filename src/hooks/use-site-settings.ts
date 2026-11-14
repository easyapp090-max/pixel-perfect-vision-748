import { useEffect, useState } from "react";

import { isSecureBackendConfigured } from "@/lib/backend-config";
import { loadSiteSettings } from "@/lib/store-api";
import { defaultSiteSettings, type SiteSettings } from "@/lib/store-data";

export function useSiteSettings() {
  const [settings, setSettings] = useState<SiteSettings>(defaultSiteSettings);

  useEffect(() => {
    if (!isSecureBackendConfigured()) return;
    let active = true;
    loadSiteSettings()
      .then((loaded) => {
        if (active) setSettings(loaded);
      })
      .catch(() => {
        // Public pages keep their safe empty fallback when the settings table is unavailable.
      });
    return () => {
      active = false;
    };
  }, []);

  return settings;
}
