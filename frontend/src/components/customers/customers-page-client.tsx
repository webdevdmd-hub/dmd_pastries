"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/customers/access-denied-card";
import { CustomerDetailsDrawer } from "@/components/customers/customer-details-drawer";
import { CustomerFormDialog } from "@/components/customers/customer-form-dialog";
import { CustomersCardGrid } from "@/components/customers/customers-card-grid";
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
  // The id, not the customer: the drawer fetches the detail record itself, so
  // it shows tags, stats and notes the list rows do not carry.
  const [detailsCustomerId, setDetailsCustomerId] = useState<string | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
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

  const openDetails = (customer: Customer): void => {
    setDetailsCustomerId(customer.id);
    setDetailsOpen(true);
  };

  const openEdit = (customer: Customer): void => {
    // The drawer may be open underneath; a form on top of a sheet on top of
    // the list is one layer too many, so the drawer closes first. Closing or
    // saving the form then lands back on the list.
    setDetailsOpen(false);
    setEditingCustomer(customer);
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
  const listHandlers = {
    canManage,
    customers,
    onDelete: (customer: Customer) => setPendingAction({ type: "delete", customer }),
    onEdit: openEdit,
    onStatusChange: (customer: Customer, status: CustomerStatus) =>
      setPendingAction({ type: "status", customer, status }),
    onView: openDetails,
  };

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

      {/* A ten-column ledger has no honest phone layout. Below md the list is
          cards carrying the same fields; the table takes over from md up. */}
      {!customersQuery.isLoading && !customersQuery.error && customers.length > 0 ? (
        <>
          <div className="md:hidden">
            <CustomersCardGrid {...listHandlers} />
          </div>
          <Card className="hidden overflow-hidden md:block">
            <CardContent className="p-0">
              <CustomersTable {...listHandlers} />
            </CardContent>
          </Card>
        </>
      ) : null}

      <CustomerDetailsDrawer
        customerId={detailsCustomerId}
        onEdit={openEdit}
        onOpenChange={setDetailsOpen}
        open={detailsOpen}
      />

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
