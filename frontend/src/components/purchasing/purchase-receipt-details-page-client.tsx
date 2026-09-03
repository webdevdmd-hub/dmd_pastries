"use client";

import { RotateCcw } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReceiptAccountingBadge } from "@/components/purchasing/purchase-receipt-accounting-badge";
import {
  parsePurchaseReceiptDetailTab,
  type PurchaseReceiptDetailTabKey,
} from "@/components/purchasing/purchase-receipt-detail-tabs";
import {
  formatPurchaseReceiptDate,
  PurchaseReceiptDetailsPanel,
} from "@/components/purchasing/purchase-receipt-details-panel";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import { PurchaseReturnDialog } from "@/components/purchasing/purchase-return-dialog";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { Button } from "@/components/ui/button";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useStockLocations } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import { usePostPurchaseReceipt, usePurchaseReceipt } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

export function PurchaseReceiptDetailsPageClient({
  receiptId,
}: {
  receiptId: string;
}): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canPost = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsPost,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const canReturn = hasAnyPermission([
    PERMISSIONS.purchasingReturnsCreate,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const receiptQuery = usePurchaseReceipt(receiptId, canView);
  const stockLocationsQuery = useStockLocations(canView && canReturn);
  const postMutation = usePostPurchaseReceipt();

  const activeTab = parsePurchaseReceiptDetailTab(searchParams.get("tab"));

  const changeTab = (tab: PurchaseReceiptDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "items") {
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

  if (receiptQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (receiptQuery.error || !receiptQuery.data) {
    return (
      <PurchaseErrorState
        description={
          receiptQuery.error
            ? getErrorMessage(receiptQuery.error)
            : "Receive goods record not found."
        }
        onRetry={() => {
          void receiptQuery.refetch();
        }}
      />
    );
  }

  const receipt = receiptQuery.data;
  const canPostReceipt = canPost && receipt.status === "draft";

  const handlePost = async (): Promise<void> => {
    try {
      await postMutation.mutateAsync(receipt.id);
      toast.success("Receive goods posted and stock updated.");
      await receiptQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <Link
            className="inline-flex items-center gap-1.5 text-cell text-foreground-muted transition-colors hover:text-foreground"
            href={ROUTES.purchasingReceipts}
          >
            Back to receive goods
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="font-mono text-page">{receipt.receiptNumber}</h1>
            <PurchaseReceiptStatusBadge status={receipt.status} />
            <PurchaseReceiptAccountingBadge receipt={receipt} />
          </div>
          <p className="mt-1 text-meta text-foreground-muted">
            {receipt.supplierName} · {receipt.branchName} · Received{" "}
            <span className="tabular-nums">{formatPurchaseReceiptDate(receipt.receivedDate)}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canPostReceipt ? (
            <Button
              disabled={postMutation.isPending}
              onClick={() => void handlePost()}
              type="button"
            >
              Post receive goods
            </Button>
          ) : null}
          {canReturn && receipt.status === "posted" ? (
            <Button onClick={() => setReturnDialogOpen(true)} type="button" variant="outline">
              <RotateCcw className="h-4 w-4" />
              Return items
            </Button>
          ) : null}
        </div>
      </div>

      <PurchaseReceiptDetailsPanel
        activeTab={activeTab}
        canView={canView}
        onTabChange={changeTab}
        receipt={receipt}
      />

      <PurchaseReturnDialog
        onClose={() => setReturnDialogOpen(false)}
        open={returnDialogOpen}
        receipt={receipt}
        stockLocations={stockLocationsQuery.data ?? []}
      />
    </div>
  );
}
