import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowUpRight, Menu, Search, ShoppingBag, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Intro } from "@/components/Intro";
import { CategoryEditorial } from "@/components/CategoryEditorial";
import { ProductCard } from "@/components/ProductCard";
import { StorefrontDataNotice } from "@/components/StorefrontDataNotice";
import { Wordmark } from "@/components/Wordmark";
import { useStorefrontData } from "@/hooks/use-storefront-data";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { addCartItem, getCartCount } from "@/lib/cart";
import { siteImages } from "@/lib/store-data";
import { getHomepageProductSections, isHomepageSectionVisible } from "@/lib/storefront-state";
import reference from "@/assets/reference.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "5ADSH — خدش | Streetwear from Cairo" },
      {
        name: "description",
        content: "خدش — raw, rebellious streetwear. New drops, limited runs, prices in EGP.",
      },
      { property: "og:title", content: "5ADSH — خدش | Streetwear from Cairo" },
      {
        property: "og:description",
        content: "Raw, rebellious streetwear. New drops and limited runs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { products, categories, homepage, status, error } = useStorefrontData();
  const siteSettings = useSiteSettings();
  const [menu, setMenu] = useState(false);
  const [cartCount, setCartCount] = useState(getCartCount());
  const [toast, setToast] = useState(false);
  const { newDrops, bestSellers } = getHomepageProductSections(products);

  useEffect(() => {
    setCartCount(getCartCount());
  }, []);

  const handleAddToCart = (product: (typeof products)[number] | undefined) => {
    if (!product) return;
    const variant = product.variants.find((entry) => entry.stock > 0) ?? product.variants[0];
    if (!variant) return;

    addCartItem({
      id: `${product.id}-${variant.size}-${variant.color}`,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.salePrice ?? product.price,
      image: product.images[0] ?? siteImages.hero,
      size: variant.size,
      color: variant.color,
      quantity: 1,
    });

    setCartCount(getCartCount());
    setToast(true);
    window.setTimeout(() => setToast(false), 1600);
  };

  return (
    <div className="overflow-x-hidden">
      <Intro />

      <div className="overflow-hidden bg-primary py-2 font-mono text-[11px] tracking-[0.3em] text-primary-foreground">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, key) => (
            <span key={key} className="flex gap-10">
              {[
                homepage.announcement || "FREE SHIPPING ACROSS EGYPT OVER EGP 2,000",
                "DROP 07 — OUT NOW",
                "خدش مش عيب",
                "LEAVE A MARK",
              ].map((item) => (
                <span key={item}>/// {item}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      <div className="mx-auto max-w-[1600px] px-4 pt-6 md:px-8">
        <StorefrontDataNotice status={status} error={error} />
      </div>

      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-8">
          <nav className="hidden gap-6 font-mono text-xs tracking-widest md:flex">
            {[
              ["MEN", "/products/men"],
              ["WOMEN", "/products/women"],
              ["KIDS", "/products/kids"],
              ["DROPS", "/products/new-drops"],
            ].map(([label, href]) => (
              <Link
                key={label}
                to={href as string}
                className="relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-foreground after:transition-all hover:after:w-full"
              >
                {label}
              </Link>
            ))}
          </nav>

          <button className="md:hidden" onClick={() => setMenu(true)} aria-label="Menu">
            <Menu />
          </button>

          <Link to="/" aria-label="5ADSH home">
            <Wordmark className="text-3xl md:text-4xl" />
          </Link>

          <div className="flex items-center gap-5">
            <Link to="/products" aria-label="Search products">
              <Search className="hidden h-5 w-5 md:block" />
            </Link>
            <Link to="/cart" className="relative" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center bg-primary px-1 font-mono text-[9px] text-primary-foreground">
                {cartCount}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-50 flex flex-col bg-primary p-6 text-primary-foreground animate-rise">
          <button className="self-end" onClick={() => setMenu(false)} aria-label="Close">
            <X />
          </button>
          <div className="mt-8 flex flex-col gap-2">
            {[
              { label: "Home", href: "/" },
              { label: "All products", href: "/products" },
              { label: "Men", category: "men" },
              { label: "Women", category: "women" },
              { label: "Kids", category: "kids" },
              { label: "Drops", category: "new-drops" },
              { label: "Cart", href: "/cart" },
              { label: "Admin", href: "/admin" },
            ].map((item) =>
              "category" in item ? (
                <Link
                  key={item.label}
                  to="/products/$category"
                  params={{ category: item.category }}
                  onClick={() => setMenu(false)}
                  className="font-display text-4xl uppercase"
                >
                  {item.label}
                </Link>
              ) : (
                <Link
                  key={item.label}
                  to={item.href}
                  onClick={() => setMenu(false)}
                  className="font-display text-4xl uppercase"
                >
                  {item.label}
                </Link>
              ),
            )}
          </div>
        </div>
      )}

      <section className="relative mx-auto max-w-[1600px] px-4 pb-16 pt-6 md:px-8">
        <div className="pointer-events-none relative z-10 leading-[0.8]">
          <Wordmark animate arabic={false} className="text-[27vw] md:text-[24vw] xl:text-[380px]" />
        </div>
        <div className="grid gap-6 md:-mt-[10vw] md:grid-cols-12">
          <div className="relative md:col-span-5 md:col-start-6 md:row-span-2">
            <div className="grain aspect-[4/5] overflow-hidden">
              <img
                src={reference}
                alt="5ADSH campaign — Drop 07"
                width={1280}
                height={1600}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="font-arabic absolute -left-6 -bottom-10 -rotate-12 text-8xl md:-left-24 md:text-[11rem]">
              خدش
            </span>
          </div>

          <div className="flex flex-col justify-end gap-6 md:col-span-4 md:col-start-1 md:row-start-1 md:pt-[14vw]">
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
              DROP 07 / CAIRO / FW26
            </p>
            <h1 className="font-display text-5xl uppercase leading-[0.9] md:text-7xl animate-rise">
              {homepage.heroTitle || "Wear the mark. Not the rules."}
            </h1>
            {homepage.heroSubtitle ? (
              <p className="max-w-md text-sm text-muted-foreground">{homepage.heroSubtitle}</p>
            ) : null}
            <Link
              to="/products"
              className="group inline-flex w-fit items-center gap-3 bg-primary px-8 py-4 font-mono text-sm tracking-widest text-primary-foreground transition hover:gap-6"
            >
              {(homepage.primaryCta || "SHOP NOW").toUpperCase()}{" "}
              <ArrowUpRight className="h-4 w-4 transition group-hover:rotate-45" />
            </Link>
          </div>

          <div className="hidden md:col-span-2 md:col-start-11 md:flex md:flex-col md:justify-end">
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              (01) Raw-edge denim. Heavy cotton. Hand-distressed in small batches. Every piece
              carries a scratch — no two alike.
            </p>
          </div>
        </div>
      </section>

      <div id="cats">
        <CategoryEditorial categories={categories} />
      </div>

      {isHomepageSectionVisible(siteSettings, "newDrops") ? (
        <section id="drops" className="mx-auto max-w-[1600px] px-4 py-20 md:px-8">
          <SectionHead n="03" title="New Drops" ar="جديد" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {newDrops.slice(0, 4).map((product, index) => (
              <ProductCard
                key={product.id}
                p={product}
                i={index}
                onAdd={() => handleAddToCart(product)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="overflow-hidden border-y py-6">
        <div className="flex w-max animate-marquee gap-12">
          {Array.from({ length: 8 }).map((_, index) => (
            <Wordmark key={index} className="text-7xl md:text-9xl" />
          ))}
        </div>
      </div>

      {isHomepageSectionVisible(siteSettings, "bestSellers") ? (
        <section className="mx-auto max-w-[1600px] px-4 py-20 md:px-8">
          <SectionHead n="04" title="Best Sellers" ar="الأكثر مبيعاً" />
          <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
            {bestSellers.slice(0, 4).map((product, index) => (
              <ProductCard
                key={product.id}
                p={product}
                i={index}
                onAdd={() => handleAddToCart(product)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="relative bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-[1600px] md:grid-cols-2">
          <div className="grain relative aspect-square md:aspect-auto">
            <img
              src={siteImages.tee}
              alt="Limited Fracture Tee"
              loading="lazy"
              className="absolute inset-0 h-full w-full object-cover"
            />
          </div>

          <div className="flex flex-col justify-center gap-6 px-6 py-16 md:px-16">
            <p className="font-mono text-xs tracking-[0.3em] opacity-60">
              (05) LIMITED — 150 PIECES ONLY
            </p>
            <h2 className="font-display text-6xl uppercase leading-[0.85] md:text-8xl">
              The
              <br />
              Fracture
              <br />
              Run
            </h2>
            <p className="max-w-md text-sm opacity-70">
              Hand-cracked screen print on 280gsm washed cotton. Numbered inside the neck. The next
              drop is configured from the admin dashboard.
            </p>
            <div className="flex flex-col gap-2 border border-primary-foreground/30 p-4 font-mono text-xs tracking-[0.2em] uppercase">
              <span>Campaign window</span>
              <span className="text-primary-foreground/70">Managed from admin settings</span>
            </div>
            <button
              onClick={() => handleAddToCart(newDrops[0])}
              disabled={!newDrops[0]}
              className="w-fit bg-primary-foreground px-8 py-4 font-mono text-sm tracking-widest text-primary transition hover:tracking-[0.3em]"
            >
              CLAIM YOURS — EGP 1,450
            </button>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1600px] px-4 py-28 md:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <span className="font-arabic text-[40vw] leading-[0.7] md:col-span-5 md:text-[18vw]">
            خدش
          </span>
          <div className="flex flex-col justify-center gap-6 md:col-span-6 md:col-start-7">
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">
              (06) /χadʃ/ — noun. a scratch.
            </p>
            <p className="font-display text-3xl uppercase leading-tight md:text-5xl">
              A scratch is proof you were there. We make clothes that carry marks — of the street,
              of the city, of you.
            </p>
            <div className="scratch-line w-40" />
            <p className="max-w-lg text-sm text-muted-foreground">
              Born in Cairo. Cut in small batches. 5ADSH is for the ones who don't polish their
              edges — every seam, every tear is intentional.
            </p>
          </div>
        </div>
      </section>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 bg-primary px-6 py-3 font-mono text-xs tracking-widest text-primary-foreground animate-rise">
          ADDED TO CART — {cartCount}
        </div>
      )}
    </div>
  );
}

function SectionHead({ n, title, ar }: { n: string; title: string; ar: string }) {
  return (
    <div className="mb-10 flex items-end justify-between gap-4 border-b border-current/20 pb-4">
      <h2 className="font-display text-5xl uppercase leading-none md:text-8xl">
        <span className="mr-3 align-top font-mono text-xs tracking-widest opacity-50">({n})</span>
        {title}
      </h2>
      <span className="font-arabic text-3xl opacity-70">{ar}</span>
    </div>
  );
}
