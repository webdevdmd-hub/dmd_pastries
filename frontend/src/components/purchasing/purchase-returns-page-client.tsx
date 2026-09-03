"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReturnDetailsDrawer } from "@/components/purchasing/purchase-return-details-drawer";
import { PurchaseReturnFromReceiptDialog } from "@/components/purchasing/purchase-return-from-receipt-dialog";
import { PurchaseReturnsCardGrid } from "@/components/purchasing/purchase-returns-card-grid";
import { PurchaseReturnsTable } from "@/components/purchasing/purchase-returns-table";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { PurchasingToolbar } from "@/components/purchasing/purchasing-toolbar";
import { FilteredState } from "@/components/shared/collection-state";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { ReturnReversalDialog } from "@/components/shared/return-reversal-dialog";
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
  useCancelPurchaseReturn,
  usePostPurchaseReturn,
  usePurchaseReturns,
  usePurchasingBranches,
  usePurchasingSuppliers,
  useReversePurchaseReturn,
} from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { PurchaseReturn, PurchasingFilters } from "@/types/purchasing";

const defaultFilters: PurchasingFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  search: "",
  status: "all",
  supplierId: "all",
};

const returnStatuses = [
  { label: "Draft", value: "draft" },
  { label: "Posted", value: "posted" },
  { label: "Cancelled", value: "cancelled" },
  { label: "Reversed", value: "reversed" },
];

type PendingAction = { purchaseReturn: PurchaseReturn; type: "post" | "cancel" } | null;

