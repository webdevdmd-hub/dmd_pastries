"use client";

import { ExternalLink, Pencil } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import { SupplierPaymentStatusBadge } from "@/components/purchasing/purchase-supplier-payments-table";
import {
  DEFAULT_SUPPLIER_PAYMENT_DETAIL_TAB,
  type SupplierPaymentDetailTabKey,
} from "@/components/purchasing/supplier-payment-detail-tabs";
import {
  formatSupplierPaymentMoney,
  SupplierPaymentDetailsPanel,
} from "@/components/purchasing/supplier-payment-details-panel";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { ROUTES } from "@/constants/routes";
import type { SupplierPayment } from "@/types/purchasing";

type SupplierPaymentDetailsDrawerProps = {
  canManage: boolean;
  /** Opens the edit form in the host's own modal flow. */
  onEdit?: ((payment: SupplierPayment) => void) | undefined;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  payment: SupplierPayment | null;
};

/**
 * One payment made in a sheet over the ledger. The list rows already carry
 * the allocations, so the sheet needs no fetch of its own. The tab is plain
 * state here; the header offers the full page for anyone who wants a URL.
 */
export function SupplierPaymentDetailsDrawer({
  canManage,
  onEdit,
  onOpenChange,
  open,
  payment,
}: SupplierPaymentDetailsDrawerProps): JSX.Element {
  // Radix requires a title in every dialog. The body renders the supplier;
  // the empty state names the sheet invisibly.
  const fallbackTitle = (
    <SheetHeader className="sr-only">
      <SheetTitle>Payment details</SheetTitle>
      <SheetDescription>Details of the selected payment made.</SheetDescription>
    </SheetHeader>
  );

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        {payment ? (
          // Keyed by payment so switching payments resets the tab.
          <SupplierPaymentDetailsDrawerBody
            canManage={canManage}
            key={payment.id}
            onEdit={onEdit}
            payment={payment}
          />
        ) : (
          fallbackTitle
        )}
      </SheetContent>
    </Sheet>
  );
}

function SupplierPaymentDetailsDrawerBody({
  canManage,
  onEdit,
  payment,
}: {
  canManage: boolean;
  onEdit: ((payment: SupplierPayment) => void) | undefined;
  payment: SupplierPayment;
}): JSX.Element {
  const [activeTab, setActiveTab] = useState<SupplierPaymentDetailTabKey>(
    DEFAULT_SUPPLIER_PAYMENT_DETAIL_TAB,
  );
  const detailHref = `${ROUTES.purchasingPayments}/${payment.id}`;

  return (
    <div className="flex flex-col gap-6">
      <SheetHeader>
        <div className="flex flex-wrap items-center gap-3 pr-8">
          <SheetTitle className="text-page">{payment.supplierName}</SheetTitle>
          <SupplierPaymentStatusBadge status={payment.paymentStatus} />
        </div>
        <SheetDescription>
          {payment.paymentMethodName} · {payment.branchName}
        </SheetDescription>
        <p className="text-kpi tabular-nums">{formatSupplierPaymentMoney(payment.amount)}</p>
        <div className="flex flex-wrap gap-2 pt-1">
          <Button asChild size="sm" variant="outline">
            <Link href={detailHref}>
              <ExternalLink className="h-4 w-4" />
              Open full page
            </Link>
          </Button>
          {canManage && onEdit && payment.paymentStatus === "completed" ? (
            <Button onClick={() => onEdit(payment)} size="sm" type="button" variant="outline">
              <Pencil className="h-4 w-4" />
              Edit payment
            </Button>
          ) : null}
        </div>
      </SheetHeader>

      <SupplierPaymentDetailsPanel
        activeTab={activeTab}
        onTabChange={setActiveTab}
        payment={payment}
      />
    </div>
  );
}
