"use client";

import Link from "next/link";
import type { JSX } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
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
  const receiptQuery = usePurchaseReceipt(receiptId, canView);
  const postMutation = usePostPurchaseReceipt();

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
          receiptQuery.error ? getErrorMessage(receiptQuery.error) : "Purchase receipt not found."
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
      toast.success("Receipt posted and stock updated.");
      await receiptQuery.refetch();
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.purchasingReceipts}
        >
          Back to Purchase Receipts
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">{receipt.receiptNumber}</h1>
          <PurchaseReceiptStatusBadge status={receipt.status} />
          {canPostReceipt ? (
            <Button
              disabled={postMutation.isPending}
              onClick={() => void handlePost()}
              type="button"
            >
              Post Receipt
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {receipt.supplierName} · {receipt.branchName}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Linked PO</p>
            <p className="text-lg font-semibold text-brand-espresso">
              {receipt.purchaseOrderId ?? "Not linked"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Linked Invoice</p>
            <p className="text-lg font-semibold text-brand-espresso">
              {receipt.purchaseInvoiceId ?? "Not linked"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Received By</p>
            <p className="text-lg font-semibold text-brand-espresso">
              {receipt.receivedByUserName}
            </p>
          </CardContent>
        </Card>
      </div>
      <PurchasingItemLines lines={receipt.items} title="Receipt items" />
      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Stock movement visibility</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">
            Receipt item rows include inventory item and stock movement IDs when the backend posts
            stock-in records.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
