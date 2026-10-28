import hero from "@/assets/hero.jpg";
import men from "@/assets/men.jpg";
import women from "@/assets/women.jpg";
import acc from "@/assets/acc.jpg";
import tee from "@/assets/tee.jpg";
import jeans from "@/assets/jeans.jpg";
import type { StorePermission } from "@/lib/auth";

export const siteImages = { hero, men, women, acc, tee, jeans };

export type ProductVariant = {
  id: string;
  size: string;
  color: string;
  stock: number;
};

export type StoreProduct = {
  id: string;
  slug: string;
  name: string;
  category: string;
  subcategory: string;
  price: number;
  salePrice?: number | undefined;
  sku: string;
  description: string;
  badge?: string;
  featured?: boolean;
  bestSeller?: boolean;
  newArrival?: boolean;
  images: string[];
  colors: string[];
  sizes: string[];
  variants: ProductVariant[];
};

export type StoreCategory = {
  id: string;
  name: string;
  slug: string;
  image: string;
  arabic: string;
};

export type StoreCollection = {
  id: string;
  name: string;
  description: string;
  products: string[];
};

export type PromoCode = {
  id: string;
  code: string;
  type: "percentage" | "fixed";
  value: number;
  minOrder: number;
  active: boolean;
  expiresAt: string;
  description: string;
};

export type CustomerProfile = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "customer" | "admin" | "staff" | "owner";
  permissions: StorePermission[];
  status: "active" | "blocked";
};

export type StoreSettings = {
  currency: "EGP";
  shippingFreeThreshold: number;
  standardShipping: number;
  defaultCountry: string;
  allowCashOnDelivery: boolean;
  supportEmail: string;
  timezone: string;
};

export type HomepageContent = {
  heroTitle: string;
  heroSubtitle: string;
  primaryCta: string;
  secondaryCta: string;
  announcement: string;
};

