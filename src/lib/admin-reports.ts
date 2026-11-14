import type { OrderRecord } from "@/lib/cart";

export type DailySalesReport = {
  date: string;
  label: string;
  sales: number;
  profit: number | null;
};

export type SalesReport = {
  days: DailySalesReport[];
  sales: number;
  profit: number;
  orders: number;
  ordersWithoutCosts: number;
  costTrackedOrders: number;
};

function localDateKey(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function buildSalesReport(orders: OrderRecord[], now = new Date(), days = 30): SalesReport {
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1);
  const daily = Array.from({ length: days }, (_, index) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + index);
    return {
      date: localDateKey(date),
      label: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      sales: 0,
      profit: null as number | null,
    };
  });
  const dailyByDate = new Map(daily.map((day) => [day.date, day]));
  let orderCount = 0;
  let ordersWithoutCosts = 0;
  let costTrackedOrders = 0;

  for (const order of orders) {
    if (order.status === "Cancelled") continue;
    const createdAt = new Date(order.createdAt);
    if (Number.isNaN(createdAt.getTime())) continue;
    const day = dailyByDate.get(localDateKey(createdAt));
    if (!day) continue;

    orderCount += 1;
    day.sales += order.total;
    const hasCostSnapshot =
      order.items.length > 0 &&
      order.items.every(
        (item) => typeof item.unitCost === "number" && Number.isFinite(item.unitCost),
      );
    if (!hasCostSnapshot) {
      ordersWithoutCosts += 1;
      continue;
    }

    const cost = order.items.reduce((sum, item) => sum + (item.unitCost ?? 0) * item.quantity, 0);
    day.profit = (day.profit ?? 0) + order.total - cost;
    costTrackedOrders += 1;
  }

  return {
    days: daily,
    sales: daily.reduce((sum, day) => sum + day.sales, 0),
    profit: daily.reduce((sum, day) => sum + (day.profit ?? 0), 0),
    orders: orderCount,
    ordersWithoutCosts,
    costTrackedOrders,
  };
}
