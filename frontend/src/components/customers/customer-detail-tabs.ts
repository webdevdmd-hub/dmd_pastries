import { ROUTES } from "@/constants/routes";

/**
 * The five sections of a customer's detail page.
 *
 * They used to be stacked on one scroll: stats, store credit, profile beside
 * tags, notes, then recent transactions. Reaching the transactions meant
 * scrolling past every other section.
 */
export type CustomerDetailTabKey = "profile" | "tags" | "notes" | "transactions" | "credit";

export const CUSTOMER_DETAIL_TAB_KEYS: readonly CustomerDetailTabKey[] = [
  "profile",
  "tags",
  "notes",
  "transactions",
  "credit",
] as const;

/** Profile is the default, so it is spelled as the bare route. */
export const DEFAULT_CUSTOMER_DETAIL_TAB: CustomerDetailTabKey = "profile";

export const CUSTOMER_DETAIL_TAB_QUERY_KEY = "tab";

export function isCustomerDetailTabKey(
  value: string | null | undefined,
): value is CustomerDetailTabKey {
  return CUSTOMER_DETAIL_TAB_KEYS.some((key) => key === value);
}

/** Unknown or absent `?tab=` falls back to Profile rather than throwing. */
export function parseCustomerDetailTab(value: string | null | undefined): CustomerDetailTabKey {
  return isCustomerDetailTabKey(value) ? value : DEFAULT_CUSTOMER_DETAIL_TAB;
}

/** The canonical URL for one tab of one customer, preserving any other params. */
export function customerDetailTabHref(
  customerId: string,
  tab: CustomerDetailTabKey,
  params?: URLSearchParams,
): string {
  const next = new URLSearchParams(params?.toString() ?? "");
  if (tab === DEFAULT_CUSTOMER_DETAIL_TAB) {
    next.delete(CUSTOMER_DETAIL_TAB_QUERY_KEY);
  } else {
    next.set(CUSTOMER_DETAIL_TAB_QUERY_KEY, tab);
  }
  const query = next.toString();
  const base = `${ROUTES.customers}/${customerId}`;
  return query ? `${base}?${query}` : base;
}
