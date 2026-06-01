"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseDocumentChain } from "@/components/purchasing/purchase-document-chain";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import {
  useConvertPurchaseOrderToInvoice,
  usePurchaseOrder,
  usePurchaseOrderDocumentChain,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseOrderDetailsPageClient({ orderId }: { orderId: string }): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canConvert = hasAnyPermission([PERMISSIONS.purchasingInvoicesCreate]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [dueDate, setDueDate] = useState("");
  const [conversionNotes, setConversionNotes] = useState("");
  const orderQuery = usePurchaseOrder(orderId, canView);
  const chainQuery = usePurchaseOrderDocumentChain(orderId, canView);
  const convertMutation = useConvertPurchaseOrderToInvoice();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (orderQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (orderQuery.error || !orderQuery.data) {
    return (
      <PurchaseErrorState
        description={
          orderQuery.error ? getErrorMessage(orderQuery.error) : "Purchase order not found."
        }
        onRetry={() => {
          void orderQuery.refetch();
        }}
      />
    );
  }

  const order = orderQuery.data;
  const canConvertOrder = canConvert && (order.status === "draft" || order.status === "ordered");

  const openConvertDialog = (): void => {
    setInvoiceDate(today());
    setDueDate("");
    setConversionNotes(`Created from ${order.purchaseOrderNumber}`);
    setConvertOpen(true);
  };

  const handleConvert = async (): Promise<void> => {
    try {
      const invoice = await convertMutation.mutateAsync({
        id: order.id,
        payload: {
          dueDate: dueDate.trim() ? dueDate : null,
          invoiceDate: invoiceDate.trim() ? invoiceDate : null,
          notes: conversionNotes.trim() ? conversionNotes.trim() : null,
        },
      });
      toast.success("Purchase order converted to draft invoice.");
      setConvertOpen(false);
      router.push(`${ROUTES.purchasingInvoices}/${invoice.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.purchasingOrders}
        >
          Back to Purchase Orders
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">{order.purchaseOrderNumber}</h1>
          <PurchaseOrderStatusBadge status={order.status} />
          {canConvertOrder ? (
            <Button onClick={openConvertDialog} type="button">
              Convert to Invoice
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {order.supplierName} · {order.branchName}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Subtotal</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.subtotalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Discount</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.discountAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Tax</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.taxAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Total</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(order.totalAmount)}
            </p>
          </CardContent>
        </Card>
      </div>
      <PurchasingItemLines lines={order.items} title="Purchase order items" />
      <PurchaseDocumentChain
        chain={chainQuery.data}
        error={chainQuery.error}
        isLoading={chainQuery.isLoading}
        onRetry={() => {
          void chainQuery.refetch();
        }}
      />
      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">{order.notes ?? "No notes recorded."}</p>
        </CardContent>
      </Card>
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to invoice</DialogTitle>
            <DialogDescription>
              Supplier, branch, items, quantities, unit costs, discounts, taxes, and notes will be
              copied into a draft purchase invoice.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="convert-invoice-date">Invoice date</Label>
              <Input
                id="convert-invoice-date"
                onChange={(event) => setInvoiceDate(event.target.value)}
                type="date"
                value={invoiceDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-due-date">Due date</Label>
              <Input
                id="convert-due-date"
                onChange={(event) => setDueDate(event.target.value)}
                type="date"
                value={dueDate}
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="convert-invoice-notes">Notes</Label>
              <Input
                id="convert-invoice-notes"
                onChange={(event) => setConversionNotes(event.target.value)}
                placeholder="Optional invoice notes"
                value={conversionNotes}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setConvertOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={convertMutation.isPending}
              onClick={() => void handleConvert()}
              type="button"
            >
              Convert to Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
