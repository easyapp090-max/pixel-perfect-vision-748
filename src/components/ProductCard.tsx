import { useState } from "react";
import { Heart, Plus } from "lucide-react";
import { egp, type Product } from "@/lib/products";
import { cn } from "@/lib/utils";

export function ProductCard({ p, onAdd, i = 0 }: { p: Product; onAdd: () => void; i?: number }) {
  const [liked, setLiked] = useState(false);
  return (
    <article className={cn("group", i % 2 === 1 && "md:mt-16")}>
      <div className="relative aspect-[3/4] overflow-hidden bg-card grain">
        <img
          src={p.img}
          alt={p.name}
          loading="lazy"
          className="h-full w-full object-cover grayscale transition duration-700 group-hover:scale-110"
          style={{ objectPosition: p.pos ?? "center" }}
        />
        {(p.tag || p.sale) && (
          <span className="absolute left-0 top-4 bg-primary px-3 py-1 font-mono text-[10px] tracking-widest text-primary-foreground">
            {p.sale ? `−${Math.round((1 - p.sale / p.price) * 100)}%` : p.tag}
          </span>
        )}
        <button
          onClick={() => setLiked(!liked)}
          aria-label="Add to wishlist"
          className="absolute right-3 top-3 grid h-10 w-10 place-items-center bg-background/90 transition hover:scale-110"
        >
          <Heart className={cn("h-4 w-4", liked && "fill-foreground")} />
        </button>
        <button
          onClick={onAdd}
          className="absolute inset-x-0 bottom-0 flex translate-y-full items-center justify-between bg-primary px-4 py-3 font-mono text-xs tracking-widest text-primary-foreground transition duration-300 group-hover:translate-y-0 max-md:translate-y-0"
        >
          ADD TO CART <Plus className="h-4 w-4" />
        </button>
      </div>
      <div className="mt-3 flex items-start justify-between gap-3">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">{p.cat}</p>
          <h3 className="mt-1 text-sm font-medium uppercase">{p.name}</h3>
        </div>
        <div className="text-right font-mono text-sm whitespace-nowrap">
          {p.sale ? (
            <>
              <div>{egp(p.sale)}</div>
              <div className="text-xs text-muted-foreground line-through">{egp(p.price)}</div>
            </>
          ) : (
            egp(p.price)
          )}
        </div>
      </div>
    </article>
  );
}
