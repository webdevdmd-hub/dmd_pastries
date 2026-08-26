"use client";

import { ArrowRight, MoreHorizontal, ReceiptText, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseDocumentChain } from "@/components/purchasing/purchase-document-chain";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoiceFormDialog } from "@/components/purchasing/purchase-invoice-form-dialog";
import { PurchaseOrderFormDialog } from "@/components/purchasing/purchase-order-form-dialog";
import { PurchaseOrderReceiveGoodsDialog } from "@/components/purchasing/purchase-order-receive-goods-dialog";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchaseDetailSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useAllChartAccounts } from "@/hooks/use-accounting";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreatePurchaseInvoice,
  useCreatePurchaseOrderRevision,
  useDuplicatePurchaseOrder,
  usePurchaseOrder,
  usePurchaseOrderDocumentChain,
  usePurchasingBranches,
  usePurchasingProducts,
  usePurchasingSuppliers,
  usePurchasingTaxRates,
  usePurchasingUnits,
  useReceivePurchaseOrder,
  useReopenPurchaseOrder,
  useUpdatePurchaseOrder,
  useUpdatePurchaseOrderStatus,
} from "@/hooks/use-purchasing";
import { getErrorMessage } from "@/lib/api/client";
import { formatDateOnly } from "@/lib/format/date";
import { purchaseOrderToBillInitialValues } from "@/lib/purchasing/purchase-order-bill-draft";
import {
  hasOutstandingStock,
  receivingProgress,
  unreceivedValue,
} from "@/lib/purchasing/purchase-order-quantities";
import { cn } from "@/lib/utils/cn";
import type {
  CreatePurchaseInvoicePayload,
  CreatePurchaseOrderRevisionPayload,
  PurchaseOrder,
  ReceivePurchaseOrderPayload,
  UpdatePurchaseInvoicePayload,
  UpdatePurchaseOrderPayload,
} from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return formatDateOnly(value);
}

function hasRemainingReceivableProducts(order: PurchaseOrder): boolean {
  return hasOutstandingStock(order);
}

type OrderStanding = {
  /** Fraction of goods lines complete, for the inline meter. 0-1. */
  progress: number;
  /** One sentence: where this order actually is. */
  summary: string;
  tone: "muted" | "warning" | "info" | "money";
};

/**
 * The status badge, the four-step workflow tracker and the "What's next?" card
 * all answered one question: where is this order, and what happens next. Three
 * widgets, 663px, and a duplicated primary button. This computes that answer
 * once so the header can state it in a line.
 */
function orderStanding(
  order: PurchaseOrder,
  activeBill: { balanceAmount: number; paymentStatus: string; status: string } | undefined,
): OrderStanding {
  const { completeLines, stockLines } = receivingProgress(order);
  const progress = stockLines === 0 ? 0 : completeLines / stockLines;

  if (order.status === "cancelled") {
    return {
      progress: 0,
      summary: "Cancelled. This order can no longer be received.",
      tone: "muted",
    };
  }

  if (order.status === "draft") {
    return {
      progress: 0,
      summary: `Draft, not yet issued to ${order.supplierName}.`,
      tone: "muted",
    };
  }

  // Receiving is settled by goods arriving, never by a bill being raised. The
  // old tracker read `|| Boolean(activeBill)`, so a partially received order
  // that had been billed claimed "Received" while stock was still outstanding.
  // Outstanding goods therefore win over any billing state below.
  if (hasRemainingReceivableProducts(order)) {
    return {
      progress,
      summary: `${String(completeLines)} of ${String(stockLines)} lines received`,
      tone: "warning",
    };
  }

  if (!activeBill) {
    return { progress: 1, summary: "All goods received. Ready to bill.", tone: "money" };
  }

  if (activeBill.paymentStatus === "paid") {
    return { progress: 1, summary: "Received, billed and paid in full.", tone: "money" };
  }

  return { progress: 1, summary: "Received and billed. Payment outstanding.", tone: "info" };
}

const STANDING_TONE: Record<OrderStanding["tone"], string> = {
  info: "bg-info-tint text-info-text",
  money: "bg-money-tint text-money-text",
  muted: "bg-muted text-foreground-muted",
  warning: "bg-warning-tint text-warning-text",
};

