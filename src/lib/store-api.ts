import type {
  CustomerProfile,
  HomepageContent,
  PromoCode,
  StoreCategory,
  StoreCollection,
  StoreProduct,
  StoreSettings,
} from "@/lib/store-data";
import type { StorePermission } from "@/lib/auth";
import type { OrderRecord } from "@/lib/cart";
import { getSupabaseClient } from "@/lib/supabase";
import { UserInputError } from "@/lib/user-messages";

type DbRow = Record<string, unknown> & {
  product_variants?: unknown;
  inventory?: unknown;
  sale_price?: unknown;
  badge?: unknown;
  order_items?: unknown;
  coupon_code?: unknown;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isUuid = (id: string) => uuidPattern.test(id);

function fail(context: string, error: { message: string } | null) {
  if (error) throw new Error(context);
}

function asRow(value: unknown): DbRow {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("The database returned an invalid record.");
  }
  return value as DbRow;
}

function asRows(value: unknown): DbRow[] {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("The database returned an invalid record list.");
  return value.map(asRow);
}

function stringField(row: DbRow, key: string, fallback?: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  if (fallback !== undefined && value == null) return fallback;
  throw new Error(`The database returned an invalid "${key}" value.`);
}

function numberField(row: DbRow, key: string, fallback?: number): number {
  const value = row[key];
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (fallback !== undefined && value == null) return fallback;
  throw new Error(`The database returned an invalid "${key}" value.`);
}

function booleanField(row: DbRow, key: string): boolean {
  const value = row[key];
  if (typeof value !== "boolean")
    throw new Error(`The database returned an invalid "${key}" value.`);
  return value;
}

function stringArrayField(row: DbRow, key: string): string[] {
  const value = row[key];
  if (value == null) return [];
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`The database returned an invalid "${key}" list.`);
  }
  return value as string[];
}

function returnedId(data: unknown, context: string): string {
  if (!data) throw new Error(`${context}: no record was returned.`);
  return stringField(asRow(data), "id");
}

type ProductVariantIdentity = { id: string; size: string; color: string };

export function getRemovedVariantIds(
  existingVariants: ProductVariantIdentity[],
  submittedVariants: Array<Pick<ProductVariantIdentity, "size" | "color">>,
) {
  const submittedKeys = new Set(
    submittedVariants.map((variant) => `${variant.size}\u0000${variant.color}`),
  );
  return existingVariants
    .filter((variant) => !submittedKeys.has(`${variant.size}\u0000${variant.color}`))
    .map((variant) => variant.id);
}

function mapProduct(row: DbRow): StoreProduct {
  const variants = asRows(row.product_variants).map((variant) => {
    const inventory = variant.inventory;
    const inventoryRow = Array.isArray(inventory)
      ? inventory[0]
        ? asRow(inventory[0])
        : undefined
      : inventory
        ? asRow(inventory)
        : undefined;
    return {
      id: stringField(variant, "id"),
      size: stringField(variant, "size"),
      color: stringField(variant, "color"),
      stock: inventoryRow ? numberField(inventoryRow, "stock_quantity", 0) : 0,
    };
  });
  const salePrice = row.sale_price;
  return {
    id: stringField(row, "id"),
    slug: stringField(row, "slug"),
    name: stringField(row, "name"),
    category: stringField(row, "category"),
    subcategory: stringField(row, "subcategory"),
    price: numberField(row, "price"),
    ...(typeof salePrice === "number" ? { salePrice } : {}),
    sku: stringField(row, "sku"),
    description: stringField(row, "description", ""),
    ...(typeof row.badge === "string" ? { badge: row.badge } : {}),
    featured: booleanField(row, "featured"),
    bestSeller: booleanField(row, "best_seller"),
    newArrival: booleanField(row, "new_arrival"),
    images: stringArrayField(row, "images"),
    colors: stringArrayField(row, "colors"),
    sizes: stringArrayField(row, "sizes"),
    variants,
  };
}

export async function loadStoreProducts(includeInactive = false): Promise<StoreProduct[]> {
  let query = getSupabaseClient()
    .from("products")
    .select("*, product_variants(*, inventory(stock_quantity))")
    .order("created_at", { ascending: false });
  if (!includeInactive) query = query.eq("active", true);
  const { data, error } = await query;
  fail("Could not load products", error);
  return asRows(data).map(mapProduct);
}

