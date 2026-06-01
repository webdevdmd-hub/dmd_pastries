"use client";

import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseSupplierPaymentsTable } from "@/components/purchasing/purchase-supplier-payments-table";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
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
import { usePaymentMethods } from "@/hooks/use-payments";
import { usePermission } from "@/hooks/use-permission";
import {
  usePurchasingBranches,
  usePurchasingSuppliers,
  useSupplierPayments,
} from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { SupplierPaymentFilters } from "@/types/purchasing";

const defaultFilters: SupplierPaymentFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  paidByUserId: "",
  paymentMethodId: "all",
  paymentStatus: "all",
  purchaseInvoiceId: "",
  search: "",
  sortBy: "paid_at",
  sortOrder: "desc",
  supplierId: "all",
};

const paymentStatuses = [
  { label: "Completed", value: "completed" },
  { label: "Pending", value: "pending" },
  { label: "Failed", value: "failed" },
];

export function PurchaseSupplierPaymentsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const [filters, setFilters] = useState<SupplierPaymentFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const paymentsQuery = useSupplierPayments(filters, canView && branchScope.hasBranchScope);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const methodsQuery = usePaymentMethods(canView);
  const purchasingPaymentMethods = useMemo(
    () =>
      (methodsQuery.data ?? []).filter(
        (method) => method.status === "active" && method.showInPurchasing,
      ),
    [methodsQuery.data],
  );
  const isPermissionDenied =
    paymentsQuery.error instanceof ApiError && paymentsQuery.error.status === 403;
  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = branchScope.normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [branchScope]);

  if (!canView) {
    return <AccessDeniedCard />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const updateFilters = (patch: Partial<SupplierPaymentFilters>): void => {
    setFilters((currentFilters) => ({ ...currentFilters, ...patch }));
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Supplier Payments"
        description="Track money paid out to suppliers against posted purchase invoices."
      />

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))]">
        <Input
          aria-label="Search supplier payments"
          onChange={(event) => updateFilters({ search: event.target.value })}
          placeholder="Search invoice, supplier, reference..."
          value={filters.search}
        />
        <Select
          value={filters.supplierId}
          onValueChange={(supplierId) => updateFilters({ supplierId })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Supplier" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All suppliers</SelectItem>
            {(suppliersQuery.data ?? []).map((supplier) => (
              <SelectItem key={supplier.id} value={supplier.id}>
                {supplier.supplierName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.branchId} onValueChange={(branchId) => updateFilters({ branchId })}>
          <SelectTrigger>
            <SelectValue placeholder="Branch" />
          </SelectTrigger>
          <SelectContent>
            {branchScope.canAccessAllBranches ? (
              <SelectItem value="all">All branches</SelectItem>
            ) : null}
            {branchOptions.map((branch) => (
              <SelectItem key={branch.id} value={branch.id}>
                {branch.branchName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.paymentMethodId}
          onValueChange={(paymentMethodId) => updateFilters({ paymentMethodId })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All methods</SelectItem>
            {purchasingPaymentMethods.map((method) => (
              <SelectItem key={method.id} value={method.id}>
                {method.methodName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={filters.paymentStatus}
          onValueChange={(paymentStatus) => updateFilters({ paymentStatus })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            {paymentStatuses.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label="Date from"
          onChange={(event) => updateFilters({ dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <div className="flex gap-3">
          <Input
            aria-label="Date to"
            onChange={(event) => updateFilters({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
          <Button
            onClick={() => setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId })}
            type="button"
            variant="outline"
          >
            Reset
          </Button>
        </div>
      </div>

      {paymentsQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!paymentsQuery.isLoading && paymentsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to supplier payments." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(paymentsQuery.error)}
            onRetry={() => {
              void paymentsQuery.refetch();
            }}
          />
        )
      ) : null}

      {!paymentsQuery.isLoading &&
      !paymentsQuery.error &&
      (paymentsQuery.data ?? []).length === 0 ? (
        <PurchaseEmptyState title="No supplier payments found." />
      ) : null}

      {!paymentsQuery.isLoading && !paymentsQuery.error && (paymentsQuery.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PurchaseSupplierPaymentsTable payments={paymentsQuery.data ?? []} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
