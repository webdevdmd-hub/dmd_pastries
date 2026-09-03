"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/payments/access-denied-card";
import { PaymentsEmptyState } from "@/components/payments/payments-empty-state";
import { PaymentsErrorState } from "@/components/payments/payments-error-state";
import { PaymentsTableSkeleton } from "@/components/payments/payments-table-skeleton";
import { ReconciliationCardGrid } from "@/components/payments/reconciliation-card-grid";
import { ReconciliationFormDialog } from "@/components/payments/reconciliation-form-dialog";
import { ReconciliationTable } from "@/components/payments/reconciliation-table";
import { FilteredState } from "@/components/shared/collection-state";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useBranches } from "@/hooks/use-branches";
import {
  useCreateReconciliation,
  usePaymentMethods,
  useReconciliations,
} from "@/hooks/use-payments";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { toastMoneyFailure } from "@/lib/money-failure-toast";
import type { CreateReconciliationPayload, ReconciliationFilters } from "@/types/payment";

const defaultFilters: ReconciliationFilters = {
  branchId: "",
  paymentMethodId: "all",
  dateFrom: "",
  dateTo: "",
};

export function ReconciliationPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const [filters, setFilters] = useState<ReconciliationFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [lastCreated, setLastCreated] = useState<CreateReconciliationPayload | null>(null);
  const canView = hasAnyPermission([PERMISSIONS.reportsView, PERMISSIONS.paymentsReconcile]);
  const canManage = hasAnyPermission([PERMISSIONS.paymentsReconcile]);
  const reconciliationsQuery = useReconciliations(filters, canView && branchScope.hasBranchScope);
  const methodsQuery = usePaymentMethods(canView);
  const branchesQuery = useBranches(canView);
  const createMutation = useCreateReconciliation();
  const isPermissionDenied =
    reconciliationsQuery.error instanceof ApiError && reconciliationsQuery.error.status === 403;
  // Branch is scope rather than a filter here too: it defaults to the user's
  // own branch, so counting it would mark every empty ledger as "filtered"
  // and leave the badge permanently at 1.
  const hasActiveFilters =
    filters.paymentMethodId !== defaultFilters.paymentMethodId ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;
  const hiddenFilterCount =
    (filters.paymentMethodId !== defaultFilters.paymentMethodId ? 1 : 0) +
    (filters.dateFrom.length > 0 ? 1 : 0) +
    (filters.dateTo.length > 0 ? 1 : 0);
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
    return (
      <AccessDeniedCard message="You need `reports.view` or `payments.reconcile` to view reconciliation." />
    );
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleCreate = async (payload: CreateReconciliationPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Reconciliation created.");
      setLastCreated(payload);
      setDialogOpen(false);
    } catch (error) {
      toastMoneyFailure("The reconciliation was not saved", error);
    }
  };

  const resetFilters = (): void =>
    setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId });
  const reconciliations = reconciliationsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Payment Reconciliation"
        description="Compare expected payment totals with counted cash/card totals."
        actions={
          canManage ? (
            <Button onClick={() => setDialogOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Create Reconciliation
            </Button>
          ) : undefined
        }
      />

      {/* No search: the endpoint cannot search. Branch sits first in the
          popover because it scopes everything below it. */}
      <FilterToolbar
        hasAnyFilter={hasActiveFilters}
        hiddenFilterCount={hiddenFilterCount}
        hideDensityBelowMd
        onReset={resetFilters}
        popoverTitle="Filter reconciliations"
      >
        <FilterField htmlFor="reconciliationFilterBranch" label="Branch">
          <Select
            onValueChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}
            value={filters.branchId}
          >
            <SelectTrigger id="reconciliationFilterBranch">
              <SelectValue placeholder="Branch" />
            </SelectTrigger>
            <SelectContent>
              {branchScope.canAccessAllBranches ? (
                <SelectItem value="all">All branches</SelectItem>
              ) : null}
              {branchOptions.map((branch) => (
                <SelectItem key={branch.id} value={branch.id}>
                  {branch.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <FilterField htmlFor="reconciliationFilterMethod" label="Payment method">
          <Select
            onValueChange={(value) =>
              setFilters((current) => ({ ...current, paymentMethodId: value }))
            }
            value={filters.paymentMethodId}
          >
            <SelectTrigger id="reconciliationFilterMethod">
              <SelectValue placeholder="Payment method" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All methods</SelectItem>
              {(methodsQuery.data ?? []).map((method) => (
                <SelectItem key={method.id} value={method.id}>
                  {method.methodName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FilterField>
        <div className="grid grid-cols-2 gap-3">
          <FilterField htmlFor="reconciliationFilterDateFrom" label="From">
            <Input
              id="reconciliationFilterDateFrom"
              onChange={(event) =>
                setFilters((current) => ({ ...current, dateFrom: event.target.value }))
              }
              type="date"
              value={filters.dateFrom}
            />
          </FilterField>
          <FilterField htmlFor="reconciliationFilterDateTo" label="To">
            <Input
              id="reconciliationFilterDateTo"
              onChange={(event) =>
                setFilters((current) => ({ ...current, dateTo: event.target.value }))
              }
              type="date"
              value={filters.dateTo}
            />
          </FilterField>
        </div>
      </FilterToolbar>

      {lastCreated ? (
        <p className="rounded-lg bg-muted px-4 py-3 text-cell text-foreground-muted">
          Reconciliation created for {lastCreated.reconciliationDate}. The backend calculated the
          expected amount and difference; the list below shows the saved result.
        </p>
      ) : null}

      {reconciliationsQuery.isLoading ? <PaymentsTableSkeleton /> : null}

      {!reconciliationsQuery.isLoading && reconciliationsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to reconciliations." />
        ) : (
          <PaymentsErrorState
            description={getErrorMessage(reconciliationsQuery.error)}
            onRetry={() => {
              void reconciliationsQuery.refetch();
            }}
          />
        )
      ) : null}

      {!reconciliationsQuery.isLoading &&
      !reconciliationsQuery.error &&
      reconciliations.length === 0 &&
      hasActiveFilters ? (
        <FilteredState noun="reconciliations" onClearFilters={resetFilters} />
      ) : null}

      {!reconciliationsQuery.isLoading &&
      !reconciliationsQuery.error &&
      reconciliations.length === 0 &&
      !hasActiveFilters ? (
        <PaymentsEmptyState
          title="No reconciliations yet"
          description="Create daily reconciliation records to compare expected and counted totals."
        />
      ) : null}

      {/* Cards below md, the table from md up. */}
      {!reconciliationsQuery.isLoading &&
      !reconciliationsQuery.error &&
      reconciliations.length > 0 ? (
        <>
          <div className="md:hidden">
            <ReconciliationCardGrid reconciliations={reconciliations} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <ReconciliationTable reconciliations={reconciliations} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <ReconciliationFormDialog
        branches={branchOptions}
        isSubmitting={createMutation.isPending}
        onClose={() => setDialogOpen(false)}
        onSubmit={handleCreate}
        open={dialogOpen}
        paymentMethods={methodsQuery.data ?? []}
      />
    </div>
  );
}
