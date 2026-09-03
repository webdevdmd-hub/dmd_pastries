"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/app/confirm-provider";
import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseSupplierPaymentAllocationDialog } from "@/components/purchasing/purchase-supplier-payment-allocation-dialog";
import { PurchaseSupplierPaymentsCardGrid } from "@/components/purchasing/purchase-supplier-payments-card-grid";
import { PurchaseSupplierPaymentsTable } from "@/components/purchasing/purchase-supplier-payments-table";
import { PurchaseSupplierPaymentsToolbar } from "@/components/purchasing/purchase-supplier-payments-toolbar";
import { PurchaseTableSkeleton } from "@/components/purchasing/purchase-table-skeleton";
import { SupplierPaymentDetailsDrawer } from "@/components/purchasing/supplier-payment-details-drawer";
import { FilteredState } from "@/components/shared/collection-state";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
import { PageHeader } from "@/components/shared/page-header";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { useBranchScope } from "@/hooks/use-branch-scope";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateSupplierPayment,
  useDeleteSupplierPayment,
  usePurchaseInvoices,
  usePurchasingBranches,
  usePurchasingPaymentMethods,
  usePurchasingSuppliers,
  useSupplierPayment,
  useSupplierPayments,
  useUpdateSupplierPayment,
} from "@/hooks/use-purchasing";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { PURCHASE_PICKER_PAGE_SIZE } from "@/lib/api/purchasing";
import type {
  CreateSupplierPaymentPayload,
  PurchaseInvoice,
  SupplierPayment,
  SupplierPaymentFilters,
} from "@/types/purchasing";

const defaultFilters: SupplierPaymentFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  paidByUserId: "",
  paymentMethodId: "all",
  paymentStatus: "all",
  purchaseInvoiceId: "",
  search: "",
  sortBy: "payment_date",
  sortOrder: "desc",
  supplierId: "all",
};

function paymentAllocationMap(payment: SupplierPayment | null | undefined): Map<string, number> {
  return new Map(
    (payment?.allocations ?? []).map((allocation) => [
      allocation.purchaseInvoiceId,
      allocation.amount,
    ]),
  );
}

function mergeEditableInvoices(
  invoices: PurchaseInvoice[],
  payment: SupplierPayment | null | undefined,
): PurchaseInvoice[] {
  const allocationMap = paymentAllocationMap(payment);

  return invoices
    .map((invoice) => {
      const existingAllocation = allocationMap.get(invoice.id) ?? 0;
      return {
        ...invoice,
        balanceAmount: invoice.balanceAmount + existingAllocation,
      };
    })
    .filter(
      (invoice) =>
        invoice.status === "posted" && (invoice.balanceAmount > 0 || allocationMap.has(invoice.id)),
    );
}

/** AED, matching the counter and the ledger tables. */
function formatAed(value: number): string {
  return new Intl.NumberFormat("en-AE", { currency: "AED", style: "currency" }).format(value);
}

