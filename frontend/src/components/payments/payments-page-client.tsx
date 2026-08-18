"use client";

import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
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
import { SalesReturnDialog } from "@/components/payments/sales-return-dialog";
import { POSReceiptDialog } from "@/components/pos/pos-receipt-dialog";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/use-auth";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { useStockLocations } from "@/hooks/use-inventory";
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
import { useSaleReceipt } from "@/hooks/use-reports";
import { useReceiptLayouts } from "@/hooks/use-settings-data";
import { useUsers } from "@/hooks/use-users";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { resolveDashboardTimezone } from "@/lib/reports/dashboard-filters";
import type {
  AddPaymentPayload,
  PaymentFilters,
  PaymentSummaryParams,
  RefundPaymentPayload,
  SalePayment,
} from "@/types/payment";
import type { SaleReceipt } from "@/types/pos";
import type { ReceiptLayout } from "@/types/settings";
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

function selectReceiptLayout(
  layouts: ReceiptLayout[],
  branchId: string | null,
): ReceiptLayout | null {
  const activeLayouts = layouts.filter((layout) => layout.status === "active");
  const branchLayouts = branchId
    ? activeLayouts.filter((layout) => layout.branchId === branchId)
    : [];
  const businessWideLayouts = activeLayouts.filter((layout) => layout.branchId === null);

  return (
    branchLayouts.find((layout) => layout.isDefault) ??
    branchLayouts.find((layout) => Boolean(layout.counterId ?? layout.printerType)) ??
    branchLayouts[0] ??
    businessWideLayouts.find((layout) => layout.isDefault) ??
    activeLayouts.find((layout) => layout.isDefault) ??
    activeLayouts[0] ??
    null
  );
}