export async function loadStorefrontCategories(): Promise<StoreCategory[]> {
  const { data, error } = await getSupabaseClient()
    .from("categories")
    .select("id, name, slug, image, arabic")
    .eq("active", true)
    .order("name");
  fail("Could not load categories", error);
  return asRows(data).map((row) => ({
    id: stringField(row, "id"),
    name: stringField(row, "name"),
    slug: stringField(row, "slug"),
    image: stringField(row, "image", ""),
    arabic: stringField(row, "arabic", ""),
  }));
}

export async function loadHomepageContent(): Promise<HomepageContent> {
  const { data, error } = await getSupabaseClient()
    .from("homepage_content")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  fail("Could not load homepage content", error);
  const row = data == null ? null : asRow(data);
  if (!row) throw new Error("Homepage content is not configured in the store database.");
  return {
    heroTitle: stringField(row, "hero_title"),
    heroSubtitle: stringField(row, "hero_subtitle"),
    primaryCta: stringField(row, "primary_cta"),
    secondaryCta: stringField(row, "secondary_cta"),
    announcement: stringField(row, "announcement"),
  };
}

function mapOrder(row: DbRow): OrderRecord {
  const status = stringField(row, "status");
  if (!["Pending", "Confirmed", "Packed", "Shipped", "Delivered", "Cancelled"].includes(status)) {
    throw new Error("The database returned an unsupported order status.");
  }
  const deliveryMethod = stringField(row, "delivery_method");
  if (deliveryMethod !== "Standard delivery" && deliveryMethod !== "Express delivery") {
    throw new Error("The database returned an unsupported delivery method.");
  }
  const customerPaymentMethod = stringField(row, "payment_method");
  if (customerPaymentMethod !== "Cash on delivery" && customerPaymentMethod !== "Card") {
    throw new Error("The database returned an unsupported payment method.");
  }
  return {
    id: stringField(row, "id"),
    createdAt: stringField(row, "created_at"),
    status: status as OrderRecord["status"],
    customer: {
      fullName: stringField(row, "full_name", ""),
      phone: stringField(row, "phone", ""),
      governorate: stringField(row, "governorate", ""),
      city: stringField(row, "city", ""),
      address: stringField(row, "address", ""),
      notes: stringField(row, "notes", ""),
      deliveryMethod,
      paymentMethod: customerPaymentMethod,
    },
    items: asRows(row.order_items).map((item) => ({
      id: stringField(item, "id"),
      productId: stringField(item, "product_id"),
      name: stringField(item, "name"),
      slug: "",
      price: numberField(item, "price"),
      image: "",
      size: stringField(item, "size", ""),
      color: stringField(item, "color", ""),
      quantity: numberField(item, "quantity"),
    })),
    subtotal: numberField(row, "subtotal"),
    discount: numberField(row, "discount"),
    shipping: numberField(row, "shipping"),
    total: numberField(row, "total"),
    paymentMethod: stringField(row, "payment_method"),
    paymentStatus: stringField(row, "payment_status") as OrderRecord["paymentStatus"],
    deliveryMethod: stringField(row, "delivery_method"),
    tracking: stringField(row, "tracking", ""),
    ...(typeof row.coupon_code === "string" ? { promoCode: row.coupon_code } : {}),
  };
}

export type AdminStoreData = {
  products: StoreProduct[];
  categories: StoreCategory[];
  collections: StoreCollection[];
  customers: CustomerProfile[];
  promos: PromoCode[];
  homepage: HomepageContent;
  settings: StoreSettings;
  orders: OrderRecord[];
};

