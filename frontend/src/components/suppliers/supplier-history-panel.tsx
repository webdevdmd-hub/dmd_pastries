"use client";

import type { JSX } from "react";

import {
  collectPurchasedItems,
  formatCurrency,
  itemKey,
  PanelEmpty,
  PanelError,
  PanelSkeleton,
  supplierScopedFilters,
} from "@/components/suppliers/supplier-purchasing-shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  usePurchaseInvoices,
  usePurchaseReturns,
  useSupplierPayments,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

/**
 * The ledger totals, plus what was actually bought.
 *
 * The four figures were `font-bold` (weight 700, outside the type system) and
 * carried no `tabular-nums`, so the digits shifted column as values changed.
 */
export function SupplierHistoryPanel({
  canView,
  supplierId,
}: {
  canView: boolean;
  supplierId: string;
}): JSX.Element {
  const filters = supplierScopedFilters(supplierId);
  const invoicesQuery = usePurchaseInvoices(filters.invoices, canView);
  const returnsQuery = usePurchaseReturns(filters.returns, canView);
  const paymentsQuery = useSupplierPayments(filters.payments, canView);

  if (invoicesQuery.isLoading || returnsQuery.isLoading || paymentsQuery.isLoading) {
    return <PanelSkeleton />;
  }

  const queryError = invoicesQuery.error ?? returnsQuery.error ?? paymentsQuery.error ?? null;
  const invoices = invoicesQuery.data ?? [];
  const returns = returnsQuery.data ?? [];
  const payments = paymentsQuery.data ?? [];

  const totalPurchased = invoices.reduce((total, invoice) => total + invoice.totalAmount, 0);
  const totalPaid = payments.reduce((total, payment) => total + payment.amount, 0);
  const outstanding = invoices.reduce((total, invoice) => total + invoice.balanceAmount, 0);
  const vendorCredits = returns.reduce((total, purchaseReturn) => {
    if (purchaseReturn.status === "cancelled" || purchaseReturn.status === "reversed") {
      return total;
    }

    return total + purchaseReturn.openCreditAmount;
  }, 0);
  const purchasedItems = collectPurchasedItems(invoices);

  const metrics = [
    { label: "Total purchased", value: formatCurrency(totalPurchased) },
    { label: "Paid to supplier", value: formatCurrency(totalPaid) },
    { label: "Outstanding", value: formatCurrency(outstanding) },
    { label: "Open vendor credits", value: formatCurrency(vendorCredits) },
  ];

  return (
    <div className="flex flex-col gap-4">
      {queryError ? (
        <PanelError
          message={getErrorMessage(queryError)}
          noun="purchase history"
          onRetry={() => {
            void invoicesQuery.refetch();
            void returnsQuery.refetch();
            void paymentsQuery.refetch();
          }}
        />
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div className="rounded-xl bg-muted p-4" key={metric.label}>
            <p className="text-meta text-foreground-muted">{metric.label}</p>
            <p className="mt-1.5 text-title tabular-nums">{metric.value}</p>
          </div>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Purchased items</CardTitle>
          <p className="mt-1 text-body text-foreground-muted">
            The most-bought lines across this supplier&apos;s bills.
          </p>
        </CardHeader>
        <CardContent>
          {purchasedItems.length > 0 ? (
            <div className="flex flex-col gap-2">
              {purchasedItems.map((item) => (
                <div
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                  key={itemKey(item)}
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{item.itemNameSnapshot}</p>
                    <p className="text-meta tabular-nums text-foreground-muted">
                      {item.quantity} {item.unitSymbol} at {formatCurrency(item.unitCost)}
                    </p>
                  </div>
                  <span className="shrink-0 font-medium tabular-nums">
                    {formatCurrency(item.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <PanelEmpty
              description="Item lines appear once a bill is posted against this supplier. Open a bill to see its full item table."
              title="No item lines yet"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