const defaultProducts: StoreProduct[] = [
  {
    id: "prod-fracture-tee",
    slug: "fracture-tee-washed-black",
    name: "Fracture Tee — Washed Black",
    category: "T-Shirts",
    subcategory: "T-Shirts",
    price: 1150,
    salePrice: 990,
    sku: "5AD-TS-001",
    description:
      "Heavy-weight washed cotton tee with a distressed print and a relaxed cut intended for daily wear.",
    badge: "NEW",
    featured: true,
    newArrival: true,
    images: [tee, hero, men],
    colors: ["Black", "Bone", "Stone"],
    sizes: ["S", "M", "L", "XL"],
    variants: [
      { id: "prod-fracture-tee-black-s", size: "S", color: "Black", stock: 6 },
      { id: "prod-fracture-tee-black-m", size: "M", color: "Black", stock: 12 },
      { id: "prod-fracture-tee-black-l", size: "L", color: "Black", stock: 9 },
      { id: "prod-fracture-tee-black-xl", size: "XL", color: "Black", stock: 4 },
      { id: "prod-fracture-tee-bone-m", size: "M", color: "Bone", stock: 5 },
      { id: "prod-fracture-tee-stone-l", size: "L", color: "Stone", stock: 3 },
    ],
  },
  {
    id: "prod-split-knee-jeans",
    slug: "split-knee-wide-jeans",
    name: "Split-Knee Wide Jeans",
    category: "Jeans",
    subcategory: "Jeans",
    price: 2450,
    salePrice: 1990,
    sku: "5AD-JN-021",
    description:
      "Structured wide-leg denim with split knees, a clean taper, and a durable finish designed for all-day movement.",
    badge: "SALE",
    bestSeller: true,
    newArrival: true,
    images: [jeans, men, hero],
    colors: ["Indigo", "Stone", "Black"],
    sizes: ["28", "30", "32", "34"],
    variants: [
      { id: "prod-split-knee-jeans-indigo-30", size: "30", color: "Indigo", stock: 8 },
      { id: "prod-split-knee-jeans-indigo-32", size: "32", color: "Indigo", stock: 7 },
      { id: "prod-split-knee-jeans-stone-30", size: "30", color: "Stone", stock: 4 },
      { id: "prod-split-knee-jeans-black-34", size: "34", color: "Black", stock: 3 },
    ],
  },
  {
    id: "prod-denim-jacket",
    slug: "raw-edge-denim-jacket",
    name: "Raw Edge Denim Jacket",
    category: "Jackets",
    subcategory: "Jackets",
    price: 3600,
    sku: "5AD-JK-034",
    description:
      "Double-layered denim jacket with raw hems, a relaxed fit, and a heavyweight finish suited for the city in motion.",
    badge: "LIMITED",
    featured: true,
    newArrival: true,
    images: [hero, men, women],
    colors: ["Washed Indigo", "Black"],
    sizes: ["S", "M", "L", "XL"],
    variants: [
      { id: "prod-denim-jacket-indigo-m", size: "M", color: "Washed Indigo", stock: 6 },
      { id: "prod-denim-jacket-indigo-l", size: "L", color: "Washed Indigo", stock: 3 },
      { id: "prod-denim-jacket-black-l", size: "L", color: "Black", stock: 2 },
    ],
  },
  {
    id: "prod-maxi-dress",
    slug: "column-maxi-dress",
    name: "Column Maxi Dress",
    category: "Dresses",
    subcategory: "Dresses",
    price: 2800,
    sku: "5AD-DR-045",
    description:
      "Minimal column dress with clean tailoring and a soft drape built for movement and elevated layering.",
    featured: true,
    images: [women, hero, acc],
    colors: ["Jet", "Ivory", "Stone"],
    sizes: ["XS", "S", "M", "L"],
    variants: [
      { id: "prod-maxi-dress-jet-s", size: "S", color: "Jet", stock: 5 },
      { id: "prod-maxi-dress-ivory-m", size: "M", color: "Ivory", stock: 4 },
      { id: "prod-maxi-dress-stone-l", size: "L", color: "Stone", stock: 2 },
    ],
  },
  {
    id: "prod-root-graphic-tee",
    slug: "root-graphic-oversized-tee",
    name: "Root Graphic Oversized Tee",
    category: "T-Shirts",
    subcategory: "T-Shirts",
    price: 990,
    salePrice: 790,
    sku: "5AD-TS-102",
    description:
      "Oversized cotton tee with a large graphic print, clean neckline, and a heavy wash for a consistent broken-in feel.",
    bestSeller: true,
    images: [men, tee, women],
    colors: ["Cream", "Black", "Olive"],
    sizes: ["S", "M", "L", "XL"],
    variants: [
      { id: "prod-root-graphic-tee-cream-m", size: "M", color: "Cream", stock: 9 },
      { id: "prod-root-graphic-tee-black-l", size: "L", color: "Black", stock: 7 },
      { id: "prod-root-graphic-tee-olive-xl", size: "XL", color: "Olive", stock: 4 },
    ],
  },
  {
    id: "prod-cargo-pant",
    slug: "cargo-parachute-pant",
    name: "Cargo Parachute Pant",
    category: "Pants",
    subcategory: "Pants",
    price: 2100,
    sku: "5AD-PT-214",
    description:
      "Airy parachute pants with utility pockets, a boxy silhouette, and a lightweight construction for everyday layering.",
    bestSeller: true,
    images: [men, jeans, hero],
    colors: ["Stone", "Black", "Khaki"],
    sizes: ["S", "M", "L", "XL"],
    variants: [
      { id: "prod-cargo-pant-stone-m", size: "M", color: "Stone", stock: 5 },
      { id: "prod-cargo-pant-black-l", size: "L", color: "Black", stock: 7 },
      { id: "prod-cargo-pant-khaki-xl", size: "XL", color: "Khaki", stock: 3 },
    ],
  },
  {
    id: "prod-runner-shoe",
    slug: "tread-runner-triple-black",
    name: "Tread Runner — Triple Black",
    category: "Shoes",
    subcategory: "Shoes",
    price: 4200,
    salePrice: 3490,
    sku: "5AD-SH-330",
    description:
      "Technical runner-inspired sneaker with a supportive sole, layered cushioning, and minimal monochrome styling.",
    bestSeller: true,
    images: [acc, hero, men],
    colors: ["Black"],
    sizes: ["39", "40", "41", "42", "43"],
    variants: [
      { id: "prod-runner-shoe-black-39", size: "39", color: "Black", stock: 3 },
      { id: "prod-runner-shoe-black-41", size: "41", color: "Black", stock: 5 },
      { id: "prod-runner-shoe-black-42", size: "42", color: "Black", stock: 4 },
      { id: "prod-runner-shoe-black-43", size: "43", color: "Black", stock: 2 },
    ],
  },
  {
    id: "prod-curb-chain",
    slug: "curb-chain-6mm",
    name: "Curb Chain 6mm",
    category: "Accessories",
    subcategory: "Accessories",
    price: 650,
    sku: "5AD-AC-422",
    description:
      "Heavy curb chain with a substantial finish and minimal profile for layered styling or standalone wear.",
    bestSeller: true,
    images: [acc, men, women],
    colors: ["Silver", "Black"],
    sizes: ["One Size"],
    variants: [
      { id: "prod-curb-chain-silver-one-size", size: "One Size", color: "Silver", stock: 11 },
      { id: "prod-curb-chain-black-one-size", size: "One Size", color: "Black", stock: 8 },
    ],
  },
];

const defaultCategories: StoreCategory[] = [
  { id: "cat-men", name: "Men", slug: "men", image: men, arabic: "رجالي" },
  { id: "cat-women", name: "Women", slug: "women", image: women, arabic: "حريمي" },
  { id: "cat-kids", name: "Kids", slug: "kids", image: hero, arabic: "أطفال" },
  {
    id: "cat-accessories",
    name: "Accessories",
    slug: "accessories",
    image: acc,
    arabic: "إكسسوار",
  },
];

