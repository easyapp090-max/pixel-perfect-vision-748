export type CartItem = {
  id: string;
  productId: string;
  name: string;
  slug: string;
  price: number;
  image: string;
  size: string;
  color: string;
  quantity: number;
};

export type CartLine = {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
};

export type OrderStatus =
  "Pending" | "Confirmed" | "Packed" | "Shipped" | "Delivered" | "Cancelled";

export type CustomerCheckoutFields = {
  fullName: string;
  phone: string;
  governorate: string;
  city: string;
  address: string;
  notes: string;
  deliveryMethod: "Standard delivery" | "Express delivery";
  paymentMethod: "Cash on delivery" | "Card";
};

export type OrderRecord = {
  id: string;
  createdAt: string;
  status: OrderStatus;
  customer: CustomerCheckoutFields;
  items: CartItem[];
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  paymentMethod: string;
  paymentStatus: "Pending" | "Completed" | "Failed";
  deliveryMethod: string;
  tracking: string;
  promoCode?: string;
};

export const CART_STORAGE_KEY = "5adsh-cart-v1";

function readJSON<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJSON<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getStoredCart(): CartItem[] {
  return readJSON<CartItem[]>(CART_STORAGE_KEY, []);
}

export function persistCart(items: CartItem[]) {
  writeJSON(CART_STORAGE_KEY, items);
}

export function getCartCount() {
  return getStoredCart().reduce((count, item) => count + item.quantity, 0);
}

export function addCartItem(item: CartItem) {
  const nextItems = getStoredCart();
  const existing = nextItems.find(
    (candidate) =>
      candidate.productId === item.productId &&
      candidate.size === item.size &&
      candidate.color === item.color,
  );

  if (existing) {
    existing.quantity += item.quantity;
    persistCart(nextItems);
    return nextItems;
  }

  nextItems.push(item);
  persistCart(nextItems);
  return nextItems;
}

export function updateCartItemQuantity(itemId: string, quantity: number) {
  const nextItems = getStoredCart().map((item) =>
    item.id === itemId ? { ...item, quantity: Math.max(0, quantity) } : item,
  );
  const filtered = nextItems.filter((item) => item.quantity > 0);
  persistCart(filtered);
  return filtered;
}

export function removeCartItem(itemId: string) {
  const nextItems = getStoredCart().filter((item) => item.id !== itemId);
  persistCart(nextItems);
  return nextItems;
}

export function clearCart() {
  persistCart([]);
  return [] as CartItem[];
}

export function validatePromoCode(code: string, subtotal: number) {
  void subtotal;
  return {
    valid: false,
    message: `Coupon "${code.trim()}" must be validated by the store before it can be applied.`,
  };
}

export function calculateCart(
  items: Pick<CartItem, "price" | "quantity">[],
  promoCode?: string,
  verifiedDiscount?: number,
): {
  subtotal: number;
  discount: number;
  shipping: number;
  total: number;
  promo: ReturnType<typeof validatePromoCode> | null;
  shippingLabel: string;
} {
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const promoResult =
    promoCode && verifiedDiscount !== undefined
      ? {
          valid: true,
          code: promoCode.trim().toUpperCase(),
          type: "verified",
          value: verifiedDiscount,
          amount: verifiedDiscount,
          message: "Verified by store.",
        }
      : promoCode
        ? validatePromoCode(promoCode, subtotal)
        : { valid: false, message: "No code applied." };
  const discount =
    promoResult.valid && "amount" in promoResult
      ? Math.min(subtotal, Math.max(0, promoResult.amount))
      : 0;
  const shipping = subtotal >= 2000 ? 0 : 120;
  const total = Math.max(0, subtotal - discount + shipping);

  return {
    subtotal,
    discount,
    shipping,
    total,
    promo: promoResult.valid ? promoResult : null,
    shippingLabel: subtotal >= 2000 ? "Free shipping" : "Standard delivery",
  };
}

export function validateCheckoutForm(input: Partial<CustomerCheckoutFields>) {
  const errors: Partial<Record<keyof CustomerCheckoutFields, string>> = {};

  if (!input.fullName?.trim()) errors.fullName = "Full name is required.";
  if (!input.phone?.trim()) errors.phone = "Phone number is required.";
  if (!input.governorate?.trim()) errors.governorate = "Governorate is required.";
  if (!input.city?.trim()) errors.city = "City is required.";
  if (!input.address?.trim()) errors.address = "Street address is required.";
  if (!input.deliveryMethod) errors.deliveryMethod = "Delivery method is required.";
  if (!input.paymentMethod) errors.paymentMethod = "Payment method is required.";

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function canStartCheckoutSubmission(isInFlight: boolean) {
  return !isInFlight;
}

export function canAccessAdmin(role: string | undefined | null) {
  const normalizedRole = (role ?? "").trim().toLowerCase();
  return normalizedRole === "admin" || normalizedRole === "staff" || normalizedRole === "owner";
}