export function PaymentsPageClient(): JSX.Element {
  const router = useRouter();
  const { user } = useAuth();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const { hasAnyPermission, hasPermission } = usePermission();
  const [filters, setFilters] = useState<PaymentFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [addPaymentOpen, setAddPaymentOpen] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<SalePayment | null>(null);
  const [refundPayment, setRefundPayment] = useState<SalePayment | null>(null);
  const [returnPayment, setReturnPayment] = useState<SalePayment | null>(null);
  const [receipt, setReceipt] = useState<SaleReceipt | null>(null);
  const [receiptBranchId, setReceiptBranchId] = useState<string | null>(null);
  const canView = hasAnyPermission([PERMISSIONS.paymentsView, PERMISSIONS.posView]);
  const canAdd = hasAnyPermission([PERMISSIONS.paymentsAdd, PERMISSIONS.posSell]);
  const canRefund = hasAnyPermission([PERMISSIONS.paymentsRefund, PERMISSIONS.posRefund]);
  const canViewUsers = hasPermission(PERMISSIONS.usersView);
  const canSelectRefundApprover =
    hasAnyPermission([PERMISSIONS.paymentsRefund]) || user?.roles.some(isOwnerOrAdminRole) === true;
  const timezone = useMemo(resolveDashboardTimezone, []);
  const summaryParams: PaymentSummaryParams = {
    branchId: filters.branchId,
    dateFrom: filters.dateFrom,
    dateTo: filters.dateTo,
    timezone,
  };
  const paymentsQuery = usePayments(filters, canView && branchScope.hasBranchScope);
  const summaryQuery = useDailyPaymentSummary(summaryParams, canView && branchScope.hasBranchScope);
  const methodSummaryQuery = usePaymentSummaryByMethod(
    summaryParams,
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
  // Refund-dialog-only data: fetching it on every list render cost two requests
  // per page load for a dialog most visits never open. React Query caches the
  // result, so it is fetched once on first open and reused after that.
  //
  // receiptLayouts deliberately stays eager: the receipt dialog renders as soon
  // as setReceipt fires, so a lazy layout could print with the wrong one.
  const isRefundDialogOpen = refundPayment !== null;
  const stockLocationsQuery = useStockLocations(
    isRefundDialogOpen && canRefund && branchScope.hasBranchScope,
  );
  const receiptLayoutsQuery = useReceiptLayouts(canView && branchScope.hasBranchScope);
  const usersQuery = useUsers(
    { search: "", status: "active" },
    isRefundDialogOpen && canRefund && canViewUsers,
  );
  const addPaymentMutation = useAddPaymentToSale();
  const refundMutation = useRefundPayment();
  const saleReceiptMutation = useSaleReceipt();
  const receiptLayout = selectReceiptLayout(
    receiptLayoutsQuery.data ?? [],
    receiptBranchId ?? branchScope.effectiveBranchId,
  );
  const isPermissionDenied =
    paymentsQuery.error instanceof ApiError && paymentsQuery.error.status === 403;
  const approverOptions = (usersQuery.data ?? []).filter(hasApproverRole).map((approver) => ({
    id: approver.id,
    label: `${approver.fullName} (${approver.roleName})`,
  }));
  useEffect(() => {
    setFilters((currentFilters) => {
      const branchId = normalizeBranchId(currentFilters.branchId);
      return branchId === currentFilters.branchId
        ? currentFilters
        : { ...currentFilters, branchId };
    });
  }, [normalizeBranchId]);

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

  const handleViewReceipt = async (payment: SalePayment): Promise<void> => {
    if (payment.sourceType !== "pos_sale" || !payment.sourceId) {
      return;
    }

    try {
      const saleReceipt = await saleReceiptMutation.mutateAsync(payment.sourceId);
      setReceiptBranchId(payment.branchId || branchScope.effectiveBranchId);
      setReceipt(saleReceipt);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleViewSaleDetails = (payment: SalePayment): void => {
    if (payment.sourceType !== "pos_sale" || !payment.sourceId) {
      return;
    }

    router.push(`/payments/sales/${payment.sourceId}`);
  };

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Payments"
        description="Track incoming customer collections from POS sales and bakery orders."
        actions={
          canAdd ? (
            <Button onClick={() => setAddPaymentOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Add payment
            </Button>
          ) : undefined
        }
      />

      <PaymentsSummaryCards
        errorMessage={summaryQuery.error ? getErrorMessage(summaryQuery.error) : undefined}
        onRetry={() => {
          void summaryQuery.refetch();
        }}
        summary={summaryQuery.data}
      />

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
              isReceiptLoading={saleReceiptMutation.isPending}
              onCreateReturn={setReturnPayment}
              onView={setSelectedPayment}
              onViewReceipt={(payment) => {
                void handleViewReceipt(payment);
              }}
              onViewSaleDetails={handleViewSaleDetails}
              payments={paymentsQuery.data ?? []}
            />
          </CardContent>
        </Card>
      ) : null}

      <PaymentDetailsDrawer
        canRefund={canRefund}
        isReceiptLoading={saleReceiptMutation.isPending}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedPayment(null);
          }
        }}
        onRefund={setRefundPayment}
        onCreateReturn={setReturnPayment}
        onViewReceipt={(payment) => {
          void handleViewReceipt(payment);
        }}
        onViewSaleDetails={handleViewSaleDetails}
        open={selectedPayment !== null}
        payment={selectedPayment}
        refunds={(refundsQuery.data ?? []).filter(
          (refund) => refund.salePaymentId === selectedPayment?.id,
        )}
      />

      <POSReceiptDialog
        layout={receiptLayout}
        onNewSale={() => {
          setReceipt(null);
          setReceiptBranchId(null);
        }}
        onOpenChange={(open) => {
          if (!open) {
            setReceipt(null);
            setReceiptBranchId(null);
          }
        }}
        open={receipt !== null}
        primaryActionLabel="Close"
        receipt={receipt}
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

      <SalesReturnDialog
        onOpenChange={(open) => {
          if (!open) {
            setReturnPayment(null);
          }
        }}
        open={returnPayment !== null}
        paymentMethods={methodsQuery.data ?? []}
        saleId={returnPayment?.sourceId ?? null}
        saleNumber={returnPayment?.sourceNumber ?? null}
        stockLocations={stockLocationsQuery.data ?? []}
      />
    </div>
  );
}
