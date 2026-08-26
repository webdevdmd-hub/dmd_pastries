import { ROUTES } from "@/constants/routes";

/**
 * The six sections of a supplier's detail page.
 *
 * They used to be six stacked panels on one scroll: profile and contacts side
 * by side, then notes, then a "Purchasing history" card that itself held the
 * ledger metrics, purchased items, recent documents and the vendor statement.
 * Reaching the statement meant scrolling past everything else, and the same
 * figure was printed in three places on the way down.
 */
export type SupplierDetailTabKey =
  | "profile"
  | "contacts"
  | "notes"
  | "history"
  | "documents"
  | "statement";

export const SUPPLIER_DETAIL_TAB_KEYS: readonly SupplierDetailTabKey[] = [
  "profile",
  "contacts",
  "notes",
  "history",
  "documents",
  "statement",
] as const;

/** Profile is the default, so it is spelled as the bare route. */
export const DEFAULT_SUPPLIER_DETAIL_TAB: SupplierDetailTabKey = "profile";

export const SUPPLIER_DETAIL_TAB_QUERY_KEY = "tab";

export function isSupplierDetailTabKey(
  value: string | null | undefined,
): value is SupplierDetailTabKey {
  return SUPPLIER_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Profile rather than throwing. */
export function parseSupplierDetailTab(value: string | null | undefined): SupplierDetailTabKey {
  return isSupplierDetailTabKey(value) ? value : DEFAULT_SUPPLIER_DETAIL_TAB;
}

/**
 * The canonical URL for one tab of one supplier, preserving any other params.
 */
export function supplierDetailTabHref(
  supplierId: string,
  tab: SupplierDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_SUPPLIER_DETAIL_TAB) {
    next.delete(SUPPLIER_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(SUPPLIER_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.suppliers}/${supplierId}`;
  return query ? `${base}?${query}` : base;
}
