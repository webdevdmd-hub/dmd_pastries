"use client";

import type { JSX } from "react";

import type { CustomerDetailTabKey } from "@/components/customers/customer-detail-tabs";
import {
  CUSTOMER_DETAIL_TABPANEL_ID,
  CustomerDetailViewTabs,
} from "@/components/customers/customer-detail-view-tabs";
import { CustomerNotesSection } from "@/components/customers/customer-notes-section";
import { CustomerProfileCard } from "@/components/customers/customer-profile-card";
import { CustomerRecentTransactionsTable } from "@/components/customers/customer-recent-transactions-table";
import { CustomerStatsCards } from "@/components/customers/customer-stats-cards";
import { CustomerTagsSection } from "@/components/customers/customer-tags-section";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useCustomerCredits } from "@/hooks/use-customer-credits";
import { useCustomerNotes, useCustomerStats } from "@/hooks/use-customers";
import type { Customer } from "@/types/customer";

type CustomerDetailsPanelProps = {
  activeTab: CustomerDetailTabKey;
  canManage: boolean;
  canView: boolean;
  customer: Customer;
  onTabChange: (tab: CustomerDetailTabKey) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function creditLabel(sourceType: string, notes: string | null | undefined): string {
  if (notes) {
    return notes;
  }
  if (sourceType === "sales_return") {
    return "Sales return credit";
  }
  if (sourceType === "bakery_order") {
    return "Bakery order credit";
  }
  return "Manual credit";
}

/**
 * The body of a customer's details: stats, the tab strip, and whichever panel
 * is selected. Shared by the full page and the drawer over the list, which is
 * why the tab is a prop rather than state. The page keeps it in the URL; the
 * drawer keeps it in memory.
 */
export function CustomerDetailsPanel({
  activeTab,
  canManage,
  canView,
  customer,
  onTabChange,
}: CustomerDetailsPanelProps): JSX.Element {
  const statsQuery = useCustomerStats(customer.id, canView);
  const creditsQuery = useCustomerCredits(customer.id, canView);
  // Notes are a small list and their count badges the strip, so they load
  // with the panel rather than only when their tab opens.
  const notesQuery = useCustomerNotes(customer.id, canView);
  const credits = creditsQuery.data?.items ?? [];

  return (
    <div className="grid gap-6">
      <CustomerDetailViewTabs
        active={activeTab}
        customerId={customer.id}
        notesCount={notesQuery.data?.length}
        onTabChange={onTabChange}
        tagsCount={customer.tags.length}
      />

      {/* One panel element that swaps, which is what `aria-controls` on every
          tab points at. */}
      <div id={CUSTOMER_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {/* The nine stat cards live on the Profile tab rather than above the
            strip: on a phone they stand a full screen tall, which would put
            the tabs below the fold and bring the long scroll back. */}
        {activeTab === "profile" ? (
          <div className="grid gap-6">
            <CustomerStatsCards
              creditBalance={creditsQuery.data?.balance ?? 0}
              stats={statsQuery.data}
            />
            <CustomerProfileCard customer={customer} />
          </div>
        ) : null}
        {activeTab === "tags" ? (
          <CustomerTagsSection canManage={canManage} customer={customer} />
        ) : null}
        {activeTab === "notes" ? (
          <CustomerNotesSection canManage={canManage} customerId={customer.id} />
        ) : null}
        {activeTab === "transactions" ? (
          <CustomerRecentTransactionsTable
            transactions={statsQuery.data?.recentTransactions ?? []}
          />
        ) : null}
        {activeTab === "credit" ? (
          <Card className="bg-card/80">
            <CardHeader>
              <CardTitle className="text-title font-medium text-brand-espresso">
                Store credit
              </CardTitle>
            </CardHeader>
            <CardContent>
              {credits.length > 0 ? (
                <div className="grid gap-2">
                  {credits.map((credit) => (
                    <div
                      className="flex items-center justify-between gap-3 rounded-2xl border border-brand-cappuccino/60 p-3 text-sm"
                      key={credit.id}
                    >
                      <span className="min-w-0 text-brand-espresso">
                        {creditLabel(credit.sourceType, credit.notes)}
                      </span>
                      <span className="whitespace-nowrap font-medium tabular-nums text-brand-espresso">
                        {formatCurrency(credit.balance)}
                        <span className="ml-1 text-meta font-normal text-brand-mocha">
                          of {formatCurrency(credit.amount)}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
                  No store credit on this account. Credit is issued from a sales return or a
                  cancelled bakery order.
                </p>
              )}
            </CardContent>
          </Card>
        ) : null}
      </div>
    </div>
  );
}