export async function loadAdminStore(): Promise<AdminStoreData> {
  const supabase = getSupabaseClient();
  const [
    productResult,
    categoryResult,
    collectionResult,
    collectionProductResult,
    profileResult,
    roleResult,
    permissionResult,
    couponResult,
    homepageResult,
    settingsResult,
    orderResult,
  ] = await Promise.all([
    supabase
      .from("products")
      .select("*, product_variants(*, inventory(stock_quantity))")
      .order("created_at", { ascending: false }),
    supabase.from("categories").select("*").order("name"),
    supabase.from("collections").select("*").order("name"),
    supabase.from("collection_products").select("collection_id, product_id, position"),
    supabase.from("profiles").select("id, email, full_name, phone"),
    supabase.from("app_roles").select("user_id, role"),
    supabase.from("store_permissions").select("user_id, permission"),
    supabase.from("coupons").select("*").order("created_at", { ascending: false }),
    supabase.from("homepage_content").select("*").eq("singleton", true).maybeSingle(),
    supabase.from("store_settings").select("*").eq("singleton", true).maybeSingle(),
    supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false }),
  ]);
  fail("Could not load admin products", productResult.error);
  fail("Could not load categories", categoryResult.error);
  fail("Could not load collections", collectionResult.error);
  fail("Could not load collection products", collectionProductResult.error);
  fail("Could not load customer profiles", profileResult.error);
  fail("Could not load customer roles", roleResult.error);
  fail("Could not load assistant permissions", permissionResult.error);
  fail("Could not load coupons", couponResult.error);
  fail("Could not load homepage content", homepageResult.error);
  fail("Could not load store settings", settingsResult.error);
  fail("Could not load orders", orderResult.error);

  const products: StoreProduct[] = asRows(productResult.data).map(mapProduct);
  const productLinks = asRows(collectionProductResult.data);
  const collections: StoreCollection[] = asRows(collectionResult.data).map((row) => ({
    id: stringField(row, "id"),
    name: stringField(row, "name"),
    description: stringField(row, "description", ""),
    products: productLinks
      .filter((link) => stringField(link, "collection_id") === stringField(row, "id"))
      .sort((a, b) => numberField(a, "position") - numberField(b, "position"))
      .map((link) => stringField(link, "product_id")),
  }));
  const categories: StoreCategory[] = asRows(categoryResult.data).map((row) => ({
    id: stringField(row, "id"),
    name: stringField(row, "name"),
    slug: stringField(row, "slug"),
    image: stringField(row, "image", ""),
    arabic: stringField(row, "arabic", ""),
  }));
  const roleRows = asRows(roleResult.data);
  const permissionRows = asRows(permissionResult.data);
  const customers: CustomerProfile[] = asRows(profileResult.data).map((profile) => {
    const id = stringField(profile, "id");
    const roles = roleRows.filter((row) => stringField(row, "user_id") === id);
    const permissions = permissionRows
      .filter((row) => stringField(row, "user_id") === id)
      .map((row) => stringField(row, "permission"))
      .filter((permission): permission is StorePermission =>
        [
          "manage_products",
          "manage_orders",
          "view_customers",
          "manage_discounts",
          "manage_content",
          "manage_settings",
        ].includes(permission),
      );
    const matchingRole = roles.find((row) => stringField(row, "role") !== "customer");
    const role = matchingRole ? stringField(matchingRole, "role") : "customer";
    if (!["customer", "staff", "admin", "owner"].includes(role)) {
      throw new Error("The database returned an unsupported customer role.");
    }
    return {
      id,
      name: stringField(profile, "full_name"),
      email: stringField(profile, "email"),
      phone: stringField(profile, "phone", ""),
      role: role as CustomerProfile["role"],
      permissions,
      status: "active",
    };
  });
  const promos: PromoCode[] = asRows(couponResult.data).map((row) => {
    const type = stringField(row, "type");
    if (type !== "percentage" && type !== "fixed") {
      throw new Error("The database returned an unsupported coupon type.");
    }
    return {
      id: stringField(row, "id"),
      code: stringField(row, "code"),
      type,
      value: numberField(row, "value"),
      minOrder: numberField(row, "min_order"),
      active: booleanField(row, "active"),
      expiresAt: stringField(row, "expires_at", ""),
      description: stringField(row, "description", ""),
    };
  });
  const homepageRow = homepageResult.data == null ? null : asRow(homepageResult.data);
  const settingsRow = settingsResult.data == null ? null : asRow(settingsResult.data);

  return {
    products,
    categories,
    collections,
    customers,
    promos,
    homepage: {
      heroTitle: homepageRow ? stringField(homepageRow, "hero_title") : "",
      heroSubtitle: homepageRow ? stringField(homepageRow, "hero_subtitle") : "",
      primaryCta: homepageRow ? stringField(homepageRow, "primary_cta") : "",
      secondaryCta: homepageRow ? stringField(homepageRow, "secondary_cta") : "",
      announcement: homepageRow ? stringField(homepageRow, "announcement") : "",
    },
    settings: {
      currency: "EGP",
      shippingFreeThreshold: settingsRow
        ? numberField(settingsRow, "shipping_free_threshold")
        : 2000,
      standardShipping: settingsRow ? numberField(settingsRow, "standard_shipping") : 120,
      defaultCountry: settingsRow ? stringField(settingsRow, "default_country") : "Egypt",
      allowCashOnDelivery: settingsRow ? booleanField(settingsRow, "allow_cash_on_delivery") : true,
      supportEmail: settingsRow ? stringField(settingsRow, "support_email") : "",
      timezone: settingsRow ? stringField(settingsRow, "timezone") : "Africa/Cairo",
    },
    orders: asRows(orderResult.data).map(mapOrder),
  };
}

