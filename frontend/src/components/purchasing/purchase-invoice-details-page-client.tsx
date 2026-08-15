"use client";

import { AlertTriangle, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX, ReactNode } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AppBadge } from "@/components/app/app-badge";
import { usePublishBreadcrumbLabel } from "@/components/layout/breadcrumb-label";
import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoiceFormDialog } from "@/components/purchasing/purchase-invoice-form-dialog";
import { PurchaseInvoiceItemLines } from "@/components/purchasing/purchase-invoice-item-lines";
import { PurchaseInvoicePaymentsSection } from "@/components/purchasing/purchase-invoice-payments-section";
import { PurchaseInvoiceStatusBadge } from "@/components/purchasing/purchase-invoice-status-badge";
import { PurchasePaymentStatusBadge } from "@/components/purchasing/purchase-payment-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
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
import { Textarea } from "@/components/ui/textarea";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAllChartAccounts } from "@/hooks/use-accounting";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelPurchaseInvoice,
  useConvertPurchaseInvoiceToReceipt,
  usePostPurchaseInvoice,
  usePurchaseInvoice,
  usePurchasingBranches,
  usePurchasingProducts,
  usePurchasingSuppliers,
  usePurchasingTaxRates,
  usePurchasingUnits,
  useUpdatePurchaseInvoice,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import { getPurchaseInvoiceUpdateErrorMessage } from "@/lib/api/purchase-invoice-conflicts";
import { cn } from "@/lib/utils/cn";
import type {
  CreatePurchaseInvoicePayload,
  PurchaseInvoice,
  PurchasePaymentStatus,
  UpdatePurchaseInvoicePayload,
} from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(date);
}

