"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReceiptDetailsDrawer } from "@/components/purchasing/purchase-receipt-details-drawer";
import { PurchaseReceiptsCardGrid } from "@/components/purchasing/purchase-receipts-card-grid";
import { PurchaseReceiptsTable } from "@/components/purchasing/purchase-receipts-table";
import { PurchaseReceiveDialog } from "@/components/purchasing/purchase-receive-dialog";
import { PurchaseReturnDialog } from "@/components/purchasing/purchase-return-dialog";
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
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useStockLocations } from "@/hooks/use-inventory";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelPurchaseReceipt,
  usePostPurchaseReceipt,
  usePurchaseReceipts,
  usePurchasingBranches,
  usePurchasingProducts,
  usePurchasingSuppliers,
  usePurchasingTaxRates,
  usePurchasingUnits,
  useReceivePurchase,
} from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  PurchaseReceipt,
  PurchasingFilters,
  ReceivePurchasePayload,
} from "@/types/purchasing";

const defaultFilters: PurchasingFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  status: "all",
  supplierId: "all",
};

const receiptStatuses = [
  { label: "Draft", value: "draft" },
  { label: "Posted", value: "posted" },
  { label: "Cancelled", value: "cancelled" },
];

type PendingAction = { receipt: PurchaseReceipt; type: "post" | "cancel" } | null;

