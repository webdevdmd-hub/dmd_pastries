"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/customers/access-denied-card";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomersEmptyState } from "@/components/customers/customers-empty-state";
import { CustomersErrorState } from "@/components/customers/customers-error-state";
import { CustomersSummaryCards } from "@/components/customers/customers-summary-cards";
import { CustomersTable } from "@/components/customers/customers-table";
import { CustomersTableSkeleton } from "@/components/customers/customers-table-skeleton";
import { CustomersToolbar } from "@/components/customers/customers-toolbar";
import { FilteredState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { PERMISSIONS } from "@/constants/permissions";
import {
  useCreateCustomer,
  useCustomers,
  useCustomerTags,
  useDeleteCustomer,
  useUpdateCustomer,
  useUpdateCustomerStatus,
} from "@/hooks/use-customers";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  CreateCustomerPayload,
  Customer,
  CustomerFilters,
  CustomerStatus,
  UpdateCustomerPayload,
} from "@/types/customer";

const defaultFilters: CustomerFilters = {
  search: "",
  status: "all",
  tagId: "all",
  dateFrom: "",
  dateTo: "",
};

type PendingAction =
  | { type: "status"; customer: Customer; status: CustomerStatus }
  | { type: "delete"; customer: Customer }
  | null;

export function CustomersPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.customersView, PERMISSIONS.posView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.customersCreate,
    PERMISSIONS.customersEdit,
    PERMISSIONS.customersDelete,
    PERMISSIONS.customersStatusUpdate,
    PERMISSIONS.customersNotesManage,
    PERMISSIONS.customersTagsManage,
    PERMISSIONS.posSell,
  ]);
  const [filters, setFilters] = useState<CustomerFilters>(defaultFilters);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const customersQuery = useCustomers(filters, canView);
  const tagsQuery = useCustomerTags(canView);
  const createMutation = useCreateCustomer();
  const updateMutation = useUpdateCustomer();
  const statusMutation = useUpdateCustomerStatus();
  const deleteMutation = useDeleteCustomer();
  const isPermissionDenied =
    customersQuery.error instanceof ApiError && customersQuery.error.status === 403;
  // Zero rows has two causes with opposite remedies. Every field here is a
  // choice the user made in the toolbar; there is no branch scope on this
  // screen, so nothing has to be excluded.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== defaultFilters.status ||
    filters.tagId !== defaultFilters.tagId ||
    filters.dateFrom.length > 0 ||
    filters.dateTo.length > 0;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const openCreate = (): void => {
    setEditingCustomer(null);
    setFormOpen(true);
  };

  const handleCreate = async (payload: CreateCustomerPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Customer created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateCustomerPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Customer updated.");
      setFormOpen(false);
      setEditingCustomer(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) {
      return;
    }

    try {
      if (pendingAction.type === "status") {
        await statusMutation.mutateAsync({
          id: pendingAction.customer.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Customer status updated.");
      } else {
        await deleteMutation.mutateAsync(pendingAction.customer.id);
        toast.success("Customer deleted.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const customers = customersQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Customers"
        description="Manage customer profiles, contact details, notes, purchase history, and POS lookup."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Add Customer
            </Button>
          ) : undefined
        }
      />

      <CustomersSummaryCards customers={customers} />

      <CustomersToolbar
        filters={filters}
        onFiltersChange={setFilters}
        tags={tagsQuery.data ?? []}
      />

      {customersQuery.isLoading ? <CustomersTableSkeleton /> : null}

      {!customersQuery.isLoading && customersQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the customers endpoint." />
        ) : (
          <CustomersErrorState
            description={getErrorMessage(customersQuery.error)}
            onRetry={() => {
              void customersQuery.refetch();
            }}
          />
        )
      ) : null}

      {/* "No customers yet" is a lie when a tag or date range excluded them, and
          it offers "Add Customer" to someone who already has hundreds. DESIGN.md 8. */}
      {!customersQuery.isLoading &&
      !customersQuery.error &&
      customers.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="customers"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!customersQuery.isLoading &&
      !customersQuery.error &&
      customers.length === 0 &&
      !hasActiveFilters ? (
        <CustomersEmptyState canManage={canManage} onCreate={openCreate} />
      ) : null}

      {!customersQuery.isLoading && !customersQuery.error && customers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <CustomersTable
              canManage={canManage}
              customers={customers}
              onDelete={(customer) => setPendingAction({ type: "delete", customer })}
              onEdit={(customer) => {
                setEditingCustomer(customer);
                setFormOpen(true);
              }}
              onStatusChange={(customer, status) =>
                setPendingAction({ type: "status", customer, status })
              }
            />
          </CardContent>
        </Card>
      ) : null}

      <CustomerFormDialog
        customer={editingCustomer}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditingCustomer(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete" ? "Delete customer" : "Change customer status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This soft-deletes the customer from active customer workflows."
                : `Update ${pendingAction?.customer.fullName ?? "customer"} to ${pendingAction?.status ?? "status"}?`}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={statusMutation.isPending || deleteMutation.isPending}
              onClick={() => {
                void confirmAction();
              }}
              type="button"
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
