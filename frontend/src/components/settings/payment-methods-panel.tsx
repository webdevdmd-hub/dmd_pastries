"use client";

import { CreditCard, Plus } from "lucide-react";
import type { JSX } from "react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

import { useConfirm } from "@/components/app/confirm-provider";
import { PaymentMethodDetailsDrawer } from "@/components/settings/payment-method-details-drawer";
import { PaymentMethodDialog } from "@/components/settings/payment-method-dialog";
import { PaymentMethodsCardGrid } from "@/components/settings/payment-methods-card-grid";
import { PaymentMethodsTable } from "@/components/settings/payment-methods-table";
import { EmptyState, FailedState, FilteredState } from "@/components/shared/collection-state";
import { FilterField, FilterToolbar } from "@/components/shared/filter-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PERMISSIONS } from "@/constants/permissions";
import { usePaymentAccounts } from "@/hooks/use-accounting";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreatePaymentMethod,
  useDeletePaymentMethod,
  usePaymentMethod,
  usePaymentMethods,
  useUpdatePaymentMethod,
  useUpdatePaymentMethodStatus,
} from "@/hooks/use-settings-data";
import { getErrorMessage } from "@/lib/api/client";
import type { PaymentAccountsFilters } from "@/types/accounting";
import type { CreatePaymentMethodPayload, PaymentMethod, RecordStatus } from "@/types/settings";

const paymentAccountsForMethodsFilters: PaymentAccountsFilters = {
  accountType: "all",
  branchId: "",
  limit: 100,
  page: 1,
  search: "",
  sortBy: "account_name",
  sortOrder: "asc",
  status: "active",
};

type MethodFilters = {
  search: string;
  status: RecordStatus | "all";
};

const defaultFilters: MethodFilters = { search: "", status: "all" };

/**
 * The Methods tab of payment setup: the list, its drawer, and its form. The
 * list endpoint returns every method, so search and status filter here.
 */
