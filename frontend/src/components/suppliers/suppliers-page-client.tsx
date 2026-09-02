"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { FilteredState } from "@/components/shared/collection-state";
import { PageHeader } from "@/components/shared/page-header";
import { AccessDeniedCard } from "@/components/suppliers/access-denied-card";
import { SupplierFormDialog } from "@/components/suppliers/supplier-form-dialog";
import {
  type SupplierPendingAction,
  SupplierStatusConfirmDialog,
} from "@/components/suppliers/supplier-status-confirm-dialog";
import { SuppliersAttentionStrip } from "@/components/suppliers/suppliers-attention-strip";
import { SuppliersEmptyState } from "@/components/suppliers/suppliers-empty-state";
import { SuppliersErrorState } from "@/components/suppliers/suppliers-error-state";
import { SuppliersPagination } from "@/components/suppliers/suppliers-pagination";
import { SuppliersTable } from "@/components/suppliers/suppliers-table";
import { SuppliersTableSkeleton } from "@/components/suppliers/suppliers-table-skeleton";
import { SuppliersToolbar } from "@/components/suppliers/suppliers-toolbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PERMISSIONS } from "@/constants/permissions";
import { usePermission } from "@/hooks/use-permission";
import {
  useCreateSupplier,
  useDeleteSupplier,
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
  status: "all",
  country: "",
  missingTermsOnly: false,
};

const PAGE_SIZE = 10;

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
  const [page, setPage] = useState(1);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<SupplierPendingAction>(null);
  const suppliersQuery = useSuppliers(filters, canView);
  const createMutation = useCreateSupplier();
  const updateMutation = useUpdateSupplier();
  const statusMutation = useUpdateSupplierStatus();
  const deleteMutation = useDeleteSupplier();
  const isPermissionDenied =
    suppliersQuery.error instanceof ApiError && suppliersQuery.error.status === 403;
  // Zero rows has two causes with opposite remedies. All three fields are
  // toolbar choices; this screen carries no branch scope to exclude.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.status !== defaultFilters.status ||
    filters.country.trim().length > 0 ||
    filters.missingTermsOnly;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  // Any filter change returns to page 1: page 3 of the old result set is
  // rarely page 3 of the new one, and silently landing there looks like the
  // filter dropped rows.
  const applyFilters = (next: SupplierFilters): void => {
    setFilters(next);
    setPage(1);
  };

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

  const handleUpdate = async (
    id: string,
    payload: UpdateSupplierPayload,
    nextStatus?: SupplierStatus,
  ): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });

      if (nextStatus) {
        await statusMutation.mutateAsync({ id, payload: { status: nextStatus } });
      }

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

  const loaded = suppliersQuery.data?.items ?? [];
  // Applied here rather than server-side: see SupplierFilters.missingTermsOnly.
  const suppliers = filters.missingTermsOnly
    ? loaded.filter((supplier) => supplier.status !== "blocked" && supplier.paymentTerms === "")
    : loaded;
  const total = suppliersQuery.data?.total ?? loaded.length;
  const pageCount = Math.max(1, Math.ceil(suppliers.length / PAGE_SIZE));
  // A filter that shrinks the result set can strand the viewer on a page that
  // no longer exists; clamping in render alone would show an empty table for
  // one frame before the state caught up.
  const safePage = Math.min(page, pageCount);
  const pageRows = suppliers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

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

      <SuppliersAttentionStrip
        onFilterMissingTerms={() => applyFilters({ ...filters, missingTermsOnly: true })}
        onFilterStatus={(status) => applyFilters({ ...filters, status })}
        suppliers={loaded}
        total={total}
      />

      <SuppliersToolbar filters={filters} onFiltersChange={applyFilters} />

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

      {/* A country or status that matched nothing is not an empty supplier book,
          and "Add Supplier" is the wrong next step for it. DESIGN.md 8. */}
      {!suppliersQuery.isLoading &&
      !suppliersQuery.error &&
      suppliers.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="suppliers"
          onClearFilters={() => applyFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!suppliersQuery.isLoading &&
      !suppliersQuery.error &&
      suppliers.length === 0 &&
      !hasActiveFilters ? (
        <SuppliersEmptyState canManage={canManage} onCreate={openCreate} />
      ) : null}

      {!suppliersQuery.isLoading && !suppliersQuery.error && suppliers.length > 0 ? (
        <Card className="overflow-hidden">
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
              suppliers={pageRows}
            />
          </CardContent>
          <SuppliersPagination
            loaded={suppliers.length}
            onPageChange={setPage}
            page={safePage}
            pageSize={PAGE_SIZE}
            total={total}
          />
        </Card>
      ) : null}

      <SupplierFormDialog
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

      <SupplierStatusConfirmDialog
        isSubmitting={statusMutation.isPending || deleteMutation.isPending}
        onCancel={() => setPendingAction(null)}
        onConfirm={() => {
          void confirmAction();
        }}
        pendingAction={pendingAction}
      />
    </div>
  );
}
