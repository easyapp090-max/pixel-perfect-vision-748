import { Link } from "@tanstack/react-router";

import { siteImages, type CategoryDefinition } from "@/lib/store-data";

const editorialCategories: CategoryDefinition[] = [
  { name: "Men", slug: "men", arabic: "رجال", image: siteImages.fahd, tone: "men" },
  { name: "Women", slug: "women", arabic: "حريمي", image: siteImages.women, tone: "women" },
  { name: "Jackets", slug: "jackets", arabic: "جاكيتات", image: siteImages.hero, tone: "jackets" },
  {
    name: "Accessories",
    slug: "accessories",
    arabic: "إكسسوارات",
    image: siteImages.acc,
    tone: "accessories",
  },
];

export const categoryNavigation = [
  ["MEN", "men"],
  ["WOMEN", "women"],
  ["KIDS", "kids"],
  ["T-SHIRTS", "t-shirts"],
  ["SHIRTS", "shirts"],
  ["PANTS", "pants"],
  ["JEANS", "jeans"],
  ["DRESSES", "dresses"],
  ["SETS", "sets"],
  ["JACKETS", "jackets"],
  ["SHOES", "shoes"],
  ["ACCESSORIES", "accessories"],
  ["COMING SOON", "coming-soon"],
] as const;

export function CategoryNav({ activeCategory }: { activeCategory?: string }) {
  return (
    <nav aria-label="Shop by category" className="category-editorial__nav">
      {categoryNavigation.map(([label, slug]) => (
        <Link
          key={slug}
          to="/products/$category"
          params={{ category: slug }}
          className={`category-editorial__nav-item ${activeCategory === slug ? "category-editorial__nav-item--active" : ""}`}
          aria-current={activeCategory === slug ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function CategoryEditorial({ standalone = false }: { standalone?: boolean }) {
  return (
    <section className={`category-editorial ${standalone ? "category-editorial--standalone" : ""}`}>
      <div className="mx-auto max-w-[1600px] px-4 py-20 md:px-8 md:py-28">
        <div className="category-editorial__heading">
          <p className="font-mono text-[10px] tracking-[0.32em] text-white/50">(02)</p>
          <div className="flex items-end justify-between gap-4">
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
                width={category.tone === "men" ? 896 : 1280}
                height={category.tone === "men" ? 1280 : 1600}
                loading="lazy"
                onError={(event) => {
                  event.currentTarget.src = siteImages.hero;
                }}
              />
              <span className="category-editorial__shade" />
              <span className="category-editorial__label">
                <span className="font-display text-4xl uppercase tracking-tight md:text-6xl">
                  {category.name}
                </span>
                <span className="font-arabic text-xl text-white/75 md:text-2xl">
                  {category.arabic}
                </span>
              </span>
            </Link>
          ))}
        </div>

        <div className="mt-10">
          <CategoryNav />
        </div>
      </div>
    </section>
  );
}
