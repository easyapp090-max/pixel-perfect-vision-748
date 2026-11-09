import { createFileRoute } from "@tanstack/react-router";

import { CategoryEditorial } from "@/components/CategoryEditorial";

export const Route = createFileRoute("/categories")({
  head: () => ({ meta: [{ title: "Categories — 5ADSH" }] }),
  component: () => <CategoryEditorial standalone />,
});
