"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseSupplierPaymentDialog } from "@/components/purchasing/purchase-supplier-payment-dialog";
import { PurchaseSupplierPaymentsTable } from "@/components/purchasing/purchase-supplier-payments-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { usePaymentMethods } from "@/hooks/use-payments";
import { useAddSupplierInvoicePayment, useSupplierInvoicePayments } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import type { AddSupplierPaymentPayload, PurchaseInvoice } from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function PurchaseInvoicePaymentsSection({
  canManage,
  invoice,
}: {
  canManage: boolean;
  invoice: PurchaseInvoice;
}): JSX.Element {
  const [dialogOpen, setDialogOpen] = useState(false);
  const paymentsQuery = useSupplierInvoicePayments(invoice.id, true);
  const methodsQuery = usePaymentMethods(canManage);
  const addPaymentMutation = useAddSupplierInvoicePayment();
  const canAddPayment = canManage && invoice.status === "posted" && invoice.balanceAmount > 0;
  const purchasingPaymentMethods = (methodsQuery.data ?? []).filter(
    (method) => method.status === "active" && method.showInPurchasing,
  );

  const handleAddPayment = async (payload: AddSupplierPaymentPayload): Promise<void> => {
    try {
      await addPaymentMutation.mutateAsync({ invoiceId: invoice.id, payload });
      toast.success("Payment made recorded.");
      setDialogOpen(false);
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <Card className="bg-white/85">
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <CardTitle>Payments Made</CardTitle>
          <p className="mt-1 text-sm text-brand-mocha">
            Money paid out for this bill. Balance:{" "}
            <span className="font-semibold text-brand-espresso">
              {formatCurrency(invoice.balanceAmount)}
            </span>
          </p>
        </div>
        <Button
          disabled={!canAddPayment}
          onClick={() => setDialogOpen(true)}
          size="sm"
          type="button"
        >
          <Plus className="h-4 w-4" />
          Add Payment
        </Button>
      </CardHeader>
      <CardContent>
        {invoice.status !== "posted" ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino bg-brand-latte/50 p-4 text-sm text-brand-mocha">
            Post the bill before recording payments.
          </p>
        ) : null}
        {invoice.status === "posted" && invoice.balanceAmount <= 0 ? (
          <p className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            This bill is fully paid.
          </p>
        ) : null}
        {paymentsQuery.isLoading ? (
          <p className="rounded-2xl border border-brand-cappuccino/60 p-4 text-sm text-brand-mocha">
            Loading payments made...
          </p>
        ) : null}
        {paymentsQuery.error ? (
          <PurchaseErrorState
            description={getErrorMessage(paymentsQuery.error)}
            onRetry={() => {
              void paymentsQuery.refetch();
            }}
          />
        ) : null}
        {!paymentsQuery.isLoading &&
        !paymentsQuery.error &&
        (paymentsQuery.data ?? []).length > 0 ? (
          <PurchaseSupplierPaymentsTable payments={paymentsQuery.data ?? []} showSupplier={false} />
        ) : null}
        {!paymentsQuery.isLoading &&
        !paymentsQuery.error &&
        (paymentsQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            No payments made yet.
          </p>
        ) : null}
      </CardContent>
      <PurchaseSupplierPaymentDialog
        balanceAmount={invoice.balanceAmount}
        invoiceNumber={invoice.invoiceNumber}
        isSubmitting={addPaymentMutation.isPending}
        methods={purchasingPaymentMethods}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleAddPayment}
        open={dialogOpen}
      />
    </Card>
  );
}
