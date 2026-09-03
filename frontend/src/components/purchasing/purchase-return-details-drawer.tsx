"use client";

import { ExternalLink } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import {
  DEFAULT_PURCHASE_RETURN_DETAIL_TAB,
  type PurchaseReturnDetailTabKey,
} from "@/components/purchasing/purchase-return-detail-tabs";
import {
  formatPurchaseReturnMoney,
  PurchaseReturnDetailsPanel,
} from "@/components/purchasing/purchase-return-details-panel";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
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
import { usePurchaseReturn } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import type { PurchaseReturn } from "@/types/purchasing";

export type PurchaseReturnActionHandlers = {
  canCancel: boolean;
  canPost: boolean;
  canReverse: boolean;
  onCancel: (purchaseReturn: PurchaseReturn) => void;
  onPost: (purchaseReturn: PurchaseReturn) => void;
  onReverse: (purchaseReturn: PurchaseReturn) => void;
};

type PurchaseReturnDetailsDrawerProps = PurchaseReturnActionHandlers & {
  canView: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  purchaseReturnId: string | null;
};

/**
 * One vendor credit in a sheet over the list. The list rows may carry their
 * lines, but the drawer fetches the record itself so the journal and
 * reversal links are current. The tab is plain state here; the header offers
 * the full page for anyone who wants a URL.
 */
export function PurchaseReturnDetailsDrawer({
  canCancel,
  canPost,
  canReverse,
  canView,
  onCancel,
  onOpenChange,
  onPost,
  onReverse,
  open,
  purchaseReturnId,
}: PurchaseReturnDetailsDrawerProps): JSX.Element {
  const returnQuery = usePurchaseReturn(
    purchaseReturnId,
    open && purchaseReturnId !== null && canView,
  );

  // Radix requires a title in every dialog. The body renders the note number;
  // the states before it name the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Vendor credit details</SheetTitle>
      <SheetDescription>Details of the selected vendor credit.</SheetDescription>
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
        ) : returnQuery.isLoading ? (
          <>
            {fallbackTitle}
            <PurchaseTableSkeleton />
          </>
        ) : returnQuery.error || !returnQuery.data ? (
          <>
            {fallbackTitle}
            <PurchaseErrorState
              description={
                returnQuery.error ? getErrorMessage(returnQuery.error) : "Vendor credit not found."
              }
              onRetry={() => void returnQuery.refetch()}
            />
          </>
        ) : (
          // Keyed by record so switching notes resets the tab.
          <PurchaseReturnDetailsDrawerBody
            canCancel={canCancel}
            canPost={canPost}
            canReverse={canReverse}
            key={returnQuery.data.id}
            onCancel={onCancel}
            onPost={onPost}
            onReverse={onReverse}
            purchaseReturn={returnQuery.data}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PurchaseReturnDetailsDrawerBody({
  canCancel,
  canPost,
  canReverse,
  onCancel,
  onPost,
  onReverse,
  purchaseReturn,
}: PurchaseReturnActionHandlers & { purchaseReturn: PurchaseReturn }): JSX.Element {
  const [activeTab, setActiveTab] = useState<PurchaseReturnDetailTabKey>(
    DEFAULT_PURCHASE_RETURN_DETAIL_TAB,
  );
  const detailHref = `${ROUTES.purchasingReturns}/${purchaseReturn.id}`;
  const isDraft = purchaseReturn.status === "draft";
  const isPosted = purchaseReturn.status === "posted";

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="font-mono text-page">{purchaseReturn.returnNumber}</SheetTitle>
          <PurchaseReturnStatusBadge status={purchaseReturn.status} />
        </div>
        <SheetDescription>
          {purchaseReturn.supplierName} · {purchaseReturn.branchName}
        </SheetDescription>
        <p className="text-kpi tabular-nums">
          {formatPurchaseReturnMoney(purchaseReturn.returnTotal)}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canPost && isDraft ? (
            <Button onClick={() => onPost(purchaseReturn)} size="sm" type="button">
              Post vendor credit
            </Button>
          ) : null}
          {canCancel && isDraft ? (
            <Button
              onClick={() => onCancel(purchaseReturn)}
              size="sm"
              type="button"
              variant="outline"
            >
              Cancel draft
            </Button>
          ) : null}
          {canReverse && isPosted ? (
            <Button
              onClick={() => onReverse(purchaseReturn)}
              size="sm"
              type="button"
              variant="outline"
            >
              Reverse vendor credit
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <PurchaseReturnDetailsPanel
        activeTab={activeTab}
        onTabChange={setActiveTab}
        purchaseReturn={purchaseReturn}
      />
    </div>
  );
}
