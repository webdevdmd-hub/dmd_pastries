"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import {
  DEFAULT_PURCHASE_INVOICE_DETAIL_TAB,
  type PurchaseInvoiceDetailTabKey,
} from "@/components/purchasing/purchase-invoice-detail-tabs";
import {
  formatPurchaseInvoiceDate,
  formatPurchaseInvoiceMoney,
  PurchaseInvoiceDetailsPanel,
} from "@/components/purchasing/purchase-invoice-details-panel";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
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
import { usePurchaseInvoice } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import type { PurchaseInvoice } from "@/types/purchasing";

type PurchaseInvoiceDetailsDrawerProps = {
  canManagePayments: boolean;
  canView: boolean;
  invoiceId: string | null;
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((invoice: PurchaseInvoice) => void) | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
};

/**
 * One bill in a sheet over the list. The list rows carry only a summary, so
 * the drawer fetches the record itself. The tab is plain state here; the
 * header offers the full page for anyone who wants a URL.
 */
export function PurchaseInvoiceDetailsDrawer({
  canManagePayments,
  canView,
  invoiceId,
  onEdit,
  onOpenChange,
  open,
}: PurchaseInvoiceDetailsDrawerProps): JSX.Element {
  const invoiceQuery = usePurchaseInvoice(invoiceId, open && invoiceId !== null && canView);

  // Radix requires a title in every dialog. The body renders the bill number;
  // the states before it name the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Bill details</SheetTitle>
      <SheetDescription>Details of the selected bill.</SheetDescription>
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
        ) : invoiceQuery.isLoading ? (
          <>
            {fallbackTitle}
            <PurchaseTableSkeleton />
          </>
        ) : invoiceQuery.error || !invoiceQuery.data ? (
          <>
            {fallbackTitle}
            <PurchaseErrorState
              description={
                invoiceQuery.error ? getErrorMessage(invoiceQuery.error) : "Bill not found."
              }
              onRetry={() => void invoiceQuery.refetch()}
            />
          </>
        ) : (
          // Keyed by bill so switching bills resets the tab.
          <PurchaseInvoiceDetailsDrawerBody
            canManagePayments={canManagePayments}
            invoice={invoiceQuery.data}
            key={invoiceQuery.data.id}
            onEdit={onEdit}
          />
        )}
      </SheetContent>
    </Sheet>
  );
}

function PurchaseInvoiceDetailsDrawerBody({
  canManagePayments,
  invoice,
  onEdit,
}: {
  canManagePayments: boolean;
  invoice: PurchaseInvoice;
  onEdit: ((invoice: PurchaseInvoice) => void) | undefined;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<PurchaseInvoiceDetailTabKey>(
    DEFAULT_PURCHASE_INVOICE_DETAIL_TAB,
  );
  const detailHref = `${ROUTES.purchasingInvoices}/${invoice.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="font-mono text-page">{invoice.invoiceNumber}</SheetTitle>
          <PurchaseInvoiceStatusBadge status={invoice.status} />
          <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
        </div>
        <SheetDescription>
          {invoice.supplierName} · {invoice.branchName} · Billed{" "}
          <span className="tabular-nums">{formatPurchaseInvoiceDate(invoice.invoiceDate)}</span> ·
          Due <span className="tabular-nums">{formatPurchaseInvoiceDate(invoice.dueDate)}</span>
        </SheetDescription>
        <p className="text-kpi tabular-nums">
          {formatPurchaseInvoiceMoney(invoice.totalAmount)}
          {invoice.balanceAmount > 0 && invoice.balanceAmount !== invoice.totalAmount ? (
            <span className="ml-2 text-cell font-normal text-foreground-muted">
              {formatPurchaseInvoiceMoney(invoice.balanceAmount)} still due
            </span>
          ) : null}
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {onEdit && invoice.status !== "cancelled" ? (
            <Button onClick={() => onEdit(invoice)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit bill
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <PurchaseInvoiceDetailsPanel
        activeTab={activeTab}
        canManagePayments={canManagePayments}
        invoice={invoice}
        onTabChange={setActiveTab}
      />
    </div>
  );
}
