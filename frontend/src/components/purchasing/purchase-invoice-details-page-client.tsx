"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseDocumentChain } from "@/components/purchasing/purchase-document-chain";
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
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelPurchaseInvoice,
  useConvertPurchaseInvoiceToReceipt,
  usePurchaseInvoice,
  usePurchaseOrderDocumentChain,
} from "@/hooks/use-purchasing";
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
  const canCancel = hasAnyPermission([PERMISSIONS.purchasingInvoicesCancel]);
  const canConvert = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsCreate,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [receivedDate, setReceivedDate] = useState(today());
  const [conversionNotes, setConversionNotes] = useState("");
  const invoiceQuery = usePurchaseInvoice(invoiceId, canView);
  const chainQuery = usePurchaseOrderDocumentChain(
    invoiceQuery.data?.purchaseOrderId ?? null,
    canView && Boolean(invoiceQuery.data?.purchaseOrderId),
  );
  const convertMutation = useConvertPurchaseInvoiceToReceipt();
  const cancelMutation = useCancelPurchaseInvoice();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (invoiceQuery.isLoading) {
    return <PurchaseTableSkeleton />;
  }

  if (invoiceQuery.error || !invoiceQuery.data) {
    return (
      <PurchaseErrorState
        description={invoiceQuery.error ? getErrorMessage(invoiceQuery.error) : "Bill not found."}
        onRetry={() => {
          void invoiceQuery.refetch();
        }}
      />
    );
  }

  const invoice = invoiceQuery.data;
  const canConvertInvoice = canConvert && invoice.status === "posted";
  const canCancelInvoice = canCancel && invoice.status === "posted";
  const billTitle = invoice.supplierBillNumber ?? invoice.invoiceNumber;

  const openConvertDialog = (): void => {
    setReceivedDate(today());
    setConversionNotes(`Created from ${billTitle}`);
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
      toast.success("Bill converted to draft receive goods record.");
      setConvertOpen(false);
      router.push(`${ROUTES.purchasingReceipts}/${receipt.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCancelBill = async (): Promise<void> => {
    const reason = cancelReason.trim();
    if (!reason) {
      toast.error("Enter a cancellation reason before cancelling the bill.");
      return;
    }

    try {
      await cancelMutation.mutateAsync({
        id: invoice.id,
        payload: { reason },
      });
      toast.success("Bill cancelled.");
      setCancelOpen(false);
      setCancelReason("");
      await invoiceQuery.refetch();
      if (invoice.purchaseOrderId) {
        await chainQuery.refetch();
      }
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
          Back to Bills
        </Link>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <h1 className="font-display text-4xl text-brand-espresso">{billTitle}</h1>
          <PurchaseInvoiceStatusBadge status={invoice.status} />
          <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
          {canConvertInvoice ? (
            <Button onClick={openConvertDialog} type="button">
              Create receive goods
            </Button>
          ) : null}
          {canCancelInvoice ? (
            <Button
              onClick={() => {
                setCancelReason("");
                setCancelOpen(true);
              }}
              type="button"
              variant="outline"
            >
              Cancel Bill
            </Button>
          ) : null}
        </div>
        <p className="mt-2 text-sm text-brand-mocha">
          {invoice.supplierName} / {invoice.branchName} / Internal Bill No {invoice.invoiceNumber}
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

      <Card className="border-brand-cappuccino bg-white/85">
        <CardHeader>
          <CardTitle>Bill details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-brand-mocha">Supplier bill no</p>
            <p className="font-semibold text-brand-espresso">
              {invoice.supplierBillNumber ?? "Not recorded"}
            </p>
          </div>
          <div>
            <p className="text-brand-mocha">Internal bill no</p>
            <p className="font-semibold text-brand-espresso">{invoice.invoiceNumber}</p>
          </div>
          <div>
            <p className="text-brand-mocha">Supplier</p>
            <p className="font-semibold text-brand-espresso">{invoice.supplierName}</p>
          </div>
          <div>
            <p className="text-brand-mocha">Branch</p>
            <p className="font-semibold text-brand-espresso">{invoice.branchName}</p>
          </div>
          {invoice.status === "cancelled" ? (
            <>
              <div>
                <p className="text-brand-mocha">Cancelled at</p>
                <p className="font-semibold text-brand-espresso">
                  {invoice.cancelledAt ?? "Not recorded"}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Cancel reason</p>
                <p className="font-semibold text-brand-espresso">
                  {invoice.cancelReason ?? "Not recorded"}
                </p>
              </div>
              <div>
                <p className="text-brand-mocha">Reversal journal</p>
                {invoice.reversalJournalEntryId ? (
                  <Link
                    className="font-semibold text-brand-espresso underline-offset-4 hover:underline"
                    href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(
                      invoice.reversalJournalEntryId,
                    )}`}
                  >
                    View journal
                  </Link>
                ) : (
                  <p className="font-semibold text-brand-espresso">Not recorded</p>
                )}
              </div>
              <div>
                <p className="text-brand-mocha">Cancelled receipt</p>
                <p className="font-semibold text-brand-espresso">
                  {invoice.cancelledReceiptId ?? "Not recorded"}
                </p>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <Card className="border-brand-cappuccino bg-white/85">
        <CardHeader>
          <CardTitle>Bill summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-brand-mocha">Subtotal</span>
            <span className="font-semibold text-brand-espresso">
              {formatCurrency(invoice.subtotalAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-brand-cappuccino/60 pt-2">
            <span className="text-brand-mocha">Line discounts</span>
            <span className="font-semibold text-red-700">
              -{formatCurrency(invoice.discountAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-brand-cappuccino/60 pt-2">
            <span className="text-brand-mocha">Bill discount</span>
            <span className="font-semibold text-red-700">
              -{formatCurrency(invoice.billDiscountAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-brand-cappuccino/60 pt-2">
            <span className="text-brand-mocha">Tax</span>
            <span className="font-semibold text-brand-espresso">
              {formatCurrency(invoice.taxAmount)}
            </span>
          </div>
          {invoice.chargeAmount + invoice.chargeTaxAmount > 0 ? (
            <div className="flex items-center justify-between border-t border-brand-cappuccino/60 pt-2">
              <span className="text-brand-mocha">Legacy charges</span>
              <span className="font-semibold text-brand-espresso">
                {formatCurrency(invoice.chargeAmount + invoice.chargeTaxAmount)}
              </span>
            </div>
          ) : null}
          <div className="flex items-center justify-between rounded-lg bg-brand-latte px-3 py-2 text-base">
            <span className="font-semibold text-brand-mocha">Grand total</span>
            <span className="text-lg font-bold text-brand-espresso">
              {formatCurrency(invoice.totalAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-brand-mocha">Paid</span>
            <span className="font-semibold text-brand-espresso">
              {formatCurrency(invoice.paidAmount)}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-brand-mocha">Balance due</span>
            <span className="font-semibold text-brand-espresso">
              {formatCurrency(invoice.balanceAmount)}
            </span>
          </div>
        </CardContent>
      </Card>

      <PurchasingItemLines lines={invoice.items} title="Bill items" />
      <PurchaseInvoicePaymentsSection canManage={canManage} invoice={invoice} />
      {invoice.purchaseOrderId ? (
        <PurchaseDocumentChain
          chain={chainQuery.data}
          error={chainQuery.error}
          isLoading={chainQuery.isLoading}
          onRetry={() => {
            void chainQuery.refetch();
          }}
        />
      ) : null}
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
            <DialogTitle>Create receive goods record</DialogTitle>
            <DialogDescription>
              Supplier, branch, bill link, items, quantities, batches, and expiry dates will be
              copied into a draft receive goods record. Stock updates only after posting it.
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
                placeholder="Optional receive goods notes"
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
              Create receive goods
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={cancelOpen}
        onOpenChange={(open) => {
          setCancelOpen(open);
          if (!open) {
            setCancelReason("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel Bill</DialogTitle>
            <DialogDescription>
              Cancelling this posted bill will reverse supplier payable, VAT, and inventory if the
              stock is still available. This action keeps an audit trail and cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="detail-bill-cancel-reason">Cancellation reason</Label>
            <Textarea
              id="detail-bill-cancel-reason"
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="Wrong supplier bill entered"
              value={cancelReason}
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setCancelOpen(false);
                setCancelReason("");
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              disabled={cancelMutation.isPending || !cancelReason.trim()}
              onClick={() => void handleCancelBill()}
              type="button"
            >
              Cancel Bill
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
