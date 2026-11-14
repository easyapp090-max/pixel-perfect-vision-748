import { Link } from "@tanstack/react-router";

import {
  categoryCatalog,
  normalizeCategory,
  siteImages,
  type StoreCategory,
} from "@/lib/store-data";

export const categoryNavigation = categoryCatalog.map(
  ({ navLabel, slug }) => [navLabel, slug] as const,
);

export function CategoryNav({
  activeCategory,
  hiddenSlugs = [],
}: {
  activeCategory?: string;
  hiddenSlugs?: string[];
}) {
  const hidden = new Set(hiddenSlugs);
  return (
    <nav aria-label="Shop by category" className="category-editorial__nav">
      {categoryNavigation.map(([label, slug]) =>
        hidden.has(slug) ? null : (
          <Link
            key={slug}
            to="/products/$category"
            params={{ category: slug }}
            className={`category-editorial__nav-item ${activeCategory === slug ? "category-editorial__nav-item--active" : ""}`}
            aria-current={activeCategory === slug ? "page" : undefined}
          >
            {label}
          </Link>
        ),
      )}
    </nav>
  );
}

export function CategoryEditorial({
  standalone = false,
  categories = [],
}: {
  standalone?: boolean;
  categories?: StoreCategory[];
}) {
  const hiddenSlugs = categories
    .filter((category) => category.active === false)
    .map((category) => normalizeCategory(category.slug));
  const editorialCategories = categoryCatalog.filter(
    (category) => category.isEditorial && !hiddenSlugs.includes(category.slug),
  );
  return (
    <section className={`category-editorial ${standalone ? "category-editorial--standalone" : ""}`}>
      <div className="mx-auto max-w-[1600px] px-4 py-20 md:px-8 md:py-28">
        <div className="category-editorial__heading">
          <p className="font-mono text-[10px] tracking-[0.32em] text-white/50">(02)</p>
          <div className="category-editorial__title-row flex items-end justify-between gap-4">
            <h1 className="font-display text-[clamp(4rem,12vw,11rem)] uppercase leading-[.78]">
              Categories
            </h1>
            <span className="font-arabic pb-1 text-2xl text-white/65 md:text-4xl">الأقسام</span>
          </div>
        </div>

        <div className="category-editorial__grid mt-10 md:mt-14">
          {editorialCategories.map((category) => (
            <Link
              key={category.slug}
              to="/products/$category"
              params={{ category: category.slug }}
              className={`category-editorial__card category-editorial__card--${category.tone} group`}
            >
              <img
                src={category.image}
                alt={`${category.name} editorial collection`}
                width={
                  category.tone === "men"
                    ? 896
                    : category.tone === "women"
                      ? 768
                      : category.tone === "accessories"
                        ? 1024
                        : 1280
                }
                height={
                  category.tone === "men"
                    ? 1152
                    : category.tone === "women"
                      ? 1024
                      : category.tone === "accessories"
                        ? 1024
                        : 1600
                }
                className="category-editorial__image"
                loading="eager"
                onError={(event) => {
                  event.currentTarget.src = siteImages.hero;
                }}
              />
              <span className="category-editorial__shade" />
              <span className="category-editorial__label">
                <span className="category-editorial__name font-display">{category.name}</span>
                <span className="category-editorial__arabic font-arabic">{category.arabic}</span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <CategoryNav hiddenSlugs={hiddenSlugs} />
        </div>
      </div>
    </section>
  );
}
