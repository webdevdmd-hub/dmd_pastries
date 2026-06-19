"use client";

import { AlertCircle, Loader2 } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { SupplierLookupSelect } from "@/components/purchasing/supplier-lookup-select";
import { Button } from "@/components/ui/button";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  CreateSupplierPaymentPayload,
  PurchaseInvoice,
  PurchasingBranchOption,
  PurchasingSupplierOption,
} from "@/types/purchasing";
import type { PaymentMethod } from "@/types/settings";

type SupplierPaymentAllocationDialogProps = {
  branchId: string;
  branches: PurchasingBranchOption[];
  invoices: PurchaseInvoice[];
  invoicesError: string | null;
  invoicesLoading: boolean;
  isSubmitting: boolean;
  methods: PaymentMethod[];
  onClose: () => void;
  onBranchChange: (branchId: string) => void;
  onRetryInvoices: () => void;
  onRefreshInvoices: () => Promise<PurchaseInvoice[]>;
  onSubmit: (payload: CreateSupplierPaymentPayload) => Promise<void>;
  onSupplierChange: (supplierId: string) => void;
  open: boolean;
  selectedBranchId: string;
  selectedSupplierId: string;
  suppliers: PurchasingSupplierOption[];
};

function todayInputValue(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value));
}

function parseAmount(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function roundMoney(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function invoiceLabel(invoice: PurchaseInvoice): string {
  return invoice.supplierBillNumber ?? invoice.invoiceNumber;
}

export function PurchaseSupplierPaymentAllocationDialog({
  branchId,
  branches,
  invoices,
  invoicesError,
  invoicesLoading,
  isSubmitting,
  methods,
  onClose,
  onBranchChange,
  onRetryInvoices,
  onRefreshInvoices,
  onSubmit,
  onSupplierChange,
  open,
  selectedBranchId,
  selectedSupplierId,
  suppliers,
}: SupplierPaymentAllocationDialogProps): JSX.Element {
  const [paymentMethodId, setPaymentMethodId] = useState("");
  const [amount, setAmount] = useState("0");
  const [paymentDate, setPaymentDate] = useState(todayInputValue);
  const [referenceNumber, setReferenceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [allocations, setAllocations] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [validatingBalances, setValidatingBalances] = useState(false);

  const selectedMethod = methods.find((method) => method.id === paymentMethodId) ?? null;
  const amountValue = roundMoney(parseAmount(amount));
  const allocationEntries = useMemo(
    () =>
      invoices.map((invoice) => ({
        amount: roundMoney(parseAmount(allocations[invoice.id] ?? "0")),
        invoice,
      })),
    [allocations, invoices],
  );
  const allocatedAmount = roundMoney(
    allocationEntries.reduce((total, entry) => total + entry.amount, 0),
  );
  const advanceAmount = roundMoney(Math.max(amountValue - allocatedAmount, 0));
  const allocationTooHigh = allocationEntries.some(
    (entry) => entry.amount > roundMoney(entry.invoice.balanceAmount),
  );
  const overAllocated = allocatedAmount > amountValue;
  const selectedMethodMissingAccount = Boolean(
    selectedMethod && !selectedMethod.defaultPaymentAccountId,
  );

  useEffect(() => {
    if (!open) return;

    setPaymentMethodId("");
    setAmount("0");
    setPaymentDate(todayInputValue());
    setReferenceNumber("");
    setNotes("");
    setAllocations({});
    setSubmitError(null);
  }, [open]);

  useEffect(() => {
    setAllocations({});
    setSubmitError(null);
    setRowErrors({});
  }, [selectedSupplierId]);

  const updateAllocation = (invoiceId: string, nextAmount: string): void => {
    setSubmitError(null);
    setRowErrors((current) => {
      if (!(invoiceId in current)) return current;
      const { [invoiceId]: _removed, ...next } = current;
      void _removed;
      return next;
    });
    setAllocations((current) => ({ ...current, [invoiceId]: nextAmount }));
  };

  const payInFull = (invoice: PurchaseInvoice): void => {
    const currentAmount = roundMoney(parseAmount(allocations[invoice.id] ?? "0"));
    const remainingBeforeRow = roundMoney(amountValue - (allocatedAmount - currentAmount));
    const cappedAmount =
      amountValue > 0
        ? Math.max(0, Math.min(invoice.balanceAmount, remainingBeforeRow))
        : invoice.balanceAmount;

    updateAllocation(invoice.id, String(roundMoney(cappedAmount)));
  };

  const submit = async (): Promise<void> => {
    setSubmitError(null);
    setRowErrors({});

    if (!selectedSupplierId) {
      setSubmitError("Select a supplier before saving payment.");
      return;
    }

    if (!branchId) {
      setSubmitError("Select a branch before saving payment.");
      return;
    }

    if (!paymentMethodId) {
      setSubmitError("Select a payment method before saving payment.");
      return;
    }

    if (!selectedMethod?.defaultPaymentAccountId) {
      setSubmitError("Select a payment method with a linked paid-through account.");
      return;
    }

    if (amountValue <= 0) {
      setSubmitError("Payment amount must be greater than zero.");
      return;
    }

    if (selectedMethod.requiresReference && referenceNumber.trim().length === 0) {
      setSubmitError("Reference number is required for this payment method.");
      return;
    }

    if (allocationTooHigh) {
      setSubmitError("Payment cannot exceed amount due.");
      return;
    }

    if (overAllocated) {
      setSubmitError("Allocated amount cannot exceed payment amount.");
      return;
    }

    const payableEntries = allocationEntries.filter((entry) => entry.amount > 0);

    setValidatingBalances(true);
    try {
      if (payableEntries.length > 0) {
        const latestInvoices = await onRefreshInvoices();
        const latestById = new Map(latestInvoices.map((invoice) => [invoice.id, invoice]));
        const nextRowErrors: Record<string, string> = {};

        for (const entry of payableEntries) {
          const latestInvoice = latestById.get(entry.invoice.id);
          if (latestInvoice?.status !== "posted" || roundMoney(latestInvoice.balanceAmount) <= 0) {
            nextRowErrors[entry.invoice.id] = "This bill is no longer open for payment.";
            continue;
          }

          const latestBalance = roundMoney(latestInvoice.balanceAmount);
          if (entry.amount > latestBalance) {
            nextRowErrors[entry.invoice.id] =
              `Bill balance changed. Maximum payable is ${formatCurrency(latestBalance)}.`;
          }
        }

        if (Object.keys(nextRowErrors).length > 0) {
          setRowErrors(nextRowErrors);
          setSubmitError("Review bill allocation amounts before saving.");
          return;
        }
      }

      await onSubmit({
        allocations: payableEntries.map((entry) => ({
          amount: entry.amount,
          purchaseInvoiceId: entry.invoice.id,
        })),
        amount: amountValue,
        branchId,
        notes: notes.trim() ? notes.trim() : null,
        paidThroughAccountId: selectedMethod.defaultPaymentAccountId,
        paymentDate: paymentDate || null,
        paymentMethodId,
        referenceNumber: referenceNumber.trim() ? referenceNumber.trim() : null,
        supplierId: selectedSupplierId,
      });
    } catch (error: unknown) {
      if (error instanceof ApiError && error.message.includes("allocation amount cannot exceed")) {
        const purchaseInvoiceId =
          typeof error.errorDetails?.purchase_invoice_id === "string"
            ? error.errorDetails.purchase_invoice_id
            : "";
        const balanceAmount =
          typeof error.errorDetails?.balance_amount === "number"
            ? error.errorDetails.balance_amount
            : null;

        if (purchaseInvoiceId && balanceAmount !== null) {
          setRowErrors({
            [purchaseInvoiceId]: `Bill balance changed. Maximum payable is ${formatCurrency(
              roundMoney(balanceAmount),
            )}.`,
          });
          setSubmitError("Review bill allocation amounts before saving.");
          return;
        }
      }

      const message = getErrorMessage(error);
      setSubmitError(message);
      toast.error(message);
    } finally {
      setValidatingBalances(false);
    }
  };

  return (
    <Dialog
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
      open={open}
    >
      <DialogContent className="flex max-h-[92vh] max-w-[1200px] flex-col overflow-hidden p-0 sm:w-[92vw]">
        <DialogHeader className="border-b border-brand-cappuccino/70 px-6 py-5">
          <DialogTitle>Record Supplier Payment</DialogTitle>
          <DialogDescription>
            Select a supplier, allocate the payment across open bills, or save the balance as
            supplier advance.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <div className="grid gap-2">
              <Label>Branch *</Label>
              <Select
                onValueChange={(nextBranchId) => {
                  setSubmitError(null);
                  onBranchChange(nextBranchId);
                }}
                value={selectedBranchId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                  {branches.map((branch) => (
                    <SelectItem key={branch.id} value={branch.id}>
                      {branch.branchName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p aria-hidden="true" className="min-h-5 text-xs leading-5 text-transparent">
                Helper
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Supplier *</Label>
              <SupplierLookupSelect
                onValueChange={onSupplierChange}
                suppliers={suppliers}
                value={selectedSupplierId}
              />
              <p className="min-h-5 text-xs leading-5 text-brand-mocha">
                {!selectedSupplierId ? "Select a supplier to view open bills." : ""}
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplierPaymentAmount">Payment amount *</Label>
              <Input
                id="supplierPaymentAmount"
                inputMode="decimal"
                min={0}
                onChange={(event) => {
                  setSubmitError(null);
                  setAmount(event.target.value);
                }}
                step="0.01"
                type="number"
                value={amount}
              />
              <p aria-hidden="true" className="min-h-5 text-xs leading-5 text-transparent">
                Helper
              </p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplierPaymentDate">Payment date *</Label>
              <Input
                id="supplierPaymentDate"
                onChange={(event) => setPaymentDate(event.target.value)}
                type="date"
                value={paymentDate}
              />
              <p aria-hidden="true" className="min-h-5 text-xs leading-5 text-transparent">
                Helper
              </p>
            </div>

            <div className="grid gap-2">
              <Label>Payment method *</Label>
              <Select
                onValueChange={(nextPaymentMethodId) => {
                  setSubmitError(null);
                  setPaymentMethodId(nextPaymentMethodId);
                }}
                value={paymentMethodId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select payment method" />
                </SelectTrigger>
                <SelectContent>
                  {methods.map((method) => (
                    <SelectItem key={method.id} value={method.id}>
                      {method.methodName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="min-h-5 text-xs leading-5 text-brand-mocha">
                {selectedMethod?.defaultPaymentAccountId
                  ? `Paid through: ${selectedMethod.defaultPaymentAccountName || "Linked account"}`
                  : ""}
              </p>
              {selectedMethodMissingAccount ? (
                <p className="text-xs leading-5 text-red-700">
                  This payment method has no paid-through account. Link one in Payment Setup before
                  recording payment.
                </p>
              ) : null}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="supplierPaymentReference">
                Reference #{selectedMethod?.requiresReference ? " *" : ""}
              </Label>
              <Input
                id="supplierPaymentReference"
                onChange={(event) => {
                  setSubmitError(null);
                  setReferenceNumber(event.target.value);
                }}
                placeholder={
                  selectedMethod?.requiresReference
                    ? "Required for selected method"
                    : "Optional transaction reference"
                }
                value={referenceNumber}
              />
              <p aria-hidden="true" className="min-h-5 text-xs leading-5 text-transparent">
                Helper
              </p>
            </div>
          </div>

          <div className="mt-5 rounded-xl border border-brand-cappuccino/70">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-cappuccino/70 px-4 py-3">
              <div>
                <h3 className="font-semibold text-brand-espresso">Bills for selected supplier</h3>
                <p className="text-sm text-brand-mocha">
                  Enter a payment amount per bill, or leave all rows zero to record an advance.
                </p>
              </div>
              {invoicesLoading ? (
                <span className="inline-flex items-center gap-2 text-sm text-brand-mocha">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Loading bills...
                </span>
              ) : null}
            </div>

            {invoicesError ? (
              <div className="grid gap-3 px-4 py-6 text-sm text-red-800">
                <div className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4" />
                  {invoicesError}
                </div>
                <Button className="w-fit" onClick={onRetryInvoices} type="button" variant="outline">
                  Retry
                </Button>
              </div>
            ) : null}

            {!invoicesError && !selectedSupplierId ? (
              <div className="px-4 py-8 text-sm text-brand-mocha">
                Select a supplier to view open bills.
              </div>
            ) : null}

            {!invoicesError && selectedSupplierId && !invoicesLoading && invoices.length === 0 ? (
              <div className="px-4 py-8 text-sm text-brand-mocha">
                No posted open bills found for this supplier. You can still record this as supplier
                advance.
              </div>
            ) : null}

            {!invoicesError && invoices.length > 0 ? (
              <>
                <div className="hidden overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Bill #</TableHead>
                        <TableHead>PO #</TableHead>
                        <TableHead className="text-right">Bill amount</TableHead>
                        <TableHead className="text-right">Amount due</TableHead>
                        <TableHead className="w-[160px]">Payment</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {invoices.map((invoice) => {
                        const rowAmount = roundMoney(parseAmount(allocations[invoice.id] ?? "0"));
                        const rowError =
                          rowErrors[invoice.id] ??
                          (rowAmount > roundMoney(invoice.balanceAmount)
                            ? "Payment cannot exceed amount due."
                            : "");

                        return (
                          <TableRow key={invoice.id}>
                            <TableCell>{formatDate(invoice.invoiceDate)}</TableCell>
                            <TableCell className="font-medium text-brand-espresso">
                              {invoiceLabel(invoice)}
                            </TableCell>
                            <TableCell>
                              {invoice.purchaseOrderNumber ??
                                (invoice.purchaseOrderId ? "PO number unavailable" : "-")}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(invoice.totalAmount)}
                            </TableCell>
                            <TableCell className="text-right tabular-nums">
                              {formatCurrency(invoice.balanceAmount)}
                            </TableCell>
                            <TableCell>
                              <Input
                                aria-label={`Payment for ${invoiceLabel(invoice)}`}
                                inputMode="decimal"
                                min={0}
                                onChange={(event) =>
                                  updateAllocation(invoice.id, event.target.value)
                                }
                                step="0.01"
                                type="number"
                                value={allocations[invoice.id] ?? "0"}
                              />
                              {rowError ? (
                                <p className="mt-1 text-xs text-red-700">{rowError}</p>
                              ) : null}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                onClick={() => payInFull(invoice)}
                                size="sm"
                                type="button"
                                variant="ghost"
                              >
                                Pay in full
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>

                <div className="grid gap-3 p-3 md:hidden">
                  {invoices.map((invoice) => {
                    const rowAmount = roundMoney(parseAmount(allocations[invoice.id] ?? "0"));
                    const rowError =
                      rowErrors[invoice.id] ??
                      (rowAmount > roundMoney(invoice.balanceAmount)
                        ? "Payment cannot exceed amount due."
                        : "");

                    return (
                      <div
                        className="grid gap-3 rounded-lg border border-brand-cappuccino/70 p-3"
                        key={invoice.id}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="font-medium text-brand-espresso">
                              {invoiceLabel(invoice)}
                            </p>
                            <p className="text-xs text-brand-mocha">
                              {formatDate(invoice.invoiceDate)}
                            </p>
                          </div>
                          <Button
                            onClick={() => payInFull(invoice)}
                            size="sm"
                            type="button"
                            variant="ghost"
                          >
                            Pay in full
                          </Button>
                        </div>
                        <div className="grid grid-cols-2 gap-3 text-sm">
                          <div>
                            <p className="text-xs text-brand-mocha">Bill amount</p>
                            <p className="tabular-nums">{formatCurrency(invoice.totalAmount)}</p>
                          </div>
                          <div>
                            <p className="text-xs text-brand-mocha">Amount due</p>
                            <p className="tabular-nums">{formatCurrency(invoice.balanceAmount)}</p>
                          </div>
                        </div>
                        <div className="grid gap-1">
                          <Label>Payment</Label>
                          <Input
                            aria-label={`Payment for ${invoiceLabel(invoice)}`}
                            inputMode="decimal"
                            min={0}
                            onChange={(event) => updateAllocation(invoice.id, event.target.value)}
                            step="0.01"
                            type="number"
                            value={allocations[invoice.id] ?? "0"}
                          />
                          {rowError ? <p className="text-xs text-red-700">{rowError}</p> : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_360px]">
            <div className="grid gap-2">
              <Label htmlFor="supplierPaymentNotes">Notes</Label>
              <Textarea
                id="supplierPaymentNotes"
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional internal supplier payment note"
                value={notes}
              />
            </div>

            <div className="rounded-xl border border-brand-cappuccino bg-brand-latte/40 p-4">
              <div className="grid gap-3 text-sm">
                <div className="flex justify-between gap-4">
                  <span className="text-brand-mocha">Amount paid</span>
                  <span className="font-semibold tabular-nums text-brand-espresso">
                    {formatCurrency(amountValue)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-brand-mocha">Used for bills</span>
                  <span className="font-semibold tabular-nums text-brand-espresso">
                    {formatCurrency(allocatedAmount)}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-brand-mocha">Supplier advance</span>
                  <span className="font-semibold tabular-nums text-brand-espresso">
                    {formatCurrency(advanceAmount)}
                  </span>
                </div>
              </div>
              {advanceAmount > 0 && amountValue > 0 ? (
                <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                  {formatCurrency(advanceAmount)} will be saved as supplier advance.
                </p>
              ) : null}
              {overAllocated ? (
                <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800">
                  Allocated amount cannot exceed payment amount.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-brand-cappuccino/70 px-6 py-4">
          {submitError ? (
            <p className="mr-auto flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {submitError}
            </p>
          ) : null}
          <Button onClick={onClose} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            disabled={
              isSubmitting || invoicesLoading || validatingBalances || selectedMethodMissingAccount
            }
            onClick={() => void submit()}
            type="button"
          >
            {isSubmitting || validatingBalances ? "Saving..." : "Save as Paid"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
