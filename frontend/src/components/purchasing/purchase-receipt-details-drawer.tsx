"use client";

import { ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReceiptAccountingBadge } from "@/components/purchasing/purchase-receipt-accounting-badge";
import {
  DEFAULT_PURCHASE_RECEIPT_DETAIL_TAB,
  type PurchaseReceiptDetailTabKey,
} from "@/components/purchasing/purchase-receipt-detail-tabs";
import {
  formatPurchaseReceiptDate,
  PurchaseReceiptDetailsPanel,
} from "@/components/purchasing/purchase-receipt-details-panel";
import { PurchaseReceiptStatusBadge } from "@/components/purchasing/purchase-receipt-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import { usePurchaseReceipt } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import type { PurchaseReceipt } from "@/types/purchasing";

type PurchaseReceiptDetailsDrawerProps = {
  canPost: boolean;
  canReturn: boolean;
  canView: boolean;
  onOpenChange: (open: boolean) => void;
  /** Opens the post confirmation in the host's own dialog flow. */
  onPost?: ((receipt: PurchaseReceipt) => void) | undefined;
  /** Opens the return dialog in the host's own modal flow. */
  onReturn?: ((receipt: PurchaseReceipt) => void) | undefined;
  open: boolean;
  receiptId: string | null;
};

/**
 * One receive-goods record in a sheet over the list. The list rows carry only
 * a summary, so the drawer fetches the record itself. The tab is plain state
 * here; the header offers the full page for anyone who wants a URL.
 */
export function PurchaseReceiptDetailsDrawer({
  canPost,
  canReturn,
  canView,
  onOpenChange,
  onPost,
  onReturn,
  open,
  receiptId,
}: PurchaseReceiptDetailsDrawerProps): JSX.Element {
  const receiptQuery = usePurchaseReceipt(receiptId, open && receiptId !== null && canView);

  // Radix requires a title in every dialog. The body renders the receipt
  // number; the states before it name the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Receive goods details</SheetTitle>
      <SheetDescription>Details of the selected receive goods record.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {!canView ? (
          <>
            {fallbackTitle}
            <AccessDeniedCard />
          </>
        ) : receiptQuery.isLoading ? (
          <>
            {fallbackTitle}
            <PurchaseTableSkeleton />
          </>
        ) : receiptQuery.error || !receiptQuery.data ? (
          <>
            {fallbackTitle}
            <PurchaseErrorState
              description={
                receiptQuery.error
                  ? getErrorMessage(receiptQuery.error)
                  : "Receive goods record not found."
              }
              onRetry={() => void receiptQuery.refetch()}
            />
          </>
        ) : (
          // Keyed by receipt so switching records resets the tab.
          <PurchaseReceiptDetailsDrawerBody
            canPost={canPost}
            canReturn={canReturn}
            canView={canView}
            key={receiptQuery.data.id}
            onPost={onPost}
            onReturn={onReturn}
            receipt={receiptQuery.data}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PurchaseReceiptDetailsDrawerBody({
  canPost,
  canReturn,
  canView,
  onPost,
  onReturn,
  receipt,
}: {
  canPost: boolean;
  canReturn: boolean;
  canView: boolean;
  onPost: ((receipt: PurchaseReceipt) => void) | undefined;
  onReturn: ((receipt: PurchaseReceipt) => void) | undefined;
  receipt: PurchaseReceipt;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<PurchaseReceiptDetailTabKey>(
    DEFAULT_PURCHASE_RECEIPT_DETAIL_TAB,
  );
  const detailHref = `${ROUTES.purchasingReceipts}/${receipt.id}`;

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="font-mono text-page">{receipt.receiptNumber}</SheetTitle>
          <PurchaseReceiptStatusBadge status={receipt.status} />
          <PurchaseReceiptAccountingBadge receipt={receipt} />
        </div>
        <SheetDescription>
          {receipt.supplierName} · {receipt.branchName} · Received{" "}
          <span className="tabular-nums">{formatPurchaseReceiptDate(receipt.receivedDate)}</span>
        </SheetDescription>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canPost && onPost && receipt.status === "draft" ? (
            <Button onClick={() => onPost(receipt)} size="sm" type="button">
              Post receipt
            </Button>
          ) : null}
          {canReturn && onReturn && receipt.status === "posted" ? (
            <Button onClick={() => onReturn(receipt)} size="sm" type="button" variant="outline">
              <RotateCcw className="h-4 w-4" />
              Return items
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <PurchaseReceiptDetailsPanel
        activeTab={activeTab}
        canView={canView}
        onTabChange={setActiveTab}
        receipt={receipt}
      />
    </div>
  );
}