export function PurchaseOrderDetailsPageClient({ orderId }: { orderId: string }): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canConvert = hasAnyPermission([PERMISSIONS.purchasingInvoicesCreate]);
  const canCreate = hasAnyPermission([
    PERMISSIONS.purchasingOrdersCreate,
    PERMISSIONS.purchasingManage,
  ]);
  const canEdit = hasAnyPermission([
    PERMISSIONS.purchasingOrdersEdit,
    PERMISSIONS.purchasingManage,
  ]);
  const canReceive = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsCreate,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const canIssue = hasAnyPermission([PERMISSIONS.purchasingOrdersStatusUpdate]);
  const canReopen = hasAnyPermission([
    PERMISSIONS.purchasingOrdersStatusUpdate,
    PERMISSIONS.purchasingManage,
  ]);
  const [convertOpen, setConvertOpen] = useState(false);
  const [pendingStatusAction, setPendingStatusAction] = useState<"issue" | "cancel" | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const orderQuery = usePurchaseOrder(orderId, canView);
  const chainQuery = usePurchaseOrderDocumentChain(orderId, canView);
  const branchesQuery = usePurchasingBranches(canView);
  const duplicateMutation = useDuplicatePurchaseOrder();
  const productsQuery = usePurchasingProducts(canView);
  const reopenMutation = useReopenPurchaseOrder();
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const unitsQuery = usePurchasingUnits(canView);
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
  const createInvoiceMutation = useCreatePurchaseInvoice();
  const createRevisionMutation = useCreatePurchaseOrderRevision();
  const receiveMutation = useReceivePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const statusMutation = useUpdatePurchaseOrderStatus();

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (orderQuery.isLoading) {
    return <PurchaseDetailSkeleton />;
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
  const activeBill = chainQuery.data?.purchaseInvoices.find(
    (invoice) => invoice.status !== "cancelled",
  );
  const isPaid = activeBill?.paymentStatus === "paid";
  const canReceiveOrder =
    canReceive &&
    (order.status === "ordered" || order.status === "partially_received") &&
    hasRemainingReceivableProducts(order);
  const canEditOrder = canEdit && (order.status === "draft" || order.status === "ordered");
  const canAdjustRemaining = canEdit && order.status === "partially_received";
  const canEditWithCorrection = canEdit && order.status === "received";
  const canConvertOrder = canConvert && order.status === "received" && !activeBill;
  const billInitialValues = purchaseOrderToBillInitialValues(order);
  const purchaseAccounts = [...(purchaseAccountsQuery.data ?? [])];

  const handleConfirmStatusAction = async (): Promise<void> => {
    if (!pendingStatusAction) return;

    try {
      if (pendingStatusAction === "issue") {
        await statusMutation.mutateAsync({ id: order.id, payload: { status: "ordered" } });
        toast.success("Purchase order marked as issued.");
      } else {
        await statusMutation.mutateAsync({ id: order.id, payload: { status: "cancelled" } });
        toast.success("Purchase order cancelled.");
      }
      setPendingStatusAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReceive = async (payload: ReceivePurchaseOrderPayload): Promise<void> => {
    try {
      await receiveMutation.mutateAsync({ id: order.id, payload });
      toast.success("Goods received against purchase order.");
      setReceiveOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdatePurchaseOrderPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success(
        order.status === "partially_received"
          ? "Remaining quantities adjusted."
          : "Purchase order updated.",
      );
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleRevise = async (
    id: string,
    payload: CreatePurchaseOrderRevisionPayload,
  ): Promise<void> => {
    try {
      const revision = await createRevisionMutation.mutateAsync({ id, payload });
      toast.success(`Purchase order revision ${String(revision.revisionNumber)} saved.`);
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReopen = async (): Promise<void> => {
    try {
      await reopenMutation.mutateAsync(order.id);
      toast.success("Purchase order reopened as draft.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleDuplicate = async (): Promise<void> => {
    try {
      const duplicatedOrder = await duplicateMutation.mutateAsync(order.id);
      toast.success("Purchase order duplicated as draft.");
      router.push(`${ROUTES.purchasingOrders}/${duplicatedOrder.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleCreateBillFromOrder = async (
    payload: CreatePurchaseInvoicePayload,
  ): Promise<void> => {
    try {
      const invoice = await createInvoiceMutation.mutateAsync(payload);
      toast.success("Draft bill created from purchase order.");
      setConvertOpen(false);
      router.push(`${ROUTES.purchasingInvoices}/${invoice.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const noopUpdateBill = (_id: string, _payload: UpdatePurchaseInvoicePayload): Promise<void> =>
    Promise.reject(new Error("This dialog only creates bills from purchase orders."));

  const primaryAction = (): JSX.Element | null => {
    if (order.status === "draft" && canIssue) {
      return (
        <Button
          disabled={statusMutation.isPending}
          onClick={() => setPendingStatusAction("issue")}
          type="button"
        >
          Mark as issued
          <ArrowRight className="h-4 w-4" />
        </Button>
      );
    }

    if (canReceiveOrder) {
      return (
        <Button onClick={() => setReceiveOpen(true)} type="button">
          Receive goods
          <Truck className="h-4 w-4" />
        </Button>
      );
    }

    if (canConvertOrder) {
      return (
        <Button onClick={() => setConvertOpen(true)} type="button">
          Convert to bill
          <ReceiptText className="h-4 w-4" />
        </Button>
      );
    }

    if (activeBill?.status === "posted" && activeBill.balanceAmount > 0) {
      return (
        <Button asChild>
          <Link href={`${ROUTES.purchasingInvoices}/${activeBill.id}`}>
            Record payment
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      );
    }

    if (isPaid) {
      return (
        <Button asChild>
          <Link href={`${ROUTES.suppliers}/${order.supplierId}#statement`}>
            View vendor statement
          </Link>
        </Button>
      );
    }

    return null;
  };

  const standing = orderStanding(order, activeBill);
  const outstandingValue = hasRemainingReceivableProducts(order) ? unreceivedValue(order) : 0;
  const hasSecondaryActions =
    canEditOrder ||
    canAdjustRemaining ||
    canEditWithCorrection ||
    canCreate ||
    (canIssue && order.status !== "received" && order.status !== "cancelled") ||
    (canReopen && order.status === "cancelled");

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-4">
      {/* One header, sticky, carrying the identity, the standing and the single
          next action. It replaces the header card, the four-step tracker and
          the What's next card -- 663px of chrome that answered one question
          three times and rendered the primary button twice. */}
      <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-card px-4 py-4 sm:mx-0 sm:rounded-md sm:border sm:px-5">
        <Link
          className="text-meta text-foreground-muted hover:text-foreground"
          href={ROUTES.purchasingOrders}
        >
          &larr; Purchase orders
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="font-serif text-3xl text-brand-espresso">{order.purchaseOrderNumber}</h1>
          <PurchaseOrderStatusBadge status={order.status} />
          <div className="ml-auto flex flex-wrap items-center gap-2">
            {hasSecondaryActions ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    aria-label={`More actions for ${order.purchaseOrderNumber}`}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {canEditOrder || canAdjustRemaining || canEditWithCorrection ? (
                    <DropdownMenuItem onSelect={() => setFormOpen(true)}>
                      {canEditWithCorrection
                        ? "Edit with correction"
                        : canAdjustRemaining
                          ? "Adjust remaining"
                          : "Edit"}
                    </DropdownMenuItem>
                  ) : null}
                  {canCreate ? (
                    <DropdownMenuItem
                      disabled={duplicateMutation.isPending}
                      onSelect={() => void handleDuplicate()}
                    >
                      Duplicate as draft
                    </DropdownMenuItem>
                  ) : null}
                  {canReopen && order.status === "cancelled" ? (
                    <DropdownMenuItem
                      disabled={reopenMutation.isPending}
                      onSelect={() => void handleReopen()}
                    >
                      Reopen
                    </DropdownMenuItem>
                  ) : null}
                  {canIssue && order.status !== "received" && order.status !== "cancelled" ? (
                    <DropdownMenuItem
                      disabled={statusMutation.isPending}
                      onSelect={() => setPendingStatusAction("cancel")}
                    >
                      Cancel order
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
            {primaryAction()}
          </div>
        </div>
        <p className="mt-1.5 text-sm text-foreground-muted">
          {order.supplierName} &middot; {order.branchName} &middot; Ordered{" "}
          <span className="tabular-nums">{formatDate(order.orderDate)}</span>
          {order.expectedDeliveryDate ? (
            <>
              {" "}
              &middot; Expected{" "}
              <span className="tabular-nums">{formatDate(order.expectedDeliveryDate)}</span>
            </>
          ) : null}
        </p>

        <div
          className={cn(
            "mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md px-3 py-2 text-sm",
            STANDING_TONE[standing.tone],
          )}
        >
          {standing.tone === "warning" ? (
            <span
              aria-hidden="true"
              className="h-1 w-16 overflow-hidden rounded-full bg-current/20"
            >
              <span
                className="block h-full rounded-full bg-current"
                style={{ width: `${String(Math.round(standing.progress * 100))}%` }}
              />
            </span>
          ) : null}
          <span className="tabular-nums">{standing.summary}</span>
          {outstandingValue > 0 ? (
            <>
              <span aria-hidden="true">&middot;</span>
              <span>
                <span className="font-semibold tabular-nums">
                  {formatCurrency(outstandingValue)}
                </span>{" "}
                still to arrive
              </span>
            </>
          ) : null}
          <Button
            className="ml-auto"
            onClick={() => setTimelineOpen(true)}
            size="sm"
            type="button"
            variant="outline"
          >
            Timeline &amp; documents
          </Button>
        </div>

        {order.status === "partially_received" ? (
          <p className="mt-2 text-meta text-foreground-muted">
            Every line must be received before this order can be converted to a bill.
          </p>
        ) : null}
      </div>

      <PurchasingItemLines
        lines={order.items}
        title="Purchase order items"
        totals={{
          discount: order.discountAmount,
          subtotal: order.subtotalAmount,
          tax: order.taxAmount,
          total: order.totalAmount,
        }}
      />

      {/* Timeline, linked documents and notes are reference material: needed
          when someone asks "what happened here", not on every visit. As a
          drawer they cost one click instead of 2,111px of permanent scroll. */}
      <Sheet onOpenChange={setTimelineOpen} open={timelineOpen}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl" side="right">
          <SheetHeader>
            <SheetTitle>Timeline &amp; documents</SheetTitle>
            <SheetDescription>
              {order.purchaseOrderNumber} &middot; {order.supplierName}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="rounded-md bg-muted p-4">
              <h3 className="text-meta font-medium text-foreground-muted">Document summary</h3>
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">Bill</dt>
                  <dd className="font-medium">
                    {activeBill?.supplierBillNumber ?? activeBill?.invoiceNumber ?? "Not created"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">Bill status</dt>
                  <dd className="font-medium">{activeBill ? activeBill.status : "Pending"}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">Payment status</dt>
                  <dd className="font-medium">
                    {activeBill ? activeBill.paymentStatus : "Pending"}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-foreground-muted">Not yet received</dt>
                  <dd className="font-medium tabular-nums">
                    {hasRemainingReceivableProducts(order)
                      ? formatCurrency(unreceivedValue(order))
                      : "Nothing outstanding"}
                  </dd>
                </div>
                {/* Balance due is what the supplier is owed, which only a bill
                    can establish. Falling back to the order total presented an
                    un-billed PO as money owed. */}
                <div className="flex justify-between gap-4 border-t border-border pt-2">
                  <dt className="text-foreground-muted">Balance due</dt>
                  <dd className="font-medium tabular-nums">
                    {activeBill ? formatCurrency(activeBill.balanceAmount) : "No bill yet"}
                  </dd>
                </div>
              </dl>
            </div>

            <PurchaseDocumentChain
              chain={chainQuery.data}
              error={chainQuery.error}
              isLoading={chainQuery.isLoading}
              onRetry={() => {
                void chainQuery.refetch();
              }}
            />

            <div>
              <h3 className="text-meta font-medium text-foreground-muted">Notes</h3>
              <p className="mt-2 text-sm text-foreground-muted">
                {order.notes ?? "No notes recorded."}
              </p>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      <Dialog
        open={pendingStatusAction !== null}
        onOpenChange={(nextOpen) => (!nextOpen ? setPendingStatusAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingStatusAction === "issue"
                ? `Issue ${order.purchaseOrderNumber} to ${order.supplierName}?`
                : `Cancel ${order.purchaseOrderNumber}?`}
            </DialogTitle>
            <DialogDescription>
              {pendingStatusAction === "issue"
                ? "The order moves from Draft to Ordered and becomes receivable. Items, supplier, and branch can still be edited until goods arrive."
                : order.status === "partially_received"
                  ? "This order already has received goods against it. Cancelling stops further receiving; posted receipts and stock stay as they are."
                  : "The order moves to Cancelled and can no longer be received. It can be reopened as a draft later if nothing else links to it."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingStatusAction(null)} type="button" variant="outline">
              Keep as is
            </Button>
            <Button
              className={
                pendingStatusAction === "cancel"
                  ? "bg-danger text-primary-foreground hover:bg-danger"
                  : undefined
              }
              disabled={statusMutation.isPending}
              onClick={() => void handleConfirmStatusAction()}
              type="button"
            >
              {pendingStatusAction === "issue"
                ? statusMutation.isPending
                  ? "Issuing..."
                  : "Issue order"
                : statusMutation.isPending
                  ? "Cancelling..."
                  : "Cancel order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <PurchaseOrderReceiveGoodsDialog
        isSubmitting={receiveMutation.isPending}
        onClose={() => setReceiveOpen(false)}
        onReceive={handleReceive}
        open={receiveOpen}
        order={order}
      />
      <PurchaseInvoiceFormDialog
        accounts={purchaseAccounts}
        branches={branchesQuery.data ?? []}
        createButtonLabel="Create draft bill"
        createDescription={`Review and edit the bill copied from ${order.purchaseOrderNumber}.`}
        createTitle="Create Bill from PO"
        initialValues={billInitialValues}
        invoice={null}
        isSubmitting={createInvoiceMutation.isPending}
        onClose={() => setConvertOpen(false)}
        onCreate={handleCreateBillFromOrder}
        onUpdate={noopUpdateBill}
        open={convertOpen}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />
      <PurchaseOrderFormDialog
        accounts={purchaseAccounts}
        branches={branchesQuery.data ?? []}
        isSubmitting={updateMutation.isPending || createRevisionMutation.isPending}
        onClose={() => setFormOpen(false)}
        onCreate={() => Promise.resolve()}
        onRevise={handleRevise}
        onUpdate={handleUpdate}
        open={formOpen}
        order={order}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />
    </div>
  );
}
