import { ROUTES } from "@/constants/routes";

/**
 * The three sections of a receive-goods record.
 *
 * Items are what a storekeeper opens the record to check. The linked
 * documents and the vendor credits raised against it are follow-up, and used
 * to sit below the items as three more cards on one long scroll.
 */
export type PurchaseReceiptDetailTabKey = "items" | "documents" | "credits";

export const PURCHASE_RECEIPT_DETAIL_TAB_KEYS: readonly PurchaseReceiptDetailTabKey[] = [
  "items",
  "documents",
  "credits",
] as const;

/** Items is the default, so it is spelled as the bare route. */
export const DEFAULT_PURCHASE_RECEIPT_DETAIL_TAB: PurchaseReceiptDetailTabKey = "items";

export const PURCHASE_RECEIPT_DETAIL_TAB_QUERY_KEY = "tab";

export function isPurchaseReceiptDetailTabKey(
  value: string | null | undefined,
): value is PurchaseReceiptDetailTabKey {
  return PURCHASE_RECEIPT_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Items rather than throwing. */
export function parsePurchaseReceiptDetailTab(
  value: string | null | undefined,
): PurchaseReceiptDetailTabKey {
  return isPurchaseReceiptDetailTabKey(value) ? value : DEFAULT_PURCHASE_RECEIPT_DETAIL_TAB;
}

/** The canonical URL for one tab of one receipt, preserving any other params. */
export function purchaseReceiptDetailTabHref(
  receiptId: string,
  tab: PurchaseReceiptDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_PURCHASE_RECEIPT_DETAIL_TAB) {
    next.delete(PURCHASE_RECEIPT_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(PURCHASE_RECEIPT_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.purchasingReceipts}/${receiptId}`;
  return query ? `${base}?${query}` : base;
}
