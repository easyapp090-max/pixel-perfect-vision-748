import { Link } from "@tanstack/react-router";
import { Menu, Phone, Search, ShieldCheck, ShoppingBag, UserRound, X } from "lucide-react";
import { useEffect, useState } from "react";

import { Wordmark } from "@/components/Wordmark";
import { getCartCount } from "@/lib/cart";
import { useSiteSettings } from "@/hooks/use-site-settings";

const categoryLinks = [
  { label: "HOME", to: "/" },
  { label: "MEN", to: "/products/men" },
  { label: "WOMEN", to: "/products/women" },
  { label: "KIDS", to: "/products/kids" },
  { label: "DROPS", to: "/products/new-drops" },
];

export function StoreNavbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(getCartCount);
  const settings = useSiteSettings();

  useEffect(() => {
    const updateCartCount = () => setCartCount(getCartCount());
    window.addEventListener("cart:updated", updateCartCount);
    window.addEventListener("storage", updateCartCount);
    return () => {
      window.removeEventListener("cart:updated", updateCartCount);
      window.removeEventListener("storage", updateCartCount);
    };
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b bg-background/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1600px] items-center justify-between px-4 md:px-8">
          <nav
            aria-label="Main navigation"
            className="hidden gap-6 font-mono text-xs tracking-widest md:flex"
          >
            {categoryLinks.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="relative after:absolute after:-bottom-1 after:left-0 after:h-px after:w-0 after:bg-foreground after:transition-all hover:after:w-full"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <button
            type="button"
            className="md:hidden"
            onClick={() => setMenuOpen(true)}
            aria-label="Open navigation menu"
          >
            <Menu />
          </button>

          <Link to="/" aria-label="5ADSH home">
            <Wordmark className="text-3xl md:text-4xl" />
          </Link>

          <div className="flex items-center gap-4">
            {settings.phone ? (
              <a href={`tel:${settings.phone}`} aria-label={`Call ${settings.phone}`}>
                <Phone className="h-5 w-5" />
              </a>
            ) : null}
            <Link to="/products" aria-label="Search products">
              <Search className="hidden h-5 w-5 md:block" />
            </Link>
            <Link to="/cart" className="relative" aria-label={`Shopping cart, ${cartCount} items`}>
              <ShoppingBag className="h-5 w-5" />
              <span className="absolute -right-2 -top-2 grid h-4 min-w-4 place-items-center bg-primary px-1 font-mono text-[9px] text-primary-foreground">
                {cartCount}
              </span>
            </Link>
            <Link to="/login" aria-label="User sign in">
              <UserRound className="h-5 w-5" />
            </Link>
            <Link to="/admin/login" aria-label="Administrator sign in">
              <ShieldCheck className="h-5 w-5" />
            </Link>
          </div>
        </div>
      </header>

      {menuOpen ? (
        <div className="fixed inset-0 z-50 flex flex-col bg-primary p-6 text-primary-foreground animate-rise md:hidden">
          <button
            type="button"
            className="self-end"
            onClick={() => setMenuOpen(false)}
            aria-label="Close navigation menu"
          >
            <X />
          </button>
          <nav aria-label="Mobile navigation" className="mt-8 flex flex-col gap-2">
            {[
              { label: "Home", to: "/" },
              { label: "All products", to: "/products" },
              ...categoryLinks.map(({ label, to }) => ({ label, to })),
              { label: "Size guide", to: "/size-guide" },
              { label: "Cart", to: "/cart" },
              { label: "User sign in", to: "/login" },
              { label: "Admin sign in", to: "/admin/login" },
            ].map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setMenuOpen(false)}
                className="font-display text-4xl uppercase"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </>
  );
}
