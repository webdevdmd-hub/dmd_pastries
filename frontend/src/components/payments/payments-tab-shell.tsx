"use client";

import Link from "next/link";
import type { JSX } from "react";

import { PaymentsPageClient } from "@/components/payments/payments-page-client";
import {
  PAYMENTS_TAB_LABELS,
  PAYMENTS_TABS,
  type PaymentsTab,
  paymentsTabHref,
} from "@/components/payments/payments-tabs";
import { ReconciliationPageClient } from "@/components/payments/reconciliation-page-client";
import { RefundsPageClient } from "@/components/payments/refunds-page-client";
import { SalesReturnsPageClient } from "@/components/payments/sales-returns-page-client";
import { cn } from "@/lib/utils/cn";

/**
 * The four customer-payment surfaces under one route.
 *
 * They were four separate routes, and only the first had a sidebar entry — so
 * the overview carried four navigation cards to reach the other three, on top of
 * being a dashboard and a table. Folding them into URL-backed tabs is the same
 * shape /settings/payment-setup already uses.
 *
 * Rendered as links, not a JS tablist, because each tab is a real URL: the back
 * button, a bookmark and a pasted link all behave the way a person expects.
 *
 * Only the active panel mounts. Each page client owns its own queries, so
 * mounting all four would fire every payments, refunds, returns and
 * reconciliation request on each visit — the over-fetching this module was just
 * treated for.
 */
export function PaymentsTabShell({ activeTab }: { activeTab: PaymentsTab }): JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <nav
        aria-label="Payments sections"
        className="flex gap-1 overflow-x-auto border-b border-border"
      >
        {PAYMENTS_TABS.map((tab) => {
          const isActive = tab === activeTab;

          return (
            <Link
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "whitespace-nowrap border-b-2 px-3.5 py-2.5 text-cell font-medium transition-colors duration-fast ease-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? "border-primary text-foreground"
                  : "border-transparent text-foreground-muted hover:text-foreground",
              )}
              href={paymentsTabHref(tab)}
              key={tab}
            >
              {PAYMENTS_TAB_LABELS[tab]}
            </Link>
          );
        })}
      </nav>

      {activeTab === "activity" ? <PaymentsPageClient /> : null}
      {activeTab === "refunds" ? <RefundsPageClient /> : null}
      {activeTab === "returns" ? <SalesReturnsPageClient /> : null}
      {activeTab === "reconciliation" ? <ReconciliationPageClient /> : null}
    </div>
  );
}
