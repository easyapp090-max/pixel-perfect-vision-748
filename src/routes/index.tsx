import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowUpRight, Menu, Search, ShoppingBag, X } from "lucide-react";
import { Wordmark } from "@/components/Wordmark";
import { Intro } from "@/components/Intro";
import { ProductCard } from "@/components/ProductCard";
import { allCats, bestSellers, categories, images, newDrops } from "@/lib/products";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "5ADSH — خدش | Streetwear from Cairo" },
      { name: "description", content: "خدش — raw, rebellious streetwear. New drops, limited runs, prices in EGP." },
      { property: "og:title", content: "5ADSH — خدش | Streetwear from Cairo" },
      { property: "og:description", content: "Raw, rebellious streetwear. New drops and limited runs." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function useCountdown() {
  const [t, setT] = useState({ d: 3, h: 14, m: 22, s: 9 });
  useEffect(() => {
    const id = setInterval(() => {
      setT((p) => {
        let { d, h, m, s } = p;
        s--; if (s < 0) { s = 59; m--; } if (m < 0) { m = 59; h--; } if (h < 0) { h = 23; d = Math.max(0, d - 1); }
        return { d, h, m, s };
      });
    }, 1000);
    return () => clearInterval(id);
  }, []);
  return t;
}

function Index() {
  const [cart, setCart] = useState(0);
  const [menu, setMenu] = useState(false);
  const [toast, setToast] = useState(false);
  const cd = useCountdown();
  const add = () => { setCart((c) => c + 1); setToast(true); setTimeout(() => setToast(false), 1600); };

  return (
    <div className="overflow-x-hidden">
      <Intro />
      {/* ticker */}
      <div className="overflow-hidden bg-primary py-2 font-mono text-[11px] tracking-[0.3em] text-primary-foreground">
        <div className="flex w-max animate-marquee gap-10 whitespace-nowrap">
          {Array.from({ length: 2 }).map((_, k) => (
            <span key={k} className="flex gap-10">
              {["FREE SHIPPING ACROSS EGYPT OVER EGP 2,000", "DROP 07 — OUT NOW", "خدش مش عيب", "LEAVE A MARK"].map((s) => (
                <span key={s}>/// {s}</span>
              ))}
            </span>
          ))}
        </div>
      </div>

      {/* header */}
      <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-4 py-3 md:px-8">
          <nav className="hidden gap-6 font-mono text-xs tracking-widest md:flex">
            {["MEN", "WOMEN", "KIDS", "DROPS"].map((n) => (
              <a key={n} href="#cats" className="relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-foreground after:transition-all hover:after:w-full">{n}</a>
            ))}
          </nav>
          <button className="md:hidden" onClick={() => setMenu(true)} aria-label="Menu"><Menu /></button>
          <a href="#" aria-label="5ADSH home"><Wordmark className="text-3xl md:text-4xl" /></a>
          <div className="flex items-center gap-5">
            <Search className="hidden h-5 w-5 md:block" />
            <button className="relative" aria-label="Cart">
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center bg-primary px-1 font-mono text-[9px] text-primary-foreground">{cart}</span>
            </button>
          </div>
        </div>
      </header>

      {menu && (
        <div className="fixed inset-0 z-50 flex flex-col bg-primary p-6 text-primary-foreground animate-rise">
          <button className="self-end" onClick={() => setMenu(false)} aria-label="Close"><X /></button>
          <div className="mt-8 flex flex-col gap-2">
            {allCats.map((c) => (
              <a key={c} href="#cats" onClick={() => setMenu(false)} className="font-display text-4xl uppercase">{c}</a>
            ))}
          </div>
        </div>
      )}

      {/* hero */}
      <section className="relative mx-auto max-w-[1600px] px-4 pb-16 pt-6 md:px-8">
        <div className="pointer-events-none relative z-10 leading-[0.8]">
          <Wordmark animate arabic={false} className="text-[27vw] md:text-[24vw] xl:text-[380px]" />
        </div>
        <div className="grid gap-6 md:-mt-[10vw] md:grid-cols-12">
          <div className="relative md:col-span-5 md:col-start-6 md:row-span-2">
            <div className="grain aspect-[4/5] overflow-hidden">
              <img src={images.hero} alt="5ADSH campaign — Drop 07" width={1280} height={1600} className="h-full w-full object-cover" />
            </div>
            <span className="font-arabic absolute -left-6 -bottom-10 -rotate-12 text-8xl md:-left-24 md:text-[11rem]">خدش</span>
          </div>
          <div className="flex flex-col justify-end gap-6 md:col-span-4 md:col-start-1 md:row-start-1 md:pt-[14vw]">
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">DROP 07 / CAIRO / FW26</p>
            <h1 className="font-display text-5xl uppercase leading-[0.9] md:text-7xl animate-rise">Wear the<br />mark.<br />Not the<br />rules.</h1>
            <a href="#drops" className="group inline-flex w-fit items-center gap-3 bg-primary px-8 py-4 font-mono text-sm tracking-widest text-primary-foreground transition hover:gap-6">
              SHOP NOW <ArrowUpRight className="h-4 w-4 transition group-hover:rotate-45" />
            </a>
          </div>
          <div className="hidden md:col-span-2 md:col-start-11 md:flex md:flex-col md:justify-end">
            <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
              (01) Raw-edge denim. Heavy cotton. Hand-distressed in small batches. Every piece carries a scratch — no two alike.
            </p>
          </div>
        </div>
      </section>

      {/* categories */}
      <section id="cats" className="bg-primary py-20 text-primary-foreground">
        <div className="mx-auto max-w-[1600px] px-4 md:px-8">
          <SectionHead n="02" title="Categories" ar="الأقسام" />
          <div className="grid grid-cols-2 gap-3 md:grid-cols-12 md:gap-4">
            {categories.map((c, i) => (
              <a
                key={c.name}
                href="#drops"
                className={[
                  "group relative overflow-hidden",
                  i === 0 && "col-span-2 aspect-[4/3] md:col-span-7 md:row-span-2 md:aspect-auto",
                  i === 1 && "aspect-[3/4] md:col-span-5 md:aspect-[5/4]",
                  i === 2 && "aspect-[3/4] md:col-span-3 md:aspect-square",
                  i === 3 && "col-span-2 aspect-[2/1] md:col-span-2 md:aspect-auto",
                ].filter(Boolean).join(" ")}
              >
                <img src={c.img} alt={c.name} loading="lazy" className="absolute inset-0 h-full w-full object-cover grayscale transition duration-700 group-hover:scale-105" style={{ objectPosition: c.pos }} />
                <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between">
                  <span className="font-display text-4xl uppercase md:text-6xl">{c.name}</span>
                  <span className="font-arabic text-2xl">{c.ar}</span>
                </div>
              </a>
            ))}
          </div>
          <div className="mt-8 flex flex-wrap gap-2">
            {allCats.map((c) => (
              <span key={c} className={`border border-primary-foreground/30 px-4 py-2 font-mono text-xs uppercase tracking-widest transition hover:bg-primary-foreground hover:text-primary ${c === "Coming Soon" ? "border-dashed opacity-60" : ""}`}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* new drops */}
      <section id="drops" className="mx-auto max-w-[1600px] px-4 py-20 md:px-8">
        <SectionHead n="03" title="New Drops" ar="جديد" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {newDrops.map((p, i) => <ProductCard key={p.id} p={p} i={i} onAdd={add} />)}
        </div>
      </section>

      {/* marquee wordmark */}
      <div className="overflow-hidden border-y py-6">
        <div className="flex w-max animate-marquee gap-12">
          {Array.from({ length: 8 }).map((_, i) => (
            <Wordmark key={i} className="text-7xl md:text-9xl" />
          ))}
        </div>
      </div>

      {/* best sellers */}
      <section className="mx-auto max-w-[1600px] px-4 py-20 md:px-8">
        <SectionHead n="04" title="Best Sellers" ar="الأكثر مبيعاً" />
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {bestSellers.map((p, i) => <ProductCard key={p.id} p={p} i={i} onAdd={add} />)}
        </div>
      </section>

      {/* limited drop */}
      <section className="relative bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-[1600px] md:grid-cols-2">
          <div className="grain relative aspect-square md:aspect-auto">
            <img src={images.tee} alt="Limited Fracture Tee" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
          </div>
          <div className="flex flex-col justify-center gap-6 px-6 py-16 md:px-16">
            <p className="font-mono text-xs tracking-[0.3em] opacity-60">(05) LIMITED — 150 PIECES ONLY</p>
            <h2 className="font-display text-6xl uppercase leading-[0.85] md:text-8xl">The<br />Fracture<br />Run</h2>
            <p className="max-w-md text-sm opacity-70">Hand-cracked screen print on 280gsm washed cotton. Numbered inside the neck. When it's gone, it's scratched off the archive.</p>
            <div className="flex gap-3 font-mono">
              {([["D", cd.d], ["H", cd.h], ["M", cd.m], ["S", cd.s]] as const).map(([l, v]) => (
                <div key={l} className="border border-primary-foreground/30 px-4 py-3 text-center">
                  <div className="text-3xl tabular-nums">{String(v).padStart(2, "0")}</div>
                  <div className="text-[10px] opacity-60">{l}</div>
                </div>
              ))}
            </div>
            <button onClick={add} className="w-fit bg-primary-foreground px-8 py-4 font-mono text-sm tracking-widest text-primary transition hover:tracking-[0.3em]">
              CLAIM YOURS — EGP 1,450
            </button>
          </div>
        </div>
      </section>

      {/* statement */}
      <section className="mx-auto max-w-[1600px] px-4 py-28 md:px-8">
        <div className="grid gap-10 md:grid-cols-12">
          <span className="font-arabic text-[40vw] leading-[0.7] md:col-span-5 md:text-[18vw]">خدش</span>
          <div className="flex flex-col justify-center gap-6 md:col-span-6 md:col-start-7">
            <p className="font-mono text-xs tracking-[0.3em] text-muted-foreground">(06) /χadʃ/ — noun. a scratch.</p>
            <p className="font-display text-3xl uppercase leading-tight md:text-5xl">
              A scratch is proof you were there. We make clothes that carry marks — of the street, of the city, of you.
            </p>
            <div className="scratch-line w-40" />
            <p className="max-w-lg text-sm text-muted-foreground">
              Born in Cairo. Cut in small batches. 5ADSH is for the ones who don't polish their edges — every seam, every tear is intentional.
            </p>
          </div>
        </div>
      </section>

      {/* footer */}
      <footer className="bg-primary px-4 pt-16 text-primary-foreground md:px-8">
        <div className="mx-auto max-w-[1600px]">
          <div className="grid gap-10 border-b border-primary-foreground/20 pb-12 md:grid-cols-4">
            <div className="md:col-span-2">
              <p className="font-display text-3xl uppercase">Get scratched first.</p>
              <form onSubmit={(e) => e.preventDefault()} className="mt-4 flex max-w-md border border-primary-foreground/40">
                <input placeholder="EMAIL" className="flex-1 bg-transparent px-4 py-3 font-mono text-sm outline-none placeholder:text-primary-foreground/50" />
                <button className="bg-primary-foreground px-5 font-mono text-xs text-primary">JOIN</button>
              </form>
            </div>
            <ul className="space-y-2 font-mono text-xs tracking-widest opacity-70">
              {["SHIPPING", "RETURNS", "SIZE GUIDE", "CONTACT"].map((l) => <li key={l}>{l}</li>)}
            </ul>
            <ul className="space-y-2 font-mono text-xs tracking-widest opacity-70">
              {["INSTAGRAM", "TIKTOK", "CAIRO, EG"].map((l) => <li key={l}>{l}</li>)}
            </ul>
          </div>
          <div className="relative py-6 leading-[0.8] [--background:var(--ink)]">
            <Wordmark arabic={false} className="text-[27vw] xl:text-[420px]" />
          </div>
          <p className="pb-6 font-mono text-[10px] tracking-widest opacity-50">© 2026 5ADSH — خدش. ALL MARKS RESERVED.</p>
        </div>
      </footer>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 bg-primary px-6 py-3 font-mono text-xs tracking-widest text-primary-foreground animate-rise">
          ADDED TO CART — {cart}
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
      <span className="font-arabic text-3xl md:text-5xl">{ar}</span>
    </div>
  );
}
