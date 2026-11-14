import { createFileRoute, Link, Outlet, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, LogOut, Pencil, Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Wordmark } from "@/components/Wordmark";
import { buildSalesReport } from "@/lib/admin-reports";
import { getUserFacingError } from "@/lib/user-messages";
import {
  getCurrentAdminSession,
  hasAdminAccess,
  inviteCustomerByEmail,
  signOutAdmin,
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
  deleteStoreCategory,
  deleteStoreCoupon,
  deleteStoreCustomer,
  loadAdminStore,
  saveHomepageContent,
  saveStoreCategory,
  saveStoreCollection,
  saveStoreCoupon,
  saveStoreProduct,
  saveStoreSettings,
  setAssistantAccess,
  setAssistantPermissions,
  updateStoreCustomerProfile,
  updateOrderDetails as updateStoreOrderDetails,
  updateOrderStatus as updateStoreOrderStatus,
  uploadProductImage,
  type AdminStoreData,
} from "@/lib/store-api";
import { parseTickerMessages } from "@/lib/storefront-state";

type AdminTab =
  | "overview"
  | "products"
  | "categories"
  | "orders"
  | "reports"
  | "customers"
  | "promos"
  | "content"
  | "settings";

type AdminEditor =
  "product" | "category" | "promo" | "customer" | "customer-invite" | "homepage" | null;

type AdminDetail = {
  type: "product" | "category" | "customer" | "promo" | "homepage";
  id?: string;
};

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
  audience: "all",
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

function toLocalDateTimeValue(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}

function AdminPagePanel({
  title,
  eyebrow,
  onBack,
  actions,
  children,
}: {
  title: string;
  eyebrow: string;
  onBack: () => void;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="admin-workspace-page">
      <div className="admin-workspace-heading">
        <button type="button" onClick={onBack} className="admin-back-link">
          <ArrowLeft className="h-4 w-4" />
          Back to table
        </button>
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
              {eyebrow}
            </p>
            <h2 className="mt-2 font-display text-4xl uppercase md:text-6xl">{title}</h2>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </div>
      </div>
      <div className="admin-workspace-body">{children}</div>
    </section>
  );
}