const defaultCollections: StoreCollection[] = [
  {
    id: "coll-after-hours",
    name: "After Hours",
    description: "Night layering",
    products: ["prod-denim-jacket", "prod-cargo-pant"],
  },
  {
    id: "coll-night-shift",
    name: "Night Shift",
    description: "Monochrome essentials",
    products: ["prod-fracture-tee", "prod-maxi-dress"],
  },
];

const defaultHomepage: HomepageContent = {
  heroTitle: "Wear the mark. Not the rules.",
  heroSubtitle: "Raw-edge denim. Heavy cotton. Hand-distressed in small batches.",
  primaryCta: "Shop now",
  secondaryCta: "View drops",
  announcement: "FREE SHIPPING ACROSS EGYPT OVER EGP 2,000",
};

const defaultSettings: StoreSettings = {
  currency: "EGP",
  shippingFreeThreshold: 2000,
  standardShipping: 120,
  defaultCountry: "Egypt",
  allowCashOnDelivery: true,
  supportEmail: "hello@5adsh.store",
  timezone: "Africa/Cairo",
};

export const STORE_PRODUCTS_KEY = "5adsh-demo-products-v1";
export const STORE_CATEGORIES_KEY = "5adsh-demo-categories-v1";
export const STORE_COLLECTIONS_KEY = "5adsh-demo-collections-v1";
export const STORE_HOME_KEY = "5adsh-demo-home-v1";
export const STORE_SETTINGS_KEY = "5adsh-demo-settings-v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const json = window.localStorage.getItem(key);
    return json ? (JSON.parse(json) as T) : fallback;
  } catch {
    return fallback;
  }
}

export const storeProducts = readJSON(STORE_PRODUCTS_KEY, defaultProducts);
export const storefrontCategories = readJSON(STORE_CATEGORIES_KEY, defaultCategories);
export const storeCollections = readJSON(STORE_COLLECTIONS_KEY, defaultCollections);
export const homepageContent = readJSON(STORE_HOME_KEY, defaultHomepage);
export const storeSettings = readJSON(STORE_SETTINGS_KEY, defaultSettings);
export let bestSellers = storeProducts.filter((product) => product.bestSeller);
export let newDrops = storeProducts.filter((product) => product.newArrival || product.featured);

export function syncStoreViews() {
  bestSellers = storeProducts.filter((product) => product.bestSeller);
  newDrops = storeProducts.filter((product) => product.newArrival || product.featured);
  homepageHero = {
    title: homepageContent.heroTitle,
    subtitle: homepageContent.heroSubtitle,
    buttons: [
      { label: homepageContent.primaryCta, href: "/products" },
      { label: homepageContent.secondaryCta, href: "/products/new-drops" },
    ],
  };
  homepageCollections = [
    { name: "After Hours", category: "Men", image: men },
    { name: "Night Shift", category: "Women", image: women },
    { name: "City Tones", category: "Accessories", image: acc },
  ];
}

export let homepageHero = {
  title: homepageContent.heroTitle,
  subtitle: homepageContent.heroSubtitle,
  buttons: [
    { label: homepageContent.primaryCta, href: "/products" },
    { label: homepageContent.secondaryCta, href: "/products/new-drops" },
  ],
};

export let homepageCollections = [
  { name: "After Hours", category: "Men", image: men },
  { name: "Night Shift", category: "Women", image: women },
  { name: "City Tones", category: "Accessories", image: acc },
];

export const allCategorySlugs = [
  "all",
  "men",
  "women",
  "kids",
  "t-shirts",
  "shirts",
  "pants",
  "jeans",
  "dresses",
  "jackets",
  "shoes",
  "accessories",
  "new-drops",
  "collections",
];

export function getProductBySlug(slug: string) {
  return storeProducts.find((product) => product.slug === slug);
}

export function getProductsByCategory(category: string) {
  const lower = category.toLowerCase();
  if (lower === "all" || !category) return storeProducts;
  return storeProducts.filter((product) => {
    const matchesCategory =
      product.category.toLowerCase() === lower || product.subcategory.toLowerCase() === lower;
    const matchesGender =
      product.category.toLowerCase() === lower ||
      product.category.toLowerCase().replace(/s$/, "") === lower;
    return matchesCategory || matchesGender;
  });
}

export function getProductVariant(product: StoreProduct, size: string, color: string) {
  return product.variants.find((variant) => variant.size === size && variant.color === color);
}

export function getProductStock(product: StoreProduct, size: string, color: string) {
  return getProductVariant(product, size, color)?.stock ?? 0;
}

export function clampProductQuantity(quantity: number, availableStock: number) {
  if (availableStock <= 0) return 1;
  return Math.max(1, Math.min(Math.floor(quantity), availableStock));
}

export const formatPrice = (value: number) => `EGP ${value.toLocaleString("en-US")}`;
