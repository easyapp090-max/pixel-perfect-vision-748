import { createFileRoute } from "@tanstack/react-router";

import { CategoryEditorial } from "@/components/CategoryEditorial";
import { useStorefrontData } from "@/hooks/use-storefront-data";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — 5ADSH" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { categories } = useStorefrontData();
  return <CategoryEditorial standalone categories={categories} />;
}
