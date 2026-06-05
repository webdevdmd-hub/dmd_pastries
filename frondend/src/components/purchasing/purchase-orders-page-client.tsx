"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseOrderFormDialog } from "@/components/purchasing/purchase-order-form-dialog";
import { PurchaseOrdersTable } from "@/components/purchasing/purchase-orders-table";
import { PurchaseReceiveDialog } from "@/components/purchasing/purchase-receive-dialog";
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
  useConvertPurchaseOrderToInvoice,
  useCreatePurchaseOrder,
  useDeletePurchaseOrder,
  usePurchaseOrders,
  usePurchasingBranches,
  usePurchasingIngredients,
  usePurchasingProducts,
  usePurchasingSuppliers,
  usePurchasingTaxRates,
  usePurchasingUnits,
  useReceivePurchase,
  useUpdatePurchaseOrder,
  useUpdatePurchaseOrderStatus,
} from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  CreatePurchaseOrderPayload,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchasingFilters,
  ReceivePurchasePayload,
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
  | null;

export function PurchaseOrdersPageClient(): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.purchasingOrdersCreate,
    PERMISSIONS.purchasingOrdersEdit,
    PERMISSIONS.purchasingOrdersDelete,
    PERMISSIONS.purchasingOrdersStatusUpdate,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const canConvertToInvoice = hasAnyPermission([PERMISSIONS.purchasingInvoicesCreate]);
  const [filters, setFilters] = useState<PurchasingFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [editingOrder, setEditingOrder] = useState<PurchaseOrder | null>(null);
  const [receivingOrder, setReceivingOrder] = useState<PurchaseOrder | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const ordersQuery = usePurchaseOrders(filters, canView && branchScope.hasBranchScope);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const productsQuery = usePurchasingProducts(canView);
  const ingredientsQuery = usePurchasingIngredients(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const createMutation = useCreatePurchaseOrder();
  const updateMutation = useUpdatePurchaseOrder();
  const statusMutation = useUpdatePurchaseOrderStatus();
  const deleteMutation = useDeletePurchaseOrder();
  const receiveMutation = useReceivePurchase();
  const convertMutation = useConvertPurchaseOrderToInvoice();
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
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReceive = async (payload: ReceivePurchasePayload): Promise<void> => {
    try {
      await receiveMutation.mutateAsync(payload);
      toast.success("Stock received and inventory updated successfully.");
      setReceivingOrder(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleConvertToInvoice = async (order: PurchaseOrder): Promise<void> => {
    try {
      const invoice = await convertMutation.mutateAsync({
        id: order.id,
        payload: {
          invoiceDate: new Date().toISOString().slice(0, 10),
          notes: `Created from ${order.purchaseOrderNumber}`,
        },
      });
      toast.success("Purchase order converted to draft invoice.");
      router.push(`${ROUTES.purchasingInvoices}/${invoice.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "status") {
        await statusMutation.mutateAsync({
          id: pendingAction.order.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Purchase order status updated.");
      } else {
        await deleteMutation.mutateAsync(pendingAction.order.id);
        toast.success("Purchase order deleted.");
      }
      setPendingAction(null);
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
          canManage ? (
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
          actionLabel={canManage ? "Create Purchase Order" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PurchaseOrdersTable
              canConvertToInvoice={canConvertToInvoice}
              canManage={canManage}
              onConvertToInvoice={(order) => void handleConvertToInvoice(order)}
              onDelete={(order) => setPendingAction({ order, type: "delete" })}
              onEdit={(order) => {
                setEditingOrder(order);
                setFormOpen(true);
              }}
              onReceive={setReceivingOrder}
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
        ingredients={ingredientsQuery.data ?? []}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setEditingOrder(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
        order={editingOrder}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />

      <PurchaseReceiveDialog
        branches={branchesQuery.data ?? []}
        ingredients={ingredientsQuery.data ?? []}
        isSubmitting={receiveMutation.isPending}
        onClose={() => setReceivingOrder(null)}
        onReceive={handleReceive}
        open={receivingOrder !== null}
        order={receivingOrder}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
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
                : "Change purchase order status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This removes the draft order if the backend allows it."
                : `Update ${pendingAction?.order.purchaseOrderNumber ?? "order"} to ${pendingAction?.status ?? "status"}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={statusMutation.isPending || deleteMutation.isPending}
              onClick={() => void confirmAction()}
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