export function PurchaseSupplierPaymentsPageClient(): JSX.Element {
  const confirm = useConfirm();
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.purchasingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.purchasingInvoicesEdit,
    PERMISSIONS.purchasingInvoicesPost,
  ]);
  const [filters, setFilters] = useState<SupplierPaymentFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [manualDialogOpen, setManualDialogOpen] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<string | null>(null);
  const [selectedPaymentBranchId, setSelectedPaymentBranchId] = useState("");
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  // The drawer keeps its payment while it animates closed, so open state is
  // separate from the selected record.
  const [detailsPayment, setDetailsPayment] = useState<SupplierPayment | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [page, setPage] = useState(1);
  const paymentsQuery = useSupplierPayments(filters, canView && branchScope.hasBranchScope, page);
  const paymentsTotalPages = paymentsQuery.data?.pagination.totalPages ?? 1;
  // Narrowing the filters, or deleting the last row on the final page, both
  // leave the page pointing past the end. The empty response that comes back
  // reads as "nothing found", which is a lie about the data rather than about
  // the page, so snap back into range.
  const filterKey = JSON.stringify(filters);
  useEffect(() => {
    setPage(1);
  }, [filterKey]);
  useEffect(() => {
    if (page > paymentsTotalPages) {
      setPage(paymentsTotalPages);
    }
  }, [page, paymentsTotalPages]);
  const suppliersQuery = usePurchasingSuppliers("", canView);
  const branchesQuery = usePurchasingBranches(canView);
  const editingPaymentQuery = useSupplierPayment(
    editingPaymentId,
    canView && canManage && editingPaymentId !== null,
  );
  const filterBranchId = branchScope.normalizeBranchId(filters.branchId);
  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );
  const manualBranchId =
    selectedPaymentBranchId || (filterBranchId === "all" ? "" : filterBranchId);
  const paymentMethodBranchId =
    manualDialogOpen && manualBranchId.length > 0
      ? manualBranchId
      : filterBranchId === "all"
        ? ""
        : filterBranchId;
  const methodsQuery = usePurchasingPaymentMethods(
    paymentMethodBranchId,
    canView &&
      branchScope.hasBranchScope &&
      paymentMethodBranchId.length > 0 &&
      (!manualDialogOpen || manualBranchId.length > 0),
  );
  const payableInvoicesQuery = usePurchaseInvoices(
    {
      branchId: manualBranchId,
      dateFrom: "",
      dateTo: "",
      paymentStatus: "all",
      search: "",
      status: "posted",
      supplierId: selectedSupplierId,
    },
    canView &&
      canManage &&
      branchScope.hasBranchScope &&
      manualDialogOpen &&
      manualBranchId.length > 0 &&
      selectedSupplierId.length > 0,
    1,
    PURCHASE_PICKER_PAGE_SIZE,
  );
  const createPaymentMutation = useCreateSupplierPayment();
  const updatePaymentMutation = useUpdateSupplierPayment();
  const deletePaymentMutation = useDeleteSupplierPayment();
  const purchasingPaymentMethods = methodsQuery.data ?? [];
  const isPermissionDenied =
    paymentsQuery.error instanceof ApiError && paymentsQuery.error.status === 403;
  // Branch is scope, not a filter: it always carries a value, so counting it
  // would make a genuinely empty ledger look like a narrow search. Sort order is
  // not a filter either: it reorders rows, it never removes them.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.supplierId !== defaultFilters.supplierId ||
    filters.paymentMethodId !== defaultFilters.paymentMethodId ||
    filters.paymentStatus !== defaultFilters.paymentStatus ||
    filters.paidByUserId.length > 0 ||
    filters.purchaseInvoiceId.length > 0 ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;
  const payableInvoices = useMemo(() => {
    if (!selectedSupplierId) return [];

    return editingPaymentId
      ? mergeEditableInvoices(payableInvoicesQuery.data?.items ?? [], editingPaymentQuery.data)
      : (payableInvoicesQuery.data?.items ?? []).filter(
          (invoice) => invoice.status === "posted" && invoice.balanceAmount > 0,
        );
  }, [editingPaymentId, editingPaymentQuery.data, payableInvoicesQuery.data, selectedSupplierId]);

  useEffect(() => {
    if (!editingPaymentId) {
      setSelectedSupplierId("");
    }
  }, [editingPaymentId, filters.branchId, manualDialogOpen]);

  useEffect(() => {
    if (!manualDialogOpen) return;

    const nextBranchId =
      filterBranchId !== "all"
        ? filterBranchId
        : (branchOptions.find((branch) => branch.status === "active")?.id ?? "");

    setSelectedPaymentBranchId(nextBranchId);
  }, [branchOptions, filterBranchId, manualDialogOpen]);

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

  const updateFilters = (patch: Partial<SupplierPaymentFilters>): void => {
    setFilters((currentFilters) => ({ ...currentFilters, ...patch }));
  };

  const resetFilters = (): void => {
    setFilters({ ...defaultFilters, branchId: branchScope.defaultBranchId });
  };

  const closeManualDialog = (): void => {
    setManualDialogOpen(false);
    setEditingPaymentId(null);
    setSelectedPaymentBranchId("");
    setSelectedSupplierId("");
  };

  const handleManualPayment = async (payload: CreateSupplierPaymentPayload): Promise<void> => {
    if (!payload.supplierId) {
      toast.error("Select a supplier before recording payment.");
      return;
    }

    if (editingPaymentId) {
      await updatePaymentMutation.mutateAsync({ paymentId: editingPaymentId, payload });
      toast.success("Payment made updated.");
    } else {
      await createPaymentMutation.mutateAsync(payload);
      toast.success("Payment made recorded.");
    }
    closeManualDialog();
  };

  const refreshPayableInvoices = async (): Promise<PurchaseInvoice[]> => {
    const result = await payableInvoicesQuery.refetch();
    if (!selectedSupplierId) return [];

    return editingPaymentId
      ? mergeEditableInvoices(result.data?.items ?? [], editingPaymentQuery.data)
      : (result.data?.items ?? []).filter(
          (invoice) => invoice.status === "posted" && invoice.balanceAmount > 0,
        );
  };

  const openDetails = (payment: SupplierPayment): void => {
    setDetailsPayment(payment);
    setDetailsOpen(true);
  };

  const openEditPayment = (payment: SupplierPayment): void => {
    // The drawer may be open underneath; a form on top of a sheet on top of
    // the list is one layer too many, so the drawer closes first. Closing or
    // saving the form then lands back on the list.
    setDetailsOpen(false);
    setEditingPaymentId(payment.id);
    setSelectedPaymentBranchId(payment.branchId);
    setSelectedSupplierId(payment.supplierId);
    setManualDialogOpen(true);
  };

  const deletePayment = async (payment: SupplierPayment): Promise<void> => {
    // The only genuinely irreversible action here, so the only one that keeps
    // tone="danger". Amount and supplier lead so the operator can confirm they
    // clicked the row they meant.
    const confirmed = await confirm({
      cancelLabel: "Keep payment",
      confirmLabel: "Delete payment",
      consequence: `This permanently deletes the ${formatAed(payment.amount)} payment to ${payment.supplierName} on invoice ${payment.invoiceNumber}. It cannot be undone.`,
      detail:
        "Reverses its effect on supplier outstanding, bill balances, supplier advance and the accounting records.",
      title: "Delete this payment?",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deletePaymentMutation.mutateAsync(payment.id);
      toast.success("Payment made deleted.");
      setDetailsOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const payments = paymentsQuery.data?.items ?? [];
  const listHandlers = {
    onDelete: canManage
      ? (payment: SupplierPayment) => {
          void deletePayment(payment);
        }
      : undefined,
    onEdit: canManage ? openEditPayment : undefined,
    onView: openDetails,
    payments,
  };
  const pagination = paymentsQuery.data?.pagination ? (
    <PaginationBar
      isFetching={paymentsQuery.isFetching}
      limit={paymentsQuery.data.pagination.limit}
      noun={{ one: "payment made", other: "payments made" }}
      onPageChange={setPage}
      page={paymentsQuery.data.pagination.page}
      total={paymentsQuery.data.pagination.total}
      totalPages={paymentsQuery.data.pagination.totalPages}
    />
  ) : null;

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Payments Made"
        description="Track money paid out to suppliers, bill allocations, and advances."
        actions={
          canManage ? (
            <Button onClick={() => setManualDialogOpen(true)} type="button">
              <Plus className="h-4 w-4" />
              Record Payment Made
            </Button>
          ) : undefined
        }
      />

      <PurchaseSupplierPaymentsToolbar
        branches={branchOptions}
        canAccessAllBranches={branchScope.canAccessAllBranches}
        filters={filters}
        onFiltersChange={updateFilters}
        onReset={resetFilters}
        paymentMethods={purchasingPaymentMethods}
        suppliers={suppliersQuery.data ?? []}
      />

      {paymentsQuery.isLoading ? <PurchaseTableSkeleton /> : null}

      {!paymentsQuery.isLoading && paymentsQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to payments made." />
        ) : (
          <PurchaseErrorState
            description={getErrorMessage(paymentsQuery.error)}
            onRetry={() => {
              void paymentsQuery.refetch();
            }}
          />
        )
      ) : null}

      {/* Filtered and empty need opposite remedies. "No payments made" on a
          screen where a date range simply excluded everything reads as "we have
          never paid this supplier", which may be flatly untrue. DESIGN.md 8. */}
      {!paymentsQuery.isLoading &&
      !paymentsQuery.error &&
      payments.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="supplier payments"
          onClearFilters={resetFilters}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!paymentsQuery.isLoading &&
      !paymentsQuery.error &&
      payments.length === 0 &&
      !hasActiveFilters ? (
        <PurchaseEmptyState title="No payments made found." />
      ) : null}

      {/* An eleven-column ledger has no honest phone layout. Below md the list
          is cards carrying the same fields; the table takes over from md up. */}
      {!paymentsQuery.isLoading && !paymentsQuery.error && payments.length > 0 ? (
        <>
          <div className="grid gap-4 md:hidden">
            <PurchaseSupplierPaymentsCardGrid {...listHandlers} />
            {pagination ? <Card className="overflow-hidden">{pagination}</Card> : null}
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <PurchaseSupplierPaymentsTable {...listHandlers} />
              {pagination}
            </CardContent>
          </Card>
        </>
      ) : null}

      <SupplierPaymentDetailsDrawer
        canManage={canManage}
        onEdit={openEditPayment}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
        payment={detailsPayment}
      />

      <PurchaseSupplierPaymentAllocationDialog
        branchId={manualBranchId}
        branches={branchOptions.filter((branch) => branch.status === "active")}
        invoices={payableInvoices}
        invoicesError={
          payableInvoicesQuery.error ? getErrorMessage(payableInvoicesQuery.error) : null
        }
        invoicesLoading={payableInvoicesQuery.isLoading}
        initialPayment={editingPaymentQuery.data ?? null}
        isSubmitting={
          createPaymentMutation.isPending ||
          updatePaymentMutation.isPending ||
          (editingPaymentId !== null && editingPaymentQuery.isLoading)
        }
        mode={editingPaymentId ? "edit" : "create"}
        methods={purchasingPaymentMethods}
        onBranchChange={(branchId) => {
          setSelectedPaymentBranchId(branchId);
          setSelectedSupplierId("");
        }}
        onClose={closeManualDialog}
        onRetryInvoices={() => {
          void payableInvoicesQuery.refetch();
        }}
        onRefreshInvoices={refreshPayableInvoices}
        onSubmit={handleManualPayment}
        onSupplierChange={setSelectedSupplierId}
        open={manualDialogOpen}
        selectedBranchId={selectedPaymentBranchId}
        selectedSupplierId={selectedSupplierId}
        suppliers={suppliersQuery.data ?? []}
      />
    </div>
  );
}
