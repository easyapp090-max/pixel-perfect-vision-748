import type { HomepageContent, StoreCategory, StoreProduct } from "@/lib/store-data";

export type StorefrontDataStatus = "loading" | "live" | "unavailable" | "error";

export type StorefrontDataState = {
  products: StoreProduct[];
  categories: StoreCategory[];
  homepage: HomepageContent;
  status: StorefrontDataStatus;
  error: string;
};

const emptyHomepage: HomepageContent = {
  heroTitle: "",
  heroSubtitle: "",
  primaryCta: "",
  secondaryCta: "",
  announcement: "",
};

export function createInitialStorefrontData(backendConfigured: boolean): StorefrontDataState {
  return {
    products: [],
    categories: [],
    homepage: emptyHomepage,
    status: backendConfigured ? "loading" : "unavailable",
    error: backendConfigured ? "" : "Live storefront data is unavailable. Please try again later.",
  };
}
