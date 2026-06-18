"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseOrderConvertToBillDialog } from "@/components/purchasing/purchase-order-convert-to-bill-dialog";
import { PurchaseOrderFormDialog } from "@/components/purchasing/purchase-order-form-dialog";
import { PurchaseOrderReceiveGoodsDialog } from "@/components/purchasing/purchase-order-receive-goods-dialog";
import { PurchaseOrdersTable } from "@/components/purchasing/purchase-orders-table";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingToolbar } from "@/components/purchasing/purchasing-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSIONS } from "@/constants/permissions";
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import {
  useConvertPurchaseOrderToBill,
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  useDuplicatePurchaseOrder,
  usePurchaseOrder,
  usePurchaseOrders,
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
import { ApiError, getErrorMessage } from "@/lib/api/client";
import {
  getHistoryDeleteConflictMessage,
  isHistoryDeleteConflict,
} from "@/lib/api/delete-conflicts";
import type {
  ConvertPurchaseOrderToBillPayload,
  CreatePurchaseOrderPayload,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchasingFilters,
  ReceivePurchaseOrderPayload,
  UpdatePurchaseOrderPayload,
} from "@/types/purchasing";

const defaultFilters: PurchasingFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  status: "all",
  supplierId: "all",
};

const orderStatuses = [
  { label: "Draft", value: "draft" },
  { label: "Ordered", value: "ordered" },
  { label: "Partially received", value: "partially_received" },
  { label: "Received", value: "received" },
  { label: "Cancelled", value: "cancelled" },
];

type PendingAction =
  | { order: PurchaseOrder; status: PurchaseOrderStatus; type: "status" }
  | { order: PurchaseOrder; type: "delete" }
  | { order: PurchaseOrder; type: "reopen" }
  | null;

