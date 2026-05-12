"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/payments/access-denied-card";
import { AddPaymentDialog } from "@/components/payments/add-payment-dialog";
import { PaymentDetailsDrawer } from "@/components/payments/payment-details-drawer";
import { PaymentMethodSummaryCards } from "@/components/payments/payment-method-summary-cards";
import { PaymentRefundDialog } from "@/components/payments/payment-refund-dialog";
import { PaymentsEmptyState } from "@/components/payments/payments-empty-state";
import { PaymentsErrorState } from "@/components/payments/payments-error-state";
import { PaymentsSummaryCards } from "@/components/payments/payments-summary-cards";
import { PaymentsTable } from "@/components/payments/payments-table";
import { PaymentsTableSkeleton } from "@/components/payments/payments-table-skeleton";
import { PaymentsToolbar } from "@/components/payments/payments-toolbar";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useBranchScope } from "@/hooks/use-branch-scope";
import {
  useAddPaymentToSale,
  useDailyPaymentSummary,
  usePaymentMethods,
  usePayments,
  usePaymentSummaryByMethod,
  useRefundPayment,
  useRefunds,
} from "@/hooks/use-payments";
import { usePermission } from "@/hooks/use-permission";
import { useUsers } from "@/hooks/use-users";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  AddPaymentPayload,
  PaymentFilters,
  RefundPaymentPayload,
  SalePayment,
} from "@/types/payment";
import type { User } from "@/types/user";

const defaultFilters: PaymentFilters = {
  search: "",
  paymentMethodId: "all",
  paymentStatus: "all",
  dateFrom: "",
  dateTo: "",
  branchId: "",
};

function hasApproverRole(user: User): boolean {
  const roleName = user.roleName.toLowerCase();

  return roleName.includes("owner") || roleName.includes("admin") || roleName.includes("manager");
}

function isOwnerOrAdminRole(roleName: string): boolean {
  const normalizedRoleName = roleName.toLowerCase();

  return normalizedRoleName.includes("owner") || normalizedRoleName.includes("admin");
}

export function PaymentsPageClient(): JSX.Element {
  const { user } = useAuth();
  const branchScope = useBranchScope();
  const { hasAnyPermission, hasPermission } = usePermission();
  const [filters, setFilters] = useState<PaymentFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SalePayment | null>(null);
  const [refundPayment, setRefundPayment] = useState<SalePayment | null>(null);
  const canView = hasAnyPermission([PERMISSIONS.paymentsView, PERMISSIONS.posView]);
  const canAdd = hasAnyPermission([PERMISSIONS.paymentsAdd, PERMISSIONS.posSell]);
  const canRefund = hasAnyPermission([PERMISSIONS.paymentsRefund, PERMISSIONS.posRefund]);
  const canViewUsers = hasPermission(PERMISSIONS.usersView);
  const canSelectRefundApprover =
    hasAnyPermission([PERMISSIONS.paymentsRefund]) || user?.roles.some(isOwnerOrAdminRole) === true;
  const paymentsQuery = usePayments(filters, canView && branchScope.hasBranchScope);
  const summaryQuery = useDailyPaymentSummary(
    { branchId: filters.branchId },
    canView && branchScope.hasBranchScope,
  );
  const methodSummaryQuery = usePaymentSummaryByMethod(
    { branchId: filters.branchId },
    canView && branchScope.hasBranchScope,
  );
  const refundsQuery = useRefunds(
    {
      search: "",
      refundStatus: "all",
      paymentMethodId: "all",
      dateFrom: "",
      dateTo: "",
    },
    canView && branchScope.hasBranchScope,
  );
  const methodsQuery = usePaymentMethods(canView);
  const usersQuery = useUsers({ search: "", status: "active" }, canRefund && canViewUsers);
  const addPaymentMutation = useAddPaymentToSale();
  const refundMutation = useRefundPayment();
  const isPermissionDenied =
    paymentsQuery.error instanceof ApiError && paymentsQuery.error.status === 403;
  const approverOptions = (usersQuery.data ?? []).filter(hasApproverRole).map((approver) => ({
    id: approver.id,
    label: `${approver.fullName} (${approver.roleName})`,
  }));

  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = branchScope.normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [branchScope]);

  if (!canView) {
    return <AccessDeniedCard message="You need `payments.view` or `pos.view` to view Payments." />;
  }

  if (!branchScope.hasBranchScope) {
    return <NoBranchScopeCard />;
  }

  const handleAddPayment = async (saleId: string, payload: AddPaymentPayload): Promise<void> => {
    try {
      await addPaymentMutation.mutateAsync({ saleId, payload });
      toast.success("Payment added to sale.");
      setAddPaymentOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleRefund = async (paymentId: string, payload: RefundPaymentPayload): Promise<void> => {
    try {
      await refundMutation.mutateAsync({ paymentId, payload });
      toast.success("Refund created.");
      setRefundPayment(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Track sale payments, split payments, refunds, and daily collection status."
        actions={
          canAdd ? (
            <Button onClick={() => setAddPaymentOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Add payment
            </Button>
          ) : undefined
        }
      />

      <PaymentsSummaryCards summary={summaryQuery.data} />

      <PaymentMethodSummaryCards summaries={methodSummaryQuery.data ?? []} />

      <PaymentsToolbar
        filters={filters}
        onFiltersChange={setFilters}
        paymentMethods={methodsQuery.data ?? []}
      />

      {paymentsQuery.isLoading ? <PaymentsTableSkeleton /> : null}

      {!paymentsQuery.isLoading && paymentsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the payments endpoint." />
        ) : (
          <PaymentsErrorState
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
        <PaymentsEmptyState />
      ) : null}

      {!paymentsQuery.isLoading && !paymentsQuery.error && (paymentsQuery.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PaymentsTable
              canRefund={canRefund}
              onRefund={setRefundPayment}
              onView={setSelectedPayment}
              payments={paymentsQuery.data ?? []}
            />
          </CardContent>
        </Card>
      ) : null}

      <PaymentDetailsDrawer
        canRefund={canRefund}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPayment(null);
          }
        }}
        onRefund={setRefundPayment}
        open={selectedPayment !== null}
        payment={selectedPayment}
        refunds={(refundsQuery.data ?? []).filter(
          (refund) => refund.salePaymentId === selectedPayment?.id,
        )}
      />

      <AddPaymentDialog
        isSubmitting={addPaymentMutation.isPending}
        onClose={() => setAddPaymentOpen(false)}
        onSubmit={handleAddPayment}
        open={addPaymentOpen}
        paymentMethods={methodsQuery.data ?? []}
      />

      <PaymentRefundDialog
        approverOptions={approverOptions}
        canSelectApprover={canSelectRefundApprover}
        currentUserId={user?.id ?? null}
        currentUserName={user?.fullName ?? "Current user"}
        isSubmitting={refundMutation.isPending}
        onClose={() => setRefundPayment(null)}
        onSubmit={handleRefund}
        open={refundPayment !== null}
        payment={refundPayment}
        refunds={(refundsQuery.data ?? []).filter(
          (refund) => refund.salePaymentId === refundPayment?.id,
        )}
      />
    </div>
  );
}
