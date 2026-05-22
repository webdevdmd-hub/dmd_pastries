"use client";

import { FilePlus2, PackageCheck, ReceiptText, Truck, WalletCards } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchasingSummaryCards } from "@/components/purchasing/purchasing-summary-cards";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import { usePurchasingSummary } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

const quickActions = [
  {
    description: "Draft and send supplier orders before stock is received.",
    href: ROUTES.purchasingOrders,
    icon: FilePlus2,
    label: "Create Purchase Order",
  },
  {
    description: "Record supplier invoices and post payable totals.",
    href: ROUTES.purchasingInvoices,
    icon: ReceiptText,
    label: "Create Purchase Invoice",
  },
  {
    description: "Receive supplier stock and update inventory quantities.",
    href: ROUTES.purchasingReceipts,
    icon: PackageCheck,
    label: "Receive Stock",
  },
  {
    description: "Track outgoing supplier payments against posted purchase invoices.",
    href: ROUTES.purchasingPayments,
    icon: WalletCards,
    label: "Supplier Payments",
  },
  {
    description: "Supplier history foundation links purchasing back to supplier profiles.",
    href: ROUTES.suppliers,
    icon: Truck,
    label: "Supplier History",
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
        description="Manage supplier orders, purchase invoices, receiving, and stock-in operations."
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {quickActions.map((action) => {
          const Icon = action.icon;
          return (
            <Link href={action.href} key={action.label}>
              <Card className="h-full bg-white/85 transition hover:-translate-y-0.5 hover:shadow-float">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <span className="rounded-2xl bg-brand-latte p-3 text-brand-mocha">
                      <Icon className="h-5 w-5" />
                    </span>
                    <CardTitle className="text-lg">{action.label}</CardTitle>
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
