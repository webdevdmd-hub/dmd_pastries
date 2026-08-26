"use client";

import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";

import {
  formatCurrency,
  formatDate,
  invoiceDocuments,
  orderDocuments,
  PanelEmpty,
  PanelError,
  PanelFiltered,
  PanelSkeleton,
  paymentDocuments,
  type RecentDocument,
  returnDocuments,
  supplierScopedFilters,
} from "@/components/suppliers/supplier-purchasing-shared";
import { SegmentedControl } from "@/components/ui/segmented-control";
import {
  usePurchaseInvoices,
  usePurchaseOrders,
  usePurchaseReturns,
  useSupplierPayments,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

type DocumentKind = "all" | "orders" | "bills" | "credits" | "payments";

/**
 * Every document linked to this supplier, filterable by kind.
 *
 * The old card showed the eight most recent and stopped there, with no way to
 * see the ninth and nothing saying eight was a cap. The list is complete now
 * and the segmented control narrows it by document type.
 */
export function SupplierDocumentsPanel({
  canView,
  supplierId,
}: {
  canView: boolean;
  supplierId: string;
}): JSX.Element {
  const [kind, setKind] = useState<DocumentKind>("all");
  const filters = supplierScopedFilters(supplierId);
  const ordersQuery = usePurchaseOrders(filters.orders, canView);
  const invoicesQuery = usePurchaseInvoices(filters.invoices, canView);
  const returnsQuery = usePurchaseReturns(filters.returns, canView);
  const paymentsQuery = useSupplierPayments(filters.payments, canView);

  if (
    ordersQuery.isLoading ||
    invoicesQuery.isLoading ||
    returnsQuery.isLoading ||
    paymentsQuery.isLoading
  ) {
    return <PanelSkeleton />;
  }

  const queryError =
    ordersQuery.error ?? invoicesQuery.error ?? returnsQuery.error ?? paymentsQuery.error ?? null;

  const orders = orderDocuments(ordersQuery.data ?? []);
  const bills = invoiceDocuments(invoicesQuery.data ?? []);
  const credits = returnDocuments(returnsQuery.data ?? []);
  const payments = paymentDocuments(paymentsQuery.data ?? []);

  const byKind: Record<DocumentKind, RecentDocument[]> = {
    all: [...bills, ...orders, ...credits, ...payments],
    orders,
    bills,
    credits,
    payments,
  };

  const documents = [...byKind[kind]].sort((first, second) => {
    const firstDate = first.date ? new Date(first.date).getTime() : 0;
    const secondDate = second.date ? new Date(second.date).getTime() : 0;
    return secondDate - firstDate;
  });

  return (
    <div className="flex flex-col gap-4">
      {queryError ? (
        <PanelError
          message={getErrorMessage(queryError)}
          noun="supplier documents"
          onRetry={() => {
            void ordersQuery.refetch();
            void invoicesQuery.refetch();
            void returnsQuery.refetch();
            void paymentsQuery.refetch();
          }}
        />
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label="Filter documents by type"
          onValueChange={setKind}
          options={[
            { label: "All", value: "all", badge: byKind.all.length },
            { label: "Orders", value: "orders", badge: orders.length },
            { label: "Bills", value: "bills", badge: bills.length },
            { label: "Credits", value: "credits", badge: credits.length },
            { label: "Payments", value: "payments", badge: payments.length },
          ]}
          value={kind}
        />
        <p className="text-meta tabular-nums text-foreground-muted">
          {documents.length} {documents.length === 1 ? "document" : "documents"}
        </p>
      </div>

      {documents.length > 0 ? (
        <div className="flex flex-col gap-2">
          {documents.map((document) => (
            <Link
              className="flex items-center justify-between gap-3 rounded-xl border border-border bg-card p-3 transition-colors hover:bg-muted"
              href={document.href}
              key={document.key}
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="rounded-lg bg-muted p-2 text-foreground-muted">
                  {document.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate">
                    <span className="text-meta text-foreground-muted">{document.label} </span>
                    <span className="font-mono font-medium">{document.number}</span>
                  </p>
                  <p className="text-meta tabular-nums text-foreground-muted">
                    {formatDate(document.date)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-3">
                <span className="font-medium tabular-nums">{formatCurrency(document.amount)}</span>
                {document.status}
              </div>
            </Link>
          ))}
        </div>
      ) : kind === "all" ? (
        <PanelEmpty
          description="Orders, bills, vendor credits and payments raised against this supplier collect here."
          title="No documents yet"
        />
      ) : (
        /* Documents exist, this chip excludes them. A filtered row with a way
           back, not the dashed empty card. */
        <PanelFiltered noun="documents" onClearFilters={() => setKind("all")} />
      )}
    </div>
  );
}
