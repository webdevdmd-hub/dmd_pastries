import { ROUTES } from "@/constants/routes";

/**
 * The three sections of a bill.
 *
 * Items and payments are what you open a bill to check or do. The
 * identifiers, dates and notes are reference material that used to sit in a
 * side sheet behind a "Details & notes" button.
 */
export type PurchaseInvoiceDetailTabKey = "items" | "payments" | "details";

export const PURCHASE_INVOICE_DETAIL_TAB_KEYS: readonly PurchaseInvoiceDetailTabKey[] = [
  "items",
  "payments",
  "details",
] as const;

/** Items is the default, so it is spelled as the bare route. */
export const DEFAULT_PURCHASE_INVOICE_DETAIL_TAB: PurchaseInvoiceDetailTabKey = "items";

export const PURCHASE_INVOICE_DETAIL_TAB_QUERY_KEY = "tab";

export function isPurchaseInvoiceDetailTabKey(
  value: string | null | undefined,
): value is PurchaseInvoiceDetailTabKey {
  return PURCHASE_INVOICE_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Items rather than throwing. */
export function parsePurchaseInvoiceDetailTab(
  value: string | null | undefined,
): PurchaseInvoiceDetailTabKey {
  return isPurchaseInvoiceDetailTabKey(value) ? value : DEFAULT_PURCHASE_INVOICE_DETAIL_TAB;
}

/** The canonical URL for one tab of one bill, preserving any other params. */
export function purchaseInvoiceDetailTabHref(
  invoiceId: string,
  tab: PurchaseInvoiceDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_PURCHASE_INVOICE_DETAIL_TAB) {
    next.delete(PURCHASE_INVOICE_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(PURCHASE_INVOICE_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.purchasingInvoices}/${invoiceId}`;
  return query ? `${base}?${query}` : base;
}
