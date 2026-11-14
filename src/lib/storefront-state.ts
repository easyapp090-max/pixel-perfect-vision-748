import type { HomepageContent, StoreCategory, StoreProduct } from "@/lib/store-data";

export type StorefrontDataStatus = "loading" | "live" | "unavailable" | "error";

export type StorefrontDataState = {
  products: StoreProduct[];
  categories: StoreCategory[];
  homepage: HomepageContent;
  status: StorefrontDataStatus;
  error: string;
};

export function parseTickerMessages(value: string) {
  return value
    .split(/\r?\n/)
    .map((message) => message.trim())
    .filter(Boolean);
}

export function filterStorefrontProducts(products: StoreProduct[], category: string) {
  const normalizedCategory = category.toLowerCase();
  if (["men", "women", "kids"].includes(normalizedCategory)) {
    return products.filter(
      (product) =>
        !product.audience || product.audience === "all" || product.audience === normalizedCategory,
    );
  }
  if (normalizedCategory === "all") return products;
  if (normalizedCategory === "new-drops") {
    return products.filter((product) => product.featured || product.newArrival);
  }

  return products.filter(
    (product) =>
      product.category.toLowerCase() === normalizedCategory ||
      product.subcategory.toLowerCase() === normalizedCategory ||
      product.category.toLowerCase().replace(/s$/, "") === normalizedCategory,
  );
}

export function getHomepageProductSections(products: StoreProduct[]) {
  return {
    bestSellers: products.filter((product) => product.bestSeller === true),
    newDrops: products.filter(
      (product) => product.newArrival === true || product.featured === true,
    ),
  };
}

export function isHomepageSectionVisible(
  settings: { showBestSellers: boolean; showNewDrops: boolean },
  section: "bestSellers" | "newDrops",
) {
  return section === "bestSellers" ? settings.showBestSellers : settings.showNewDrops;
}

const emptyHomepage: HomepageContent = {
  heroTitle: "",
  heroSubtitle: "",
  primaryCta: "",
  secondaryCta: "",
  announcement: "",
  tickerMessages: [],
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
