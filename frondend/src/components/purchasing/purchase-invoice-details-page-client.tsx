"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoicePaymentsSection } from "@/components/purchasing/purchase-invoice-payments-section";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
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
import { useConvertPurchaseInvoiceToReceipt, usePurchaseInvoice } from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

export function PurchaseInvoiceDetailsPageClient({
  invoiceId,
}: {
  invoiceId: string;
}): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.purchasingInvoicesEdit,
    PERMISSIONS.purchasingInvoicesPost,
  ]);
  const canConvert = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsCreate,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [receivedDate, setReceivedDate] = useState(today());
  const [conversionNotes, setConversionNotes] = useState("");
  const invoiceQuery = usePurchaseInvoice(invoiceId, canView);
  const convertMutation = useConvertPurchaseInvoiceToReceipt();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (invoiceQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (invoiceQuery.error || !invoiceQuery.data) {
    return (
      <PurchaseErrorState
        description={
          invoiceQuery.error ? getErrorMessage(invoiceQuery.error) : "Purchase invoice not found."
        }
        onRetry={() => {
          void invoiceQuery.refetch();
        }}
      />
    );
  }

  const invoice = invoiceQuery.data;
  const canConvertInvoice = canConvert && invoice.status === "posted";

  const openConvertDialog = (): void => {
    setReceivedDate(today());
    setConversionNotes(`Created from ${invoice.invoiceNumber}`);
    setConvertOpen(true);
  };

  const handleConvert = async (): Promise<void> => {
    try {
      const receipt = await convertMutation.mutateAsync({
        id: invoice.id,
        payload: {
          notes: conversionNotes.trim() ? conversionNotes.trim() : null,
          receivedDate: receivedDate.trim() ? receivedDate : null,
        },
      });
      toast.success("Purchase invoice converted to draft receipt.");
      setConvertOpen(false);
      router.push(`${ROUTES.purchasingReceipts}/${receipt.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <div>
        <Link
          className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
          href={ROUTES.purchasingInvoices}
        >
          Back to Purchase Invoices
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">{invoice.invoiceNumber}</h1>
          <PurchaseInvoiceStatusBadge status={invoice.status} />
          <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
          {canConvertInvoice ? (
            <Button onClick={openConvertDialog} type="button">
              Convert to Receipt
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {invoice.supplierName} · {invoice.branchName}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Total</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.totalAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Paid</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.paidAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Balance</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.balanceAmount)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-brand-mocha">Tax</p>
            <p className="text-2xl font-semibold text-brand-espresso">
              {formatCurrency(invoice.taxAmount)}
            </p>
          </CardContent>
        </Card>
      </div>
      <PurchasingItemLines lines={invoice.items} title="Purchase invoice items" />
      <PurchaseInvoicePaymentsSection canManage={canManage} invoice={invoice} />
      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">{invoice.notes ?? "No notes recorded."}</p>
        </CardContent>
      </Card>
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Convert to stock receipt</DialogTitle>
            <DialogDescription>
              Supplier, branch, invoice link, items, quantities, batches, and expiry dates will be
              copied into a draft receipt. Stock updates only after posting the receipt.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="space-y-2">
              <Label htmlFor="convert-received-date">Received date</Label>
              <Input
                id="convert-received-date"
                onChange={(event) => setReceivedDate(event.target.value)}
                type="date"
                value={receivedDate}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="convert-receipt-notes">Notes</Label>
              <Input
                id="convert-receipt-notes"
                onChange={(event) => setConversionNotes(event.target.value)}
                placeholder="Optional receipt notes"
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
              Convert to Receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
