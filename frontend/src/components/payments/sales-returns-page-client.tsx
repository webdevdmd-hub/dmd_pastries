"use client";

import { RotateCcw } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/payments/access-denied-card";
import { PaymentsErrorState } from "@/components/payments/payments-error-state";
import { PaymentsTableSkeleton } from "@/components/payments/payments-table-skeleton";
import { SalesReturnsCardGrid } from "@/components/payments/sales-returns-card-grid";
import { SalesReturnsTable } from "@/components/payments/sales-returns-table";
import { EmptyState, FilteredState } from "@/components/shared/collection-state";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { ReturnReversalDialog } from "@/components/shared/return-reversal-dialog";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import {
  useCancelSalesReturn,
  usePostSalesReturn,
  useReverseSalesReturn,
  useSalesReturns,
} from "@/hooks/use-sales-returns";
import { getErrorMessage } from "@/lib/api/client";
import { toastMoneyFailure } from "@/lib/money-failure-toast";
import type { SalesReturn, SalesReturnFilters, SalesReturnStatus } from "@/types/sales-return";

const defaultFilters: SalesReturnFilters = {
  search: "",
  status: "all",
};

export function SalesReturnsPageClient(): JSX.Element {
  const branchScope = useBranchScope();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.paymentsView, PERMISSIONS.posView]);
  const canManage = hasAnyPermission([PERMISSIONS.paymentsRefund, PERMISSIONS.posRefund]);
  const canReverse = hasAnyPermission([
    PERMISSIONS.salesReturnsReverse,
    PERMISSIONS.salesReturnsManage,
    PERMISSIONS.paymentsRefund,
    PERMISSIONS.posRefund,
  ]);
  const [filters, setFilters] = useState<SalesReturnFilters>(defaultFilters);
  const [reversalReturn, setReversalReturn] = useState<SalesReturn | null>(null);
  const returnsQuery = useSalesReturns(filters, canView && branchScope.hasBranchScope);
  // "Nothing to show" has two causes with opposite remedies (DESIGN.md §8).
  const hasActiveFilters =
    filters.search.trim().length > 0 || filters.status !== defaultFilters.status;
  const postMutation = usePostSalesReturn();
  const cancelMutation = useCancelSalesReturn();
  const reverseMutation = useReverseSalesReturn();

  if (!canView) {
    return (
      <AccessDeniedCard message="You need `payments.view` or `pos.view` to view credit notes." />
    );
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handlePost = async (salesReturn: SalesReturn): Promise<void> => {
    try {
      await postMutation.mutateAsync(salesReturn.id);
      toast.success("Credit note posted.");
    } catch (error) {
      toastMoneyFailure("The credit note was not posted", error);
    }
  };

  const handleCancel = async (salesReturn: SalesReturn): Promise<void> => {
    try {
      await cancelMutation.mutateAsync(salesReturn.id);
      toast.success("Draft credit note cancelled.");
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
      toast.success("Credit note reversed.");
      setReversalReturn(null);
    } catch (error) {
      toastMoneyFailure("The credit note was not reversed", error);
    }
  };

  const returns = returnsQuery.data ?? [];
  const listHandlers = {
    canManage,
    canReverse,
    isCancelling: cancelMutation.isPending,
    isPosting: postMutation.isPending,
    isReversing: reverseMutation.isPending,
    onCancel: (salesReturn: SalesReturn) => void handleCancel(salesReturn),
    onPost: (salesReturn: SalesReturn) => void handlePost(salesReturn),
    onReverse: setReversalReturn,
    returns,
  };
  const hiddenFilterCount = filters.status !== defaultFilters.status ? 1 : 0;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Returns / Credit Notes"
        description="Review POS item-level returns, refund handling, and posted credit notes."
      />

      <FilterToolbar
        hasAnyFilter={hasActiveFilters}
        hiddenFilterCount={hiddenFilterCount}
        hideDensityBelowMd
        onReset={() => setFilters(defaultFilters)}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
        popoverTitle="Filter credit notes"
        searchAriaLabel="Search returns by return, sale, or customer"
        searchPlaceholder="Search return, sale, customer..."
        searchValue={filters.search}
      >
        <FilterField htmlFor="returnsFilterStatus" label="Status">
          <Select
            onValueChange={(value) =>
              setFilters((current) => ({ ...current, status: value as SalesReturnStatus | "all" }))
            }
            value={filters.status}
          >
            <SelectTrigger id="returnsFilterStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="posted">Posted</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="reversed">Reversed</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterToolbar>

      {returnsQuery.isLoading ? <PaymentsTableSkeleton /> : null}

      {!returnsQuery.isLoading && returnsQuery.error ? (
        <PaymentsErrorState
          description={getErrorMessage(returnsQuery.error)}
          onRetry={() => void returnsQuery.refetch()}
          title="credit notes"
        />
      ) : null}

      {/* Filtered and empty are different situations with opposite remedies. */}
      {!returnsQuery.isLoading &&
      !returnsQuery.error &&
      returns.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="credit notes"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!returnsQuery.isLoading &&
      !returnsQuery.error &&
      returns.length === 0 &&
      !hasActiveFilters ? (
        <EmptyState
          description="Create item returns from POS sale details inside Payments."
          icon={RotateCcw}
          title="No credit notes yet"
        />
      ) : null}

      {/* Cards below md, the table from md up. */}
      {!returnsQuery.isLoading && !returnsQuery.error && returns.length > 0 ? (
        <>
          <div className="md:hidden">
            <SalesReturnsCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <SalesReturnsTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <ReturnReversalDialog
        description="Reversing a posted credit note creates a controlled correction while keeping the original audit trail."
        isSubmitting={reverseMutation.isPending}
        noteNumber={reversalReturn?.returnNumber ?? null}
        onConfirm={(reason) => void handleReverse(reason)}
        onOpenChange={(open) => {
          if (!open) setReversalReturn(null);
        }}
        open={reversalReturn !== null}
        title="Reverse credit note"
      />
    </div>
  );
}