export function PurchaseOrdersPageClient(): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canCreate = hasAnyPermission([
    PERMISSIONS.purchasingOrdersCreate,
    PERMISSIONS.purchasingManage,
  ]);
  const canEdit = hasAnyPermission([
    PERMISSIONS.purchasingOrdersEdit,
    PERMISSIONS.purchasingManage,
  ]);
  const canDelete = hasAnyPermission([
    PERMISSIONS.purchasingOrdersDelete,
    PERMISSIONS.purchasingManage,
  ]);
  const canUpdateStatus = hasAnyPermission([
    PERMISSIONS.purchasingOrdersStatusUpdate,
    PERMISSIONS.purchasingManage,
  ]);
  const canReceiveOrder = hasAnyPermission([
    PERMISSIONS.purchasingReceiveStock,
    PERMISSIONS.purchasingManage,
  ]);
  const canConvertToBill = hasAnyPermission([PERMISSIONS.purchasingInvoicesCreate]);
  const [filters, setFilters] = useState<PurchasingFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [editingOrderId, setEditingOrderId] = useState<string | null>(null);
  const [convertingOrder, setConvertingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const ordersQuery = usePurchaseOrders(filters, canView && branchScope.hasBranchScope);
  const editingOrderQuery = usePurchaseOrder(
    editingOrderId,
    canView && branchScope.hasBranchScope && editingOrderId !== null,
  );
  const receivingOrderQuery = usePurchaseOrder(
    receivingOrderId,
    canView && branchScope.hasBranchScope && receivingOrderId !== null,
  );
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const productsQuery = usePurchasingProducts(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const statusMutation = useUpdatePurchaseOrderStatus();
  const deleteMutation = useDeletePurchaseOrder();
  const reopenMutation = useReopenPurchaseOrder();
  const duplicateMutation = useDuplicatePurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const convertMutation = useConvertPurchaseOrderToBill();
  const isPermissionDenied =
    ordersQuery.error instanceof ApiError && ordersQuery.error.status === 403;

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [normalizeBranchId]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const openCreate = (): void => {
    setEditingOrder(null);
    setEditingOrderId(null);
    setFormOpen(true);
  };

  const handleCreate = async (payload: CreatePurchaseOrderPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Purchase order created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdatePurchaseOrderPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Purchase order updated.");
      setEditingOrder(null);
      setEditingOrderId(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReceive = async (payload: ReceivePurchaseOrderPayload): Promise<void> => {
    if (!receivingOrderId) return;

    try {
      await receiveMutation.mutateAsync({ id: receivingOrderId, payload });
      toast.success("Goods received against purchase order.");
      setReceivingOrderId(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleConvertToBill = async (payload: ConvertPurchaseOrderToBillPayload): Promise<void> => {
    if (!convertingOrder) return;

    try {
      const invoice = await convertMutation.mutateAsync({
        id: convertingOrder.id,
        payload,
      });
      toast.success("Purchase order converted to draft bill.");
      setConvertingOrder(null);
      router.push(`${ROUTES.purchasingInvoices}/${invoice.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    const action = pendingAction;
    if (!action) return;

    try {
      if (action.type === "status") {
        await statusMutation.mutateAsync({
          id: action.order.id,
          payload: { status: action.status },
        });
        toast.success("Purchase order status updated.");
      } else if (action.type === "delete") {
        await deleteMutation.mutateAsync(action.order.id);
        toast.success("Purchase order deleted.");
      } else {
        await reopenMutation.mutateAsync(action.order.id);
        toast.success("Purchase order reopened as draft.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(
        action.type === "delete" && isHistoryDeleteConflict(error)
          ? getHistoryDeleteConflictMessage("purchase order")
          : getErrorMessage(error),
      );
    }
  };

  const handleDuplicate = async (order: PurchaseOrder): Promise<void> => {
    try {
      const duplicatedOrder = await duplicateMutation.mutateAsync(order.id);
      toast.success("Purchase order duplicated as draft.");
      router.push(`${ROUTES.purchasingOrders}/${duplicatedOrder.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const orders = ordersQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Purchase Orders"
        description="Create and track supplier purchase orders before stock is received."
        actions={
          canCreate ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Create Purchase Order
            </Button>
          ) : undefined
        }
      />

      <PurchasingToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        onFiltersChange={setFilters}
        resetBranchId={branchScope.defaultBranchId}
        statuses={orderStatuses}
        suppliers={suppliersQuery.data ?? []}
      />

      {ordersQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!ordersQuery.isLoading && ordersQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to purchase orders." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(ordersQuery.error)}
            onRetry={() => {
              void ordersQuery.refetch();
            }}
          />
        )
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length === 0 ? (
        <PurchaseEmptyState
          actionLabel={canCreate ? "Create Purchase Order" : undefined}
          onAction={canCreate ? openCreate : undefined}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PurchaseOrdersTable
              canCreate={canCreate}
              canDelete={canDelete}
              canEdit={canEdit}
              canConvertToBill={canConvertToBill}
              canReceiveOrder={canReceiveOrder}
              canUpdateStatus={canUpdateStatus}
              onConvertToBill={setConvertingOrder}
              onDelete={(order) => setPendingAction({ order, type: "delete" })}
              onDuplicate={(order) => void handleDuplicate(order)}
              onEdit={(order) => {
                setEditingOrder(order);
                setEditingOrderId(order.id);
                setFormOpen(true);
              }}
              onReopen={(order) => setPendingAction({ order, type: "reopen" })}
              onReceive={(order) => setReceivingOrderId(order.id)}
              onStatusChange={(order, status) =>
                setPendingAction({ order, status, type: "status" })
              }
              orders={orders}
            />
          </CardContent>
        </Card>
      ) : null}

      <PurchaseOrderFormDialog
        branches={branchesQuery.data ?? []}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setEditingOrder(null);
          setEditingOrderId(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
        order={editingOrderQuery.data ?? editingOrder}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />

      <PurchaseOrderReceiveGoodsDialog
        isSubmitting={receiveMutation.isPending}
        isLoading={receivingOrderQuery.isLoading}
        loadError={receivingOrderQuery.error ? getErrorMessage(receivingOrderQuery.error) : null}
        onClose={() => setReceivingOrderId(null)}
        onReceive={handleReceive}
        open={receivingOrderId !== null}
        order={receivingOrderQuery.data ?? null}
      />

      <PurchaseOrderConvertToBillDialog
        isSubmitting={convertMutation.isPending}
        onClose={() => setConvertingOrder(null)}
        onConvert={handleConvertToBill}
        open={convertingOrder !== null}
        order={convertingOrder}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete"
                ? "Delete purchase order"
                : pendingAction?.type === "reopen"
                  ? "Reopen purchase order"
                  : "Change purchase order status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This permanently removes the purchase order, its item lines, and document charges only when it has no linked receiving, bill, payment, vendor credit, or stock history. This cannot be undone."
                : pendingAction?.type === "reopen"
                  ? "Reopen this cancelled purchase order as a draft only if it has no linked receipt, bill, payment, return, or stock history."
                  : `Update ${pendingAction?.order.purchaseOrderNumber ?? "order"} to ${pendingAction?.status ?? "status"}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className={
                pendingAction?.type === "delete"
                  ? "bg-red-700 text-white hover:bg-red-800"
                  : undefined
              }
              disabled={
                statusMutation.isPending || deleteMutation.isPending || reopenMutation.isPending
              }
              onClick={() => void confirmAction()}
              type="button"
            >
              {pendingAction?.type === "delete"
                ? "Delete purchase order"
                : pendingAction?.type === "reopen"
                  ? "Reopen purchase order"
                  : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
