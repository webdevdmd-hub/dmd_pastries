"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/packaging/access-denied-card";
import { PackagingEmptyState } from "@/components/packaging/packaging-empty-state";
import { PackagingErrorState } from "@/components/packaging/packaging-error-state";
import { PackagingFormDialog } from "@/components/packaging/packaging-form-dialog";
import { PackagingSummaryCards } from "@/components/packaging/packaging-summary-cards";
import { PackagingTable } from "@/components/packaging/packaging-table";
import { PackagingTableSkeleton } from "@/components/packaging/packaging-table-skeleton";
import { PackagingToolbar } from "@/components/packaging/packaging-toolbar";
import { FilteredState } from "@/components/shared/collection-state";
import { LegacyProductMasterNotice } from "@/components/shared/legacy-product-master-notice";
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
import { ROUTES } from "@/constants/routes";
import {
  useCreatePackaging,
  useDeletePackaging,
  usePackaging,
  usePackagingCategories,
  usePackagingSupplierLookup,
  usePackagingUnits,
  useUpdatePackaging,
  useUpdatePackagingStatus,
} from "@/hooks/use-packaging";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import {
  getHistoryDeleteConflictMessage,
  isHistoryDeleteConflict,
} from "@/lib/api/delete-conflicts";
import type {
  CreatePackagingPayload,
  PackagingFilters,
  PackagingItem,
  PackagingStatus,
  UpdatePackagingPayload,
} from "@/types/packaging";

const defaultFilters: PackagingFilters = {
  categoryId: "all",
  search: "",
  status: "all",
  stockTracked: "all",
  supplierId: "all",
};

type PendingAction =
  | { item: PackagingItem; status: PackagingStatus; type: "status" }
  | { item: PackagingItem; type: "delete" }
  | null;

export function PackagingPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const canView = hasAnyPermission([PERMISSIONS.packagingView, PERMISSIONS.masterDataView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.packagingCreate,
    PERMISSIONS.packagingEdit,
    PERMISSIONS.packagingDelete,
    PERMISSIONS.packagingStatusUpdate,
    PERMISSIONS.packagingUsageRulesManage,
  ]);
  const [filters, setFilters] = useState<PackagingFilters>(defaultFilters);
  const [editingItem, setEditingItem] = useState<PackagingItem | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const packagingQuery = usePackaging(filters, canView);
  const categoriesQuery = usePackagingCategories(canView);
  const suppliersQuery = usePackagingSupplierLookup("", canView);
  const unitsQuery = usePackagingUnits(canView);
  const createMutation = useCreatePackaging();
  const updateMutation = useUpdatePackaging();
  const statusMutation = useUpdatePackagingStatus();
  const deleteMutation = useDeletePackaging();
  const isPermissionDenied =
    packagingQuery.error instanceof ApiError && packagingQuery.error.status === 403;
  // Every field in this toolbar is user-chosen, so every field counts. There is
  // no branch scope and no paging here to exclude.
  const hasActiveFilters =
    filters.search.trim().length > 0 ||
    filters.categoryId !== defaultFilters.categoryId ||
    filters.supplierId !== defaultFilters.supplierId ||
    filters.status !== defaultFilters.status ||
    filters.stockTracked !== defaultFilters.stockTracked;

  if (!canView) {
    return <AccessDeniedCard />;
  }

  const handleCreate = async (payload: CreatePackagingPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Packaging item created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdatePackagingPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Packaging item updated.");
      setEditingItem(null);
      setFormOpen(false);
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
          id: pendingAction.item.id,
          payload: { status: pendingAction.status },
        });
        toast.success("Packaging status updated.");
      } else {
        await deleteMutation.mutateAsync(pendingAction.item.id);
        toast.success("Packaging item deleted.");
      }
      setPendingAction(null);
    } catch (error) {
      toast.error(
        pendingAction.type === "delete" && isHistoryDeleteConflict(error)
          ? getHistoryDeleteConflictMessage("packaging item")
          : getErrorMessage(error),
      );
      setPendingAction(null);
    }
  };

  const categories = categoriesQuery.data ?? [];
  const items = (packagingQuery.data ?? []).map((item) => ({
    ...item,
    packagingCategoryName:
      item.packagingCategoryName !== "Uncategorized"
        ? item.packagingCategoryName
        : (categories.find((category) => category.id === item.packagingCategoryId)?.categoryName ??
          item.packagingCategoryName),
  }));
  const suppliers = suppliersQuery.data ?? [];
  const units = unitsQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Packaging"
        description="Manage packaging items like boxes, cups, trays, labels, and their usage in products and orders."
        actions={
          canManage ? (
            <Button asChild type="button">
              <Link href={ROUTES.productsPackaging}>
                Open Product Master
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          ) : undefined
        }
      />

      <LegacyProductMasterNotice kind="packaging" />

      <PackagingSummaryCards items={items} />

      <PackagingToolbar
        categories={categories}
        filters={filters}
        onFiltersChange={setFilters}
        suppliers={suppliers}
      />

      {packagingQuery.isLoading ? <PackagingTableSkeleton /> : null}

      {!packagingQuery.isLoading && packagingQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to the packaging endpoint." />
        ) : (
          <PackagingErrorState
            description={getErrorMessage(packagingQuery.error)}
            onRetry={() => {
              void packagingQuery.refetch();
            }}
          />
        )
      ) : null}

      {/* Empty and filtered need opposite remedies. "No packaging yet" is a lie
          when the catalogue is full and the user simply ticked "Stock tracked".
          DESIGN.md 8. */}
      {!packagingQuery.isLoading &&
      !packagingQuery.error &&
      items.length === 0 &&
      hasActiveFilters ? (
        <FilteredState
          noun="packaging items"
          onClearFilters={() => setFilters(defaultFilters)}
          query={filters.search.trim() || undefined}
        />
      ) : null}

      {!packagingQuery.isLoading &&
      !packagingQuery.error &&
      items.length === 0 &&
      !hasActiveFilters ? (
        <PackagingEmptyState canManage={false} onCreate={() => undefined} />
      ) : null}

      {!packagingQuery.isLoading && !packagingQuery.error && items.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <PackagingTable
              canManage={canManage}
              items={items}
              onDelete={(item) => setPendingAction({ item, type: "delete" })}
              onEdit={(item) => {
                setEditingItem(item);
                setFormOpen(true);
              }}
              onStatusChange={(item, status) => setPendingAction({ item, status, type: "status" })}
            />
          </CardContent>
        </Card>
      ) : null}

      <PackagingFormDialog
        categories={categories}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        item={editingItem}
        onClose={() => {
          setEditingItem(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onUpdate={handleUpdate}
        open={formOpen}
        suppliers={suppliers}
        units={units}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {pendingAction?.type === "delete"
                ? "Delete packaging item"
                : "Change packaging status"}
            </DialogTitle>
            <DialogDescription>
              {pendingAction?.type === "delete"
                ? "This soft-deletes the packaging item from active catalog workflows."
                : `Update ${pendingAction?.item.packagingName ?? "packaging item"} to ${pendingAction?.status ?? "status"}?`}
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
