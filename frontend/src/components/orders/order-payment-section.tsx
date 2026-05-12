"use client";

import { CreditCard, Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { OrderPaymentDialog } from "@/components/orders/order-payment-dialog";
import { Button } from "@/components/ui/button";
import { useAddOrderPayment, useOrderPayments } from "@/hooks/use-orders";
import { usePaymentMethods } from "@/hooks/use-payments";
import { getErrorMessage } from "@/lib/api/client";
import type { BakeryOrder } from "@/types/orders";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function OrderPaymentSection({
  canManage,
  order,
}: {
  canManage: boolean;
  order: BakeryOrder | null;
}): JSX.Element {
  const [open, setOpen] = useState(false);
  const paymentsQuery = useOrderPayments(order?.id ?? null, order !== null);
  const methodsQuery = usePaymentMethods(canManage);
  const addPaymentMutation = useAddOrderPayment();

  return (
    <section className="rounded-3xl border border-brand-cappuccino/60 bg-white/85 p-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-brand-espresso">Payments</h2>
          <p className="text-sm text-brand-mocha">Deposits, balance payments, and full payments.</p>
        </div>
        <Button
          disabled={!order || !canManage}
          onClick={() => setOpen(true)}
          type="button"
          variant="outline"
        >
          <Plus className="h-4 w-4" />
          Add payment
        </Button>
      </div>
      <div className="mt-5 grid gap-3">
        <div className="grid grid-cols-3 gap-3 rounded-2xl bg-brand-latte/70 p-4 text-sm">
          <span>
            <span className="block text-brand-mocha">Paid</span>
            <strong className="text-brand-espresso">
              {formatCurrency(order?.paidAmount ?? 0)}
            </strong>
          </span>
          <span>
            <span className="block text-brand-mocha">Balance</span>
            <strong className="text-brand-espresso">
              {formatCurrency(order?.balanceAmount ?? 0)}
            </strong>
          </span>
          <span>
            <span className="block text-brand-mocha">Total</span>
            <strong className="text-brand-espresso">
              {formatCurrency(order?.totalAmount ?? 0)}
            </strong>
          </span>
        </div>
        {!order ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            Save the order before adding payments.
          </p>
        ) : null}
        {(paymentsQuery.data ?? []).map((payment) => (
          <div
            className="flex items-center justify-between rounded-2xl border border-brand-cappuccino/60 p-3 text-sm"
            key={payment.id}
          >
            <span className="flex items-center gap-2 text-brand-espresso">
              <CreditCard className="h-4 w-4" />
              {payment.paymentMethodName} - {payment.paymentType}
            </span>
            <span className="font-semibold">{formatCurrency(payment.amount)}</span>
          </div>
        ))}
        {order && !paymentsQuery.isLoading && (paymentsQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            No payments recorded yet.
          </p>
        ) : null}
      </div>
      <OrderPaymentDialog
        isSubmitting={addPaymentMutation.isPending}
        methods={(methodsQuery.data ?? []).filter((method) => method.status === "active")}
        onClose={() => setOpen(false)}
        onSubmit={async (payload) => {
          if (!order) {
            return;
          }
          try {
            await addPaymentMutation.mutateAsync({ orderId: order.id, payload });
            toast.success("Order payment added.");
            setOpen(false);
          } catch (error: unknown) {
            toast.error(getErrorMessage(error));
          }
        }}
        open={open}
      />
    </section>
  );
}