function formatDateTime(value: string | null): string {
  if (!value) return "Not recorded";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";
  return new Intl.DateTimeFormat("en-AE", { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function balanceTone(paymentStatus: PurchasePaymentStatus, balanceAmount: number): string {
  if (balanceAmount <= 0) return "text-emerald-600";
  if (paymentStatus === "overdue") return "text-red-600";
  return "text-amber-600";
}

function receiveStatusMeta(status: PurchaseInvoice["receiveStatus"]): {
  label: string;
  tone: "muted" | "warning" | "success";
} {
  if (status === "received") return { label: "Received", tone: "success" };
  if (status === "partially_received") return { label: "Partially received", tone: "warning" };
  return { label: "Not received", tone: "muted" };
}

function SectionHeader({
  action,
  description,
  title,
}: {
  action?: ReactNode;
  description?: string;
  title: string;
}): JSX.Element {
  return (
    <div className="flex flex-col gap-3 border-b border-workspace-border px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h2 className="text-lg font-semibold text-brand-espresso">{title}</h2>
        {description ? <p className="mt-1 text-sm text-workspace-muted">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: ReactNode }): JSX.Element {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-workspace-muted">{label}</p>
      <div className="mt-1 text-sm font-semibold text-brand-espresso">{value}</div>
    </div>
  );
}

function SummaryRow({
  emphasis = false,
  label,
  value,
}: {
  emphasis?: boolean;
  label: string;
  value: string;
}): JSX.Element {
  return (
    <div className="flex items-center justify-between py-1.5 text-sm">
      <span className={emphasis ? "font-semibold text-brand-espresso" : "text-workspace-muted"}>
        {label}
      </span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "font-semibold text-brand-espresso" : "font-medium text-brand-espresso",
        )}
      >
        {value}
      </span>
    </div>
  );
}

export function PurchaseInvoiceDetailsPageClient({
  invoiceId,
}: {
  invoiceId: string;
}): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([PERMISSIONS.purchasingInvoicesEdit]);
  const canEdit = hasAnyPermission([PERMISSIONS.purchasingInvoicesEdit]);
  const canPost = hasAnyPermission([PERMISSIONS.purchasingInvoicesPost]);
  const canCancel = hasAnyPermission([PERMISSIONS.purchasingInvoicesCancel]);
  const canConvert = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsCreate,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [postOpen, setPostOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [receivedDate, setReceivedDate] = useState(today());
  const [conversionNotes, setConversionNotes] = useState("");
  const invoiceQuery = usePurchaseInvoice(invoiceId, canView);
  // Show the bill number in the breadcrumb instead of the record id.
  usePublishBreadcrumbLabel(invoiceQuery.data?.invoiceNumber ?? null);
  const branchesQuery = usePurchasingBranches(canView);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const productsQuery = usePurchasingProducts(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const purchaseAccountsQuery = useAllChartAccounts(
    {
      accountGroup: "",
      accountType: "all",
      limit: 100,
      page: 1,
      parentAccountId: "",
      search: "",
      sortBy: "account_code",
      sortOrder: "asc",
      status: "active",
    },
    canView,
  );
  const convertMutation = useConvertPurchaseInvoiceToReceipt();
  const postMutation = usePostPurchaseInvoice();
  const cancelMutation = useCancelPurchaseInvoice();
  const updateMutation = useUpdatePurchaseInvoice();

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
  const canConvertInvoice = canConvert && invoice.status === "posted" && invoice.canReceiveStock;
  const canPostInvoice = canPost && invoice.status === "draft";
  const canCancelInvoice = canCancel && invoice.status === "posted";
  const canEditInvoice = canEdit && invoice.status !== "cancelled";
  const billTitle = invoice.supplierBillNumber ?? invoice.invoiceNumber;
  const isOverdue = invoice.paymentStatus === "overdue";
  const receiveStatus = receiveStatusMeta(invoice.receiveStatus);
  const hasLegacyCharges = invoice.chargeAmount + invoice.chargeTaxAmount > 0;

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

  const handlePostBill = async (): Promise<void> => {
    try {
      await postMutation.mutateAsync(invoice.id);
      toast.success("Bill posted.");
      setPostOpen(false);
      await invoiceQuery.refetch();
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
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdateBill = async (
    id: string,
    payload: UpdatePurchaseInvoicePayload,
  ): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Bill updated.");
      setEditOpen(false);
      await invoiceQuery.refetch();
    } catch (error) {
      toast.error(getPurchaseInvoiceUpdateErrorMessage(error));
    }
  };

  const noopCreateBill = (_payload: CreatePurchaseInvoicePayload): Promise<void> =>
    Promise.reject(new Error("This dialog only edits an existing bill."));

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Link
        className="w-fit text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
        href={ROUTES.purchasingInvoices}
      >
        Back to Bills
      </Link>

      <header className="overflow-hidden rounded-md border border-workspace-border bg-white">
        <div className="flex flex-col gap-5 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-workspace-muted">
              Bill no
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-3xl font-semibold text-brand-espresso">
                {invoice.invoiceNumber}
              </h1>
              <PurchaseInvoiceStatusBadge status={invoice.status} />
              <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
            </div>
            <p className="mt-2 text-sm text-workspace-muted">
              {invoice.supplierName} &middot; {invoice.branchName}
            </p>
            <p className="mt-3 text-xs text-workspace-muted">
              Created by {invoice.createdByUserName} on {formatDateTime(invoice.createdAt)}
              {invoice.updatedAt !== invoice.createdAt
                ? ` · Last updated ${formatDateTime(invoice.updatedAt)}`
                : ""}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 lg:shrink-0 lg:justify-end">
            {canEditInvoice ? (
              <Button onClick={() => setEditOpen(true)} type="button" variant="outline">
                Edit
              </Button>
            ) : null}
            {canPostInvoice ? (
              <Button onClick={() => setPostOpen(true)} type="button">
                Post Bill
              </Button>
            ) : null}
            {canConvertInvoice ? (
              <Button onClick={openConvertDialog} type="button">
                Create receive goods
              </Button>
            ) : null}
            {canCancelInvoice ? (
              <Button
                className="border-red-200 text-red-700 hover:bg-red-50"
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
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
        <div className="flex min-w-0 flex-col gap-6">
          <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
            <SectionHeader
              description="Identifiers, dates, and the linked purchase order for this bill."
              title="Bill info & supplier"
            />
            <div className="grid gap-5 p-5 sm:grid-cols-2 lg:grid-cols-3">
              <InfoField label="Bill no" value={invoice.invoiceNumber} />
              <InfoField
                label="Invoice no (supplier)"
                value={invoice.supplierBillNumber ?? "Not recorded"}
              />
              <InfoField label="Supplier" value={invoice.supplierName} />
              <InfoField label="Branch" value={invoice.branchName} />
              <InfoField label="Bill date" value={formatDate(invoice.invoiceDate)} />
              <InfoField
                label="Due date"
                value={
                  <span
                    className={cn(
                      "inline-flex items-center gap-1.5",
                      isOverdue ? "text-red-700" : undefined,
                    )}
                  >
                    {isOverdue ? (
                      <AlertTriangle aria-hidden="true" className="h-3.5 w-3.5" />
                    ) : null}
                    {formatDate(invoice.dueDate)}
                  </span>
                }
              />
              <InfoField
                label="Purchase order"
                value={
                  invoice.purchaseOrderId ? (
                    <Link
                      className="inline-flex items-center gap-1 text-brand-espresso underline-offset-4 hover:underline"
                      href={`${ROUTES.purchasingOrders}/${invoice.purchaseOrderId}`}
                    >
                      {invoice.purchaseOrderNumber ?? "View purchase order"}
                      <ArrowUpRight aria-hidden="true" className="h-3.5 w-3.5" />
                    </Link>
                  ) : (
                    "Not linked to a purchase order"
                  )
                }
              />
              <InfoField
                label="Goods receipt"
                value={<AppBadge tone={receiveStatus.tone}>{receiveStatus.label}</AppBadge>}
              />
            </div>
          </section>

          {invoice.status === "cancelled" ? (
            <section className="rounded-md border border-red-200 bg-red-50 p-5">
              <div className="flex items-start gap-3">
                <AlertTriangle
                  aria-hidden="true"
                  className="mt-0.5 h-5 w-5 shrink-0 text-red-700"
                />
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-semibold text-red-900">This bill was cancelled</h2>
                  <p className="mt-1 text-sm text-red-800">
                    Cancelling a posted bill reverses the supplier payable, VAT, and inventory
                    impact where stock is still available.
                  </p>
                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Cancelled at
                      </p>
                      <p className="mt-1 text-sm font-semibold text-red-900">
                        {formatDateTime(invoice.cancelledAt)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Cancel reason
                      </p>
                      <p className="mt-1 text-sm font-semibold text-red-900">
                        {invoice.cancelReason ?? "Not recorded"}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Reversal journal
                      </p>
                      {invoice.reversalJournalEntryId ? (
                        <Link
                          className="mt-1 inline-block text-sm font-semibold text-red-900 underline-offset-4 hover:underline"
                          href={`${ROUTES.accountingJournalEntries}?search=${encodeURIComponent(
                            invoice.reversalJournalEntryId,
                          )}`}
                        >
                          View journal
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-red-900">Not recorded</p>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                        Cancelled receipt
                      </p>
                      {invoice.cancelledReceiptId ? (
                        <Link
                          className="mt-1 inline-block text-sm font-semibold text-red-900 underline-offset-4 hover:underline"
                          href={`${ROUTES.purchasingReceipts}/${invoice.cancelledReceiptId}`}
                        >
                          View receipt
                        </Link>
                      ) : (
                        <p className="mt-1 text-sm font-semibold text-red-900">Not recorded</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          ) : null}

          <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
            <SectionHeader
              description={`${String(invoice.items.length)} line item(s) on this bill.`}
              title="Bill items"
            />
            <PurchaseInvoiceItemLines items={invoice.items} />
          </section>

          <PurchaseInvoicePaymentsSection canManage={canManage} invoice={invoice} />

          <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
            <SectionHeader title="Notes" />
            <div className="p-5">
              <p className="text-sm text-workspace-muted">
                {invoice.notes ?? "No notes recorded."}
              </p>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-6 lg:sticky lg:top-6">
          <section className="overflow-hidden rounded-md border border-workspace-border bg-white">
            <SectionHeader
              description="Amounts owed and paid for this bill."
              title="Financial summary"
            />
            <div className="p-5">
              <p className="text-xs font-semibold uppercase tracking-wide text-workspace-muted">
                Balance due
              </p>
              <p
                className={cn(
                  "mt-1 text-3xl font-bold tabular-nums",
                  balanceTone(invoice.paymentStatus, invoice.balanceAmount),
                )}
              >
                {formatCurrency(invoice.balanceAmount)}
              </p>

              <div className="mt-4 grid grid-cols-2 gap-3 border-t border-workspace-border pt-4">
                <div>
                  <p className="text-xs font-semibold uppercase text-workspace-muted">Total</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-brand-espresso">
                    {formatCurrency(invoice.totalAmount)}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase text-workspace-muted">Paid</p>
                  <p className="mt-1 text-lg font-semibold tabular-nums text-emerald-600">
                    {formatCurrency(invoice.paidAmount)}
                  </p>
                </div>
              </div>

              <div className="mt-5 divide-y divide-workspace-border border-t border-workspace-border">
                <SummaryRow label="Subtotal" value={formatCurrency(invoice.subtotalAmount)} />
                <SummaryRow
                  label="Line discounts"
                  value={
                    invoice.discountAmount > 0
                      ? `-${formatCurrency(invoice.discountAmount)}`
                      : formatCurrency(0)
                  }
                />
                <SummaryRow
                  label="Bill discount"
                  value={
                    invoice.billDiscountAmount > 0
                      ? `-${formatCurrency(invoice.billDiscountAmount)}`
                      : formatCurrency(0)
                  }
                />
                <SummaryRow label="Tax" value={formatCurrency(invoice.taxAmount)} />
                {hasLegacyCharges ? (
                  <SummaryRow
                    label="Legacy charges"
                    value={formatCurrency(invoice.chargeAmount + invoice.chargeTaxAmount)}
                  />
                ) : null}
              </div>

              <div className="mt-3 flex items-center justify-between rounded-md bg-brand-latte px-3 py-2.5">
                <span className="text-sm font-semibold text-brand-espresso">Grand total</span>
                <span className="text-base font-bold tabular-nums text-brand-espresso">
                  {formatCurrency(invoice.totalAmount)}
                </span>
              </div>

              <div className="mt-3 space-y-0.5">
                <SummaryRow label="Paid" value={formatCurrency(invoice.paidAmount)} />
                <SummaryRow
                  emphasis
                  label="Balance due"
                  value={formatCurrency(invoice.balanceAmount)}
                />
              </div>
            </div>
          </section>
        </div>
      </div>

      <PurchaseInvoiceFormDialog
        accounts={[...(purchaseAccountsQuery.data ?? [])]}
        branches={branchesQuery.data ?? []}
        invoice={invoice}
        isSubmitting={updateMutation.isPending}
        onClose={() => setEditOpen(false)}
        onCreate={noopCreateBill}
        onUpdate={handleUpdateBill}
        open={editOpen}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />
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
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post Bill</DialogTitle>
            <DialogDescription>
              Posting confirms the supplier bill, creates the supplier payable, and posts the
              purchase accounting journal.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPostOpen(false)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={postMutation.isPending}
              onClick={() => void handlePostBill()}
              type="button"
            >
              Post Bill
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
