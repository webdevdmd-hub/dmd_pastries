"use client";

import { CreditCard, Plus } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { OrderPaymentDialog } from "@/components/orders/order-payment-dialog";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/constants/routes";
import { useAddOrderPayment, useOrderPayments } from "@/hooks/use-orders";
import { usePaymentMethods } from "@/hooks/use-payments";
import { getErrorMessage } from "@/lib/api/client";
import type { BakeryOrder } from "@/types/orders";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function paymentTypeLabel(paymentType: "deposit" | "balance" | "full"): string {
  if (paymentType === "deposit") {
    return "Advance Payment";
  }

  if (paymentType === "full") {
    return "Final Payment";
  }

  return "Balance Payment";
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
  const visiblePaymentMethods = (methodsQuery.data ?? []).filter(
    (method) => method.status === "active" && method.showInBakeryOrders,
  );
  const usablePaymentMethods = visiblePaymentMethods.filter((method) =>
    Boolean(method.defaultPaymentAccountId),
  );
  const defaultPaymentMethod =
    usablePaymentMethods.find((method) => method.isDefault) ?? usablePaymentMethods[0] ?? null;
  const hasUnconfiguredMethods = visiblePaymentMethods.length > usablePaymentMethods.length;

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
        {order && (order.chargeAmount > 0 || order.chargeTaxAmount > 0) ? (
          <div className="rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 text-sm">
            <div className="flex justify-between">
              <span className="text-brand-mocha">Subtotal</span>
              <strong className="text-brand-espresso">
                {formatCurrency(order.subtotalAmount)}
              </strong>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-mocha">Item tax</span>
              <strong className="text-brand-espresso">{formatCurrency(order.taxAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-mocha">Charges</span>
              <strong className="text-brand-espresso">{formatCurrency(order.chargeAmount)}</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-brand-mocha">Charge tax</span>
              <strong className="text-brand-espresso">
                {formatCurrency(order.chargeTaxAmount)}
              </strong>
            </div>
          </div>
        ) : null}
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
              {paymentTypeLabel(payment.paymentType)}: {payment.paymentMethodName} -{" "}
              {formatCurrency(payment.amount)}
            </span>
            {payment.journalEntryId ? (
              <Button asChild size="sm" variant="outline">
                <Link
                  href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(
                    payment.journalEntryId,
                  )}`}
                >
                  View Journal
                </Link>
              </Button>
            ) : null}
          </div>
        ))}
        {order && !paymentsQuery.isLoading && (paymentsQuery.data ?? []).length === 0 ? (
          <p className="rounded-2xl border border-dashed border-brand-cappuccino p-4 text-sm text-brand-mocha">
            No payments recorded yet.
          </p>
        ) : null}
        {hasUnconfiguredMethods ? (
          <p className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Some bakery payment methods need a default payment account before they can be used.
          </p>
        ) : null}
      </div>
      <OrderPaymentDialog
        defaultPaymentMethodId={defaultPaymentMethod?.id ?? null}
        isSubmitting={addPaymentMutation.isPending}
        methods={usablePaymentMethods}
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