export function PurchaseReceiptsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.purchasingReceiptsCreate,
    PERMISSIONS.purchasingReceiptsPost,
    PERMISSIONS.purchasingReceiptsCancel,
    PERMISSIONS.purchasingReceiveStock,
  ]);
  const canReturn = hasAnyPermission([
    PERMISSIONS.purchasingReturnsCreate,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const [filters, setFilters] = useState<PurchasingFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [returnReceipt, setReturnReceipt] = useState<PurchaseReceipt | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  // The id, not the record: the list rows carry a summary and the drawer
  // fetches the full receipt itself.
  const [detailsReceiptId, setDetailsReceiptId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const receiptsQuery = usePurchaseReceipts(filters, canView && branchScope.hasBranchScope, page);
  const receiptsTotalPages = receiptsQuery.data?.pagination.totalPages ?? 1;
  // Narrowing the filters, or deleting the last row on the final page,
  // both leave the page pointing past the end. The empty response that
  // comes back reads as "nothing found", which is a lie about the data
  // rather than about the page, so snap back into range.
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(1);
  }, [filterKey]);
  useEffect(() => {
    if (page > receiptsTotalPages) {
      setPage(receiptsTotalPages);
    }
  }, [page, receiptsTotalPages]);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const productsQuery = usePurchasingProducts(canView);
  const unitsQuery = usePurchasingUnits(canView);
  const taxRatesQuery = usePurchasingTaxRates(canView);
  const stockLocationsQuery = useStockLocations(canView && canReturn);
  const receiveMutation = useReceivePurchase();
  const postMutation = usePostPurchaseReceipt();
  const cancelMutation = useCancelPurchaseReceipt();
  const isPermissionDenied =
    receiptsQuery.error instanceof ApiError && receiptsQuery.error.status === 403;
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

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleReceive = async (payload: ReceivePurchasePayload): Promise<void> => {
    try {
      await receiveMutation.mutateAsync(payload);
      toast.success(
        "Stock received into operational inventory. Accounting inventory updates when the supplier bill is posted.",
      );
      setReceiveOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openDetails = (receipt: PurchaseReceipt): void => {
    setDetailsReceiptId(receipt.id);
    setDetailsOpen(true);
  };

  // A dialog on top of a sheet on top of the list is one layer too many, so
  // the drawer closes before any of these open. Confirming or cancelling
  // then lands back on the list.
  const askAction = (action: NonNullable<PendingAction>): void => {
    setDetailsOpen(false);
    setPendingAction(action);
  };

  const openReturn = (receipt: PurchaseReceipt): void => {
    setDetailsOpen(false);
    setReturnReceipt(receipt);
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "post") {
        await postMutation.mutateAsync(pendingAction.receipt.id);
        toast.success("Purchase receipt posted.");
      } else {
        await cancelMutation.mutateAsync(pendingAction.receipt.id);
        toast.success("Purchase receipt cancelled.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const receipts = receiptsQuery.data?.items ?? [];
  const listHandlers = {
    canManage,
    canReturn,
    onCancel: (receipt: PurchaseReceipt) => askAction({ receipt, type: "cancel" }),
    onPost: (receipt: PurchaseReceipt) => askAction({ receipt, type: "post" }),
    onReturn: openReturn,
    onView: openDetails,
    receipts,
  };
  const pagination = receiptsQuery.data?.pagination ? (
    <PaginationBar
      isFetching={receiptsQuery.isFetching}
      limit={receiptsQuery.data.pagination.limit}
      noun={{ one: "goods receipt", other: "goods receipts" }}
      onPageChange={setPage}
      page={receiptsQuery.data.pagination.page}
      total={receiptsQuery.data.pagination.total}
      totalPages={receiptsQuery.data.pagination.totalPages}
    />
  ) : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Receive Goods"
        description="Receive supplier goods and trace inventory stock-in movements."
        actions={
          canManage ? (
            <Button onClick={() => setReceiveOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Receive Goods
            </Button>
          ) : undefined
        }
      />

      <PurchasingToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        noun="receive goods records"
        onFiltersChange={setFilters}
        resetBranchId={branchScope.defaultBranchId}
        statuses={receiptStatuses}
        suppliers={suppliersQuery.data ?? []}
      />

      {receiptsQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!receiptsQuery.isLoading && receiptsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to receive goods records." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(receiptsQuery.error)}
            onRetry={() => {
              void receiptsQuery.refetch();
            }}
          />
        )
      ) : null}

      {/* Filtered and empty need opposite remedies. Offering "Receive Goods" to
          a storekeeper whose supplier filter matched nothing says no delivery was
          ever booked in, and invites a duplicate stock-in. DESIGN.md 8. */}
      {!receiptsQuery.isLoading &&
      !receiptsQuery.error &&
      receipts.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="receive goods records"
          onClearFilters={() =>
            setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })
          }
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!receiptsQuery.isLoading &&
      !receiptsQuery.error &&
      receipts.length === 0 &&
      !hasActiveFilters ? (
        <PurchaseEmptyState
          actionLabel={canManage ? "Receive Goods" : undefined}
          onAction={canManage ? () => setReceiveOpen(true) : undefined}
          title="No receive goods records found."
        />
      ) : null}

      {/* An eight-column ledger has no honest phone layout. Below md the list
          is cards carrying the same fields; the table takes over from md up. */}
      {!receiptsQuery.isLoading && !receiptsQuery.error && receipts.length > 0 ? (
        <>
          <div className="grid gap-4 md:hidden">
            <PurchaseReceiptsCardGrid {...listHandlers} />
            {pagination ? <Card className="overflow-hidden">{pagination}</Card> : null}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <PurchaseReceiptsTable {...listHandlers} />
              {pagination}
            </CardContent>
          </Card>
        </>
      ) : null}

      <PurchaseReceiptDetailsDrawer
        canPost={canManage}
        canReturn={canReturn}
        canView={canView}
        onOpenChange={setDetailsOpen}
        onPost={(receipt) => askAction({ receipt, type: "post" })}
        onReturn={openReturn}
        open={detailsOpen}
        receiptId={detailsReceiptId}
      />

      <PurchaseReceiveDialog
        branches={branchesQuery.data ?? []}
        isSubmitting={receiveMutation.isPending}
        onClose={() => setReceiveOpen(false)}
        onReceive={handleReceive}
        open={receiveOpen}
        products={productsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
        taxRates={taxRatesQuery.data ?? []}
        units={unitsQuery.data ?? []}
      />

      <PurchaseReturnDialog
        onClose={() => setReturnReceipt(null)}
        open={returnReceipt !== null}
        receipt={returnReceipt}
        stockLocations={stockLocationsQuery.data ?? []}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "post" ? "Post receive goods" : "Cancel receive goods"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "post"
                ? "Posting confirms received goods and updates inventory. No accounting journal is posted from receive goods."
                : "Cancelling posted receive goods may create reversal stock movements."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={postMutation.isPending || cancelMutation.isPending}
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
