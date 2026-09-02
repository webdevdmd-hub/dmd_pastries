"use client";

import { LayoutGrid, List, Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/orders/access-denied-card";
import { OrderDetailsDrawer } from "@/components/orders/order-details-drawer";
import { OrderFormPage } from "@/components/orders/order-form-page";
import { OrdersCardGrid } from "@/components/orders/orders-card-grid";
import { OrdersEmptyState } from "@/components/orders/orders-empty-state";
import { OrdersErrorState } from "@/components/orders/orders-error-state";
import { OrdersSummaryCards } from "@/components/orders/orders-summary-cards";
import { OrdersTable } from "@/components/orders/orders-table";
import { OrdersTableSkeleton } from "@/components/orders/orders-table-skeleton";
import { OrdersToolbar } from "@/components/orders/orders-toolbar";
import { FilteredState } from "@/components/shared/collection-state";
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

type OrdersViewMode = "card" | "list";

type PendingAction =
  | { order: BakeryOrder; status: OrderStatus; type: "status" }
  | { order: BakeryOrder; type: "delete" }
  | null;

const ordersViewModeStorageKey = "bakery-orders.view-mode";

function isOrdersViewMode(value: string | null): value is OrdersViewMode {
  return value === "card" || value === "list";
}

export function OrdersPageClient(): JSX.Element {
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
  const [createOpen, setCreateOpen] = useState(false);
  // The id, not the order: the drawer fetches the detail record itself, so it
  // shows payments and items the list rows do not carry.
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Edit opens in the same full-height modal as Create, over the list. Closing
  // it lands back here rather than on the order's details page.
  const [editOrderId, setEditOrderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<OrdersViewMode>("list");
  const ordersQuery = useOrders(filters, canView);
  const summaryQuery = useOrderSummary(canView);
  const statusMutation = useUpdateOrderStatus();
  const deleteMutation = useDeleteOrder();
  const isPermissionDenied =
    ordersQuery.error instanceof ApiError && ordersQuery.error.status === 403;
  // Every field on BakeryOrderFilters is user-chosen: there is no branch scope
  // and no paging here, so all five count. View mode is a display toggle, not a
  // filter, and never narrows the result set.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== defaultFilters.status ||
    filters.orderType !== defaultFilters.orderType ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;

  useEffect(() => {
    const savedViewMode = window.localStorage.getItem(ordersViewModeStorageKey);

    if (isOrdersViewMode(savedViewMode)) {
      setViewMode(savedViewMode);
    }
  }, []);

  const updateViewMode = (nextViewMode: OrdersViewMode): void => {
    setViewMode(nextViewMode);
    window.localStorage.setItem(ordersViewModeStorageKey, nextViewMode);
  };

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const openCreate = (): void => {
    setCreateOpen(true);
  };

  const openDetails = (order: BakeryOrder): void => {
    setDetailsOrderId(order.id);
    setDetailsOpen(true);
  };

  const openEdit = (order: BakeryOrder): void => {
    // The drawer may be open underneath; a form on top of a sheet on top of
    // the list is one layer too many, so the drawer closes first.
    setDetailsOpen(false);
    setEditOrderId(order.id);
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
          <div className="flex flex-wrap items-center gap-2">
            {/* Below md the list view renders as cards anyway, so the toggle
                would switch between two identical layouts. */}
            <div
              aria-label="Order view"
              className="hidden rounded-xl border border-workspace-border bg-workspace-panel p-1 md:inline-flex"
              role="group"
            >
              <Button
                aria-label="Card view"
                aria-pressed={viewMode === "card"}
                className={
                  viewMode === "card"
                    ? "h-9 rounded-lg px-3"
                    : "h-9 rounded-lg px-3 text-workspace-muted"
                }
                onClick={() => updateViewMode("card")}
                type="button"
                variant={viewMode === "card" ? "default" : "ghost"}
              >
                <LayoutGrid className="h-4 w-4" />
                <span className="hidden sm:inline">Card</span>
              </Button>
              <Button
                aria-label="List view"
                aria-pressed={viewMode === "list"}
                className={
                  viewMode === "list"
                    ? "h-9 rounded-lg px-3"
                    : "h-9 rounded-lg px-3 text-workspace-muted"
                }
                onClick={() => updateViewMode("list")}
                type="button"
                variant={viewMode === "list" ? "default" : "ghost"}
              >
                <List className="h-4 w-4" />
                <span className="hidden sm:inline">List</span>
              </Button>
            </div>
            {canManage ? (
              <Button onClick={openCreate} type="button">
                <Plus className="h-4 w-4" />
                Create Order
              </Button>
            ) : null}
          </div>
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

      {/* An order book narrowed to one date with nothing in it is not an empty
          order book. Offering "Create Order" there hides the fact that hundreds
          of orders exist just outside the filter. DESIGN.md 8. */}
      {!ordersQuery.isLoading && !ordersQuery.error && orders.length === 0 && hasActiveFilters ? (
        <FilteredState
          noun="orders"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length === 0 && !hasActiveFilters ? (
        <OrdersEmptyState canManage={canManage} onCreate={openCreate} />
      ) : null}

      {/* A ten-column ledger has no honest phone layout: it either scrolls
          sideways or wraps every cell. Below md the list view shows the cards,
          which carry the same fields, and the table takes over from md up. */}
      {!ordersQuery.isLoading && !ordersQuery.error && orders.length > 0 && viewMode === "list" ? (
        <>
          <div className="md:hidden">
            <OrdersCardGrid
              canManage={canManage}
              onDelete={(order) => setPendingAction({ order, type: "delete" })}
              onEdit={openEdit}
              onStatusChange={(order, status) =>
                setPendingAction({ order, status, type: "status" })
              }
              onView={openDetails}
              orders={orders}
            />
          </div>
          <Card className="hidden md:block">
            <CardContent className="p-0">
              <OrdersTable
                canManage={canManage}
                onDelete={(order) => setPendingAction({ order, type: "delete" })}
                onEdit={openEdit}
                onStatusChange={(order, status) =>
                  setPendingAction({ order, status, type: "status" })
                }
                onView={openDetails}
                orders={orders}
              />
            </CardContent>
          </Card>
        </>
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length > 0 && viewMode === "card" ? (
        <OrdersCardGrid
          canManage={canManage}
          onDelete={(order) => setPendingAction({ order, type: "delete" })}
          onEdit={openEdit}
          onStatusChange={(order, status) => setPendingAction({ order, status, type: "status" })}
          onView={openDetails}
          orders={orders}
        />
      ) : null}

      <OrderDetailsDrawer
        onEdit={openEdit}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
        orderId={detailsOrderId}
      />

      <Dialog
        onOpenChange={(open) => (open ? undefined : setEditOrderId(null))}
        open={editOrderId !== null}
      >
        <DialogContent
          className="top-3 flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-7xl translate-y-0 gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:top-6 sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)]"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Edit bakery order</DialogTitle>
            <DialogDescription>
              Edit the customer, schedule, items, charges, packaging, and production of this order.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            {editOrderId ? (
              <OrderFormPage
                key={editOrderId}
                onClose={() => setEditOrderId(null)}
                orderId={editOrderId}
                presentation="modal"
              />
            ) : null}
          </div>
        </DialogContent>
      </Dialog>

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

      <Dialog onOpenChange={setCreateOpen} open={createOpen}>
        <DialogContent
          className="top-3 flex h-[calc(100dvh-1.5rem)] max-h-[calc(100dvh-1.5rem)] w-[calc(100vw-1.5rem)] max-w-7xl translate-y-0 gap-0 overflow-hidden border-0 bg-transparent p-0 shadow-none sm:top-6 sm:h-[calc(100dvh-3rem)] sm:max-h-[calc(100dvh-3rem)] sm:w-[calc(100vw-3rem)]"
          showCloseButton={false}
        >
          <DialogHeader className="sr-only">
            <DialogTitle>Create bakery order</DialogTitle>
            <DialogDescription>
              Create a bakery order with customer details, scheduling, items, charges, and
              packaging.
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1">
            <OrderFormPage
              onClose={() => setCreateOpen(false)}
              orderId={null}
              presentation="modal"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