export async function loadCustomerOrders(): Promise<OrderRecord[]> {
  const { data, error } = await getSupabaseClient()
    .from("orders")
    .select("*, order_items(*)")
    .order("created_at", { ascending: false });
  fail("Could not load your order history", error);
  return asRows(data).map(mapOrder);
}

export async function saveStoreProduct(product: StoreProduct): Promise<StoreProduct> {
  const supabase = getSupabaseClient();
  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id")
    .eq("name", product.category)
    .maybeSingle();
  fail("Could not find product category", categoryError);
  const payload: DbRow = {
    slug: product.slug,
    name: product.name,
    category: product.category,
    subcategory: product.subcategory,
    price: product.price,
    sale_price: product.salePrice ?? null,
    sku: product.sku,
    description: product.description,
    badge: product.badge ?? null,
    featured: Boolean(product.featured),
    best_seller: Boolean(product.bestSeller),
    new_arrival: Boolean(product.newArrival),
    images: product.images,
    colors: product.colors,
    sizes: product.sizes,
    variants: product.variants,
    active: true,
    category_id: category?.id ?? null,
  };
  if (isUuid(product.id)) payload["id"] = product.id;
  const { data, error } = await supabase.from("products").upsert(payload).select("id").single();
  fail("Could not save product", error);
  const id = returnedId(data, "Could not save product");
  const variants = product.variants.map((variant) => ({
    product_id: id,
    size: variant.size,
    color: variant.color,
  }));
  if (variants.length) {
    const { error: variantsError } = await supabase
      .from("product_variants")
      .upsert(variants, { onConflict: "product_id,size,color" });
    fail("Could not save product variants", variantsError);
  }
  const { data: savedVariants, error: savedVariantsError } = await supabase
    .from("product_variants")
    .select("id, size, color")
    .eq("product_id", id);
  fail("Could not load saved product variants", savedVariantsError);
  const savedVariantRows = asRows(savedVariants).map((variant) => ({
    id: stringField(variant, "id"),
    size: stringField(variant, "size"),
    color: stringField(variant, "color"),
  }));
  const removedVariantIds = getRemovedVariantIds(savedVariantRows, product.variants);
  if (removedVariantIds.length) {
    const { error: removedVariantsError } = await supabase
      .from("product_variants")
      .delete()
      .in("id", removedVariantIds);
    fail("Could not remove deleted product variants", removedVariantsError);
  }
  const stockByVariant = new Map(
    product.variants.map((variant) => [`${variant.size}\u0000${variant.color}`, variant.stock]),
  );
  const inventory = savedVariantRows
    .filter((variant) => !removedVariantIds.includes(variant.id))
    .map((variant) => ({
      variant_id: variant.id,
      stock_quantity: Math.max(0, stockByVariant.get(`${variant.size}\u0000${variant.color}`) ?? 0),
    }));
  if (inventory.length) {
    const { error: inventoryError } = await supabase
      .from("inventory")
      .upsert(inventory, { onConflict: "variant_id" });
    fail("Could not save product inventory", inventoryError);
  }
  return { ...product, id };
}

export async function archiveStoreProduct(productId: string) {
  const { error } = await getSupabaseClient()
    .from("products")
    .update({ active: false })
    .eq("id", productId);
  fail("Could not archive product", error);
}

