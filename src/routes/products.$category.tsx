import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";

import { ProductCard } from "@/components/ProductCard";
import { StorefrontDataNotice } from "@/components/StorefrontDataNotice";
import { useStorefrontData } from "@/hooks/use-storefront-data";
import { addCartItem, getCartCount } from "@/lib/cart";
import { formatPrice, siteImages } from "@/lib/store-data";

export const Route = createFileRoute("/products/$category")({
  component: CategoryPage,
});

function CategoryPage() {
  const { category } = Route.useParams();
  const { products, status, error } = useStorefrontData();
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");

  const filteredProducts = useMemo(() => {
    const normalizedCategory = category.toLowerCase();
    const matches = products.filter((product) => {
      const matchesCategory =
        normalizedCategory === "all" ||
        product.category.toLowerCase() === normalizedCategory ||
        product.subcategory.toLowerCase() === normalizedCategory ||
        product.category.toLowerCase().replace(/s$/, "") === normalizedCategory;
      const matchesSearch =
        !search ||
        product.name.toLowerCase().includes(search.toLowerCase()) ||
        product.category.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });

    return [...matches].sort((a, b) => {
      if (sort === "price-low") return (a.salePrice ?? a.price) - (b.salePrice ?? b.price);
      if (sort === "price-high") return (b.salePrice ?? b.price) - (a.salePrice ?? a.price);
      return a.newArrival === b.newArrival ? 0 : a.newArrival ? -1 : 1;
    });
  }, [category, products, search, sort]);

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
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Collection
          </p>
          <h1 className="font-display text-5xl uppercase md:text-7xl">{category}</h1>
        </div>
        <StorefrontDataNotice status={status} error={error} />
        <Link
          to="/products"
          className="border px-4 py-2 font-mono text-xs uppercase tracking-[0.2em]"
        >
          View all
        </Link>
      </div>

      <div className="mb-8 flex flex-col gap-4 md:flex-row">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search in this collection"
          className="flex-1 border border-input bg-background px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] outline-none"
        />
        <select
          value={sort}
          onChange={(event) => setSort(event.target.value)}
          className="border border-input bg-background px-4 py-3 font-mono text-xs uppercase tracking-[0.2em] outline-none"
        >
          <option value="newest">Newest</option>
          <option value="price-low">Price low to high</option>
          <option value="price-high">Price high to low</option>
        </select>
        <Link to="/cart" className="border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em]">
          Cart ({getCartCount()})
        </Link>
      </div>

      {status !== "live" ? null : filteredProducts.length === 0 ? (
        <div className="border border-dashed p-10 text-center">
          <p className="font-display text-3xl uppercase">No items yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            This category is empty or not yet populated.
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
