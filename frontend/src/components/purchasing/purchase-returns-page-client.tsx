"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseReturnFromReceiptDialog } from "@/components/purchasing/purchase-return-from-receipt-dialog";
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

  const purchaseReturns = returnsQuery.data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Vendor Credits"
        description="Review returned supplier stock, open vendor credits, and posted credit history."
        actions={
          canCreate ? (
            <Button onClick={() => setCreateDialogOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Create vendor credit
            </Button>
          ) : undefined
        }
      />

      <Card>
        <CardContent className="p-4 text-sm text-brand-mocha">
          Vendor credits are created from posted receive-goods records so stock and bill links stay
          correct.
        </CardContent>
      </Card>

      <PurchasingToolbar
        allowAllBranches={branchScope.canAccessAllBranches}
        branches={branchOptions}
        filters={filters}
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

      {!returnsQuery.isLoading && !returnsQuery.error && purchaseReturns.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PurchaseReturnsTable
              canCancel={canCancel}
              canPost={canPost}
              canReverse={canReverse}
              onCancel={(purchaseReturn) => setPendingAction({ purchaseReturn, type: "cancel" })}
              onPost={(purchaseReturn) => setPendingAction({ purchaseReturn, type: "post" })}
              onReverse={setReversalReturn}
              returns={purchaseReturns}
            />
            {returnsQuery.data?.pagination ? (
              <PaginationBar
                isFetching={returnsQuery.isFetching}
                limit={returnsQuery.data.pagination.limit}
                noun={{ one: "vendor credit", other: "vendor credits" }}
                onPageChange={setPage}
                page={returnsQuery.data.pagination.page}
                total={returnsQuery.data.pagination.total}
                totalPages={returnsQuery.data.pagination.totalPages}
              />
            ) : null}
          </CardContent>
        </Card>
      ) : null}

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
                ? "Posting finalizes the vendor credit, creates purchase return stock movement, and posts accounting."
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
