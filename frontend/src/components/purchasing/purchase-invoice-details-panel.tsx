"use client";

import { AlertTriangle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { JSX, ReactNode } from "react";

import { AppBadge } from "@/components/app/app-badge";
import type { PurchaseInvoiceDetailTabKey } from "@/components/purchasing/purchase-invoice-detail-tabs";
import {
  PURCHASE_INVOICE_DETAIL_TABPANEL_ID,
  PurchaseInvoiceDetailViewTabs,
} from "@/components/purchasing/purchase-invoice-detail-view-tabs";
import { PurchaseInvoiceItemLines } from "@/components/purchasing/purchase-invoice-item-lines";
import { PurchaseInvoicePaymentsSection } from "@/components/purchasing/purchase-invoice-payments-section";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils/cn";
import type { PurchaseInvoice } from "@/types/purchasing";

type PurchaseInvoiceDetailsPanelProps = {
  activeTab: PurchaseInvoiceDetailTabKey;
  /** Whether payments may be recorded from the Payments tab. */
  canManagePayments: boolean;
  invoice: PurchaseInvoice;
  onTabChange: (tab: PurchaseInvoiceDetailTabKey) => void;
};

export function formatPurchaseInvoiceMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatPurchaseInvoiceDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function receiveStatusMeta(status: PurchaseInvoice["receiveStatus"]): {
  label: string;
  tone: "muted" | "warning" | "success";
} {
  if (status === "received") return { label: "Received", tone: "success" };
  if (status === "partially_received") return { label: "Partially received", tone: "warning" };
  return { label: "Not received", tone: "muted" };
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
 * The body of a bill: the tab strip and whichever panel is selected. Shared
 * by the full page and the drawer over the list, which is why the tab is a
 * prop rather than state.
 */
export function PurchaseInvoiceDetailsPanel({
  activeTab,
  canManagePayments,
  invoice,
  onTabChange,
}: PurchaseInvoiceDetailsPanelProps): JSX.Element {
  const isOverdue = invoice.paymentStatus === "overdue";
  const receiveStatus = receiveStatusMeta(invoice.receiveStatus);
  const billTotals = {
    balance: invoice.balanceAmount,
    billDiscount: invoice.billDiscountAmount,
    legacyCharges: invoice.chargeAmount + invoice.chargeTaxAmount,
    lineDiscounts: invoice.discountAmount,
    paid: invoice.paidAmount,
    subtotal: invoice.subtotalAmount,
    tax: invoice.taxAmount,
    total: invoice.totalAmount,
  };

  return (
    <div className="grid gap-6">
      <PurchaseInvoiceDetailViewTabs
        active={activeTab}
        invoiceId={invoice.id}
        itemsCount={invoice.items.length}
        onTabChange={onTabChange}
      />

      <div id={PURCHASE_INVOICE_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "items" ? (
          <div className="grid gap-6">
            {invoice.status === "cancelled" ? (
              <section className="rounded-md border border-danger/30 bg-danger-tint p-5">
                <div className="flex items-start gap-3">
                  <AlertTriangle
                    aria-hidden="true"
                    className="mt-0.5 h-5 w-5 shrink-0 text-danger-text"
                  />
                  <div className="min-w-0 flex-1">
                    <h2 className="text-cell font-medium text-danger-text">
                      This bill was cancelled
                    </h2>
                    <p className="mt-1 text-cell text-danger-text">
                      Cancelling a posted bill reverses the supplier payable, VAT, and inventory
                      impact where stock is still available.
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      <div>
                        <p className="text-meta text-danger-text">Cancelled at</p>
                        <p className="mt-1 text-cell font-medium tabular-nums text-danger-text">
                          {formatDateTime(invoice.cancelledAt)}
                        </p>
                      </div>
                      <div>
                        <p className="text-meta text-danger-text">Cancel reason</p>
                        <p className="mt-1 text-cell font-medium text-danger-text">
                          {invoice.cancelReason ?? "Not recorded"}
                        </p>
                      </div>
                      <div>
                        <p className="text-meta text-danger-text">Reversal journal</p>
                        {invoice.reversalJournalEntryId ? (
                          <Link
                            className="mt-1 inline-block text-cell font-medium text-danger-text underline-offset-4 hover:underline"
                            href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(
                              invoice.reversalJournalEntryId,
                            )}`}
                          >
                            View journal
                          </Link>
                        ) : (
                          <p className="mt-1 text-cell font-medium text-danger-text">
                            Not recorded
                          </p>
                        )}
                      </div>
                      <div>
                        <p className="text-meta text-danger-text">Cancelled receipt</p>
                        {invoice.cancelledReceiptId ? (
                          <Link
                            className="mt-1 inline-block text-cell font-medium text-danger-text underline-offset-4 hover:underline"
                            href={`${ROUTES.purchasingReceipts}/${invoice.cancelledReceiptId}`}
                          >
                            View receipt
                          </Link>
                        ) : (
                          <p className="mt-1 text-cell font-medium text-danger-text">
                            Not recorded
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            ) : null}

            {/* The table scrolls inside its section on a phone rather than
                pushing its host, a drawer or a page, wider than the screen. */}
            <section className="overflow-hidden rounded-md border border-workspace-border bg-card">
              <div className="border-b border-workspace-border px-5 py-4">
                <h2 className="text-title">Bill items</h2>
                <p className="mt-1 text-meta tabular-nums text-foreground-muted">
                  {invoice.items.length} line item{invoice.items.length === 1 ? "" : "s"} on this
                  bill.
                </p>
              </div>
              <div className="overflow-x-auto">
                <PurchaseInvoiceItemLines items={invoice.items} totals={billTotals} />
              </div>
            </section>
          </div>
        ) : null}

        {activeTab === "payments" ? (
          <PurchaseInvoicePaymentsSection canManage={canManagePayments} invoice={invoice} />
        ) : null}

        {activeTab === "details" ? (
          <div className="grid gap-4">
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailRow
                label="Bill no"
                value={<span className="font-mono">{invoice.invoiceNumber}</span>}
              />
              <DetailRow
                label="Invoice no (supplier)"
                value={invoice.supplierBillNumber ?? "Not recorded"}
              />
              <DetailRow label="Supplier" value={invoice.supplierName} />
              <DetailRow label="Branch" value={invoice.branchName} />
              <DetailRow label="Bill date" value={formatPurchaseInvoiceDate(invoice.invoiceDate)} />
              <DetailRow
                label="Due date"
                value={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      isOverdue ? "text-danger-text" : undefined,
                    )}
                  >
                    {isOverdue ? (
                      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : null}
                    {formatPurchaseInvoiceDate(invoice.dueDate)}
                  </span>
                }
              />
              <DetailRow
                label="Purchase order"
                value={
                  invoice.purchaseOrderId ? (
                    <Link
                      className="inline-flex items-center gap-1 font-mono underline-offset-4 hover:underline"
                      href={`${ROUTES.purchasingOrders}/${invoice.purchaseOrderId}`}
                    >
                      {invoice.purchaseOrderNumber ?? "View purchase order"}
                      <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    "Not linked to a purchase order"
                  )
                }
              />
              <DetailRow
                label="Goods receipt"
                value={<AppBadge tone={receiveStatus.tone}>{receiveStatus.label}</AppBadge>}
              />
              <DetailRow label="VAT mode" value={invoice.taxMode.replace("_", " ")} />
              <DetailRow label="Created by" value={invoice.createdByUserName} />
            </div>
            <DetailRow label="Notes" value={invoice.notes ?? "No notes recorded."} />
            <p className="text-meta tabular-nums text-foreground-muted">
              Created {formatDateTime(invoice.createdAt)}
              {invoice.updatedAt !== invoice.createdAt
                ? ` · Last updated ${formatDateTime(invoice.updatedAt)}`
                : ""}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
