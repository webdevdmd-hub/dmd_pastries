import { ROUTES } from "@/constants/routes";

/**
 * The three sections of a purchase order.
 *
 * Items are what the buyer opens the page to check. Documents and notes are
 * reference material for "what happened here"; they used to live in a side
 * sheet behind a button, which was one more control than a tab.
 */
export type PurchaseOrderDetailTabKey = "items" | "documents" | "notes";

export const PURCHASE_ORDER_DETAIL_TAB_KEYS: readonly PurchaseOrderDetailTabKey[] = [
  "items",
  "documents",
  "notes",
] as const;

/** Items is the default, so it is spelled as the bare route. */
export const DEFAULT_PURCHASE_ORDER_DETAIL_TAB: PurchaseOrderDetailTabKey = "items";

export const PURCHASE_ORDER_DETAIL_TAB_QUERY_KEY = "tab";

export function isPurchaseOrderDetailTabKey(
  value: string | null | undefined,
): value is PurchaseOrderDetailTabKey {
  return PURCHASE_ORDER_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Items rather than throwing. */
export function parsePurchaseOrderDetailTab(
  value: string | null | undefined,
): PurchaseOrderDetailTabKey {
  return isPurchaseOrderDetailTabKey(value) ? value : DEFAULT_PURCHASE_ORDER_DETAIL_TAB;
}

/** The canonical URL for one tab of one order, preserving any other params. */
export function purchaseOrderDetailTabHref(
  orderId: string,
  tab: PurchaseOrderDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_PURCHASE_ORDER_DETAIL_TAB) {
    next.delete(PURCHASE_ORDER_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(PURCHASE_ORDER_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.purchasingOrders}/${orderId}`;
  return query ? `${base}?${query}` : base;
}