function DetailGrid({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return (
    <dl className="admin-detail-grid">
      {items.map(({ label, value }) => (
        <div key={label} className="admin-detail-card">
          <dt className="admin-detail-label">{label}</dt>
          <dd className="mt-2 break-words text-sm font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

export const Route = createFileRoute("/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return <Outlet />;
}

export function AdminPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<AdminTab>("overview");
  const [adminSession, setAdminSession] = useState<CustomerSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [dataLoaded, setDataLoaded] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [actionSuccess, setActionSuccess] = useState("");
  const [editor, setEditor] = useState<AdminEditor>(null);
  const [selectedDetail, setSelectedDetail] = useState<AdminDetail | null>(null);
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
  const [customerDraft, setCustomerDraft] = useState<CustomerProfile>({
    id: "",
    name: "",
    email: "",
    phone: "",
    role: "customer",
    permissions: [],
    status: "active",
  });
  const [customerInviteDraft, setCustomerInviteDraft] = useState({
    name: "",
    email: "",
    phone: "",
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
  const isOwner = adminSession?.role === "owner";

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
  const salesReport = useMemo(() => buildSalesReport(orders), [orders]);

  const runAction = async (action: () => Promise<void>) => {
    setActionError("");
    setActionSuccess("");
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
      setActionSuccess(editingProductId ? "Product changes saved." : "Product created.");
      setProductDraft(emptyProduct());
      setEditingProductId(null);
      setSelectedDetail(null);
      setEditor(null);
    });

  const editProduct = (product: StoreProduct) => {
    setEditingProductId(product.id);
    setProductDraft(product);
    setSelectedDetail(null);
    setEditor("product");
  };

  const editPromo = (promo: PromoCode) => {
    setPromoDraft(promo);
    setSelectedDetail(null);
    setEditor("promo");
  };

  const editCategory = (category: StoreCategory) => {
    setCategoryDraft(category);
    setSelectedDetail(null);
    setEditor("category");
  };

  const editCustomer = (customer: CustomerProfile) => {
    setCustomerDraft(customer);
    setSelectedDetail(null);
    setEditor("customer");
  };

  const editCollection = (collection: StoreCollection) => {
    setCollectionDraft(collection);
    setActiveTab("settings");
  };

  const deleteProduct = (productId: string) =>
    runAction(async () => {
      await archiveStoreProduct(productId);
      setProducts((current) => current.filter((product) => product.id !== productId));
      setSelectedDetail(null);
      setActionSuccess("Product removed from the storefront.");
    });

  const removeProduct = (product: StoreProduct) => {
    if (window.confirm(`Delete "${product.name}" from the storefront?`)) {
      void deleteProduct(product.id);
    }
  };

  const removeCategory = (category: StoreCategory) => {
    if (!window.confirm(`Delete the "${category.name}" category?`)) return;
    void runAction(async () => {
      await deleteStoreCategory(category.id);
      setCategories((current) => current.filter((entry) => entry.id !== category.id));
      setSelectedDetail(null);
      setActionSuccess("Category deleted.");
    });
  };

  const removePromo = (promo: PromoCode) => {
    if (!window.confirm(`Delete promo code "${promo.code}"?`)) return;
    void runAction(async () => {
      await deleteStoreCoupon(promo.id);
      setPromos((current) => current.filter((entry) => entry.id !== promo.id));
      setSelectedDetail(null);
      setActionSuccess("Promo code deleted.");
    });
  };

  const saveCustomer = () =>
    runAction(async () => {
      await updateStoreCustomerProfile(customerDraft.id, customerDraft);
      setCustomers((current) =>
        current.map((customer) => (customer.id === customerDraft.id ? customerDraft : customer)),
      );
      setActionSuccess("Customer details saved.");
      setSelectedDetail(null);
      setEditor(null);
    });

  const sendCustomerInvite = () =>
    runAction(async () => {
      await inviteCustomerByEmail({
        fullName: customerInviteDraft.name,
        email: customerInviteDraft.email,
        phone: customerInviteDraft.phone,
      });
      setCustomerInviteDraft({ name: "", email: "", phone: "" });
      setSelectedDetail(null);
      setEditor(null);
      setActionSuccess(`A sign-in link was sent to ${customerInviteDraft.email.trim()}.`);
    });

  const removeCustomer = (customer: CustomerProfile) => {
    if (customer.role !== "customer" || !isOwner) return;
    const confirmed = window.confirm(
      `Permanently delete ${customer.name}'s account? Order totals and items will be kept, but customer contact details will be anonymized.`,
    );
    if (!confirmed) return;
    void runAction(async () => {
      const affectedOrderIds = new Set(await deleteStoreCustomer(customer.id));
      setCustomers((current) => current.filter((entry) => entry.id !== customer.id));
      setSelectedDetail(null);
      setOrders((current) =>
        current.map((order) =>
          affectedOrderIds.has(order.id)
            ? {
                ...order,
                customer: {
                  ...order.customer,
                  fullName: "Deleted customer",
                  phone: "",
                  governorate: "",
                  city: "",
                  address: "",
                  notes: "",
                },
              }
            : order,
        ),
      );
      const refreshed = await loadAdminStore();
      setOrders(refreshed.orders);
      setActionSuccess("Customer account permanently deleted.");
    });
  };

  const updateOrderStatus = (orderId: string, status: OrderRecord["status"]) =>
    runAction(async () => {
      await updateStoreOrderStatus(orderId, status);
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, status } : order)),
      );
    });

  const updateOrderPaymentStatus = (orderId: string, paymentStatus: OrderRecord["paymentStatus"]) =>
    runAction(async () => {
      await updateStoreOrderDetails(orderId, { paymentStatus });
      setOrders((current) =>
        current.map((order) => (order.id === orderId ? { ...order, paymentStatus } : order)),
      );
    });

  const saveOrderTracking = (order: OrderRecord) =>
    runAction(() => updateStoreOrderDetails(order.id, { tracking: order.tracking }));

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
      if (!promoDraft.code.trim() || promoDraft.value <= 0 || promoDraft.minOrder < 0) {
        throw new Error("Enter a promo code, a positive value, and a non-negative minimum order.");
      }
      if (promoDraft.type === "percentage" && promoDraft.value > 100) {
        throw new Error("Percentage discounts cannot exceed 100%.");
      }
      const saved = await saveStoreCoupon(promoDraft);
      setPromos((current) =>
        current.some((promo) => promo.id === saved.id)
          ? current.map((promo) => (promo.id === saved.id ? saved : promo))
          : [saved, ...current],
      );
      setActionSuccess(promoDraft.id ? "Promo code updated." : "Promo code created.");
      setSelectedDetail(null);
      setEditor(null);
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
      setActionSuccess(categoryDraft.id ? "Category updated." : "Category created.");
      setCategoryDraft({ id: "", name: "", slug: "", image: "", arabic: "" });
      setSelectedDetail(null);
      setEditor(null);
    });

  const saveCollection = () =>
    runAction(async () => {
      if (!collectionDraft.name.trim()) {
        throw new Error("A collection name is required.");
      }
      const saved = await saveStoreCollection(collectionDraft);
      setCollections((current) =>
        current.some((collection) => collection.id === saved.id)
          ? current.map((collection) => (collection.id === saved.id ? saved : collection))
          : [saved, ...current],
      );
      setCollectionDraft({ id: "", name: "", description: "", products: [] });
    });

  const saveSettings = () => runAction(() => saveStoreSettings(settings));

  const saveContent = () =>
    runAction(async () => {
      await saveHomepageContent(content);
      setActionSuccess("Homepage content published.");
      setSelectedDetail(null);
      setEditor(null);
    });

  const uploadHomepageImage = (
    field: "heroImage" | "campaignImage",
    file: File,
    input: HTMLInputElement,
  ) =>
    runAction(async () => {
      const altText = field === "heroImage" ? "Homepage campaign hero" : "Homepage poster";
      const imageUrl = await uploadProductImage(file, altText);
      setContent((current) => ({ ...current, [field]: imageUrl }));
      input.value = "";
    });

  const handleSignOut = async () => {
    setActionError("");
    try {
      await signOutAdmin();
      navigate({ to: "/admin/login", replace: true });
    } catch (cause) {
      setActionError(getUserFacingError(cause, "Sign out failed. Please try again."));
    }
  };

  const hasPermission = (permission: StorePermission) =>
    isOwner || Boolean(adminSession?.permissions.includes(permission));
  const tabs = (
    [
      { key: "overview", label: "Overview" },
      { key: "products", label: "Products" },
      { key: "categories", label: "Categories" },
      { key: "customers", label: "Customers" },
      { key: "promos", label: "Promo codes" },
      { key: "content", label: "Homepage" },
      { key: "orders", label: "Orders" },
      { key: "reports", label: "Reports" },
      { key: "settings", label: "Settings" },
    ] as { key: AdminTab; label: string }[]
  ).filter(
    (tab) =>
      tab.key === "overview" ||
      (tab.key === "products" && hasPermission("manage_products")) ||
      (tab.key === "categories" && hasPermission("manage_products")) ||
      (tab.key === "orders" && hasPermission("manage_orders")) ||
      (tab.key === "reports" && hasPermission("manage_orders")) ||
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
    <div className="admin-dashboard mx-auto min-h-screen max-w-[1600px] px-4 py-6 md:px-8 md:py-10">
      <div className="mb-8 flex items-center justify-between border-b border-foreground/15 pb-4">
        <Link to="/" aria-label="5ADSH home">
          <Wordmark className="text-3xl md:text-4xl" />
        </Link>
        <div className="flex items-center gap-4">
          <Link to="/" className="font-mono text-[10px] uppercase tracking-[0.2em]">
            Storefront
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 border border-black bg-black px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-white transition-colors hover:bg-black/80"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </div>
      <div className="admin-hero relative mb-8 flex flex-col justify-between gap-5 border p-6 shadow-sm md:flex-row md:items-end md:p-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">
            Admin / Control room
          </p>
          <h1 className="mt-2 font-display text-5xl uppercase leading-none md:text-7xl">
            Dashboard
          </h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="border border-primary-foreground/30 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground/75">
            {`Signed in as ${adminSession?.fullName}`}
          </div>
        </div>
      </div>
      {actionError ? (
        <p className="mb-5 border border-red-500 p-3 text-sm text-red-600">{actionError}</p>
      ) : null}
      {actionSuccess ? (
        <p className="mb-5 border border-emerald-700/30 p-3 text-sm text-emerald-800">
          {actionSuccess}
        </p>
      ) : null}

      <div className="admin-tabs mb-8 flex flex-wrap gap-2 border-b border-foreground/15 pb-4">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => {
              setEditor(null);
              setSelectedDetail(null);
              setActiveTab(tab.key);
            }}
            aria-pressed={activeTab === tab.key}
            className={`border px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] ${activeTab === tab.key ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-foreground/15 bg-card text-muted-foreground hover:text-foreground"}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "overview" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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
              <div
                key={String(label)}
                className="admin-metric border border-foreground/10 bg-card p-5"
              >
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-4 font-display text-4xl uppercase md:text-5xl">{String(value)}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div className="admin-panel border border-foreground/10 bg-card p-5">
              <h2 className="mb-4 font-display text-3xl uppercase">Top performing products</h2>
              <div className="space-y-3">
                {products.slice(0, 4).map((product) => (
                  <div
                    key={product.id}
                    className="flex items-center justify-between border border-foreground/10 bg-background p-3 transition-colors hover:bg-muted"
                  >
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

            <div className="admin-panel border border-foreground/10 bg-card p-5">
              <h2 className="mb-4 font-display text-3xl uppercase">Recent orders</h2>
              <div className="space-y-3">
                {orders
                  .slice(-5)
                  .reverse()
                  .map((order) => (
                    <div
                      key={order.id}
                      className="border border-foreground/10 bg-background p-3 transition-colors hover:bg-muted"
                    >
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

      {activeTab === "reports" && (
        <section className="space-y-6">
          <div className="flex flex-col justify-between gap-3 border-b border-foreground/15 pb-5 sm:flex-row sm:items-end">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-muted-foreground">
                Store performance / Last 30 days
              </p>
              <h2 className="mt-2 font-display text-5xl uppercase md:text-7xl">Sales report</h2>
            </div>
            <span className="w-fit border border-foreground/15 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]">
              {salesReport.orders} non-cancelled orders
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              { label: "Sales", value: salesReport.sales, currency: true },
              { label: "Gross profit", value: salesReport.profit, currency: true },
              { label: "Orders tracked", value: salesReport.costTrackedOrders, currency: false },
              {
                label: "Missing cost data",
                value: salesReport.ordersWithoutCosts,
                currency: false,
              },
            ].map(({ label, value, currency }) => (
              <div key={label} className="admin-metric border border-foreground/10 bg-card p-5">
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  {label}
                </p>
                <p className="mt-4 font-display text-4xl uppercase md:text-5xl">
                  {currency ? `EGP ${value.toLocaleString("en-US")}` : value}
                </p>
              </div>
            ))}
          </div>

          <div className="border border-foreground/10 bg-card p-5 md:p-7">
            <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
              <div>
                <h3 className="font-display text-3xl uppercase">Sales & gross profit</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  Gross profit = order total minus saved product costs, before operating expenses.
                </p>
              </div>
              <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                EGP / day
              </span>
            </div>
            <div className="admin-chart h-[320px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart
                  data={salesReport.days}
                  margin={{ top: 8, right: 12, left: 8, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#d94b2b" stopOpacity={0.28} />
                      <stop offset="100%" stopColor="#d94b2b" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    vertical={false}
                    stroke="rgba(20,20,20,0.12)"
                    strokeDasharray="4 4"
                  />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    axisLine={false}
                    interval={4}
                    tick={{ fontSize: 10, fill: "#777" }}
                  />
                  <YAxis
                    width={76}
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 10, fill: "#777" }}
                    tickFormatter={(value: number) => `EGP ${value.toLocaleString("en-US")}`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      `EGP ${Number(value).toLocaleString("en-US")}`,
                      name,
                    ]}
                    contentStyle={{
                      borderRadius: 0,
                      border: "1px solid rgba(20,20,20,0.2)",
                      fontSize: 12,
                    }}
                  />
                  <Legend />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    name="Sales"
                    stroke="#d94b2b"
                    strokeWidth={2}
                    fill="url(#salesFill)"
                  />
                  <Line
                    type="monotone"
                    dataKey="profit"
                    name="Gross profit"
                    stroke="#181818"
                    strokeWidth={2}
                    dot={false}
                    connectNulls={false}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <p className="mt-4 border-l-2 border-[#d94b2b] pl-3 text-xs leading-relaxed text-muted-foreground">
              Profit is shown only for orders with a saved product-cost snapshot. Older orders and
              products without a cost price are excluded from profit, but remain in sales totals.
            </p>
          </div>
        </section>
      )}

      {activeTab === "products" && (
        <section className="space-y-5">
          {editor !== "product" && selectedDetail?.type !== "product" ? (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-foreground/15 pb-5 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Catalog / {products.length} items
                  </p>
                  <h2 className="mt-1 font-display text-4xl uppercase md:text-5xl">Products</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setProductDraft(emptyProduct());
                    setEditingProductId(null);
                    setSelectedDetail(null);
                    setEditor("product");
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add product
                </button>
              </div>

              <div className="overflow-x-auto border border-foreground/10 bg-card">
                <table className="admin-table w-full min-w-[760px] text-left">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Category</th>
                      <th>Price</th>
                      <th>Stock</th>
                      <th>Store flags</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((product) => (
                      <tr key={product.id}>
                        <td>
                          <div className="flex items-center gap-3">
                            {product.images[0] ? (
                              <img
                                src={product.images[0]}
                                alt=""
                                className="h-12 w-12 border object-cover"
                              />
                            ) : (
                              <div className="h-12 w-12 border bg-muted" />
                            )}
                            <div>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditor(null);
                                  setSelectedDetail({ type: "product", id: product.id });
                                }}
                                className="text-left font-medium uppercase decoration-primary underline-offset-4 hover:underline"
                              >
                                {product.name}
                              </button>
                              <p className="font-mono text-[10px] text-muted-foreground">
                                {product.sku}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td>{product.category}</td>
                        <td className="font-mono">EGP {product.price.toLocaleString("en-US")}</td>
                        <td className="font-mono">
                          {product.variants.reduce((sum, variant) => sum + variant.stock, 0)}
                        </td>
                        <td>
                          {[product.newArrival && "New drop", product.featured && "Featured"]
                            .filter(Boolean)
                            .join(" · ") || "—"}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editProduct(product)}
                              className="inline-flex items-center gap-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em]"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeProduct(product)}
                              className="inline-flex items-center gap-1 border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {products.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No products yet. Use Add product to create the first one.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {selectedDetail?.type === "product"
            ? (() => {
                const product = products.find((entry) => entry.id === selectedDetail.id);
                if (!product) return null;
                return (
                  <AdminPagePanel
                    eyebrow={`Catalog / ${product.sku}`}
                    title={product.name}
                    onBack={() => setSelectedDetail(null)}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => editProduct(product)}
                          className="inline-flex items-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit product
                        </button>
                        <button
                          type="button"
                          onClick={() => removeProduct(product)}
                          className="inline-flex items-center gap-2 border border-red-500/40 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </>
                    }
                  >
                    <div className="grid gap-8 xl:grid-cols-[0.85fr_1.15fr]">
                      <div className="space-y-4">
                        {product.images[0] ? (
                          <img
                            src={product.images[0]}
                            alt={product.name}
                            className="aspect-[4/5] w-full border border-foreground/10 object-cover"
                          />
                        ) : (
                          <div className="aspect-[4/5] w-full border border-foreground/10 bg-muted" />
                        )}
                        {product.images.length > 1 ? (
                          <div className="grid grid-cols-4 gap-2">
                            {product.images.slice(1).map((image, index) => (
                              <img
                                key={`${image}-${index}`}
                                src={image}
                                alt={`${product.name} image ${index + 2}`}
                                className="aspect-square w-full border border-foreground/10 object-cover"
                              />
                            ))}
                          </div>
                        ) : null}
                      </div>
                      <div className="space-y-6">
                        <DetailGrid
                          items={[
                            { label: "SKU", value: product.sku },
                            { label: "Slug", value: product.slug },
                            { label: "Category", value: product.category },
                            { label: "Subcategory", value: product.subcategory },
                            { label: "Audience", value: product.audience ?? "all" },
                            {
                              label: "Price",
                              value: `EGP ${product.price.toLocaleString("en-US")}`,
                            },
                            {
                              label: "Sale price",
                              value:
                                product.salePrice && product.salePrice > 0
                                  ? `EGP ${product.salePrice.toLocaleString("en-US")}`
                                  : "Not on sale",
                            },
                            {
                              label: "Unit cost",
                              value:
                                product.costPrice == null
                                  ? "Not set"
                                  : `EGP ${product.costPrice.toLocaleString("en-US")}`,
                            },
                            { label: "Badge", value: product.badge || "—" },
                            { label: "Colors", value: product.colors.join(", ") || "—" },
                            { label: "Sizes", value: product.sizes.join(", ") || "—" },
                            {
                              label: "Storefront flags",
                              value:
                                [
                                  product.newArrival && "New drop",
                                  product.featured && "Featured",
                                  product.bestSeller && "Best seller",
                                ]
                                  .filter(Boolean)
                                  .join(" · ") || "None",
                            },
                          ]}
                        />
                        <section className="admin-detail-card">
                          <p className="admin-detail-label">Description</p>
                          <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/75">
                            {product.description || "No description entered."}
                          </p>
                        </section>
                      </div>
                    </div>
                    <section className="admin-detail-card mt-8">
                      <div className="mb-4 flex items-end justify-between gap-4">
                        <div>
                          <p className="admin-detail-label">Inventory</p>
                          <h3 className="mt-1 font-display text-2xl uppercase">Variant stock</h3>
                        </div>
                        <span className="font-mono text-xs text-muted-foreground">
                          {product.variants.reduce((sum, variant) => sum + variant.stock, 0)} total
                        </span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="admin-table w-full min-w-[400px] text-left">
                          <thead>
                            <tr>
                              <th>Size</th>
                              <th>Color</th>
                              <th>Stock</th>
                            </tr>
                          </thead>
                          <tbody>
                            {product.variants.map((variant) => (
                              <tr key={variant.id || `${variant.size}-${variant.color}`}>
                                <td>{variant.size}</td>
                                <td>{variant.color}</td>
                                <td className="font-mono">{variant.stock}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </section>
                  </AdminPagePanel>
                );
              })()
            : null}

          {editor === "product" ? (
            <AdminPagePanel
              eyebrow={editingProductId ? "Catalog / Edit record" : "Catalog / New record"}
              title={editingProductId ? "Edit product" : "Add product"}
              onBack={() => setEditor(null)}
            >
              <div className="space-y-3">
                <input
                  value={productDraft.name}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, name: event.target.value })
                  }
                  placeholder="Name"
                  className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                />
                <input
                  value={productDraft.slug}
                  onChange={(event) =>
                    setProductDraft({ ...productDraft, slug: event.target.value })
                  }
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
                <label className="block space-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                  Storefront audience
                  <select
                    value={productDraft.audience ?? "all"}
                    onChange={(event) =>
                      setProductDraft({
                        ...productDraft,
                        audience: event.target.value as NonNullable<StoreProduct["audience"]>,
                      })
                    }
                    className="w-full border border-input bg-background px-3 py-3 text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <option value="all">All audiences</option>
                    <option value="men">Men</option>
                    <option value="women">Women</option>
                    <option value="kids">Kids</option>
                  </select>
                </label>
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
                <input
                  type="number"
                  min="0"
                  value={productDraft.costPrice ?? ""}
                  onChange={(event) =>
                    setProductDraft((current) => {
                      const next = { ...current };
                      if (event.target.value === "") delete next.costPrice;
                      else next.costPrice = Math.max(0, Number(event.target.value));
                      return next;
                    })
                  }
                  placeholder="Unit cost (for profit reports)"
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
                <div className="grid gap-2 border p-3 sm:grid-cols-3">
                  {(
                    [
                      ["newArrival", "Show in New Drops"],
                      ["featured", "Feature product"],
                      ["bestSeller", "Best seller"],
                    ] as const
                  ).map(([field, label]) => (
                    <label
                      key={field}
                      className="flex items-center gap-2 font-mono text-[10px] uppercase"
                    >
                      <input
                        type="checkbox"
                        checked={Boolean(
                          productDraft[field as "newArrival" | "featured" | "bestSeller"],
                        )}
                        onChange={(event) =>
                          setProductDraft({
                            ...productDraft,
                            [field]: event.target.checked,
                          })
                        }
                      />
                      {label}
                    </label>
                  ))}
                </div>
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
                {productDraft.images.length > 0 ? (
                  <div className="grid grid-cols-3 gap-2">
                    {productDraft.images.map((image, index) => (
                      <button
                        key={`${image}-${index}`}
                        type="button"
                        onClick={() =>
                          setProductDraft({
                            ...productDraft,
                            images: productDraft.images.filter(
                              (_, imageIndex) => imageIndex !== index,
                            ),
                          })
                        }
                        className="group relative aspect-square overflow-hidden border"
                        aria-label={`Remove product image ${index + 1}`}
                      >
                        <img src={image} alt="" className="h-full w-full object-cover" />
                        <span className="absolute inset-x-0 bottom-0 bg-black/75 py-1 font-mono text-[9px] uppercase text-white opacity-0 transition group-hover:opacity-100">
                          Remove
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
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
            </AdminPagePanel>
          ) : null}
        </section>
      )}

      {activeTab === "categories" && (
        <section className="space-y-5">
          {editor !== "category" && selectedDetail?.type !== "category" ? (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-foreground/15 pb-5 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Catalog / {categories.length} items
                  </p>
                  <h2 className="mt-1 font-display text-4xl uppercase md:text-5xl">Categories</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCategoryDraft({ id: "", name: "", slug: "", image: "", arabic: "" });
                    setSelectedDetail(null);
                    setEditor("category");
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add category
                </button>
              </div>
              <div className="overflow-x-auto border border-foreground/10 bg-card">
                <table className="admin-table w-full min-w-[640px] text-left">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Slug</th>
                      <th>Arabic label</th>
                      <th>Image</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {categories.map((category) => (
                      <tr key={category.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setEditor(null);
                              setSelectedDetail({ type: "category", id: category.id });
                            }}
                            className="text-left font-medium uppercase decoration-primary underline-offset-4 hover:underline"
                          >
                            {category.name}
                          </button>
                        </td>
                        <td className="font-mono text-xs">{category.slug}</td>
                        <td dir="rtl">{category.arabic || "—"}</td>
                        <td>{category.image ? "Image set" : "—"}</td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editCategory(category)}
                              className="inline-flex items-center gap-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em]"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCategory(category)}
                              className="inline-flex items-center gap-1 border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {categories.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No categories yet. Add one to organize your products.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {selectedDetail?.type === "category"
            ? (() => {
                const category = categories.find((entry) => entry.id === selectedDetail.id);
                if (!category) return null;
                const categoryProducts = products.filter(
                  (product) => product.category.toLowerCase() === category.name.toLowerCase(),
                );
                return (
                  <AdminPagePanel
                    eyebrow={`Catalog / ${categoryProducts.length} products`}
                    title={category.name}
                    onBack={() => setSelectedDetail(null)}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => editCategory(category)}
                          className="inline-flex items-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit category
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCategory(category)}
                          className="inline-flex items-center gap-2 border border-red-500/40 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </>
                    }
                  >
                    <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr]">
                      <div className="space-y-4">
                        {category.image ? (
                          <img
                            src={category.image}
                            alt={category.name}
                            className="aspect-[4/3] w-full border border-foreground/10 object-cover"
                          />
                        ) : (
                          <div className="aspect-[4/3] w-full border border-foreground/10 bg-muted" />
                        )}
                        <DetailGrid
                          items={[
                            { label: "Category name", value: category.name },
                            { label: "Slug", value: category.slug },
                            { label: "Arabic label", value: category.arabic || "—" },
                            { label: "Products", value: categoryProducts.length },
                          ]}
                        />
                      </div>
                      <section className="admin-detail-card">
                        <div className="mb-4 flex items-end justify-between gap-4">
                          <div>
                            <p className="admin-detail-label">Category inventory</p>
                            <h3 className="mt-1 font-display text-2xl uppercase">
                              Products in category
                            </h3>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setActiveTab("products");
                              setProductDraft({ ...emptyProduct(), category: category.name });
                              setEditingProductId(null);
                              setSelectedDetail(null);
                              setEditor("product");
                            }}
                            className="inline-flex items-center gap-2 border px-3 py-2 font-mono text-[10px] uppercase"
                          >
                            <Plus className="h-3 w-3" />
                            Add product
                          </button>
                        </div>
                        {categoryProducts.length ? (
                          <div className="space-y-2">
                            {categoryProducts.map((product) => (
                              <button
                                key={product.id}
                                type="button"
                                onClick={() => {
                                  setActiveTab("products");
                                  setSelectedDetail({ type: "product", id: product.id });
                                }}
                                className="flex w-full items-center justify-between border border-foreground/10 bg-background p-3 text-left hover:border-primary/50"
                              >
                                <span className="font-medium uppercase">{product.name}</span>
                                <span className="font-mono text-xs text-muted-foreground">
                                  EGP {product.price.toLocaleString("en-US")}
                                </span>
                              </button>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">
                            No products currently use this category.
                          </p>
                        )}
                      </section>
                    </div>
                  </AdminPagePanel>
                );
              })()
            : null}
          {editor === "category" ? (
            <AdminPagePanel
              eyebrow={categoryDraft.id ? "Catalog / Edit record" : "Catalog / New record"}
              title={categoryDraft.id ? "Edit category" : "Add category"}
              onBack={() => setEditor(null)}
            >
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
                  {categoryDraft.id ? "Save category" : "Create category"}
                </button>
              </div>
            </AdminPagePanel>
          ) : null}
        </section>
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
                    {order.customer.phone} · {order.customer.city}, {order.customer.governorate}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    EGP {Number(order.total).toLocaleString("en-US")}
                  </p>
                  <ul className="mt-2 space-y-1 text-xs">
                    {order.items.map((item) => (
                      <li key={item.id}>
                        {item.quantity} × {item.name} · {item.size} / {item.color}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="flex flex-wrap items-center gap-3">
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
                  <label className="font-mono text-[10px] uppercase tracking-[0.2em]">
                    Payment
                    <select
                      value={order.paymentStatus}
                      onChange={(event) =>
                        updateOrderPaymentStatus(
                          order.id,
                          event.target.value as OrderRecord["paymentStatus"],
                        )
                      }
                      className="ml-2 border border-input bg-background px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em] outline-none"
                    >
                      {["Pending", "Completed", "Failed"].map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                    Tracking
                    <input
                      value={order.tracking}
                      onChange={(event) =>
                        setOrders((current) =>
                          current.map((entry) =>
                            entry.id === order.id
                              ? { ...entry, tracking: event.target.value }
                              : entry,
                          ),
                        )
                      }
                      className="w-40 border border-input bg-background px-2 py-2 font-sans text-xs normal-case tracking-normal"
                    />
                    <button
                      type="button"
                      onClick={() => saveOrderTracking(order)}
                      className="border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.2em]"
                    >
                      Save
                    </button>
                  </label>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "customers" && (
        <section className="space-y-5">
          {editor !== "customer" &&
          editor !== "customer-invite" &&
          selectedDetail?.type !== "customer" ? (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-foreground/15 pb-5 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Accounts / {customers.length} profiles
                  </p>
                  <h2 className="mt-1 font-display text-4xl uppercase md:text-5xl">Customers</h2>
                </div>
                {isOwner ? (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomerInviteDraft({ name: "", email: "", phone: "" });
                      setSelectedDetail(null);
                      setEditor("customer-invite");
                    }}
                    className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
                  >
                    <Plus className="h-4 w-4" />
                    Add customer
                  </button>
                ) : null}
              </div>
              <div className="overflow-x-auto border border-foreground/10 bg-card">
                <table className="admin-table w-full min-w-[980px] text-left">
                  <thead>
                    <tr>
                      <th>Customer</th>
                      <th>Phone</th>
                      <th>Account access</th>
                      <th>Assistant permissions</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {customers.map((customer) => (
                      <tr key={customer.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setEditor(null);
                              setSelectedDetail({ type: "customer", id: customer.id });
                            }}
                            className="text-left"
                          >
                            <span className="block font-medium uppercase decoration-primary underline-offset-4 hover:underline">
                              {customer.name || "Unnamed customer"}
                            </span>
                            <span className="font-mono text-[10px] text-muted-foreground">
                              {customer.email}
                            </span>
                          </button>
                        </td>
                        <td className="font-mono text-xs">{customer.phone || "—"}</td>
                        <td>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="border px-2 py-1 font-mono text-[10px] uppercase">
                              {customer.role}
                            </span>
                            {isOwner && ["customer", "staff"].includes(customer.role) ? (
                              <select
                                value={customer.role === "staff" ? "staff" : "customer"}
                                onChange={(event) =>
                                  updateAssistantAccess(customer.id, event.target.value === "staff")
                                }
                                aria-label={`Access for ${customer.name}`}
                                className="border border-input bg-background px-2 py-1 font-mono text-[10px] uppercase"
                              >
                                <option value="customer">Customer</option>
                                <option value="staff">Assistant</option>
                              </select>
                            ) : null}
                          </div>
                        </td>
                        <td>
                          {isOwner && customer.role === "staff" ? (
                            <div className="flex max-w-[390px] flex-wrap gap-x-3 gap-y-2">
                              {permissionLabels.map((permission) => (
                                <label
                                  key={permission.value}
                                  className="flex items-center gap-1 text-[11px]"
                                >
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
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              {customer.role === "staff" ? "No permissions" : "—"}
                            </span>
                          )}
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editCustomer(customer)}
                              disabled={!isOwner || customer.role === "owner"}
                              className="inline-flex items-center gap-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] disabled:opacity-40"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removeCustomer(customer)}
                              disabled={!isOwner || customer.role !== "customer"}
                              title={
                                customer.role === "customer"
                                  ? "Permanently delete customer"
                                  : "Only customer accounts can be deleted here"
                              }
                              className="inline-flex items-center gap-1 border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700 disabled:opacity-40"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {customers.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm text-muted-foreground">
                          No customer accounts yet. Add one to send a secure sign-in link.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}

          {selectedDetail?.type === "customer"
            ? (() => {
                const customer = customers.find((entry) => entry.id === selectedDetail.id);
                if (!customer) return null;
                return (
                  <AdminPagePanel
                    eyebrow={`Accounts / ${customer.role}`}
                    title={customer.name || "Customer profile"}
                    onBack={() => setSelectedDetail(null)}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => editCustomer(customer)}
                          disabled={!isOwner || customer.role === "owner"}
                          className="inline-flex items-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground disabled:opacity-40"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit customer
                        </button>
                        <button
                          type="button"
                          onClick={() => removeCustomer(customer)}
                          disabled={!isOwner || customer.role !== "customer"}
                          className="inline-flex items-center gap-2 border border-red-500/40 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700 disabled:opacity-40"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </>
                    }
                  >
                    <div className="max-w-4xl">
                      <DetailGrid
                        items={[
                          { label: "Full name", value: customer.name || "Unnamed customer" },
                          { label: "Email", value: customer.email || "—" },
                          { label: "Phone", value: customer.phone || "—" },
                          { label: "Account role", value: customer.role },
                          { label: "Account status", value: customer.status },
                          {
                            label: "Permissions",
                            value: customer.permissions.length
                              ? customer.permissions
                                  .map(
                                    (permission) =>
                                      permissionLabels.find((entry) => entry.value === permission)
                                        ?.label ?? permission,
                                  )
                                  .join(", ")
                              : "No additional permissions",
                          },
                        ]}
                      />
                      {customer.role === "staff" ? (
                        <section className="admin-detail-card mt-6">
                          <p className="admin-detail-label">Staff access</p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            {customer.permissions.length ? (
                              customer.permissions.map((permission) => (
                                <span
                                  key={permission}
                                  className="border border-primary/30 bg-primary/5 px-3 py-2 font-mono text-[10px] uppercase"
                                >
                                  {permissionLabels.find((entry) => entry.value === permission)
                                    ?.label ?? permission}
                                </span>
                              ))
                            ) : (
                              <span className="text-sm text-muted-foreground">
                                No admin permissions assigned.
                              </span>
                            )}
                          </div>
                        </section>
                      ) : null}
                    </div>
                  </AdminPagePanel>
                );
              })()
            : null}

          {editor === "customer" ? (
            <AdminPagePanel
              eyebrow="Accounts / Edit record"
              title="Edit customer"
              onBack={() => setEditor(null)}
            >
              <div className="space-y-4">
                <label className="block space-y-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                  Full name
                  <input
                    value={customerDraft.name}
                    onChange={(event) =>
                      setCustomerDraft({ ...customerDraft, name: event.target.value })
                    }
                    className="w-full border border-input bg-background px-3 py-3 font-sans text-sm normal-case tracking-normal"
                  />
                </label>
                <label className="block space-y-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                  Email
                  <input
                    value={customerDraft.email}
                    readOnly
                    className="w-full border border-input bg-muted px-3 py-3 font-sans text-sm normal-case tracking-normal"
                  />
                  <span className="block font-sans text-xs normal-case tracking-normal text-muted-foreground">
                    Email changes are handled through the account verification flow.
                  </span>
                </label>
                <label className="block space-y-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                  Phone
                  <input
                    value={customerDraft.phone}
                    onChange={(event) =>
                      setCustomerDraft({ ...customerDraft, phone: event.target.value })
                    }
                    className="w-full border border-input bg-background px-3 py-3 font-sans text-sm normal-case tracking-normal"
                  />
                </label>
                <button
                  type="button"
                  onClick={saveCustomer}
                  className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
                >
                  Save customer
                </button>
              </div>
            </AdminPagePanel>
          ) : null}

          {editor === "customer-invite" ? (
            <AdminPagePanel
              eyebrow="Accounts / New record"
              title="Add customer"
              onBack={() => setEditor(null)}
            >
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Send a one-time sign-in link. New email addresses get a customer account; existing
                  accounts receive a sign-in link. Your admin session stays signed in.
                </p>
                <input
                  value={customerInviteDraft.name}
                  onChange={(event) =>
                    setCustomerInviteDraft({ ...customerInviteDraft, name: event.target.value })
                  }
                  placeholder="Full name"
                  className="w-full border border-input bg-background px-3 py-3 text-sm"
                />
                <input
                  type="email"
                  value={customerInviteDraft.email}
                  onChange={(event) =>
                    setCustomerInviteDraft({ ...customerInviteDraft, email: event.target.value })
                  }
                  placeholder="Email address"
                  className="w-full border border-input bg-background px-3 py-3 text-sm"
                />
                <input
                  value={customerInviteDraft.phone}
                  onChange={(event) =>
                    setCustomerInviteDraft({ ...customerInviteDraft, phone: event.target.value })
                  }
                  placeholder="Phone number"
                  className="w-full border border-input bg-background px-3 py-3 text-sm"
                />
                <button
                  type="button"
                  onClick={sendCustomerInvite}
                  className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
                >
                  Send sign-in link
                </button>
              </div>
            </AdminPagePanel>
          ) : null}
        </section>
      )}

      {activeTab === "promos" && (
        <section className="space-y-5">
          {editor !== "promo" && selectedDetail?.type !== "promo" ? (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-foreground/15 pb-5 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Offers / {promos.length} codes
                  </p>
                  <h2 className="mt-1 font-display text-4xl uppercase md:text-5xl">Promo codes</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
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
                    setSelectedDetail(null);
                    setEditor("promo");
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add promo
                </button>
              </div>
              <div className="overflow-x-auto border border-foreground/10 bg-card">
                <table className="admin-table w-full min-w-[780px] text-left">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>Discount</th>
                      <th>Minimum order</th>
                      <th>Expiry</th>
                      <th>Status</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {promos.map((promo) => (
                      <tr key={promo.id}>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              setEditor(null);
                              setSelectedDetail({ type: "promo", id: promo.id });
                            }}
                            className="text-left font-medium uppercase decoration-primary underline-offset-4 hover:underline"
                          >
                            {promo.code}
                          </button>
                        </td>
                        <td className="font-mono">
                          {promo.type === "percentage" ? `${promo.value}%` : `EGP ${promo.value}`}
                        </td>
                        <td className="font-mono">EGP {promo.minOrder.toLocaleString("en-US")}</td>
                        <td className="text-xs">
                          {promo.expiresAt
                            ? new Date(promo.expiresAt).toLocaleDateString()
                            : "No expiry"}
                        </td>
                        <td>
                          <span
                            className={`border px-2 py-1 font-mono text-[10px] uppercase ${promo.active ? "border-emerald-700/30 text-emerald-800" : "border-foreground/20 text-muted-foreground"}`}
                          >
                            {promo.active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => editPromo(promo)}
                              className="inline-flex items-center gap-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em]"
                            >
                              <Pencil className="h-3 w-3" />
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => removePromo(promo)}
                              className="inline-flex items-center gap-1 border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                            >
                              <Trash2 className="h-3 w-3" />
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {promos.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 text-center text-sm text-muted-foreground">
                          No promo codes yet. Add one to create your first offer.
                        </td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {selectedDetail?.type === "promo"
            ? (() => {
                const promo = promos.find((entry) => entry.id === selectedDetail.id);
                if (!promo) return null;
                return (
                  <AdminPagePanel
                    eyebrow={`Offers / ${promo.active ? "Active" : "Inactive"}`}
                    title={promo.code}
                    onBack={() => setSelectedDetail(null)}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => editPromo(promo)}
                          className="inline-flex items-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit promo
                        </button>
                        <button
                          type="button"
                          onClick={() => removePromo(promo)}
                          className="inline-flex items-center gap-2 border border-red-500/40 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                        >
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </button>
                      </>
                    }
                  >
                    <div className="max-w-4xl">
                      <DetailGrid
                        items={[
                          {
                            label: "Discount",
                            value:
                              promo.type === "percentage"
                                ? `${promo.value}%`
                                : `EGP ${promo.value.toLocaleString("en-US")}`,
                          },
                          {
                            label: "Minimum order",
                            value: `EGP ${promo.minOrder.toLocaleString("en-US")}`,
                          },
                          {
                            label: "Expires",
                            value: promo.expiresAt
                              ? new Date(promo.expiresAt).toLocaleString()
                              : "No expiry",
                          },
                          { label: "Status", value: promo.active ? "Active" : "Inactive" },
                          { label: "Code type", value: promo.type },
                        ]}
                      />
                      <section className="admin-detail-card mt-6">
                        <p className="admin-detail-label">Description</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-foreground/75">
                          {promo.description || "No description entered."}
                        </p>
                      </section>
                    </div>
                  </AdminPagePanel>
                );
              })()
            : null}

          {editor === "promo" ? (
            <AdminPagePanel
              eyebrow={promoDraft.id ? "Offers / Edit record" : "Offers / New record"}
              title={promoDraft.id ? "Edit promo" : "Add promo"}
              onBack={() => setEditor(null)}
            >
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
                <label className="block font-mono text-[10px] uppercase tracking-[0.2em]">
                  Expires at
                  <input
                    type="datetime-local"
                    value={toLocalDateTimeValue(promoDraft.expiresAt)}
                    onChange={(event) =>
                      setPromoDraft({
                        ...promoDraft,
                        expiresAt: event.target.value
                          ? new Date(event.target.value).toISOString()
                          : "",
                      })
                    }
                    className="mt-2 w-full border border-input bg-background px-3 py-2 font-sans text-sm normal-case tracking-normal"
                  />
                </label>
                <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                  <input
                    type="checkbox"
                    checked={promoDraft.active}
                    onChange={(event) =>
                      setPromoDraft({ ...promoDraft, active: event.target.checked })
                    }
                  />
                  Promo is active
                </label>
                <button
                  type="button"
                  onClick={savePromo}
                  className="w-full bg-primary px-5 py-3 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
                >
                  {promoDraft.id ? "Save promo changes" : "Create promo"}
                </button>
              </div>
            </AdminPagePanel>
          ) : null}
        </section>
      )}

      {activeTab === "content" && (
        <section className="space-y-5">
          {editor !== "homepage" && selectedDetail?.type !== "homepage" ? (
            <>
              <div className="flex flex-col justify-between gap-4 border-b border-foreground/15 pb-5 sm:flex-row sm:items-end">
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    Storefront / 1 content record
                  </p>
                  <h2 className="mt-1 font-display text-4xl uppercase md:text-5xl">Homepage</h2>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDetail(null);
                    setEditor("homepage");
                  }}
                  className="inline-flex items-center justify-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.2em] text-primary-foreground"
                >
                  <Pencil className="h-4 w-4" />
                  Edit homepage
                </button>
              </div>
              <div className="overflow-x-auto border border-foreground/10 bg-card">
                <table className="admin-table w-full min-w-[720px] text-left">
                  <thead>
                    <tr>
                      <th>Content record</th>
                      <th>Hero</th>
                      <th>Campaign poster</th>
                      <th>Announcements</th>
                      <th className="text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <button
                          type="button"
                          onClick={() => {
                            setEditor(null);
                            setSelectedDetail({ type: "homepage" });
                          }}
                          className="text-left font-medium uppercase decoration-primary underline-offset-4 hover:underline"
                        >
                          Homepage content
                        </button>
                      </td>
                      <td>{content.heroTitle || "Default hero"}</td>
                      <td>{content.campaignTitle || "Default campaign"}</td>
                      <td>{content.tickerMessages.length} scrolling messages</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              setEditor(null);
                              setSelectedDetail({ type: "homepage" });
                            }}
                            className="inline-flex items-center gap-1 border px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em]"
                          >
                            <Pencil className="h-3 w-3" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              if (!window.confirm("Reset homepage content to the store defaults?"))
                                return;
                              void runAction(async () => {
                                await saveHomepageContent(homepageContent);
                                setContent(homepageContent);
                                setActionSuccess("Homepage content reset to the store defaults.");
                              });
                            }}
                            className="inline-flex items-center gap-1 border border-red-500/40 px-3 py-2 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                          >
                            <Trash2 className="h-3 w-3" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </>
          ) : null}
          {selectedDetail?.type === "homepage" ? (
            <AdminPagePanel
              eyebrow="Storefront / Homepage content"
              title="Homepage"
              onBack={() => setSelectedDetail(null)}
              actions={
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedDetail(null);
                      setEditor("homepage");
                    }}
                    className="inline-flex items-center gap-2 bg-primary px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-primary-foreground"
                  >
                    <Pencil className="h-4 w-4" />
                    Edit content
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (!window.confirm("Reset homepage content to the store defaults?")) return;
                      void runAction(async () => {
                        await saveHomepageContent(homepageContent);
                        setContent(homepageContent);
                        setSelectedDetail(null);
                        setActionSuccess("Homepage content reset to the store defaults.");
                      });
                    }}
                    className="inline-flex items-center gap-2 border border-red-500/40 px-4 py-3 font-mono text-[10px] uppercase tracking-[0.15em] text-red-700"
                  >
                    <Trash2 className="h-4 w-4" />
                    Reset content
                  </button>
                </>
              }
            >
              <div className="grid gap-8 xl:grid-cols-2">
                <section className="admin-detail-card">
                  <p className="admin-detail-label">Hero</p>
                  <h3 className="mt-2 font-display text-3xl uppercase">
                    {content.heroTitle || "Default hero"}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/65">
                    {content.heroSubtitle || "No subtitle entered."}
                  </p>
                  <div className="mt-5 grid grid-cols-2 gap-3">
                    {[
                      ["Primary CTA", content.primaryCta],
                      ["Secondary CTA", content.secondaryCta],
                    ].map(([label, value]) => (
                      <div key={label} className="border border-foreground/10 p-3">
                        <p className="admin-detail-label">{label}</p>
                        <p className="mt-2 text-sm">{value || "—"}</p>
                      </div>
                    ))}
                  </div>
                  {content.heroImage ? (
                    <img
                      src={content.heroImage}
                      alt="Homepage hero"
                      className="mt-5 aspect-[16/7] w-full border object-cover"
                    />
                  ) : null}
                </section>
                <section className="admin-detail-card">
                  <p className="admin-detail-label">Featured campaign</p>
                  <p className="mt-2 font-mono text-xs uppercase text-primary">
                    {content.campaignEyebrow || "No campaign label"}
                  </p>
                  <h3 className="mt-2 font-display text-3xl uppercase">
                    {content.campaignTitle || "Default campaign"}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/65">
                    {content.campaignDescription || "No campaign description entered."}
                  </p>
                  <DetailGrid
                    items={[
                      { label: "Button label", value: content.campaignCta || "—" },
                      {
                        label: "Featured product",
                        value:
                          products.find((product) => product.id === content.campaignProductId)
                            ?.name ?? "First New Drop",
                      },
                    ]}
                  />
                  {content.campaignImage ? (
                    <img
                      src={content.campaignImage}
                      alt="Featured campaign poster"
                      className="mt-5 aspect-[16/7] w-full border object-cover"
                    />
                  ) : null}
                </section>
                <section className="admin-detail-card xl:col-span-2">
                  <p className="admin-detail-label">Announcements</p>
                  <p className="mt-2 text-sm">{content.announcement || "No announcement bar."}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {content.tickerMessages.length ? (
                      content.tickerMessages.map((message, index) => (
                        <span
                          key={`${index}-${message}`}
                          className="border border-foreground/10 bg-background px-3 py-2 font-mono text-[10px] uppercase"
                        >
                          {message}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-muted-foreground">No scrolling messages.</span>
                    )}
                  </div>
                </section>
              </div>
            </AdminPagePanel>
          ) : null}
          {editor === "homepage" ? (
            <AdminPagePanel
              eyebrow="Storefront / Content editor"
              title="Edit homepage"
              onBack={() => setEditor(null)}
            >
              <div className="space-y-6">
                <div className="grid gap-6 xl:grid-cols-2">
                  <section className="border border-foreground/10 bg-card p-5 md:p-7">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      01 / Landing image
                    </p>
                    <h2 className="mb-5 font-display text-3xl uppercase">Homepage hero</h2>
                    {content.heroImage ? (
                      <img
                        src={content.heroImage}
                        alt="Homepage hero preview"
                        className="mb-4 aspect-[16/7] w-full border object-cover"
                      />
                    ) : null}
                    <div className="space-y-3">
                      <input
                        value={content.heroImage}
                        onChange={(event) =>
                          setContent({ ...content, heroImage: event.target.value })
                        }
                        placeholder="Hero image URL"
                        className="w-full border border-input bg-background px-3 py-2 text-xs outline-none"
                      />
                      <label className="block border border-dashed p-3 font-mono text-[10px] uppercase tracking-[0.2em]">
                        Upload hero image
                        <input
                          type="file"
                          accept="image/*"
                          className="mt-2 block w-full normal-case tracking-normal"
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const file = input.files?.[0];
                            if (file) void uploadHomepageImage("heroImage", file, input);
                          }}
                        />
                      </label>
                      <input
                        value={content.heroTitle}
                        onChange={(event) =>
                          setContent({ ...content, heroTitle: event.target.value })
                        }
                        placeholder="Hero title"
                        className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                      />
                      <textarea
                        value={content.heroSubtitle}
                        onChange={(event) =>
                          setContent({ ...content, heroSubtitle: event.target.value })
                        }
                        placeholder="Hero subtitle"
                        className="min-h-20 w-full border border-input bg-background px-3 py-2 text-sm outline-none"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={content.primaryCta}
                          onChange={(event) =>
                            setContent({ ...content, primaryCta: event.target.value })
                          }
                          placeholder="Primary CTA"
                          className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                        />
                        <input
                          value={content.secondaryCta}
                          onChange={(event) =>
                            setContent({ ...content, secondaryCta: event.target.value })
                          }
                          placeholder="Secondary CTA"
                          className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                        />
                      </div>
                    </div>
                  </section>

                  <section className="border border-foreground/10 bg-card p-5 md:p-7">
                    <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                      02 / Campaign poster
                    </p>
                    <h2 className="mb-5 font-display text-3xl uppercase">Featured drop</h2>
                    {content.campaignImage ? (
                      <img
                        src={content.campaignImage}
                        alt="Campaign poster preview"
                        className="mb-4 aspect-[16/7] w-full border object-cover"
                      />
                    ) : null}
                    <div className="space-y-3">
                      <input
                        value={content.campaignImage}
                        onChange={(event) =>
                          setContent({ ...content, campaignImage: event.target.value })
                        }
                        placeholder="Campaign poster image URL"
                        className="w-full border border-input bg-background px-3 py-2 text-xs outline-none"
                      />
                      <label className="block border border-dashed p-3 font-mono text-[10px] uppercase tracking-[0.2em]">
                        Upload campaign poster
                        <input
                          type="file"
                          accept="image/*"
                          className="mt-2 block w-full normal-case tracking-normal"
                          onChange={(event) => {
                            const input = event.currentTarget;
                            const file = input.files?.[0];
                            if (file) void uploadHomepageImage("campaignImage", file, input);
                          }}
                        />
                      </label>
                      <input
                        value={content.campaignEyebrow}
                        onChange={(event) =>
                          setContent({ ...content, campaignEyebrow: event.target.value })
                        }
                        placeholder="Campaign label"
                        className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                      />
                      <input
                        value={content.campaignTitle}
                        onChange={(event) =>
                          setContent({ ...content, campaignTitle: event.target.value })
                        }
                        placeholder="Campaign title"
                        className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                      />
                      <textarea
                        value={content.campaignDescription}
                        onChange={(event) =>
                          setContent({ ...content, campaignDescription: event.target.value })
                        }
                        placeholder="Campaign description"
                        className="min-h-20 w-full border border-input bg-background px-3 py-2 text-sm outline-none"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={content.campaignCta}
                          onChange={(event) =>
                            setContent({ ...content, campaignCta: event.target.value })
                          }
                          placeholder="Button label"
                          className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                        />
                        <select
                          value={content.campaignProductId}
                          onChange={(event) =>
                            setContent({ ...content, campaignProductId: event.target.value })
                          }
                          className="border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.12em] outline-none"
                        >
                          <option value="">First New Drop</option>
                          {products.map((product) => (
                            <option key={product.id} value={product.id}>
                              {product.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </section>
                </div>

                <section className="border border-foreground/10 bg-card p-5 md:p-7">
                  <p className="mb-2 font-mono text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                    03 / Store announcements
                  </p>
                  <div className="grid gap-3 md:grid-cols-2">
                    <input
                      value={content.announcement}
                      onChange={(event) =>
                        setContent({ ...content, announcement: event.target.value })
                      }
                      placeholder="Announcement bar"
                      className="md:col-span-2 border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
                    />
                    <label className="md:col-span-2 space-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                      Scrolling homepage messages (one per line)
                      <textarea
                        value={content.tickerMessages.join("\n")}
                        onChange={(event) =>
                          setContent({
                            ...content,
                            tickerMessages: parseTickerMessages(event.target.value),
                          })
                        }
                        placeholder={
                          "FREE SHIPPING ACROSS EGYPT OVER EGP 2,000\nDROP 07 — OUT NOW\nخدش مش عيب\nLEAVE A MARK"
                        }
                        className="min-h-32 w-full border border-input bg-background px-3 py-3 font-sans text-sm normal-case tracking-normal text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                  </div>
                </section>
                <button
                  type="button"
                  onClick={saveContent}
                  className="w-full bg-primary px-5 py-4 font-mono text-xs uppercase tracking-[0.2em] text-primary-foreground"
                >
                  Publish homepage and campaign
                </button>
              </div>
            </AdminPagePanel>
          ) : null}
        </section>
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
              <input
                value={settings.timezone}
                onChange={(event) => setSettings({ ...settings, timezone: event.target.value })}
                placeholder="Timezone"
                className="w-full border border-input bg-background px-3 py-2 text-xs uppercase tracking-[0.2em] outline-none"
              />
              <label className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.2em]">
                <input
                  type="checkbox"
                  checked={settings.allowCashOnDelivery}
                  onChange={(event) =>
                    setSettings({ ...settings, allowCashOnDelivery: event.target.checked })
                  }
                />
                Allow cash on delivery
              </label>
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
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => editCollection(collection)}
                  className="block w-full border p-3 text-left"
                >
                  <p className="font-medium uppercase">{collection.name}</p>
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                    {collection.products.length} products
                  </p>
                </button>
              ))}
            </div>
            <div className="mt-4 space-y-3">
              <h3 className="font-mono text-[10px] uppercase tracking-[0.2em]">
                {collectionDraft.id ? "Edit collection" : "Add collection"}
              </h3>
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
                {collectionDraft.id ? "Save collection changes" : "Create collection"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
