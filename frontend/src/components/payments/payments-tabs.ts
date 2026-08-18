import { ROUTES } from "@/constants/routes";

/**
 * Tab identity for /payments, kept out of the client shell on purpose.
 *
 * The server page parses `?tab=` and needs `isPaymentsTab`. A function exported
 * from a `"use client"` module cannot be called on the server — React only
 * carries component references across that boundary, not arbitrary functions —
 * so importing it from payments-tab-shell.tsx throws at request time. Neither
 * typecheck nor lint catches it; the page just renders the error boundary.
 */
export const PAYMENTS_TABS = ["activity", "refunds", "returns", "reconciliation"] as const;

export type PaymentsTab = (typeof PAYMENTS_TABS)[number];

export const PAYMENTS_TAB_LABELS: Record<PaymentsTab, string> = {
  activity: "Activity",
  refunds: "Refunds",
  returns: "Returns",
  reconciliation: "Reconciliation",
};

export function isPaymentsTab(value: string | undefined): value is PaymentsTab {
  return PAYMENTS_TABS.some((tab) => tab === value);
}

/** Unknown or missing tab resolves to Activity: a stale bookmark should land on
 *  the work surface rather than a 404. */
export function parsePaymentsTab(value: string | undefined): PaymentsTab {
  return isPaymentsTab(value) ? value : "activity";
}

export function paymentsTabHref(tab: PaymentsTab): string {
  return tab === "activity" ? ROUTES.payments : `${ROUTES.payments}?tab=${tab}`;
}
