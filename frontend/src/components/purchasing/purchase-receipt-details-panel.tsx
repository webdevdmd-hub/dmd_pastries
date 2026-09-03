"use client";

import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { PurchaseDocumentChain } from "@/components/purchasing/purchase-document-chain";
import { PurchaseReceiptAccountingBadge } from "@/components/purchasing/purchase-receipt-accounting-badge";
import type { PurchaseReceiptDetailTabKey } from "@/components/purchasing/purchase-receipt-detail-tabs";
import {
  PURCHASE_RECEIPT_DETAIL_TABPANEL_ID,
  PurchaseReceiptDetailViewTabs,
} from "@/components/purchasing/purchase-receipt-detail-view-tabs";
import { PurchaseReturnStatusBadge } from "@/components/purchasing/purchase-return-status-badge";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { ROUTES } from "@/constants/routes";
import { usePurchaseOrderDocumentChain, usePurchaseReceiptReturns } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import type { PurchaseReceipt } from "@/types/purchasing";

type PurchaseReceiptDetailsPanelProps = {
  activeTab: PurchaseReceiptDetailTabKey;
  canView: boolean;
  onTabChange: (tab: PurchaseReceiptDetailTabKey) => void;
  receipt: PurchaseReceipt;
};

export function formatPurchaseReceiptMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatPurchaseReceiptDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

export function linkedPurchaseOrderLabel(receipt: PurchaseReceipt): string {
  return (
    receipt.purchaseOrderNumber ??
    (receipt.purchaseOrderId ? "PO number unavailable" : "Not linked")
  );
}

export function linkedPurchaseInvoiceLabel(receipt: PurchaseReceipt): string {
  return (
    receipt.purchaseInvoiceNumber ??
    (receipt.purchaseInvoiceId ? "Bill number unavailable" : "Not linked")
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="break-words text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * The body of a receive-goods record: the tab strip and whichever panel is
 * selected. Shared by the full page and the drawer over the list, which is
 * why the tab is a prop rather than state.
 */
export function PurchaseReceiptDetailsPanel({
  activeTab,
  canView,
  onTabChange,
  receipt,
}: PurchaseReceiptDetailsPanelProps): JSX.Element {
  // Both lists load with the panel rather than only on their tab: the credit
  // count badges the strip, and the chain is small.
  const chainQuery = usePurchaseOrderDocumentChain(
    receipt.purchaseOrderId,
    canView && receipt.purchaseOrderId !== null,
  );
  const returnsQuery = usePurchaseReceiptReturns(
    receipt.id,
    canView && receipt.status === "posted",
  );
  const credits = returnsQuery.data ?? [];

  return (
    <div className="grid min-w-0 gap-6">
      <PurchaseReceiptDetailViewTabs
        active={activeTab}
        creditsCount={credits.length}
        itemsCount={receipt.items.length}
        onTabChange={onTabChange}
        receiptId={receipt.id}
      />

      <div
        className="min-w-0"
        id={PURCHASE_RECEIPT_DETAIL_TABPANEL_ID}
        role="tabpanel"
        tabIndex={-1}
      >
        {activeTab === "items" ? (
          <PurchasingItemLines lines={receipt.items} title="Received items" />
        ) : null}

        {activeTab === "documents" ? (
          <div className="grid gap-6">
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailRow
                label="Linked purchase order"
                value={
                  receipt.purchaseOrderId ? (
                    <Link
                      className="font-mono hover:underline"
                      href={`${ROUTES.purchasingOrders}/${receipt.purchaseOrderId}`}
                    >
                      {linkedPurchaseOrderLabel(receipt)}
                    </Link>
                  ) : (
                    "Not linked"
                  )
                }
              />
              <DetailRow
                label="Linked bill"
                value={
                  receipt.purchaseInvoiceId ? (
                    <Link
                      className="font-mono hover:underline"
                      href={`${ROUTES.purchasingInvoices}/${receipt.purchaseInvoiceId}`}
                    >
                      {linkedPurchaseInvoiceLabel(receipt)}
                    </Link>
                  ) : (
                    "Not linked"
                  )
                }
              />
              <DetailRow label="Received by" value={receipt.receivedByUserName} />
              <DetailRow
                label="Received date"
                value={formatPurchaseReceiptDate(receipt.receivedDate)}
              />
            </div>

            <div className="rounded-lg bg-muted p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-meta text-foreground-muted">Accounting status</p>
                  <p className="mt-0.5 text-cell font-medium">{receipt.accountingStatusLabel}</p>
                </div>
                <PurchaseReceiptAccountingBadge receipt={receipt} />
              </div>
              <p className="mt-2 text-cell text-foreground-muted">
                {receipt.accountingStatusDetail}
              </p>
            </div>

            {receipt.purchaseOrderId ? (
              <PurchaseDocumentChain
                chain={chainQuery.data}
                error={chainQuery.error}
                isLoading={chainQuery.isLoading}
                onRetry={() => {
                  void chainQuery.refetch();
                }}
              />
            ) : (
              <p className="text-cell text-foreground-muted">
                This receipt is not linked to a purchase order, so there is no document chain to
                trace.
              </p>
            )}

            <p className="text-meta text-foreground-muted">
              Receipt item rows carry their inventory item and stock movement ids once the backend
              has posted the stock-in records.
            </p>
          </div>
        ) : null}

        {activeTab === "credits" ? (
          <div className="grid gap-3">
            {receipt.status !== "posted" ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-cell text-foreground-muted">
                Vendor credits can only be raised against a posted receipt.
              </p>
            ) : null}
            {returnsQuery.isLoading ? (
              <p className="text-cell text-foreground-muted">Loading vendor credits...</p>
            ) : null}
            {returnsQuery.error ? (
              <p className="text-cell text-danger-text">{getErrorMessage(returnsQuery.error)}</p>
            ) : null}
            {receipt.status === "posted" &&
            !returnsQuery.isLoading &&
            !returnsQuery.error &&
            credits.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border p-4 text-cell text-foreground-muted">
                No vendor credits have been raised against this receipt.
              </p>
            ) : null}
            {credits.map((purchaseReturn) => (
              <Link
                className="grid gap-2 rounded-lg bg-muted px-3 py-2 transition-colors duration-fast ease-out hover:bg-muted/70"
                href={`${ROUTES.purchasingReturns}/${purchaseReturn.id}`}
                key={purchaseReturn.id}
              >
                <span className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-mono text-cell font-medium">
                    {purchaseReturn.returnNumber}
                  </span>
                  <PurchaseReturnStatusBadge status={purchaseReturn.status} />
                </span>
                <span className="flex flex-wrap items-center justify-between gap-2 text-meta tabular-nums text-foreground-muted">
                  <span>{formatPurchaseReceiptDate(purchaseReturn.returnDate)}</span>
                  <span className="font-medium text-foreground">
                    {formatPurchaseReceiptMoney(purchaseReturn.returnTotal)}
                  </span>
                </span>
              </Link>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
