"use client";

import { ArrowRight, CheckCircle2, FileDown, ReceiptText, Truck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseDocumentChain } from "@/components/purchasing/purchase-document-chain";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseOrderConvertToBillDialog } from "@/components/purchasing/purchase-order-convert-to-bill-dialog";
import { PurchaseOrderFormDialog } from "@/components/purchasing/purchase-order-form-dialog";
import { PurchaseOrderReceiveGoodsDialog } from "@/components/purchasing/purchase-order-receive-goods-dialog";
import { PurchaseOrderStatusBadge } from "@/components/purchasing/purchase-order-status-badge";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingItemLines } from "@/components/purchasing/purchasing-item-lines";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { usePermission } from "@/hooks/use-permission";
import {
  useConvertPurchaseOrderToBill,
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
import { cn } from "@/lib/utils/cn";
import type {
  ConvertPurchaseOrderToBillPayload,
  ReceivePurchaseOrderPayload,
  UpdatePurchaseOrderPayload,
} from "@/types/purchasing";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

function formatDate(value: string | null): string {
  return value
    ? new Intl.DateTimeFormat("en-AE", { dateStyle: "medium" }).format(new Date(value))
    : "Not set";
}

function WorkflowStep({
  description,
  isActive,
  isDone,
  title,
}: {
  description: string;
  isActive: boolean;
  isDone: boolean;
  title: string;
}): JSX.Element {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 transition",
        isDone
          ? "border-brand-espresso bg-brand-espresso text-white"
          : isActive
            ? "border-brand-espresso bg-white text-brand-espresso shadow-sm"
            : "border-brand-cappuccino bg-white text-brand-mocha",
      )}
    >
      <div className="flex items-center gap-2">
        <CheckCircle2
          className={cn("h-4 w-4", isDone ? "text-white" : "text-brand-mocha")}
          aria-hidden="true"
        />
        <p className="text-xs font-bold uppercase tracking-[0.2em]">{title}</p>
      </div>
      <p className={cn("mt-2 text-sm", isDone ? "text-white/80" : "text-brand-mocha")}>
        {description}
      </p>
    </div>
  );
}

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
  const [formOpen, setFormOpen] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(false);
  const orderQuery = usePurchaseOrder(orderId, canView);
  const chainQuery = usePurchaseOrderDocumentChain(orderId, canView);
  const branchesQuery = usePurchasingBranches(canView);
  const duplicateMutation = useDuplicatePurchaseOrder();
  const productsQuery = usePurchasingProducts(canView);
  const reopenMutation = useReopenPurchaseOrder();
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const convertMutation = useConvertPurchaseOrderToBill();
  const receiveMutation = useReceivePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const statusMutation = useUpdatePurchaseOrderStatus();

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
  const activeBill = chainQuery.data?.purchaseInvoices.find(
    (invoice) => invoice.status !== "cancelled",
  );
  const isPaid = activeBill?.paymentStatus === "paid";
  const canReceiveOrder =
    canReceive && (order.status === "ordered" || order.status === "partially_received");
  const canEditOrder = canEdit && (order.status === "draft" || order.status === "ordered");
  const canAdjustRemaining = canEdit && order.status === "partially_received";
  const canConvertOrder = canConvert && order.status === "received" && !activeBill;
  const orderedDone = order.status !== "draft" && order.status !== "cancelled";
  const receivedDone = order.status === "received" || Boolean(activeBill);
  const billedDone = Boolean(activeBill);
  const paidDone = isPaid;

  const handleMarkIssued = async (): Promise<void> => {
    try {
      await statusMutation.mutateAsync({ id: order.id, payload: { status: "ordered" } });
      toast.success("Purchase order marked as issued.");
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

  const handleConvert = async (payload: ConvertPurchaseOrderToBillPayload): Promise<void> => {
    try {
      const invoice = await convertMutation.mutateAsync({
        id: order.id,
        payload,
      });
      toast.success("Purchase order converted to draft bill.");
      setConvertOpen(false);
      router.push(`${ROUTES.purchasingInvoices}/${invoice.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const primaryAction = (): JSX.Element | null => {
    if (order.status === "draft" && canIssue) {
      return (
        <Button
          disabled={statusMutation.isPending}
          onClick={() => void handleMarkIssued()}
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

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <Card className="overflow-hidden border-brand-cappuccino bg-white shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <Link
                className="text-sm font-semibold text-brand-mocha hover:text-brand-espresso"
                href={ROUTES.purchasingOrders}
              >
                Back to Purchase Orders
              </Link>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h1 className="font-display text-4xl text-brand-espresso">
                  {order.purchaseOrderNumber}
                </h1>
                <PurchaseOrderStatusBadge status={order.status} />
              </div>
              <p className="mt-3 max-w-2xl text-sm text-brand-mocha">
                {order.supplierName} / {order.branchName} / Ordered {formatDate(order.orderDate)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEditOrder || canAdjustRemaining ? (
                <Button onClick={() => setFormOpen(true)} type="button" variant="outline">
                  {canAdjustRemaining ? "Adjust remaining" : "Edit"}
                </Button>
              ) : null}
              {canReopen && order.status === "cancelled" ? (
                <Button
                  disabled={reopenMutation.isPending}
                  onClick={() => void handleReopen()}
                  type="button"
                  variant="outline"
                >
                  Reopen
                </Button>
              ) : null}
              {canCreate ? (
                <Button
                  disabled={duplicateMutation.isPending}
                  onClick={() => void handleDuplicate()}
                  type="button"
                  variant="outline"
                >
                  Duplicate as draft
                </Button>
              ) : null}
              <Button
                onClick={() => toast.info("Print and download support will be connected later.")}
                type="button"
                variant="outline"
              >
                <FileDown className="h-4 w-4" />
                Print / Download
              </Button>
              {primaryAction()}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-brand-cappuccino bg-white/95 shadow-sm">
        <CardHeader className="border-b border-brand-cappuccino">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-brand-mocha">
                Purchase workflow
              </p>
              <CardTitle className="mt-1 text-2xl text-brand-espresso">
                Ordered - Received - Billed - Paid
              </CardTitle>
            </div>
            <Badge variant="secondary">
              Expected delivery: {formatDate(order.expectedDeliveryDate)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-3 p-5 md:grid-cols-4">
          <WorkflowStep
            description="Supplier PO is issued and ready for fulfilment."
            isActive={order.status === "draft"}
            isDone={orderedDone}
            title="Ordered"
          />
          <WorkflowStep
            description="Goods are received against ordered quantities."
            isActive={canReceiveOrder}
            isDone={receivedDone}
            title="Received"
          />
          <WorkflowStep
            description="Supplier bill is created from the received order."
            isActive={canConvertOrder}
            isDone={billedDone}
            title="Billed"
          />
          <WorkflowStep
            description="Payment made closes the supplier payable."
            isActive={Boolean(activeBill && activeBill.balanceAmount > 0)}
            isDone={paidDone}
            title="Paid"
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="border-brand-cappuccino bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>What's next?</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <p className="text-sm text-brand-mocha">
              Complete the next purchasing step from this order instead of creating receipts, bills,
              and payments from separate pages. Supplier, branch, item, tax, and quantity details
              carry forward automatically.
            </p>
            <div className="flex flex-wrap gap-2">
              {primaryAction()}
              <Button asChild type="button" variant="outline">
                <a href="#purchase-timeline">
                  View purchase timeline
                  <ArrowRight className="h-4 w-4" />
                </a>
              </Button>
            </div>
            {order.status === "partially_received" ? (
              <p className="rounded-2xl border border-brand-cappuccino bg-brand-latte p-4 text-sm text-brand-mocha">
                Partially received purchase orders must be fully received before converting to a
                bill in this workflow.
              </p>
            ) : null}
          </CardContent>
        </Card>

        <Card className="border-brand-cappuccino bg-white/95 shadow-sm">
          <CardHeader>
            <CardTitle>Document summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-brand-mocha">Bill</span>
              <span className="font-semibold text-brand-espresso">
                {activeBill?.supplierBillNumber ?? activeBill?.invoiceNumber ?? "Not created"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-brand-mocha">Bill status</span>
              <span className="font-semibold text-brand-espresso">
                {activeBill ? activeBill.status : "Pending"}
              </span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-brand-mocha">Payment status</span>
              <span className="font-semibold text-brand-espresso">
                {activeBill ? activeBill.paymentStatus : "Pending"}
              </span>
            </div>
            <div className="flex justify-between gap-4 border-t border-brand-cappuccino pt-3">
              <span className="text-brand-mocha">Balance due</span>
              <span className="font-semibold text-brand-espresso">
                {formatCurrency(activeBill?.balanceAmount ?? order.totalAmount)}
              </span>
            </div>
          </CardContent>
        </Card>
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

      <div id="purchase-timeline">
        <PurchaseDocumentChain
          chain={chainQuery.data}
          error={chainQuery.error}
          isLoading={chainQuery.isLoading}
          onRetry={() => {
            void chainQuery.refetch();
          }}
        />
      </div>

      <Card className="bg-white/85">
        <CardHeader>
          <CardTitle>Notes</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-brand-mocha">{order.notes ?? "No notes recorded."}</p>
        </CardContent>
      </Card>

      <PurchaseOrderReceiveGoodsDialog
        isSubmitting={receiveMutation.isPending}
        onClose={() => setReceiveOpen(false)}
        onReceive={handleReceive}
        open={receiveOpen}
        order={order}
      />
      <PurchaseOrderConvertToBillDialog
        isSubmitting={convertMutation.isPending}
        onClose={() => setConvertOpen(false)}
        onConvert={handleConvert}
        open={convertOpen}
        order={order}
      />
      <PurchaseOrderFormDialog
        branches={branchesQuery.data ?? []}
        isSubmitting={updateMutation.isPending}
        onClose={() => setFormOpen(false)}
        onCreate={() => Promise.resolve()}
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
