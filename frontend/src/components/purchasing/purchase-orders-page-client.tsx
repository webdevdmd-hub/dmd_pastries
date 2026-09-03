"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseInvoiceFormDialog } from "@/components/purchasing/purchase-invoice-form-dialog";
import { PurchaseOrderDetailsDrawer } from "@/components/purchasing/purchase-order-details-drawer";
import { PurchaseOrderFormDialog } from "@/components/purchasing/purchase-order-form-dialog";
import { PurchaseOrderReceiveGoodsDialog } from "@/components/purchasing/purchase-order-receive-goods-dialog";
import { PurchaseOrdersCardGrid } from "@/components/purchasing/purchase-orders-card-grid";
import { PurchaseOrdersTable } from "@/components/purchasing/purchase-orders-table";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingToolbar } from "@/components/purchasing/purchasing-toolbar";
import { FilteredState } from "@/components/shared/collection-state";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
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
import { useAllChartAccounts } from "@/hooks/use-accounting";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreatePurchaseInvoice,
  useCreatePurchaseOrder,
  useCreatePurchaseOrderRevision,
  useDeletePurchaseOrder,
  useDuplicatePurchaseOrder,
  usePurchaseOrder,
  usePurchaseOrderDocumentChain,
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
import { purchaseOrderToBillInitialValues } from "@/lib/purchasing/purchase-order-bill-draft";
import type {
  CreatePurchaseInvoicePayload,
  CreatePurchaseOrderPayload,
  CreatePurchaseOrderRevisionPayload,
  PurchaseOrder,
  PurchaseOrderStatus,
  PurchasingFilters,
  ReceivePurchaseOrderPayload,
  UpdatePurchaseInvoicePayload,
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
  const [convertingOrderId, setConvertingOrderId] = useState<string | null>(null);
  const [receivingOrderId, setReceivingOrderId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  // The id, not the record: the list rows carry a summary and the drawer
  // fetches the full order itself.
  const [detailsOrderId, setDetailsOrderId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  // Typing in search used to fire one request per keystroke: the raw filters
  // object fed the query key directly. Debounce only the search half; the
  // dropdowns and dates still apply instantly.
  const debouncedSearch = useDebouncedValue(filters.search);
  const [page, setPage] = useState(1);
  const activeFilters = { ...filters, search: debouncedSearch };
  const ordersQuery = usePurchaseOrders(activeFilters, canView && branchScope.hasBranchScope, page);
  const totalPages = ordersQuery.data?.pagination.totalPages ?? 1;
  // Two ways to end up pointing past the end: narrowing the filters, and
  // deleting the last order on the final page. Both land on an empty response
  // that reads as "no purchase orders found", which is a lie about the data
  // rather than about the page, so snap back into range.
  const filterKey = JSON.stringify(activeFilters);
  useEffect(() => {
    setPage(1);
  }, [filterKey]);
  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);
  const editingOrderQuery = usePurchaseOrder(
    editingOrderId,
    canView && branchScope.hasBranchScope && editingOrderId !== null,
  );
  const receivingOrderQuery = usePurchaseOrder(
    receivingOrderId,
    canView && branchScope.hasBranchScope && receivingOrderId !== null,
  );
  const convertingOrderQuery = usePurchaseOrder(
    convertingOrderId,
    canView && branchScope.hasBranchScope && convertingOrderId !== null,
  );
  const convertingOrderChainQuery = usePurchaseOrderDocumentChain(
    convertingOrderId,
    canView && branchScope.hasBranchScope && convertingOrderId !== null,
  );
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
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
  const createOrderMutation = useCreatePurchaseOrder();
  const createRevisionMutation = useCreatePurchaseOrderRevision();
  const createInvoiceMutation = useCreatePurchaseInvoice();
  const updateMutation = useUpdatePurchaseOrder();
  const statusMutation = useUpdatePurchaseOrderStatus();
  const deleteMutation = useDeletePurchaseOrder();
  const reopenMutation = useReopenPurchaseOrder();
  const duplicateMutation = useDuplicatePurchaseOrder();
  const receiveMutation = useReceivePurchaseOrder();
  const isPermissionDenied =
    ordersQuery.error instanceof ApiError && ordersQuery.error.status === 403;
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make every genuinely empty ledger look like a narrow search.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.supplierId !== defaultFilters.supplierId ||
    filters.status !== defaultFilters.status ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;

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

  useEffect(() => {
    if (!convertingOrderQuery.error) return;

    toast.error(getErrorMessage(convertingOrderQuery.error));
    setConvertingOrderId(null);
  }, [convertingOrderQuery.error]);

  useEffect(() => {
    if (!convertingOrderChainQuery.error) return;

    toast.error(getErrorMessage(convertingOrderChainQuery.error));
    setConvertingOrderId(null);
  }, [convertingOrderChainQuery.error]);

  useEffect(() => {
    const activeBill = convertingOrderChainQuery.data?.purchaseInvoices.find(
      (invoice) => invoice.status !== "cancelled",
    );
    if (!activeBill) return;

    toast.error("This purchase order already has a bill.");
    setConvertingOrderId(null);
  }, [convertingOrderChainQuery.data]);

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

  const openDetails = (order: PurchaseOrder): void => {
    setDetailsOrderId(order.id);
    setDetailsOpen(true);
  };

  // A dialog on top of a sheet on top of the list is one layer too many, so
  // the drawer closes before any of these open. Closing the dialog then
  // lands back on the list.
  const openEdit = (order: PurchaseOrder): void => {
    setDetailsOpen(false);
    setEditingOrder(order);
    setEditingOrderId(order.id);
    setFormOpen(true);
  };
  const openReceive = (order: PurchaseOrder): void => {
    setDetailsOpen(false);
    setReceivingOrderId(order.id);
  };
  const openConvert = (order: PurchaseOrder): void => {
    setDetailsOpen(false);
    setConvertingOrderId(order.id);
  };
  const askAction = (action: NonNullable<PendingAction>): void => {
    setDetailsOpen(false);
    setPendingAction(action);
  };

  const handleCreate = async (payload: CreatePurchaseOrderPayload): Promise<void> => {
    try {
      await createOrderMutation.mutateAsync(payload);
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

  const handleRevise = async (
    id: string,
    payload: CreatePurchaseOrderRevisionPayload,
  ): Promise<void> => {
    try {
      const revision = await createRevisionMutation.mutateAsync({ id, payload });
      toast.success(`Purchase order revision ${String(revision.revisionNumber)} saved.`);
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

  const handleCreateBillFromOrder = async (
    payload: CreatePurchaseInvoicePayload,
  ): Promise<void> => {
    try {
      const invoice = await createInvoiceMutation.mutateAsync(payload);
      toast.success("Draft bill created from purchase order.");
      setConvertingOrderId(null);
      router.push(`${ROUTES.purchasingInvoices}/${invoice.id}`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const noopUpdateBill = (_id: string, _payload: UpdatePurchaseInvoicePayload): Promise<void> =>
    Promise.reject(new Error("This dialog only creates bills from purchase orders."));

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
      toast.error(getErrorMessage(error));
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

  const orders = ordersQuery.data?.items ?? [];
  const pagination = ordersQuery.data?.pagination;
  const convertingOrder = convertingOrderQuery.data ?? null;
  const convertingOrderHasActiveBill = Boolean(
    convertingOrderChainQuery.data?.purchaseInvoices.some(
      (invoice) => invoice.status !== "cancelled",
    ),
  );
  const billInitialValues = convertingOrder
    ? purchaseOrderToBillInitialValues(convertingOrder)
    : null;
  const purchaseAccounts = [...(purchaseAccountsQuery.data ?? [])];

  const listHandlers = {
    canCreate,
    canDelete,
    canEdit,
    canConvertToBill,
    canReceiveOrder,
    canUpdateStatus,
    onConvertToBill: openConvert,
    onDelete: (order: PurchaseOrder) => askAction({ order, type: "delete" }),
    onDuplicate: (order: PurchaseOrder) => void handleDuplicate(order),
    onEdit: openEdit,
    onReopen: (order: PurchaseOrder) => askAction({ order, type: "reopen" }),
    onReceive: openReceive,
    onStatusChange: (order: PurchaseOrder, status: PurchaseOrderStatus) =>
      askAction({ order, status, type: "status" }),
    onView: openDetails,
    orders,
  };
  const paginationBar = pagination ? (
    <PaginationBar
      isFetching={ordersQuery.isFetching}
      limit={pagination.limit}
      noun={{ one: "purchase order", other: "purchase orders" }}
      onPageChange={setPage}
      page={pagination.page}
      total={pagination.total}
      totalPages={pagination.totalPages}
    />
  ) : null;

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
        noun="purchase orders"
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

      {/* Filtered and empty need opposite remedies. Offering "Create Purchase
          Order" to a buyer whose date range simply excluded everything says the
          supplier ledger is bare when it may hold hundreds. DESIGN.md 8. */}
      {!ordersQuery.isLoading && !ordersQuery.error && orders.length === 0 && hasActiveFilters ? (
        <FilteredState
          noun="purchase orders"
          onClearFilters={() =>
            setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })
          }
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!ordersQuery.isLoading && !ordersQuery.error && orders.length === 0 && !hasActiveFilters ? (
        <PurchaseEmptyState
          actionLabel={canCreate ? "Create Purchase Order" : undefined}
          description="Purchase orders record what you have asked a supplier for, before the goods or the bill arrive."
          onAction={canCreate ? openCreate : undefined}
          title="No purchase orders yet"
        />
      ) : null}

      {/* An eight-column ledger has no honest phone layout. Below md the list
          is cards carrying the same fields; the table takes over from md up. */}
      {!ordersQuery.isLoading && !ordersQuery.error && orders.length > 0 ? (
        <>
          <div className="grid gap-4 md:hidden">
            <PurchaseOrdersCardGrid {...listHandlers} />
            {paginationBar ? <Card className="overflow-hidden">{paginationBar}</Card> : null}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <PurchaseOrdersTable {...listHandlers} />
              {paginationBar}
            </CardContent>
          </Card>
        </>
      ) : null}

      <PurchaseOrderDetailsDrawer
        canEditOrder={(order) =>
          canEdit &&
          (order.status === "draft" ||
            order.status === "ordered" ||
            order.status === "partially_received" ||
            order.status === "received")
        }
        canView={canView}
        onEdit={openEdit}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
        orderId={detailsOrderId}
      />

      <PurchaseOrderFormDialog
        accounts={purchaseAccounts}
        branches={branchesQuery.data ?? []}
        isSubmitting={
          createOrderMutation.isPending ||
          updateMutation.isPending ||
          createRevisionMutation.isPending
        }
        onClose={() => {
          setEditingOrder(null);
          setEditingOrderId(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onRevise={handleRevise}
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

      <PurchaseInvoiceFormDialog
        accounts={purchaseAccounts}
        branches={branchesQuery.data ?? []}
        createButtonLabel="Create draft bill"
        createDescription={
          convertingOrder
            ? `Review and edit the bill copied from ${convertingOrder.purchaseOrderNumber}.`
            : "Loading purchase order details before creating the bill."
        }
        createTitle="Create Bill from PO"
        initialValues={billInitialValues}
        invoice={null}
        isSubmitting={
          createInvoiceMutation.isPending ||
          convertingOrderQuery.isLoading ||
          convertingOrderChainQuery.isLoading
        }
        onClose={() => setConvertingOrderId(null)}
        onCreate={handleCreateBillFromOrder}
        onUpdate={noopUpdateBill}
        open={convertingOrderId !== null && !convertingOrderHasActiveBill}
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
                : pendingAction?.type === "reopen"
                  ? "Reopen purchase order"
                  : pendingAction?.status === "ordered"
                    ? `Issue ${pendingAction.order.purchaseOrderNumber} to ${pendingAction.order.supplierName}?`
                    : pendingAction?.status === "cancelled"
                      ? `Cancel ${pendingAction.order.purchaseOrderNumber}?`
                      : "Change purchase order status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This will permanently delete the purchase order plus linked draft bills, draft receive-goods records, and draft vendor credits. Posted bills, posted GRNs, stock movements, journals, supplier payments, or posted vendor credits will block deletion."
                : pendingAction?.type === "reopen"
                  ? "Reopen this cancelled purchase order as a draft only if it has no linked receipt, bill, payment, return, or stock history."
                  : pendingAction?.status === "ordered"
                    ? "The order moves from Draft to Ordered and becomes receivable."
                    : pendingAction?.status === "cancelled"
                      ? "The order moves to Cancelled and can no longer be received. It can be reopened as a draft later if nothing else links to it."
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
                  ? "bg-danger text-primary-foreground hover:bg-danger"
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
                  : pendingAction?.status === "ordered"
                    ? "Issue order"
                    : pendingAction?.status === "cancelled"
                      ? "Cancel order"
                      : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
