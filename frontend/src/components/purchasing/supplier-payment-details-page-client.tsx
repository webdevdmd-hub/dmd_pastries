"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { SupplierPaymentStatusBadge } from "@/components/purchasing/purchase-supplier-payments-table";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import {
  parseSupplierPaymentDetailTab,
  type SupplierPaymentDetailTabKey,
} from "@/components/purchasing/supplier-payment-detail-tabs";
import {
  formatSupplierPaymentMoney,
  SupplierPaymentDetailsPanel,
} from "@/components/purchasing/supplier-payment-details-panel";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import { useSupplierPayment } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

/**
 * The full page for one payment made, at /purchasing/payments/[id]. Read-only:
 * editing a payment reallocates bills, which is the list page's modal flow,
 * so the page links back there rather than duplicating it.
 */
export function SupplierPaymentDetailsPageClient({
  paymentId,
}: {
  paymentId: string;
}): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const paymentQuery = useSupplierPayment(paymentId, canView && branchScope.hasBranchScope);

  const activeTab = parseSupplierPaymentDetailTab(searchParams.get("tab"));

  const changeTab = (tab: SupplierPaymentDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "details") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  if (paymentQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (paymentQuery.error || !paymentQuery.data) {
    return (
      <PurchaseErrorState
        description={
          paymentQuery.error ? getErrorMessage(paymentQuery.error) : "Payment not found."
        }
        onRetry={() => {
          void paymentQuery.refetch();
        }}
      />
    );
  }

  const payment = paymentQuery.data;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="min-w-0">
        <Link
          className="inline-flex items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
          href={ROUTES.purchasingPayments}
        >
          Back to payments made
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-page">{payment.supplierName}</h1>
          <SupplierPaymentStatusBadge status={payment.paymentStatus} />
        </div>
        <p className="mt-1 text-meta text-foreground-muted">
          {payment.paymentMethodName} · {payment.branchName}
        </p>
        <p className="mt-2 text-kpi tabular-nums">{formatSupplierPaymentMoney(payment.amount)}</p>
      </div>

      <SupplierPaymentDetailsPanel
        activeTab={activeTab}
        onTabChange={changeTab}
        payment={payment}
      />
    </div>
  );
}
