"use client";

import { MoreHorizontal } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { usePublishBreadcrumbLabel } from "@/components/layout/breadcrumb-label";
import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import {
  parsePurchaseInvoiceDetailTab,
  type PurchaseInvoiceDetailTabKey,
} from "@/components/purchasing/purchase-invoice-detail-tabs";
import { PurchaseInvoiceDetailsPanel } from "@/components/purchasing/purchase-invoice-details-panel";
import { PurchaseInvoiceFormDialog } from "@/components/purchasing/purchase-invoice-form-dialog";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

type BillStanding = {
  summary: string;
  tone: "muted" | "warning" | "danger" | "info" | "money";
};

/**
 * Where this bill actually stands, in a sentence.
 *
 * The header showed two badges, then an info card repeated the number, supplier
 * and branch the header had already given, and a 547px summary card restated
 * Total, Paid and Balance due twice over. All of it answered one question: how
 * much is owed and what happens next.
 */
function billStanding(invoice: PurchaseInvoice): BillStanding {
  if (invoice.status === "cancelled") {
    return { summary: "Cancelled. This bill no longer owes anything.", tone: "muted" };
  }

  if (invoice.status === "draft") {
    return {
      summary: `Draft. Post it to owe ${formatCurrency(invoice.totalAmount)} to ${invoice.supplierName}.`,
      tone: "muted",
    };
  }

  if (invoice.balanceAmount <= 0) {
    return { summary: "Paid in full.", tone: "money" };
  }

  const outstanding = formatCurrency(invoice.balanceAmount);

  if (invoice.paymentStatus === "overdue") {
    return { summary: `${outstanding} overdue.`, tone: "danger" };
  }

  if (invoice.paidAmount > 0) {
    return {
      summary: `${outstanding} still outstanding of ${formatCurrency(invoice.totalAmount)}.`,
      tone: "info",
    };
  }

  return { summary: `${outstanding} outstanding, nothing paid yet.`, tone: "warning" };
}

const STANDING_TONE: Record<BillStanding["tone"], string> = {
  danger: "bg-danger-tint text-danger-text",
  info: "bg-info-tint text-info-text",
  money: "bg-money-tint text-money-text",
  muted: "bg-muted text-foreground-muted",
  warning: "bg-warning-tint text-warning-text",
};

export function PurchaseInvoiceDetailsPageClient({
  invoiceId,
}: {
  invoiceId: string;
}): JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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

  const activeTab = parsePurchaseInvoiceDetailTab(searchParams.get("tab"));

  const changeTab = (tab: PurchaseInvoiceDetailTabKey): void => {
    const next = new URLSearchParams(searchParams.toString());
    if (tab === "items") {
      next.delete("tab");
    } else {
      next.set("tab", tab);
    }
    const query = next.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };

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
  const standing = billStanding(invoice);

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

      {/* Sticky, so the balance and the pay button stay reachable at any scroll
          depth. The identifiers that used to sit in a 288px card below now live
          in the drawer: they answer "which bill is this", which you ask once. */}
      <header className="sticky top-0 z-10 overflow-hidden rounded-md border border-workspace-border bg-card">
        <div className="flex flex-col gap-4 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="truncate text-2xl font-semibold text-brand-espresso">
                {invoice.invoiceNumber}
              </h1>
              <PurchaseInvoiceStatusBadge status={invoice.status} />
              <PurchasePaymentStatusBadge status={invoice.paymentStatus} />
            </div>
            <p className="mt-1.5 text-cell text-workspace-muted">
              {invoice.supplierName} &middot; {invoice.branchName} &middot; Billed{" "}
              {formatDate(invoice.invoiceDate)} &middot; Due {formatDate(invoice.dueDate)}
            </p>
            <p
              className={cn(
                "mt-3 inline-flex rounded-md px-3 py-1.5 text-cell font-medium tabular-nums",
                STANDING_TONE[standing.tone],
              )}
            >
              {standing.summary}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 lg:shrink-0 lg:justify-end">
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
            {canEditInvoice || canCancelInvoice ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`More actions for ${invoice.invoiceNumber}`}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditInvoice ? (
                    <DropdownMenuItem
                      onSelect={() => {
                        setEditOpen(true);
                      }}
                    >
                      Edit bill
                    </DropdownMenuItem>
                  ) : null}
                  {canCancelInvoice ? (
                    <DropdownMenuItem
                      className="text-danger-text"
                      onSelect={() => {
                        setCancelReason("");
                        setCancelOpen(true);
                      }}
                    >
                      Cancel bill
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </div>
        </div>
      </header>

      <PurchaseInvoiceDetailsPanel
        activeTab={activeTab}
        canManagePayments={canManage}
        invoice={invoice}
        onTabChange={changeTab}
      />

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
