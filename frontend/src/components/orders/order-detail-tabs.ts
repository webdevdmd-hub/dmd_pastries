import { ROUTES } from "@/constants/routes";

/**
 * The five sections of a bakery order's detail page.
 *
 * They used to be stacked on one scroll: the summary card with its items and
 * charges, then payments, production and packaging down the left with the
 * timeline on the right. Reaching packaging meant scrolling past every other
 * section, and each of the three lower sections carries its own form.
 */
export type OrderDetailTabKey = "items" | "payments" | "production" | "packaging" | "timeline";

export const ORDER_DETAIL_TAB_KEYS: readonly OrderDetailTabKey[] = [
  "items",
  "payments",
  "production",
  "packaging",
  "timeline",
] as const;

/** Items is the default, so it is spelled as the bare route. */
export const DEFAULT_ORDER_DETAIL_TAB: OrderDetailTabKey = "items";

export const ORDER_DETAIL_TAB_QUERY_KEY = "tab";

/** `?item=<id>` opens that line's details sheet over whichever tab is showing. */
export const ORDER_DETAIL_ITEM_QUERY_KEY = "item";

export function isOrderDetailTabKey(value: string | null | undefined): value is OrderDetailTabKey {
  return ORDER_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Items rather than throwing. */
export function parseOrderDetailTab(value: string | null | undefined): OrderDetailTabKey {
  return isOrderDetailTabKey(value) ? value : DEFAULT_ORDER_DETAIL_TAB;
}

/**
 * The canonical URL for one tab of one order, preserving any other params.
 */
export function orderDetailTabHref(
  orderId: string,
  tab: OrderDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_ORDER_DETAIL_TAB) {
    next.delete(ORDER_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(ORDER_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.orders}/${orderId}`;
  return query ? `${base}?${query}` : base;
}