export async function saveStoreCategory(category: StoreCategory) {
  const payload: DbRow = {
    name: category.name,
    slug: category.slug,
    image: category.image,
    arabic: category.arabic,
    active: true,
  };
  if (isUuid(category.id)) payload["id"] = category.id;
  const { data, error } = await getSupabaseClient()
    .from("categories")
    .upsert(payload)
    .select("id")
    .single();
  fail("Could not save category", error);
  return { ...category, id: returnedId(data, "Could not save category") };
}

export async function saveStoreCollection(collection: StoreCollection) {
  const payload: DbRow = {
    name: collection.name,
    slug: collection.name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, ""),
    description: collection.description,
    active: true,
  };
  if (isUuid(collection.id)) payload["id"] = collection.id;
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.from("collections").upsert(payload).select("id").single();
  fail("Could not save collection", error);
  const id = returnedId(data, "Could not save collection");
  const { error: clearLinksError } = await supabase
    .from("collection_products")
    .delete()
    .eq("collection_id", id);
  fail("Could not replace collection products", clearLinksError);
  if (collection.products.length) {
    const { error: linksError } = await supabase.from("collection_products").insert(
      collection.products.map((productId, position) => ({
        collection_id: id,
        product_id: productId,
        position,
      })),
    );
    fail("Could not save collection products", linksError);
  }
  return { ...collection, id };
}

export async function saveStoreCoupon(promo: PromoCode) {
  const payload: DbRow = {
    code: promo.code.trim().toUpperCase(),
    type: promo.type,
    value: promo.value,
    min_order: promo.minOrder,
    active: promo.active,
    expires_at: promo.expiresAt || null,
    description: promo.description,
  };
  if (isUuid(promo.id)) payload["id"] = promo.id;
  const { data, error } = await getSupabaseClient()
    .from("coupons")
    .upsert(payload)
    .select("id")
    .single();
  fail("Could not save coupon", error);
  return { ...promo, id: returnedId(data, "Could not save coupon") };
}

export async function assignCustomerRole(
  userId: string,
  role: Exclude<CustomerProfile["role"], "owner">,
) {
  const { error } = await getSupabaseClient().rpc("set_customer_role", {
    p_user_id: userId,
    p_role: role,
  });
  fail("Could not update account role", error);
}

export async function setAssistantAccess(userId: string, enabled: boolean) {
  const { error } = await getSupabaseClient().rpc("set_assistant_access", {
    p_user_id: userId,
    p_enabled: enabled,
  });
  fail("Could not update assistant access", error);
}

export async function setAssistantPermissions(userId: string, permissions: StorePermission[]) {
  const { error } = await getSupabaseClient().rpc("set_assistant_permissions", {
    p_user_id: userId,
    p_permissions: permissions,
  });
  fail("Could not update assistant permissions", error);
}

export async function updateOrderStatus(orderId: string, status: OrderRecord["status"]) {
  const { error } = await getSupabaseClient().from("orders").update({ status }).eq("id", orderId);
  fail("Could not update order status", error);
}

export async function saveHomepageContent(content: HomepageContent) {
  const { error } = await getSupabaseClient().from("homepage_content").upsert({
    singleton: true,
    hero_title: content.heroTitle,
    hero_subtitle: content.heroSubtitle,
    primary_cta: content.primaryCta,
    secondary_cta: content.secondaryCta,
    announcement: content.announcement,
  });
  fail("Could not save homepage content", error);
}

export async function saveStoreSettings(settings: StoreSettings) {
  const { error } = await getSupabaseClient().from("store_settings").upsert({
    singleton: true,
    currency: settings.currency,
    shipping_free_threshold: settings.shippingFreeThreshold,
    standard_shipping: settings.standardShipping,
    default_country: settings.defaultCountry,
    allow_cash_on_delivery: settings.allowCashOnDelivery,
    support_email: settings.supportEmail,
    timezone: settings.timezone,
  });
  fail("Could not save store settings", error);
}

