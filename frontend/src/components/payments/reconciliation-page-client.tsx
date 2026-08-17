"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/payments/access-denied-card";
import { PaymentsEmptyState } from "@/components/payments/payments-empty-state";
import { PaymentsErrorState } from "@/components/payments/payments-error-state";
import { PaymentsTableSkeleton } from "@/components/payments/payments-table-skeleton";
import { ReconciliationFormDialog } from "@/components/payments/reconciliation-form-dialog";
import { ReconciliationTable } from "@/components/payments/reconciliation-table";
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
      toast.error(getErrorMessage(error));
    }
  };

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

      <div className="grid gap-3 rounded-3xl border border-brand-cappuccino/70 bg-card/75 p-4 shadow-sm md:grid-cols-4">
        <Select
          onValueChange={(value) => setFilters((current) => ({ ...current, branchId: value }))}
          value={filters.branchId}
        >
          <SelectTrigger>
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
        <Select
          onValueChange={(value) =>
            setFilters((current) => ({ ...current, paymentMethodId: value }))
          }
          value={filters.paymentMethodId}
        >
          <SelectTrigger>
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
        <Input
          aria-label="Date from"
          onChange={(event) =>
            setFilters((current) => ({ ...current, dateFrom: event.target.value }))
          }
          type="date"
          value={filters.dateFrom}
        />
        <Input
          aria-label="Date to"
          onChange={(event) =>
            setFilters((current) => ({ ...current, dateTo: event.target.value }))
          }
          type="date"
          value={filters.dateTo}
        />
      </div>

      {lastCreated ? (
        <div className="rounded-3xl border border-brand-cappuccino bg-card/80 p-4 text-sm text-brand-mocha">
          Reconciliation created for {lastCreated.reconciliationDate}. Backend calculated the
          expected amount and difference; the table below has been refreshed with the saved result.
        </div>
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
      (reconciliationsQuery.data ?? []).length === 0 ? (
        <PaymentsEmptyState
          title="No reconciliations found."
          description="Create daily reconciliation records to compare expected and counted totals."
        />
      ) : null}

      {!reconciliationsQuery.isLoading &&
      !reconciliationsQuery.error &&
      (reconciliationsQuery.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <ReconciliationTable reconciliations={reconciliationsQuery.data ?? []} />
          </CardContent>
        </Card>
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
