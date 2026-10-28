import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/ProductCard";
import { StorefrontDataNotice } from "@/components/StorefrontDataNotice";
import { useStorefrontData } from "@/hooks/use-storefront-data";
import { addCartItem, getCartCount } from "@/lib/cart";
import { formatPrice, siteImages } from "@/lib/store-data";

export const Route = createFileRoute("/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const { products, status, error } = useStorefrontData();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [sort, setSort] = useState("newest");

  const filteredProducts = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    const available = products.filter((product) => {
      const matchesSearch =
        !normalizedSearch ||
        product.name.toLowerCase().includes(normalizedSearch) ||
        product.category.toLowerCase().includes(normalizedSearch);
      const matchesCategory =
        selectedCategory === "all" ||
        product.category.toLowerCase() === selectedCategory.toLowerCase();
      return matchesSearch && matchesCategory;
    });

    return [...available].sort((a, b) => {
      if (sort === "price-low") return (a.salePrice ?? a.price) - (b.salePrice ?? b.price);
      if (sort === "price-high") return (b.salePrice ?? b.price) - (a.salePrice ?? a.price);
      if (sort === "popular") return Number(b.bestSeller) - Number(a.bestSeller);
      return a.newArrival === b.newArrival ? 0 : a.newArrival ? -1 : 1;
    });
  }, [products, search, selectedCategory, sort]);

  const handleAddToCart = (product: (typeof products)[number]) => {
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
    window.dispatchEvent(new Event("cart:updated"));
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Catalog
          </p>
          <h1 className="font-display text-5xl uppercase md:text-7xl">All Products</h1>
        </div>
        <StorefrontDataNotice status={status} error={error} />
        <div className="flex items-center gap-3 text-sm font-mono uppercase text-muted-foreground">
          <span>{filteredProducts.length} items</span>
          <Link to="/cart" className="inline-flex items-center gap-2 border px-3 py-2 text-primary">
            Cart ({getCartCount()})
          </Link>
        </div>
      </div>

      <div className="mb-10 grid gap-4 border bg-card p-4 md:grid-cols-[1.3fr_0.9fr_0.8fr]">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search products or categories"
          className="border border-input bg-background px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] outline-none"
        />

        <select
          value={selectedCategory}
          onChange={(event) => setSelectedCategory(event.target.value)}
          className="border border-input bg-background px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] outline-none"
        >
          <option value="all">All categories</option>
          {Array.from(new Set(products.map((product) => product.category))).map((category) => (
            <option key={category} value={category.toLowerCase()}>
              {category}
            </option>
          ))}
        </select>

        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="border border-input bg-background px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] outline-none"
        >
          <option value="newest">Newest</option>
          <option value="price-low">Price low to high</option>
          <option value="price-high">Price high to low</option>
          <option value="popular">Popular</option>
        </select>
      </div>

      {status !== "live" ? null : filteredProducts.length === 0 ? (
        <div className="border border-dashed p-10 text-center">
          <p className="font-display text-3xl uppercase">No matches</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Try another keyword or reset the filters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {filteredProducts.map((product, index) => (
            <div key={product.id} className="space-y-2">
              <ProductCard p={product} i={index} onAdd={() => handleAddToCart(product)} />
              <div className="flex items-center justify-between text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground">
                <span>{product.category}</span>
                <span>{formatPrice(product.salePrice ?? product.price)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
