"use client";

import Link from "next/link";
import type { JSX } from "react";

import type { SupplierPaymentDetailTabKey } from "@/components/purchasing/supplier-payment-detail-tabs";
import {
  SUPPLIER_PAYMENT_DETAIL_TABPANEL_ID,
  SupplierPaymentDetailViewTabs,
} from "@/components/purchasing/supplier-payment-detail-view-tabs";
import { ROUTES } from "@/constants/routes";
import type { SupplierPayment } from "@/types/purchasing";

type SupplierPaymentDetailsPanelProps = {
  activeTab: SupplierPaymentDetailTabKey;
  onTabChange: (tab: SupplierPaymentDetailTabKey) => void;
  payment: SupplierPayment;
};

export function formatSupplierPaymentMoney(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function formatSupplierPaymentDate(value: string): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value));
}

function DetailRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="grid gap-0.5 rounded-lg bg-muted px-3 py-2">
      <span className="text-meta text-foreground-muted">{label}</span>
      <span className="break-words text-cell font-medium tabular-nums">{value}</span>
    </div>
  );
}

/**
 * The body of a payment made: the tab strip and whichever panel is selected.
 * Shared by the full page and the drawer over the list, which is why the tab
 * is a prop rather than state.
 */
export function SupplierPaymentDetailsPanel({
  activeTab,
  onTabChange,
  payment,
}: SupplierPaymentDetailsPanelProps): JSX.Element {
  return (
    <div className="grid gap-6">
      <SupplierPaymentDetailViewTabs
        active={activeTab}
        allocationsCount={payment.allocations.length}
        onTabChange={onTabChange}
        paymentId={payment.id}
      />

      <div id={SUPPLIER_PAYMENT_DETAIL_TABPANEL_ID} role="tabpanel" tabIndex={-1}>
        {activeTab === "details" ? (
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-2 md:gap-3">
              <DetailRow label="Amount" value={formatSupplierPaymentMoney(payment.amount)} />
              <DetailRow
                label="Used for bills"
                value={formatSupplierPaymentMoney(payment.allocatedAmount)}
              />
              <DetailRow
                label="Supplier advance"
                value={formatSupplierPaymentMoney(payment.unappliedAmount)}
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <DetailRow label="Supplier" value={payment.supplierName} />
              <DetailRow label="Branch" value={payment.branchName} />
              <DetailRow
                label="Payment date"
                value={formatSupplierPaymentDate(payment.paymentDate)}
              />
              <DetailRow
                label="Method"
                value={`${payment.paymentMethodName}${payment.paymentMethodType ? ` · ${payment.paymentMethodType.replace("_", " ")}` : ""}`}
              />
              <DetailRow label="Paid through" value={payment.paidThroughAccountName ?? "—"} />
              <DetailRow label="Reference" value={payment.referenceNumber ?? "—"} />
              <DetailRow label="Paid by" value={payment.paidByUserName} />
              <DetailRow label="Recorded at" value={formatSupplierPaymentDate(payment.paidAt)} />
            </div>
            <DetailRow label="Notes" value={payment.notes ?? "No notes"} />
          </div>
        ) : null}

        {activeTab === "allocations" ? (
          payment.allocations.length === 0 ? (
            <p className="rounded-lg border border-dashed border-border p-4 text-cell text-foreground-muted">
              No bills were settled by this payment. The full amount is held as supplier advance.
            </p>
          ) : (
            <div className="grid gap-2">
              {payment.allocations.map((allocation) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted px-3 py-2"
                  key={allocation.id}
                >
                  <Link
                    className="font-mono text-cell font-medium hover:underline"
                    href={`${ROUTES.purchasingInvoices}/${allocation.purchaseInvoiceId}`}
                  >
                    {allocation.invoiceNumber}
                  </Link>
                  <span className="text-cell font-medium tabular-nums">
                    {formatSupplierPaymentMoney(allocation.amount)}
                  </span>
                </div>
              ))}
            </div>
          )
        ) : null}
      </div>
    </div>
  );
}
