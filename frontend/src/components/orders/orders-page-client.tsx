"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import { OrdersEmptyState } from "@/components/orders/orders-empty-state";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { OrdersSummaryCards } from "@/components/orders/orders-summary-cards";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrdersTableSkeleton } from "@/components/orders/orders-table-skeleton";
import { OrdersToolbar } from "@/components/orders/orders-toolbar";
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
import {
  useDeleteOrder,
  useOrders,
  useOrderSummary,
  useUpdateOrderStatus,
} from "@/hooks/use-orders";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { BakeryOrder, BakeryOrderFilters, OrderStatus } from "@/types/orders";

const defaultFilters: BakeryOrderFilters = {
  dateFrom: "",
  dateTo: "",
  orderType: "all",
  search: "",
  status: "all",
};

type PendingAction =
  | { order: BakeryOrder; status: OrderStatus; type: "status" }
  | { order: BakeryOrder; type: "delete" }
  | null;

export function OrdersPageClient(): JSX.Element {
  const router = useRouter();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.ordersView, PERMISSIONS.posView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.ordersCreate,
    PERMISSIONS.ordersEdit,
    PERMISSIONS.ordersDelete,
    PERMISSIONS.ordersStatusUpdate,
    PERMISSIONS.ordersPaymentsManage,
    PERMISSIONS.ordersProductionAssign,
    PERMISSIONS.ordersPackagingManage,
    PERMISSIONS.posSell,
  ]);
  const [filters, setFilters] = useState<BakeryOrderFilters>(defaultFilters);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const ordersQuery = useOrders(filters, canView);
  const summaryQuery = useOrderSummary(canView);
  const statusMutation = useUpdateOrderStatus();
  const deleteMutation = useDeleteOrder();
  const isPermissionDenied =
    ordersQuery.error instanceof ApiError && ordersQuery.error.status === 403;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const openCreate = (): void => {
    router.push(`${ROUTES.orders}/new`);
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) {
      return;
    }

    try {
      if (pendingAction.type === "status") {
        await statusMutation.mutateAsync({
          id: pendingAction.order.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Order status updated.");
      } else {
        await deleteMutation.mutateAsync(pendingAction.order.id);
        toast.success("Order deleted.");
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
        title="Bakery Orders"
        description="Manage custom cake orders, scheduling, payments, and production."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Create Order
            </Button>
          ) : undefined
        }
      />

      <OrdersSummaryCards summary={summaryQuery.data} />
      <OrdersToolbar filters={filters} onFiltersChange={setFilters} />

      {ordersQuery.isLoading ? <OrdersTableSkeleton /> : null}

      {!ordersQuery.isLoading && ordersQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to bakery orders." />
        ) : (
          <OrdersErrorState
            description={getErrorMessage(ordersQuery.error)}
            onRetry={() => {
              void ordersQuery.refetch();
            }}
          />
        )
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length === 0 ? (
        <OrdersEmptyState canManage={canManage} onCreate={openCreate} />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <OrdersTable
              canManage={canManage}
              onDelete={(order) => setPendingAction({ order, type: "delete" })}
              onStatusChange={(order, status) =>
                setPendingAction({ order, status, type: "status" })
              }
              orders={orders}
            />
          </CardContent>
        </Card>
      ) : null}

      <Dialog
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
        open={pendingAction !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete" ? "Delete order" : "Update order status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This removes the order from active order workflows."
                : `Move ${pendingAction?.order.orderNumber ?? "order"} to ${pendingAction?.status ?? "next status"}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={statusMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                void confirmAction();
              }}
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
