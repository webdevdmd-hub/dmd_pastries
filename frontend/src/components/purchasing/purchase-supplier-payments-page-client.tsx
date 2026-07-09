"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/purchasing/access-denied-card";
import { PurchaseEmptyState } from "@/components/purchasing/purchase-empty-state";
import { PurchaseErrorState } from "@/components/purchasing/purchase-error-state";
import { PurchaseSupplierPaymentAllocationDialog } from "@/components/purchasing/purchase-supplier-payment-allocation-dialog";
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

const paymentStatuses = [
  { label: "Completed", value: "completed" },
  { label: "Voided", value: "voided" },
];

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

export function PurchaseSupplierPaymentsPageClient(): JSX.Element {
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
  const paymentsQuery = useSupplierPayments(filters, canView && branchScope.hasBranchScope);
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
  );
  const createPaymentMutation = useCreateSupplierPayment();
  const updatePaymentMutation = useUpdateSupplierPayment();
  const deletePaymentMutation = useDeleteSupplierPayment();
  const purchasingPaymentMethods = methodsQuery.data ?? [];
  const isPermissionDenied =
    paymentsQuery.error instanceof ApiError && paymentsQuery.error.status === 403;
  const payableInvoices = useMemo(() => {
    if (!selectedSupplierId) return [];

    return editingPaymentId
      ? mergeEditableInvoices(payableInvoicesQuery.data ?? [], editingPaymentQuery.data)
      : (payableInvoicesQuery.data ?? []).filter(
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
      ? mergeEditableInvoices(result.data ?? [], editingPaymentQuery.data)
      : (result.data ?? []).filter(
          (invoice) => invoice.status === "posted" && invoice.balanceAmount > 0,
        );
  };

  const openEditPayment = (payment: SupplierPayment): void => {
    setEditingPaymentId(payment.id);
    setSelectedPaymentBranchId(payment.branchId);
    setSelectedSupplierId(payment.supplierId);
    setManualDialogOpen(true);
  };

  const deletePayment = async (payment: SupplierPayment): Promise<void> => {
    const confirmed = window.confirm(
      "This will permanently delete the supplier payment and remove its effect from supplier outstanding, bill balances, supplier advance, and accounting records. This cannot be undone.",
    );
    if (!confirmed) return;

    try {
      await deletePaymentMutation.mutateAsync(payment.id);
      toast.success("Payment made deleted.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

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

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1.4fr_repeat(6,minmax(0,1fr))]">
        <Input
          aria-label="Search supplier payments"
          onChange={(event) => updateFilters({ search: event.target.value })}
          placeholder="Search supplier, reference, method..."
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

      {!paymentsQuery.isLoading &&
      !paymentsQuery.error &&
      (paymentsQuery.data ?? []).length === 0 ? (
        <PurchaseEmptyState title="No payments made found." />
      ) : null}

      {!paymentsQuery.isLoading && !paymentsQuery.error && (paymentsQuery.data ?? []).length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PurchaseSupplierPaymentsTable
              onDelete={(payment) => {
                void deletePayment(payment);
              }}
              onEdit={openEditPayment}
              payments={paymentsQuery.data ?? []}
            />
          </CardContent>
        </Card>
      ) : null}

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