export function PaymentMethodsPanel(): JSX.Element {
  const confirm = useConfirm();
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([
    PERMISSIONS.settingsView,
    PERMISSIONS.settingsPaymentMethodsManage,
  ]);
  const canManage = hasAnyPermission([PERMISSIONS.settingsPaymentMethodsManage]);
  const [filters, setFilters] = useState<MethodFilters>(defaultFilters);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedMethod, setSelectedMethod] = useState<PaymentMethod | null>(null);
  const [detailsMethod, setDetailsMethod] = useState<PaymentMethod | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const methodsQuery = usePaymentMethods(canView);
  const accountsQuery = usePaymentAccounts(paymentAccountsForMethodsFilters, canView && dialogOpen);
  // The list row is enough for the drawer; the form wants the fresh record.
  const methodDetailQuery = usePaymentMethod(selectedMethod?.id ?? null, canView && dialogOpen);
  const createMutation = useCreatePaymentMethod();
  const updateMutation = useUpdatePaymentMethod();
  const statusMutation = useUpdatePaymentMethodStatus();
  const deleteMutation = useDeletePaymentMethod();
  const submitting =
    createMutation.isPending ||
    updateMutation.isPending ||
    statusMutation.isPending ||
    deleteMutation.isPending;

  const allMethods = useMemo(() => methodsQuery.data ?? [], [methodsQuery.data]);
  const methods = useMemo(() => {
    const query = filters.search.trim().toLowerCase();
    return allMethods.filter(
      (method) =>
        (filters.status === "all" || method.status === filters.status) &&
        (query.length === 0 ||
          method.methodName.toLowerCase().includes(query) ||
          method.methodType.toLowerCase().includes(query)),
    );
  }, [allMethods, filters]);
  const hiddenFilterCount = filters.status !== "all" ? 1 : 0;
  const hasAnyFilter = hiddenFilterCount > 0 || filters.search.trim().length > 0;

  const openCreate = (): void => {
    setSelectedMethod(null);
    setDialogOpen(true);
  };

  const openDetails = (method: PaymentMethod): void => {
    setDetailsMethod(method);
    setDetailsOpen(true);
  };

  const openEdit = (method: PaymentMethod): void => {
    // A form on top of a sheet on top of the list is one layer too many, so
    // the drawer closes first. Closing or saving then lands on the list.
    setDetailsOpen(false);
    setSelectedMethod(method);
    setDialogOpen(true);
  };

  const submitMethod = async (payload: CreatePaymentMethodPayload): Promise<void> => {
    try {
      if (selectedMethod) {
        await updateMutation.mutateAsync({ id: selectedMethod.id, payload });
        toast.success("Payment method updated.");
      } else {
        await createMutation.mutateAsync(payload);
        toast.success("Payment method created.");
      }
      setDialogOpen(false);
      setSelectedMethod(null);
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      throw new Error(message);
    }
  };

  const changeStatus = async (method: PaymentMethod, status: RecordStatus): Promise<void> => {
    try {
      await statusMutation.mutateAsync({ id: method.id, payload: { status } });
      toast.success(`Payment method marked ${status}.`);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const deactivate = async (method: PaymentMethod): Promise<void> => {
    setDetailsOpen(false);
    const confirmed = await confirm({
      cancelLabel: "Keep active",
      confirmLabel: "Deactivate method",
      consequence: `${method.methodName} stops appearing at the counter and on new payments. Payments already taken with it are unchanged, and it can be reactivated later.`,
      title: `Deactivate ${method.methodName}?`,
      tone: "default",
    });

    if (!confirmed) {
      return;
    }

    try {
      await deleteMutation.mutateAsync(method.id);
      toast.success("Payment method deactivated.");
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const listHandlers = {
    canManage,
    methods,
    onDeactivate: (method: PaymentMethod) => {
      void deactivate(method);
    },
    onEdit: openEdit,
    onStatusChange: (method: PaymentMethod, status: RecordStatus) => {
      void changeStatus(method, status);
    },
    onView: openDetails,
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h2 className="text-title">Payment methods</h2>
          <p className="text-cell text-foreground-muted">
            Manage how customers pay and connect each method to a payment account.
          </p>
        </div>
        {canManage ? (
          <Button onClick={openCreate} type="button">
            <Plus className="h-4 w-4" />
            Create payment method
          </Button>
        ) : null}
      </div>

      <FilterToolbar
        hasAnyFilter={hasAnyFilter}
        hiddenFilterCount={hiddenFilterCount}
        hideDensityBelowMd
        onReset={() => setFilters(defaultFilters)}
        onSearchChange={(search) => setFilters((current) => ({ ...current, search }))}
        popoverTitle="Filter payment methods"
        searchAriaLabel="Search payment methods"
        searchPlaceholder="Search name or type..."
        searchValue={filters.search}
      >
        <FilterField htmlFor="paymentMethodsFilterStatus" label="Status">
          <Select
            onValueChange={(status) =>
              setFilters((current) => ({ ...current, status: status as MethodFilters["status"] }))
            }
            value={filters.status}
          >
            <SelectTrigger id="paymentMethodsFilterStatus">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </FilterField>
      </FilterToolbar>

      {methodsQuery.isLoading ? (
        <Card>
          <CardContent className="p-6 text-cell text-foreground-muted">
            Loading payment methods...
          </CardContent>
        </Card>
      ) : null}

      {methodsQuery.error ? (
        <FailedState
          detail={getErrorMessage(methodsQuery.error)}
          noun="payment methods"
          onRetry={() => {
            void methodsQuery.refetch();
          }}
        />
      ) : null}

      {!methodsQuery.isLoading && !methodsQuery.error && methods.length === 0 && hasAnyFilter ? (
        <FilteredState
          noun="payment methods"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
          totalCount={allMethods.length}
        />
      ) : null}

      {!methodsQuery.isLoading && !methodsQuery.error && methods.length === 0 && !hasAnyFilter ? (
        <EmptyState
          action={canManage ? { label: "Create payment method", onClick: openCreate } : undefined}
          description="Payment methods are the ways a customer can pay, such as cash, card or bank transfer, and each one links to the account its money is recorded in."
          icon={CreditCard}
          title="No payment methods yet"
        />
      ) : null}

      {/* Cards below md, the table from md up. */}
      {!methodsQuery.isLoading && !methodsQuery.error && methods.length > 0 ? (
        <>
          <div className="md:hidden">
            <PaymentMethodsCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <PaymentMethodsTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <PaymentMethodDetailsDrawer
        canManage={canManage}
        method={detailsMethod}
        onEdit={openEdit}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
      />

      <PaymentMethodDialog
        method={methodDetailQuery.data ?? selectedMethod}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedMethod(null);
          }
        }}
        onSubmit={submitMethod}
        open={dialogOpen}
        paymentAccounts={accountsQuery.data?.items ?? []}
        submitting={submitting}
      />
    </div>
  );
}
