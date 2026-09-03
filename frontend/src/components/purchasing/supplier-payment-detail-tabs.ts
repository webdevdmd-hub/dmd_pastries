import { ROUTES } from "@/constants/routes";

/** The two sections of a payment made: the payment itself, and the bills it settled. */
export type SupplierPaymentDetailTabKey = "details" | "allocations";

export const SUPPLIER_PAYMENT_DETAIL_TAB_KEYS: readonly SupplierPaymentDetailTabKey[] = [
  "details",
  "allocations",
] as const;

/** Details is the default, so it is spelled as the bare route. */
export const DEFAULT_SUPPLIER_PAYMENT_DETAIL_TAB: SupplierPaymentDetailTabKey = "details";

export const SUPPLIER_PAYMENT_DETAIL_TAB_QUERY_KEY = "tab";

export function isSupplierPaymentDetailTabKey(
  value: string | null | undefined,
): value is SupplierPaymentDetailTabKey {
  return SUPPLIER_PAYMENT_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Details rather than throwing. */
export function parseSupplierPaymentDetailTab(
  value: string | null | undefined,
): SupplierPaymentDetailTabKey {
  return isSupplierPaymentDetailTabKey(value) ? value : DEFAULT_SUPPLIER_PAYMENT_DETAIL_TAB;
}

/** The canonical URL for one tab of one payment, preserving any other params. */
export function supplierPaymentDetailTabHref(
  paymentId: string,
  tab: SupplierPaymentDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_SUPPLIER_PAYMENT_DETAIL_TAB) {
    next.delete(SUPPLIER_PAYMENT_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(SUPPLIER_PAYMENT_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.purchasingPayments}/${paymentId}`;
  return query ? `${base}?${query}` : base;
}
