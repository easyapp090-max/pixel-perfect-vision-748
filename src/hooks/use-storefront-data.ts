import { useEffect, useState } from "react";

import { isSecureBackendConfigured } from "@/lib/backend-config";
import { loadHomepageContent, loadStorefrontCategories, loadStoreProducts } from "@/lib/store-api";
import { getUserFacingError } from "@/lib/user-messages";
import { createInitialStorefrontData, type StorefrontDataState } from "@/lib/storefront-state";

export function useStorefrontData() {
  const [data, setData] = useState<StorefrontDataState>(() =>
    createInitialStorefrontData(isSecureBackendConfigured()),
  );

  useEffect(() => {
    if (!isSecureBackendConfigured()) {
      return;
    }

    let active = true;
    Promise.all([loadStoreProducts(), loadStorefrontCategories(), loadHomepageContent()])
      .then(([loadedProducts, loadedCategories, loadedHomepage]) => {
        if (!active) return;
        setData({
          products: loadedProducts,
          categories: loadedCategories,
          homepage: loadedHomepage,
          status: "live",
          error: "",
        });
      })
      .catch((cause: unknown) => {
        if (active) {
          setData((current) => ({
            ...current,
            products: [],
            categories: [],
            status: "error",
            error: getUserFacingError(
              cause,
              "Could not load live storefront data. Please try again.",
            ),
          }));
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return data;
}
