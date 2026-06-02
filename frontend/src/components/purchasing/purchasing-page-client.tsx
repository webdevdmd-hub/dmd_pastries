"use client";

import { FileText, PackageCheck, ReceiptText, RotateCcwSquare, WalletCards } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseLifecycleBoard } from "@/components/purchasing/purchase-lifecycle-board";
import { PurchasingSummaryCards } from "@/components/purchasing/purchasing-summary-cards";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { usePurchasingSummary } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

const documentCards = [
  {
    description: "Create supplier requests and convert them into bills when confirmed.",
    href: ROUTES.purchasingOrders,
    icon: FileText,
    label: "Purchase Orders",
  },
  {
    description: "Review draft bills, post payables, then convert to stock receipts.",
    href: ROUTES.purchasingInvoices,
    icon: ReceiptText,
    label: "Purchase Invoices / Bills",
  },
  {
    description: "Post received stock into inventory after invoice confirmation.",
    href: ROUTES.purchasingReceipts,
    icon: PackageCheck,
    label: "Stock Receipts",
  },
  {
    description: "Track money paid out against posted supplier invoices.",
    href: ROUTES.purchasingPayments,
    icon: WalletCards,
    label: "Supplier Payments",
  },
  {
    description: "Return damaged or excess stock and track supplier credits.",
    href: ROUTES.purchasingReturns,
    icon: RotateCcwSquare,
    label: "Purchase Returns / Vendor Credits",
  },
];

export function PurchasingPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const summaryQuery = usePurchasingSummary(canView);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Purchasing"
        description="Run the connected supplier workflow from order to bill, receipt, payment, and vendor credit."
      />

      {summaryQuery.error ? (
        <PurchaseErrorState
          description={getErrorMessage(summaryQuery.error)}
          onRetry={() => {
            void summaryQuery.refetch();
          }}
        />
      ) : (
        <PurchasingSummaryCards summary={summaryQuery.data} />
      )}

      <PurchaseLifecycleBoard summary={summaryQuery.data} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {documentCards.map((action) => {
          const Icon = action.icon;
          return (
            <Link href={action.href} key={action.label}>
              <Card className="h-full border-brand-cappuccino bg-white/85 transition hover:-translate-y-0.5 hover:border-brand-caramel hover:shadow-float">
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                      <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-base">{action.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-brand-mocha">{action.description}</p>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