export function PurchaseReturnsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.purchasingReturnsView, PERMISSIONS.purchasingView]);
  const canPost = hasAnyPermission([
    PERMISSIONS.purchasingReturnsPost,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const canCreate = hasAnyPermission([
    PERMISSIONS.purchasingReturnsCreate,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const canCancel = hasAnyPermission([
    PERMISSIONS.purchasingReturnsCancel,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const canReverse = hasAnyPermission([
    PERMISSIONS.purchasingReturnsReverse,
    PERMISSIONS.purchasingReturnsManage,
  ]);
  const [filters, setFilters] = useState<PurchasingFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [reversalReturn, setReversalReturn] = useState<PurchaseReturn | null>(null);
  // The id, not the record: the drawer fetches the note itself so its journal
  // and reversal links are current.
  const [detailsReturnId, setDetailsReturnId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const returnsQuery = usePurchaseReturns(filters, canView && branchScope.hasBranchScope, page);
  const purchaseReturnsTotalPages = returnsQuery.data?.pagination.totalPages ?? 1;
  // Narrowing the filters, or deleting the last row on the final page,
  // both leave the page pointing past the end. The empty response that
  // comes back reads as "nothing found", which is a lie about the data
  // rather than about the page, so snap back into range.
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(1);
  }, [filterKey]);
  useEffect(() => {
    if (page > purchaseReturnsTotalPages) {
      setPage(purchaseReturnsTotalPages);
    }
  }, [page, purchaseReturnsTotalPages]);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const stockLocationsQuery = useStockLocations(canView && canCreate);
  const postMutation = usePostPurchaseReturn();
  const cancelMutation = useCancelPurchaseReturn();
  const reverseMutation = useReversePurchaseReturn();
  const isPermissionDenied =
    returnsQuery.error instanceof ApiError && returnsQuery.error.status === 403;
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make a genuinely empty ledger look like a narrow search and the empty
  // state would never appear.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== defaultFilters.status ||
    filters.supplierId !== defaultFilters.supplierId ||
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

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "post") {
        await postMutation.mutateAsync(pendingAction.purchaseReturn.id);
        toast.success("Vendor credit posted.");
      } else {
        await cancelMutation.mutateAsync(pendingAction.purchaseReturn.id);
        toast.success("Draft vendor credit cancelled.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleReverse = async (reason: string): Promise<void> => {
    if (!reversalReturn) return;

    try {
      await reverseMutation.mutateAsync({
        id: reversalReturn.id,
        payload: { reason },
      });
      toast.success("Vendor credit reversed.");
      setReversalReturn(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const openDetails = (purchaseReturn: PurchaseReturn): void => {
    setDetailsReturnId(purchaseReturn.id);
    setDetailsOpen(true);
  };

  // A confirm dialog on top of a sheet on top of the list is one layer too
  // many, so the drawer closes before any of these open. Confirming or
  // cancelling then lands back on the list.
  const askPost = (purchaseReturn: PurchaseReturn): void => {
    setDetailsOpen(false);
    setPendingAction({ purchaseReturn, type: "post" });
  };
  const askCancel = (purchaseReturn: PurchaseReturn): void => {
    setDetailsOpen(false);
    setPendingAction({ purchaseReturn, type: "cancel" });
  };
  const askReverse = (purchaseReturn: PurchaseReturn): void => {
    setDetailsOpen(false);
    setReversalReturn(purchaseReturn);
  };

  const purchaseReturns = returnsQuery.data?.items ?? [];
  const listHandlers = {
    canCancel,
    canPost,
    canReverse,
    onCancel: askCancel,
    onPost: askPost,
    onReverse: askReverse,
    onView: openDetails,
    returns: purchaseReturns,
  };
  const pagination = returnsQuery.data?.pagination ? (
    <PaginationBar
      isFetching={returnsQuery.isFetching}
      limit={returnsQuery.data.pagination.limit}
      noun={{ one: "vendor credit", other: "vendor credits" }}
      onPageChange={setPage}
      page={returnsQuery.data.pagination.page}
      total={returnsQuery.data.pagination.total}
      totalPages={returnsQuery.data.pagination.totalPages}
    />
  ) : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Vendor Credits"
        description="Review returned supplier stock, open vendor credits, and posted credit history. Credits are created from posted receive-goods records so stock and bill links stay correct."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateDialogOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Create vendor credit
            </Button>
          ) : undefined
        }
      />

      <PurchasingToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
        noun="vendor credits"
        onFiltersChange={setFilters}
        resetBranchId={branchScope.defaultBranchId}
        statuses={returnStatuses}
        suppliers={suppliersQuery.data ?? []}
      />

      {returnsQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!returnsQuery.isLoading && returnsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to vendor credits." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(returnsQuery.error)}
            onRetry={() => {
              void returnsQuery.refetch();
            }}
          />
        )
      ) : null}

      {/* Filtered and empty need opposite remedies. Offering "Create vendor
          credit" to someone whose supplier filter simply matched nothing says
          no credits exist when there may be hundreds. DESIGN.md 8. */}
      {!returnsQuery.isLoading &&
      !returnsQuery.error &&
      purchaseReturns.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="vendor credits"
          onClearFilters={() =>
            setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })
          }
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!returnsQuery.isLoading &&
      !returnsQuery.error &&
      purchaseReturns.length === 0 &&
      !hasActiveFilters ? (
        <PurchaseEmptyState
          actionLabel={canCreate ? "Create vendor credit" : undefined}
          title="No vendor credits found."
          description="Create one from a posted receive-goods record with returnable supplier stock."
          onAction={canCreate ? () => setCreateDialogOpen(true) : undefined}
        />
      ) : null}

      {/* A ten-column ledger has no honest phone layout. Below md the list is
          cards carrying the same fields; the table takes over from md up. */}
      {!returnsQuery.isLoading && !returnsQuery.error && purchaseReturns.length > 0 ? (
        <>
          <div className="grid gap-4 md:hidden">
            <PurchaseReturnsCardGrid {...listHandlers} />
            {pagination ? <Card className="overflow-hidden">{pagination}</Card> : null}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <PurchaseReturnsTable {...listHandlers} />
              {pagination}
            </CardContent>
          </Card>
        </>
      ) : null}

      <PurchaseReturnDetailsDrawer
        canCancel={canCancel}
        canPost={canPost}
        canReverse={canReverse}
        canView={canView}
        onCancel={askCancel}
        onOpenChange={setDetailsOpen}
        onPost={askPost}
        onReverse={askReverse}
        open={detailsOpen}
        purchaseReturnId={detailsReturnId}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "post" ? "Post vendor credit" : "Cancel vendor credit"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "post"
                ? `Posting ${pendingAction.purchaseReturn.returnNumber} is final. It creates the purchase return stock movement and posts accounting.`
                : "Only draft vendor credits can be cancelled."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Close
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

      <PurchaseReturnFromReceiptDialog
        branches={branchOptions}
        defaultBranchId={branchScope.defaultBranchId}
        onClose={() => setCreateDialogOpen(false)}
        open={createDialogOpen}
        stockLocations={stockLocationsQuery.data ?? []}
        suppliers={suppliersQuery.data ?? []}
      />

      <ReturnReversalDialog
        description="Reversing a posted vendor credit creates a linked correction while preserving payable, stock, and accounting audit history."
        isSubmitting={reverseMutation.isPending}
        noteNumber={reversalReturn?.returnNumber ?? null}
        onConfirm={(reason) => void handleReverse(reason)}
        onOpenChange={(open) => {
          if (!open) setReversalReturn(null);
        }}
        open={reversalReturn !== null}
        title="Reverse vendor credit"
      />
    </div>
  );
}