export async function uploadProductImage(file: File, altText: string) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a valid image file.");
  if (file.size > 10 * 1024 * 1024) throw new Error("Images must be 10 MB or smaller.");

  const supabase = getSupabaseClient();
  const path = `${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
  const { error: uploadError } = await supabase.storage
    .from("product-media")
    .upload(path, file, { contentType: file.type, upsert: false });
  fail("Could not upload image", uploadError);

  const { data: userData, error: userError } = await supabase.auth.getUser();
  fail("Could not verify image uploader", userError);
  const { error: metadataError } = await supabase.from("media_assets").insert({
    storage_path: path,
    bucket: "product-media",
    alt_text: altText,
    content_type: file.type,
    byte_size: file.size,
    uploaded_by: userData.user?.id ?? null,
  });
  if (metadataError) {
    const { error: cleanupError } = await supabase.storage.from("product-media").remove([path]);
    void cleanupError;
    throw new Error("Image metadata could not be saved.");
  }
  return supabase.storage.from("product-media").getPublicUrl(path).data.publicUrl;
}

export async function placeOrder(input: {
  idempotencyKey: string;
  customer: {
    fullName: string;
    phone: string;
    governorate: string;
    city: string;
    address: string;
    notes: string;
  };
  items: Array<{ productId: string; size: string; color: string; quantity: number }>;
  couponCode: string;
  deliveryMethod: string;
  paymentMethod: string;
}): Promise<{ id: string; total: number; duplicate: boolean }> {
  const { data, error } = await getSupabaseClient().rpc("place_store_order", {
    p_idempotency_key: input.idempotencyKey,
    p_customer: {
      full_name: input.customer.fullName,
      phone: input.customer.phone,
      governorate: input.customer.governorate,
      city: input.customer.city,
      address: input.customer.address,
      notes: input.customer.notes,
      country: "Egypt",
    },
    p_items: input.items.map((item) => ({
      product_id: item.productId,
      size: item.size,
      color: item.color,
      quantity: item.quantity,
    })),
    p_coupon_code: input.couponCode || null,
    p_delivery_method: input.deliveryMethod,
    p_payment_method: input.paymentMethod,
  });
  fail("Could not place order", error);
  const result = data as { id: string; total: number; duplicate: boolean };
  if (!result?.id || typeof result.total !== "number") {
    throw new Error("Order service returned an invalid confirmation.");
  }
  return result;
}

export async function validateStoreCoupon(
  code: string,
  subtotal: number,
): Promise<{
  code: string;
  type: "percentage" | "fixed";
  value: number;
  discount: number;
  description: string;
}> {
  const { data, error } = await getSupabaseClient().rpc("validate_store_coupon", {
    p_code: code.trim(),
    p_subtotal: Math.round(subtotal),
  });
  fail("Could not validate coupon", error);
  const result = data as {
    code: string;
    type: "percentage" | "fixed";
    value: number;
    discount: number;
    description: string;
  } | null;
  if (!result || typeof result.discount !== "number") {
    throw new Error("Coupon service returned an invalid response.");
  }
  return result;
}

export async function refreshCustomerSession() {
  const { data, error } = await getSupabaseClient().auth.getSession();
  fail("Could not refresh the authentication session", error);
  return data.session;
}

export function validateOrderTrackingInput(reference: string, phone: string) {
  const normalizedReference = reference.trim().replace(/^5AD-/i, "");
  const normalizedPhone = phone.trim();
  if (!uuidPattern.test(normalizedReference))
    throw new UserInputError("Enter the full order reference from your confirmation.");
  if (normalizedPhone.length < 3 || normalizedPhone.length > 40) {
    throw new UserInputError("Enter the phone number used for the order.");
  }
  return { reference: normalizedReference, phone: normalizedPhone };
}

export const ORDER_TRACKING_ERROR_MESSAGE =
  "Order tracking is temporarily unavailable. Please try again.";

export async function trackStoreOrder(reference: string, phone: string) {
  const input = validateOrderTrackingInput(reference, phone);
  try {
    const { data, error } = await getSupabaseClient().rpc("track_store_order", {
      p_order_id: input.reference,
      p_phone: input.phone,
    });
    fail("Could not look up order tracking", error);
    const result = Array.isArray(data) ? data[0] : data;
    return result as {
      id: string;
      status: string;
      delivery_method: string;
      tracking: string;
    } | null;
  } catch {
    throw new Error(ORDER_TRACKING_ERROR_MESSAGE);
  }
}

export async function findPublicProductBySlug(slug: string) {
  const { data, error } = await getSupabaseClient()
    .from("products")
    .select("*, product_variants(*, inventory(stock_quantity))")
    .eq("slug", slug)
    .eq("active", true)
    .maybeSingle();
  fail("Could not load product details", error);
  return data ? mapProduct(data) : undefined;
}
