"use client";

import type { JSX } from "react";
import { useState } from "react";

import { AccessDeniedCard } from "@/components/payments/access-denied-card";
import { PaymentsEmptyState } from "@/components/payments/payments-empty-state";
import { PaymentsErrorState } from "@/components/payments/payments-error-state";
import { PaymentsTableSkeleton } from "@/components/payments/payments-table-skeleton";
import { PaymentsToolbar } from "@/components/payments/payments-toolbar";
import { RefundsTable } from "@/components/payments/refunds-table";
import { FilteredState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { usePaymentMethods, useRefunds } from "@/hooks/use-payments";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type { RefundFilters } from "@/types/payment";

const defaultFilters: RefundFilters = {
  search: "",
  refundStatus: "all",
  paymentMethodId: "all",
  dateFrom: "",
  dateTo: "",
};

export function RefundsPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const [filters, setFilters] = useState<RefundFilters>(defaultFilters);
  const canView = hasAnyPermission([PERMISSIONS.paymentsView, PERMISSIONS.posView]);
  const refundsQuery = useRefunds(filters, canView);
  const methodsQuery = usePaymentMethods(canView);
  const isPermissionDenied =
    refundsQuery.error instanceof ApiError && refundsQuery.error.status === 403;
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.paymentMethodId !== defaultFilters.paymentMethodId ||
    filters.refundStatus !== defaultFilters.refundStatus ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;

  if (!canView) {
    return (
      <AccessDeniedCard message="You need `payments.view` or `pos.view` to view payment refunds." />
    );
  }

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Payment Refunds"
        description="Review completed, failed, and pending payment refunds."
      />

      <PaymentsToolbar
        filters={filters}
        mode="refunds"
        onFiltersChange={setFilters}
        paymentMethods={methodsQuery.data ?? []}
      />

      {refundsQuery.isLoading ? <PaymentsTableSkeleton /> : null}

      {!refundsQuery.isLoading && refundsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the refunds endpoint." />
        ) : (
          <PaymentsErrorState
            description={getErrorMessage(refundsQuery.error)}
            onRetry={() => {
              void refundsQuery.refetch();
            }}
          />
        )
      ) : null}

      {!refundsQuery.isLoading &&
      !refundsQuery.error &&
      (refundsQuery.data ?? []).length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="refunds"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!refundsQuery.isLoading &&
      !refundsQuery.error &&
      (refundsQuery.data ?? []).length === 0 &&
      !hasActiveFilters ? (
        <PaymentsEmptyState
          title="No refunds yet"
          description="Refunds created from completed payments will appear here."
        />
      ) : null}

      {!refundsQuery.isLoading && !refundsQuery.error && (refundsQuery.data ?? []).length > 0 ? (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <RefundsTable refunds={refundsQuery.data ?? []} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
