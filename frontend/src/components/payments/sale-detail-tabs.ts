import { ROUTES } from "@/constants/routes";

/**
 * The four sections of a POS sale's detail page.
 *
 * They used to be four stacked cards on one scroll: items, then payments
 * beside returnable items, then credit notes. Reaching the credit notes meant
 * scrolling past everything else.
 */
export type SaleDetailTabKey = "items" | "payments" | "returnable" | "credit-notes";

export const SALE_DETAIL_TAB_KEYS: readonly SaleDetailTabKey[] = [
  "items",
  "payments",
  "returnable",
  "credit-notes",
] as const;

/** Items is the default, so it is spelled as the bare route. */
export const DEFAULT_SALE_DETAIL_TAB: SaleDetailTabKey = "items";

export const SALE_DETAIL_TAB_QUERY_KEY = "tab";

export function isSaleDetailTabKey(value: string | null | undefined): value is SaleDetailTabKey {
  return SALE_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Items rather than throwing. */
export function parseSaleDetailTab(value: string | null | undefined): SaleDetailTabKey {
  return isSaleDetailTabKey(value) ? value : DEFAULT_SALE_DETAIL_TAB;
}

/** The canonical URL for one tab of one sale, preserving any other params. */
export function saleDetailTabHref(
  saleId: string,
  tab: SaleDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_SALE_DETAIL_TAB) {
    next.delete(SALE_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(SALE_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.payments}/sales/${saleId}`;
  return query ? `${base}?${query}` : base;
}
