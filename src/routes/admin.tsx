import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";

import { Wordmark } from "@/components/Wordmark";
import { getUserFacingError } from "@/lib/user-messages";
import {
  getCurrentAdminSession,
  hasAdminAccess,
  type CustomerSession,
  type StorePermission,
} from "@/lib/auth";
import type { OrderRecord } from "@/lib/cart";
import {
  homepageContent,
  storeSettings,
  type CustomerProfile,
  type PromoCode,
  type StoreCategory,
  type StoreCollection,
  type StoreProduct,
  type StoreSettings,
} from "@/lib/store-data";
import {
  archiveStoreProduct,
  loadAdminStore,
  saveHomepageContent,
  saveStoreCategory,
  saveStoreCollection,
  saveStoreCoupon,
  saveStoreProduct,
  saveStoreSettings,
  setAssistantAccess,
  setAssistantPermissions,
  updateOrderStatus as updateStoreOrderStatus,
  uploadProductImage,
  type AdminStoreData,
} from "@/lib/store-api";

type AdminTab =
  | "overview"
  | "products"
  | "categories"
  | "orders"
  | "customers"
  | "promos"
  | "content"
  | "settings";

const permissionLabels: Array<{ value: StorePermission; label: string }> = [
  { value: "manage_products", label: "Products" },
  { value: "manage_orders", label: "Orders" },
  { value: "view_customers", label: "Customers" },
  { value: "manage_discounts", label: "Discounts" },
  { value: "manage_content", label: "Content" },
  { value: "manage_settings", label: "Settings" },
];

const emptyProduct = (): StoreProduct => ({
  id: "",
  slug: "",
  name: "",
  category: "T-Shirts",
  subcategory: "T-Shirts",
  price: 0,
  salePrice: 0,
  sku: "",
  description: "",
  badge: "NEW",
  featured: false,
  bestSeller: false,
  newArrival: true,
  images: [],
  colors: ["Black"],
  sizes: ["M"],
  variants: [{ id: "", size: "M", color: "Black", stock: 0 }],
});

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}

