import { ROUTES } from "@/constants/routes";

/**
 * The three sections of a vendor credit.
 *
 * They used to be one scroll: four metric cards, three link cards, a
 * reversal card, the items table, then the reason. Reaching the items meant
 * scrolling past every figure on the way down.
 */
export type PurchaseReturnDetailTabKey = "overview" | "items" | "links";

export const PURCHASE_RETURN_DETAIL_TAB_KEYS: readonly PurchaseReturnDetailTabKey[] = [
  "overview",
  "items",
  "links",
] as const;

/** Overview is the default, so it is spelled as the bare route. */
export const DEFAULT_PURCHASE_RETURN_DETAIL_TAB: PurchaseReturnDetailTabKey = "overview";

export const PURCHASE_RETURN_DETAIL_TAB_QUERY_KEY = "tab";

export function isPurchaseReturnDetailTabKey(
  value: string | null | undefined,
): value is PurchaseReturnDetailTabKey {
  return PURCHASE_RETURN_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Overview rather than throwing. */
export function parsePurchaseReturnDetailTab(
  value: string | null | undefined,
): PurchaseReturnDetailTabKey {
  return isPurchaseReturnDetailTabKey(value) ? value : DEFAULT_PURCHASE_RETURN_DETAIL_TAB;
}

/** The canonical URL for one tab of one vendor credit, preserving any other params. */
export function purchaseReturnDetailTabHref(
  purchaseReturnId: string,
  tab: PurchaseReturnDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_PURCHASE_RETURN_DETAIL_TAB) {
    next.delete(PURCHASE_RETURN_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(PURCHASE_RETURN_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.purchasingReturns}/${purchaseReturnId}`;
  return query ? `${base}?${query}` : base;
}
