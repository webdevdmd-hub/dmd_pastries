"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/shared/page-header";
import { AccessDeniedCard } from "@/components/suppliers/access-denied-card";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import { SuppliersEmptyState } from "@/components/suppliers/suppliers-empty-state";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SuppliersSummaryCards } from "@/components/suppliers/suppliers-summary-cards";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { SuppliersTableSkeleton } from "@/components/suppliers/suppliers-table-skeleton";
import { SuppliersToolbar } from "@/components/suppliers/suppliers-toolbar";
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
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateSupplier,
  useDeleteSupplier,
  useSupplierCategories,
  useSuppliers,
  useUpdateSupplier,
  useUpdateSupplierStatus,
} from "@/hooks/use-suppliers";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  CreateSupplierPayload,
  Supplier,
  SupplierFilters,
  SupplierStatus,
  UpdateSupplierPayload,
} from "@/types/supplier";

const defaultFilters: SupplierFilters = {
  search: "",
  supplierCategoryId: "all",
  status: "all",
  country: "",
};

type PendingAction =
  | { type: "status"; supplier: Supplier; status: SupplierStatus }
  | { type: "delete"; supplier: Supplier }
  | null;

export function SuppliersPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.suppliersView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.suppliersCreate,
    PERMISSIONS.suppliersEdit,
    PERMISSIONS.suppliersDelete,
    PERMISSIONS.suppliersStatusUpdate,
    PERMISSIONS.suppliersContactsManage,
    PERMISSIONS.suppliersNotesManage,
  ]);
  const [filters, setFilters] = useState<SupplierFilters>(defaultFilters);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const suppliersQuery = useSuppliers(filters, canView);
  const categoriesQuery = useSupplierCategories(canView);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const statusMutation = useUpdateSupplierStatus();
  const deleteMutation = useDeleteSupplier();
  const isPermissionDenied =
    suppliersQuery.error instanceof ApiError && suppliersQuery.error.status === 403;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const openCreate = (): void => {
    setEditingSupplier(null);
    setFormOpen(true);
  };

  const handleCreate = async (payload: CreateSupplierPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Supplier created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateSupplierPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Supplier updated.");
      setFormOpen(false);
      setEditingSupplier(null);
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
          id: pendingAction.supplier.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Supplier status updated.");
      } else {
        await deleteMutation.mutateAsync(pendingAction.supplier.id);
        toast.success("Supplier deleted.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const suppliers = suppliersQuery.data ?? [];
  const categories = categoriesQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Suppliers"
        description="Manage ingredient, packaging, equipment, logistics, and service suppliers."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Add Supplier
            </Button>
          ) : undefined
        }
      />

      <SuppliersSummaryCards categories={categories} suppliers={suppliers} />

      <SuppliersToolbar categories={categories} filters={filters} onFiltersChange={setFilters} />

      {suppliersQuery.isLoading ? <SuppliersTableSkeleton /> : null}

      {!suppliersQuery.isLoading && suppliersQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the suppliers endpoint." />
        ) : (
          <SuppliersErrorState
            description={getErrorMessage(suppliersQuery.error)}
            onRetry={() => {
              void suppliersQuery.refetch();
            }}
          />
        )
      ) : null}

      {!suppliersQuery.isLoading && !suppliersQuery.error && suppliers.length === 0 ? (
        <SuppliersEmptyState canManage={canManage} onCreate={openCreate} />
      ) : null}

      {!suppliersQuery.isLoading && !suppliersQuery.error && suppliers.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <SuppliersTable
              canManage={canManage}
              onDelete={(supplier) => setPendingAction({ type: "delete", supplier })}
              onEdit={(supplier) => {
                setEditingSupplier(supplier);
                setFormOpen(true);
              }}
              onStatusChange={(supplier, status) =>
                setPendingAction({ type: "status", supplier, status })
              }
              suppliers={suppliers}
            />
          </CardContent>
        </Card>
      ) : null}

      <SupplierFormDialog
        categories={categories}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setFormOpen(false);
          setEditingSupplier(null);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
        supplier={editingSupplier}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete" ? "Delete supplier" : "Change supplier status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This soft-deletes the supplier from active purchasing workflows."
                : `Update ${pendingAction?.supplier.supplierName ?? "supplier"} to ${pendingAction?.status ?? "status"}?`}
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
