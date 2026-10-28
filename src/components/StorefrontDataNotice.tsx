import type { StorefrontDataStatus } from "@/lib/storefront-state";

export function StorefrontDataNotice({
  status,
  error,
}: {
  status: StorefrontDataStatus;
  error: string;
}) {
  if (status === "live") return null;

  return (
    <div role="status" className="border border-dashed p-4 text-sm text-muted-foreground">
      {status === "loading"
        ? "Loading live storefront data..."
        : error || "Live storefront data is currently unavailable."}
    </div>
  );
}
