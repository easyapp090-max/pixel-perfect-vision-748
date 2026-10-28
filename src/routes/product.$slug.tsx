import { createFileRoute, Link } from "@tanstack/react-router";
import { Minus, Plus, ShieldCheck, Truck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { ProductCard } from "@/components/ProductCard";
import { StorefrontDataNotice } from "@/components/StorefrontDataNotice";
import { useStorefrontData } from "@/hooks/use-storefront-data";
import { addCartItem } from "@/lib/cart";
import { clampProductQuantity, formatPrice, siteImages } from "@/lib/store-data";

export const Route = createFileRoute("/product/$slug")({
  component: ProductDetailPage,
});

function ProductDetailPage() {
  const { slug } = Route.useParams();
  const { products, status, error } = useStorefrontData();
  const product = products.find((entry) => entry.slug === slug);

  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] ?? "");
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    setSelectedSize(product?.sizes[0] ?? "");
    setSelectedColor(product?.colors[0] ?? "");
  }, [product?.id, product?.sizes, product?.colors]);

  const availableStock = useMemo(() => {
    if (!product) return 0;
    const variant = product.variants.find(
      (entry) => entry.size === selectedSize && entry.color === selectedColor,
    );
    return variant?.stock ?? 0;
  }, [product, selectedColor, selectedSize]);

  useEffect(() => {
    setQuantity((value) => clampProductQuantity(value, availableStock));
  }, [availableStock]);

  if (!product) {
    return (
      <div className="mx-auto max-w-[800px] px-4 py-20 text-center">
        <StorefrontDataNotice status={status} error={error} />
        {status === "live" ? (
          <p className="mb-5 text-sm text-muted-foreground">Product unavailable.</p>
        ) : null}
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Product unavailable
        </p>
        <h1 className="mt-4 font-display text-5xl uppercase">Not found</h1>
        <Link
          to="/products"
          className="mt-6 inline-block border px-4 py-3 font-mono text-xs uppercase tracking-[0.2em]"
        >
          Return to shop
        </Link>
      </div>
    );
  }

  const relatedProducts = products
    .filter((item) => item.category === product.category && item.id !== product.id)
    .slice(0, 4);

  const handleAddToCart = () => {
    if (!selectedSize || !selectedColor) {
      setNotice("Please select a size and colour before adding to cart.");
      return;
    }
    if (availableStock <= 0) {
      setNotice("This variant is currently out of stock.");
      return;
    }

    addCartItem({
      id: `${product.id}-${selectedSize}-${selectedColor}`,
      productId: product.id,
      name: product.name,
      slug: product.slug,
      price: product.salePrice ?? product.price,
      image: product.images[0] ?? siteImages.hero,
      size: selectedSize,
      color: selectedColor,
      quantity,
    });

    setNotice("Added to cart.");
  };

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <div className="mb-6 flex items-center gap-3 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
        <Link to="/">Home</Link>
        <span>/</span>
        <Link to="/products">Shop</Link>
        <span>/</span>
        <span>{product.category}</span>
      </div>

      <div className="grid gap-10 md:grid-cols-2">
        <div className="grid gap-4 md:grid-cols-[120px_minmax(0,1fr)]">
          <div className="flex flex-col gap-3">
            {product.images.map((image) => (
              <img
                key={image}
                src={image}
                alt={product.name}
                className="aspect-[3/4] w-full object-cover grayscale"
              />
            ))}
          </div>
          <img
            src={product.images[0] ?? siteImages.hero}
            alt={product.name}
            className="aspect-[4/5] w-full object-cover"
          />
        </div>

        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            {product.category}
          </p>
          <h1 className="mt-3 font-display text-5xl uppercase md:text-7xl">{product.name}</h1>
          <div className="mt-4 flex items-center gap-3">
            <span className="font-mono text-xl">
              {formatPrice(product.salePrice ?? product.price)}
            </span>
            {product.salePrice && (
              <span className="text-sm text-muted-foreground line-through">
                {formatPrice(product.price)}
              </span>
            )}
          </div>

          <p className="mt-6 max-w-xl text-sm leading-relaxed text-muted-foreground">
            {product.description}
          </p>

          <div className="mt-6 space-y-5 border-y py-6">
            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Size
              </p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setSelectedSize(size)}
                    className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${selectedSize === size ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                Colour
              </p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setSelectedColor(color)}
                    className={`border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${selectedColor === color ? "bg-primary text-primary-foreground" : "bg-background"}`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex items-center border">
                <button
                  type="button"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  className="p-3"
                >
                  <Minus className="h-4 w-4" />
                </button>
                <span className="min-w-10 text-center font-mono text-sm">{quantity}</span>
                <button
                  type="button"
                  disabled={availableStock <= 0 || quantity >= availableStock}
                  onClick={() =>
                    setQuantity((value) => clampProductQuantity(value + 1, availableStock))
                  }
                  className="p-3"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {availableStock > 0 ? `${availableStock} in stock` : "Out of stock"}
              </span>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleAddToCart}
                className="bg-primary px-6 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Add to cart
              </button>
              <Link
                to="/products"
                className="border px-6 py-3 font-mono text-xs uppercase tracking-[0.2em]"
              >
                Continue shopping
              </Link>
            </div>

            {notice && (
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {notice}
              </p>
            )}
          </div>

          <div className="mt-6 grid gap-3 text-sm text-muted-foreground md:grid-cols-2">
            <div className="flex items-start gap-3 border p-4">
              <Truck className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium text-foreground">Shipping</p>
                <p>In-stock orders dispatch in 24–48 hours across Egypt.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 border p-4">
              <ShieldCheck className="mt-0.5 h-4 w-4" />
              <div>
                <p className="font-medium text-foreground">Returns</p>
                <p>Easy exchanges within 7 days on unworn items.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-16">
        <p className="mb-6 font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
          Related products
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {relatedProducts.map((item, index) =>
            (() => {
              const variant = item.variants[0];
              return (
                <ProductCard
                  key={item.id}
                  p={item}
                  i={index}
                  onAdd={() => {
                    if (!variant) return;
                    addCartItem({
                      id: `${item.id}-${variant.size}-${variant.color}`,
                      productId: item.id,
                      name: item.name,
                      slug: item.slug,
                      price: item.salePrice ?? item.price,
                      image: item.images[0] ?? siteImages.hero,
                      size: variant.size,
                      color: variant.color,
                      quantity: 1,
                    });
                  }}
                />
              );
            })(),
          )}
        </div>
      </div>
    </div>
  );
}
