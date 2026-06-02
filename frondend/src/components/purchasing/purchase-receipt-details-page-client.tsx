"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseDocumentChain } from "@/components/purchasing/purchase-document-chain";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import { PurchaseReturnDialog } from "@/components/purchasing/purchase-return-dialog";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useStockLocations } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import {
  usePostPurchaseReceipt,
  usePurchaseOrderDocumentChain,
  usePurchaseReceipt,
  usePurchaseReceiptReturns,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

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
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const receiptQuery = usePurchaseReceipt(receiptId, canView);
  const chainQuery = usePurchaseOrderDocumentChain(
    receiptQuery.data?.purchaseOrderId ?? null,
    canView && Boolean(receiptQuery.data?.purchaseOrderId),
  );
  const receiptReturnsQuery = usePurchaseReceiptReturns(
    receiptId,
    canView && receiptQuery.data?.status === "posted",
  );
  const stockLocationsQuery = useStockLocations(canView && canReturn);
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
          {canReturn && receipt.status === "posted" ? (
            <Button onClick={() => setReturnDialogOpen(true)} type="button" variant="outline">
              Return Items
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
      {receipt.purchaseOrderId ? (
        <PurchaseDocumentChain
          chain={chainQuery.data}
          error={chainQuery.error}
          isLoading={chainQuery.isLoading}
          onRetry={() => {
            void chainQuery.refetch();
          }}
        />
      ) : null}
      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Purchase returns / vendor credits</CardTitle>
        </CardHeader>
        <CardContent>
          {receiptReturnsQuery.isLoading ? (
            <p className="text-sm text-brand-mocha">Loading vendor credits...</p>
          ) : null}
          {receiptReturnsQuery.error ? (
            <p className="text-sm text-red-800">{getErrorMessage(receiptReturnsQuery.error)}</p>
          ) : null}
          {!receiptReturnsQuery.isLoading &&
          !receiptReturnsQuery.error &&
          (receiptReturnsQuery.data ?? []).length === 0 ? (
            <p className="text-sm text-brand-mocha">
              No vendor credits have been created for this receipt.
            </p>
          ) : null}
          <div className="grid gap-3 md:grid-cols-2">
            {(receiptReturnsQuery.data ?? []).map((purchaseReturn) => (
              <Link
                className="rounded-2xl border border-brand-cappuccino bg-brand-latte/40 p-4 transition hover:border-brand-caramel/70"
                href={`${ROUTES.purchasingReturns}/${purchaseReturn.id}`}
                key={purchaseReturn.id}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-brand-espresso">
                      {purchaseReturn.returnNumber}
                    </p>
                    <p className="text-xs text-brand-mocha">
                      {formatDate(purchaseReturn.returnDate)}
                    </p>
                  </div>
                  <PurchaseReturnStatusBadge status={purchaseReturn.status} />
                </div>
                <p className="mt-3 text-sm text-brand-mocha">
                  Credit total:{" "}
                  <span className="font-semibold text-brand-espresso">
                    {formatCurrency(purchaseReturn.returnTotal)}
                  </span>
                </p>
              </Link>
            ))}
          </div>
        </CardContent>
      </Card>
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
      <PurchaseReturnDialog
        onClose={() => {
          setReturnDialogOpen(false);
          void receiptReturnsQuery.refetch();
        }}
        open={returnDialogOpen}
        receipt={receipt}
        stockLocations={stockLocationsQuery.data ?? []}
      />
    </div>
  );
}