export function AdminPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [adminSession, setAdminSession] = useState<CustomerSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [categories, setCategories] = useState<StoreCategory[]>([]);
  const [collections, setCollections] = useState<StoreCollection[]>([]);
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [promos, setPromos] = useState<PromoCode[]>([]);
  const [content, setContent] = useState(homepageContent);
  const [settings, setSettings] = useState(storeSettings);
  const [productDraft, setProductDraft] = useState<StoreProduct>(() => emptyProduct());
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [promoDraft, setPromoDraft] = useState<PromoCode>({
    id: "",
    code: "",
    type: "percentage",
    value: 10,
    minOrder: 1500,
    active: true,
    expiresAt: "2027-12-31T23:59:59.000Z",
    description: "",
  });
  const [categoryDraft, setCategoryDraft] = useState<StoreCategory>({
    id: "",
    name: "",
    slug: "",
    image: "",
    arabic: "",
  });
  const [collectionDraft, setCollectionDraft] = useState<StoreCollection>({
    id: "",
    name: "",
    description: "",
    products: [],
  });

  useEffect(() => {
    let active = true;
    getCurrentAdminSession()
      .then(async (session) => {
        if (!active) return;
        setAdminSession(session);
        setAuthChecked(true);
        if (!session || !hasAdminAccess(session)) return;
        const data: AdminStoreData = await loadAdminStore();
        if (!active) return;
        setOrders(data.orders);
        setProducts(data.products);
        setCategories(data.categories);
        setCollections(data.collections);
        setCustomers(data.customers);
        setPromos(data.promos);
        setContent(data.homepage);
        setSettings(data.settings);
        setDataLoaded(true);
      })
      .catch((cause: unknown) => {
        if (active) {
          setLoadError(
            getUserFacingError(cause, "Could not verify administrator access. Please try again."),
          );
          setAuthChecked(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const accessAllowed = hasAdminAccess(adminSession);

  const metrics = useMemo(() => {
    const revenue = orders.reduce((sum, order) => sum + Number(order.total ?? 0), 0);
    const pending = orders.filter((order) =>
      ["Pending", "Confirmed"].includes(order.status),
    ).length;
    const completed = orders.filter((order) => order.status === "Delivered").length;
    const lowStock = products.filter((product) =>
      product.variants.some((variant) => variant.stock < 6),
    ).length;

    return {
      revenue,
      orders: orders.length,
      pending,
      completed,
      lowStock,
      products: products.length,
      customers: new Set(orders.map((order) => order.customer?.phone)).size,
    };
  }, [orders, products]);

  const runAction = async (action: () => Promise<void>) => {
    setActionError("");
    try {
      await action();
    } catch (cause) {
      setActionError(
        getUserFacingError(cause, "The operation could not be completed. Please try again."),
      );
    }
  };

  const saveProduct = () =>
    runAction(async () => {
      const trimmed = {
        ...productDraft,
        slug:
          productDraft.slug ||
          productDraft.name
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, "-")
            .replace(/^-|-$/g, ""),
        sku: productDraft.sku || `5AD-${Date.now().toString().slice(-6)}`,
        images: productDraft.images,
        colors: productDraft.colors.length ? productDraft.colors : ["Black"],
        sizes: productDraft.sizes.length ? productDraft.sizes : ["M"],
        variants: productDraft.variants.length
          ? productDraft.variants
          : [{ id: "", size: "M", color: "Black", stock: 0 }],
      };
      if (!trimmed.name.trim() || !trimmed.slug || !trimmed.sku || trimmed.price < 0) {
        throw new Error("Product name, slug, SKU, and a non-negative price are required.");
      }
      const saved = await saveStoreProduct({ ...trimmed, id: editingProductId ?? "" });
      setProducts((current) =>
        editingProductId
          ? current.map((product) => (product.id === editingProductId ? saved : product))
          : [saved, ...current],
      );
      setProductDraft(emptyProduct());
      setEditingProductId(null);
    });

  const editProduct = (product: StoreProduct) => {
    setEditingProductId(product.id);
    setProductDraft(product);
    setActiveTab("products");
  };

  const deleteProduct = (productId: string) =>
    runAction(async () => {
      await archiveStoreProduct(productId);
      setProducts((current) => current.filter((product) => product.id !== productId));
    });

  const updateOrderStatus = (orderId: string, status: OrderRecord["status"]) =>
    runAction(async () => {
      await updateStoreOrderStatus(orderId, status);
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status } : order)),
      );
    });

  const updateAssistantAccess = (customerId: string, enabled: boolean) =>
    runAction(async () => {
      await setAssistantAccess(customerId, enabled);
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === customerId
            ? { ...customer, role: enabled ? "staff" : "customer", permissions: [] }
            : customer,
        ),
      );
    });

  const updateAssistantPermissions = (customerId: string, permissions: StorePermission[]) =>
    runAction(async () => {
      await setAssistantPermissions(customerId, permissions);
      setCustomers((current) =>
        current.map((customer) =>
          customer.id === customerId ? { ...customer, permissions } : customer,
        ),
      );
    });

  const savePromo = () =>
    runAction(async () => {
      const saved = await saveStoreCoupon(promoDraft);
      setPromos((current) =>
        current.some((promo) => promo.id === saved.id)
          ? current.map((promo) => (promo.id === saved.id ? saved : promo))
          : [saved, ...current],
      );
      setPromoDraft({
        id: "",
        code: "",
        type: "percentage",
        value: 10,
        minOrder: 1500,
        active: true,
        expiresAt: "2027-12-31T23:59:59.000Z",
        description: "",
      });
    });

  const saveCategory = () =>
    runAction(async () => {
      const saved = await saveStoreCategory({
        ...categoryDraft,
        slug: categoryDraft.slug || categoryDraft.name.toLowerCase().trim().replace(/\s+/g, "-"),
      });
      setCategories((current) =>
        current.some((category) => category.id === saved.id)
          ? current.map((category) => (category.id === saved.id ? saved : category))
          : [saved, ...current],
      );
      setCategoryDraft({ id: "", name: "", slug: "", image: "", arabic: "" });
    });

  const saveCollection = () =>
    runAction(async () => {
      const saved = await saveStoreCollection(collectionDraft);
      setCollections((current) =>
        current.some((collection) => collection.id === saved.id)
          ? current.map((collection) => (collection.id === saved.id ? saved : collection))
          : [saved, ...current],
      );
      setCollectionDraft({ id: "", name: "", description: "", products: [] });
    });

  const saveSettings = () => runAction(() => saveStoreSettings(settings));

  const saveContent = () => runAction(() => saveHomepageContent(content));

  const isOwner = adminSession?.role === "owner";
  const hasPermission = (permission: StorePermission) =>
    isOwner || Boolean(adminSession?.permissions.includes(permission));
  const tabs = (
    [
      { key: "overview", label: "Overview" },
      { key: "products", label: "Products" },
      { key: "categories", label: "Categories" },
      { key: "orders", label: "Orders" },
      { key: "customers", label: "Customers" },
      { key: "promos", label: "Promos" },
      { key: "content", label: "Homepage" },
      { key: "settings", label: "Settings" },
    ] as { key: AdminTab; label: string }[]
  ).filter(
    (tab) =>
      tab.key === "overview" ||
      (tab.key === "products" && hasPermission("manage_products")) ||
      (tab.key === "orders" && hasPermission("manage_orders")) ||
      (tab.key === "customers" && hasPermission("view_customers")) ||
      (tab.key === "promos" && hasPermission("manage_discounts")) ||
      (tab.key === "content" && hasPermission("manage_content")) ||
      (tab.key === "settings" && hasPermission("manage_settings")),
  );

  if (!authChecked) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        Checking administrator session…
      </div>
    );
  }
  if (loadError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        <h1 className="font-display text-5xl uppercase">Admin unavailable</h1>
        <p className="mt-5 text-sm text-red-600">{loadError}</p>
        <Link
          to="/admin/login"
          className="mt-8 inline-block border px-4 py-2 font-mono text-xs uppercase"
        >
          Admin login
        </Link>
      </div>
    );
  }
  if (!accessAllowed) {
    const hasNoAssignedPermissions = Boolean(adminSession);
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center md:px-8">
        <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">Admin</p>
        <h1 className="mt-4 font-display text-5xl uppercase md:text-7xl">
          {hasNoAssignedPermissions ? "No permissions assigned" : "Restricted"}
        </h1>
        <p className="mt-6 text-base text-muted-foreground">
          {hasNoAssignedPermissions
            ? "A trusted store owner must assign at least one administrator permission before this account can use the dashboard."
            : "This dashboard requires an authenticated account with an administrator role assigned by a trusted store owner."}
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            to="/admin/login"
            className="border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Admin login
          </Link>
          <Link
            to="/"
            className="border px-4 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
          >
            Back home
          </Link>
        </div>
      </div>
    );
  }
  if (!dataLoaded) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-16 text-center">
        Loading store administration data…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-10 md:px-8">
      <div className="mb-10 flex items-center justify-between border-b pb-4">
        <Link to="/" aria-label="5ADSH home">
          <Wordmark className="text-3xl md:text-4xl" />
        </Link>
        <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.2em]">
          Storefront
        </Link>
      </div>
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Admin
          </p>
          <h1 className="font-display text-5xl uppercase md:text-7xl">Dashboard</h1>
        </div>
        <div className="rounded border border-dashed px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
          {`Signed in as ${adminSession?.fullName}`}
        </div>
      </div>
      {actionError ? (
        <p className="mb-5 border border-red-500 p-3 text-sm text-red-600">{actionError}</p>
      ) : null}

      <div className="mb-6 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveTab(tab.key)}
            className={`border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] ${activeTab === tab.key ? "bg-primary text-primary-foreground" : ""}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {[
              ["Total revenue", `EGP ${metrics.revenue.toLocaleString("en-US")}`],
              ["Orders", metrics.orders],
              ["Pending", metrics.pending],
              ["Delivered", metrics.completed],
              ["Products", metrics.products],
              ["Low stock", metrics.lowStock],
              ["Customers", metrics.customers],
              ["Skus", products.length],
            ].map(([label, value]) => (
              <div key={String(label)} className="border bg-card p-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-3 font-display text-4xl uppercase">{String(value)}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="border p-5">
              <h2 className="mb-4 font-display text-3xl uppercase">Top performing products</h2>
              <div className="space-y-3">
                {products.slice(0, 4).map((product) => (
                  <div key={product.id} className="flex items-center justify-between border p-3">
                    <div>
                      <p className="font-medium uppercase">{product.name}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {product.category}
                      </p>
                    </div>
                    <span className="font-mono text-sm">
                      {product.variants.reduce((sum, variant) => sum + variant.stock, 0)} in stock
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="border p-5">
              <h2 className="mb-4 font-display text-3xl uppercase">Recent orders</h2>
              <div className="space-y-3">
                {orders
                  .slice(-5)
                  .reverse()
                  .map((order) => (
                    <div key={order.id} className="border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {order.id}
                          </p>
                          <p className="mt-1 uppercase">{order.status}</p>
                        </div>
                        <span className="font-mono text-sm">
                          EGP {Number(order.total).toLocaleString("en-US")}
                        </span>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "products" && (
        <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Product library</h2>
            <div className="space-y-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center justify-between gap-3 border p-3"
                >
                  <div>
                    <p className="font-medium uppercase">{product.name}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      {product.category} / {product.sizes.join(", ")}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => editProduct(product)}
                      className="border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteProduct(product.id)}
                      className="border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">
              {editingProductId ? "Edit product" : "Add product"}
            </h2>
            <div className="space-y-3">
              <input
                value={productDraft.name}
                onChange={(event) => setProductDraft({ ...productDraft, name: event.target.value })}
                placeholder="Name"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={productDraft.slug}
                onChange={(event) => setProductDraft({ ...productDraft, slug: event.target.value })}
                placeholder="Slug"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={productDraft.category}
                onChange={(event) =>
                  setProductDraft({ ...productDraft, category: event.target.value })
                }
                placeholder="Category"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={productDraft.price}
                onChange={(event) =>
                  setProductDraft({ ...productDraft, price: Number(event.target.value) || 0 })
                }
                placeholder="Price"
                type="number"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={productDraft.salePrice ?? 0}
                onChange={(event) =>
                  setProductDraft({
                    ...productDraft,
                    salePrice: Number(event.target.value) || undefined,
                  })
                }
                placeholder="Sale price"
                type="number"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <textarea
                value={productDraft.description}
                onChange={(event) =>
                  setProductDraft({ ...productDraft, description: event.target.value })
                }
                placeholder="Description"
                className="min-h-24 w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={productDraft.colors.join(", ")}
                onChange={(event) =>
                  setProductDraft((current) => {
                    const colors = event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean);
                    return {
                      ...current,
                      colors,
                      variants: current.sizes.flatMap((size) =>
                        colors.map((color) => ({
                          id:
                            current.variants.find(
                              (variant) => variant.size === size && variant.color === color,
                            )?.id ?? "",
                          size,
                          color,
                          stock:
                            current.variants.find(
                              (variant) => variant.size === size && variant.color === color,
                            )?.stock ?? 0,
                        })),
                      ),
                    };
                  })
                }
                placeholder="Colors (comma separated)"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={productDraft.sizes.join(", ")}
                onChange={(event) =>
                  setProductDraft((current) => {
                    const sizes = event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean);
                    return {
                      ...current,
                      sizes,
                      variants: sizes.flatMap((size) =>
                        current.colors.map((color) => ({
                          id:
                            current.variants.find(
                              (variant) => variant.size === size && variant.color === color,
                            )?.id ?? "",
                          size,
                          color,
                          stock:
                            current.variants.find(
                              (variant) => variant.size === size && variant.color === color,
                            )?.stock ?? 0,
                        })),
                      ),
                    };
                  })
                }
                placeholder="Sizes (comma separated)"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <div className="max-h-40 space-y-2 overflow-auto border p-3">
                {productDraft.variants.map((variant, index) => (
                  <label
                    key={`${variant.size}-${variant.color}`}
                    className="flex items-center justify-between gap-3 text-xs"
                  >
                    <span>
                      {variant.size} / {variant.color}
                    </span>
                    <input
                      type="number"
                      min="0"
                      value={variant.stock}
                      aria-label={`Stock for ${variant.size} ${variant.color}`}
                      onChange={(event) =>
                        setProductDraft((current) => ({
                          ...current,
                          variants: current.variants.map((entry, entryIndex) =>
                            entryIndex === index
                              ? { ...entry, stock: Math.max(0, Number(event.target.value) || 0) }
                              : entry,
                          ),
                        }))
                      }
                      className="w-24 border border-input bg-background px-2 py-1"
                    />
                  </label>
                ))}
              </div>
              <input
                value={productDraft.images.join(", ")}
                onChange={(event) =>
                  setProductDraft({
                    ...productDraft,
                    images: event.target.value
                      .split(",")
                      .map((value) => value.trim())
                      .filter(Boolean),
                  })
                }
                placeholder="Image URLs (comma separated)"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <label className="block border border-dashed p-3 font-mono text-[10px] uppercase tracking-[0.2em]">
                Upload product image
                <input
                  type="file"
                  accept="image/*"
                  className="mt-2 block w-full normal-case tracking-normal"
                  onChange={(event) => {
                    const file = event.target.files?.[0];
                    if (!file) return;
                    void runAction(async () => {
                      const url = await uploadProductImage(file, productDraft.name);
                      setProductDraft((current) => ({
                        ...current,
                        images: [...current.images, url],
                      }));
                      event.target.value = "";
                    });
                  }}
                />
              </label>
              <button
                type="button"
                onClick={saveProduct}
                className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                {editingProductId ? "Save changes" : "Create product"}
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "categories" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Store categories</h2>
            <div className="space-y-3">
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategoryDraft(category)}
                  className="block w-full border p-3 text-left"
                >
                  <span className="font-medium uppercase">{category.name}</span>
                  <span className="block font-mono text-[10px] text-muted-foreground">
                    {category.slug}
                  </span>
                </button>
              ))}
            </div>
          </div>
          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Edit category</h2>
            <div className="space-y-3">
              <input
                value={categoryDraft.name}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, name: event.target.value })
                }
                placeholder="Name"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={categoryDraft.slug}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, slug: event.target.value })
                }
                placeholder="Slug"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={categoryDraft.image}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, image: event.target.value })
                }
                placeholder="Image URL"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={categoryDraft.arabic}
                onChange={(event) =>
                  setCategoryDraft({ ...categoryDraft, arabic: event.target.value })
                }
                placeholder="Arabic label"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <button
                type="button"
                onClick={saveCategory}
                className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Save category
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "orders" && (
        <div className="border p-5">
          <h2 className="mb-4 font-display text-3xl uppercase">Order management</h2>
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="flex flex-col gap-3 border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {order.id}
                  </p>
                  <p className="mt-1 font-medium uppercase">{order.customer.fullName}</p>
                  <p className="text-xs text-muted-foreground">
                    EGP {Number(order.total).toLocaleString("en-US")}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <select
                    value={order.status}
                    onChange={(event) =>
                      updateOrderStatus(order.id, event.target.value as OrderRecord["status"])
                    }
                    className="border border-input bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
                  >
                    {["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"].map(
                      (status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ),
                    )}
                  </select>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "customers" && (
        <div className="border p-5">
          <h2 className="mb-4 font-display text-3xl uppercase">Customer access</h2>
          <div className="space-y-3">
            {customers.map((customer) => (
              <div
                key={customer.id}
                className="flex flex-col gap-3 border p-4 md:flex-row md:items-center md:justify-between"
              >
                <div>
                  <p className="font-medium uppercase">{customer.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {customer.email}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    className={`rounded-full border px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] ${customer.role === "admin" ? "bg-primary text-primary-foreground" : ""}`}
                  >
                    {customer.role}
                  </span>
                  {isOwner && customer.role !== "owner" ? (
                    <select
                      value={customer.role === "staff" ? "staff" : "customer"}
                      onChange={(event) =>
                        updateAssistantAccess(customer.id, event.target.value === "staff")
                      }
                      className="border border-input bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
                    >
                      <option value="customer">Customer</option>
                      <option value="staff">Assistant</option>
                    </select>
                  ) : null}
                </div>
                {isOwner && customer.role === "staff" ? (
                  <div className="flex flex-wrap gap-3 border-t pt-3 md:ml-auto md:max-w-xl md:justify-end">
                    {permissionLabels.map((permission) => (
                      <label key={permission.value} className="flex items-center gap-2 text-xs">
                        <input
                          type="checkbox"
                          checked={customer.permissions.includes(permission.value)}
                          onChange={(event) =>
                            updateAssistantPermissions(
                              customer.id,
                              event.target.checked
                                ? [...customer.permissions, permission.value]
                                : customer.permissions.filter(
                                    (value) => value !== permission.value,
                                  ),
                            )
                          }
                        />
                        {permission.label}
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "promos" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Promo codes</h2>
            <div className="space-y-3">
              {promos.map((promo) => (
                <div key={promo.id} className="border p-3">
                  <div className="flex justify-between gap-3">
                    <div>
                      <p className="font-medium uppercase">{promo.code}</p>
                      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                        {promo.type}
                      </p>
                    </div>
                    <span className="font-mono text-sm">
                      {promo.active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Add promo</h2>
            <div className="space-y-3">
              <input
                value={promoDraft.code}
                onChange={(event) =>
                  setPromoDraft({ ...promoDraft, code: event.target.value.toUpperCase() })
                }
                placeholder="Code"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <select
                value={promoDraft.type}
                onChange={(event) =>
                  setPromoDraft({ ...promoDraft, type: event.target.value as PromoCode["type"] })
                }
                className="w-full border border-input bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
              >
                <option value="percentage">Percentage</option>
                <option value="fixed">Fixed</option>
              </select>
              <input
                value={promoDraft.value}
                onChange={(event) =>
                  setPromoDraft({ ...promoDraft, value: Number(event.target.value) || 0 })
                }
                type="number"
                placeholder="Value"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={promoDraft.minOrder}
                onChange={(event) =>
                  setPromoDraft({ ...promoDraft, minOrder: Number(event.target.value) || 0 })
                }
                type="number"
                placeholder="Minimum order"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <textarea
                value={promoDraft.description}
                onChange={(event) =>
                  setPromoDraft({ ...promoDraft, description: event.target.value })
                }
                placeholder="Description"
                className="min-h-20 w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <button
                type="button"
                onClick={savePromo}
                className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Save promo
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === "content" && (
        <div className="border p-5">
          <h2 className="mb-4 font-display text-3xl uppercase">Homepage content</h2>
          <div className="grid gap-3 md:grid-cols-2">
            <input
              value={content.heroTitle}
              onChange={(event) => setContent({ ...content, heroTitle: event.target.value })}
              placeholder="Hero title"
              className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
            />
            <input
              value={content.heroSubtitle}
              onChange={(event) => setContent({ ...content, heroSubtitle: event.target.value })}
              placeholder="Hero subtitle"
              className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
            />
            <input
              value={content.primaryCta}
              onChange={(event) => setContent({ ...content, primaryCta: event.target.value })}
              placeholder="Primary CTA"
              className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
            />
            <input
              value={content.secondaryCta}
              onChange={(event) => setContent({ ...content, secondaryCta: event.target.value })}
              placeholder="Secondary CTA"
              className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
            />
            <input
              value={content.announcement}
              onChange={(event) => setContent({ ...content, announcement: event.target.value })}
              placeholder="Announcement bar"
              className="md:col-span-2 border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
            />
            <button
              type="button"
              onClick={saveContent}
              className="md:col-span-2 bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
            >
              Save homepage content
            </button>
          </div>
        </div>
      )}

      {activeTab === "settings" && (
        <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Store settings</h2>
            <div className="space-y-3">
              <input
                value={settings.supportEmail}
                onChange={(event) => setSettings({ ...settings, supportEmail: event.target.value })}
                placeholder="Support email"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={settings.shippingFreeThreshold}
                onChange={(event) =>
                  setSettings({
                    ...settings,
                    shippingFreeThreshold: Number(event.target.value) || 0,
                  })
                }
                type="number"
                placeholder="Free shipping threshold"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={settings.standardShipping}
                onChange={(event) =>
                  setSettings({ ...settings, standardShipping: Number(event.target.value) || 0 })
                }
                type="number"
                placeholder="Standard shipping"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <input
                value={settings.defaultCountry}
                onChange={(event) =>
                  setSettings({ ...settings, defaultCountry: event.target.value })
                }
                placeholder="Default country"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <button
                type="button"
                onClick={saveSettings}
                className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
              >
                Save settings
              </button>
            </div>
          </div>

          <div className="border p-5">
            <h2 className="mb-4 font-display text-3xl uppercase">Collections</h2>
            <div className="space-y-3">
              {collections.map((collection) => (
                <div key={collection.id} className="border p-3">
                  <p className="font-medium uppercase">{collection.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {collection.products.length} products
                  </p>
                </div>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <input
                value={collectionDraft.name}
                onChange={(event) =>
                  setCollectionDraft({ ...collectionDraft, name: event.target.value })
                }
                placeholder="Collection name"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <textarea
                value={collectionDraft.description}
                onChange={(event) =>
                  setCollectionDraft({ ...collectionDraft, description: event.target.value })
                }
                placeholder="Description"
                className="min-h-20 w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <div className="max-h-40 space-y-2 overflow-auto">
                {products.map((product) => (
                  <label key={product.id} className="flex items-center gap-2 text-xs">
                    <input
                      type="checkbox"
                      checked={collectionDraft.products.includes(product.id)}
                      onChange={(event) =>
                        setCollectionDraft({
                          ...collectionDraft,
                          products: event.target.checked
                            ? [...collectionDraft.products, product.id]
                            : collectionDraft.products.filter((id) => id !== product.id),
                        })
                      }
                    />
                    {product.name}
                  </label>
                ))}
              </div>
              <button
                type="button"
                onClick={saveCollection}
                className="w-full border px-5 py-3 font-mono text-xs uppercase tracking-[0.2em]"
              >
                Save collection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
