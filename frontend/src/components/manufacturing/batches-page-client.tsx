"use client";

import { Plus } from "lucide-react";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import { BatchFormDialog } from "@/components/manufacturing/batch-form-dialog";
import { BatchesTable } from "@/components/manufacturing/batches-table";
import { ManufacturingEmptyState } from "@/components/manufacturing/manufacturing-empty-state";
import { ManufacturingErrorState } from "@/components/manufacturing/manufacturing-error-state";
import { ManufacturingTableSkeleton } from "@/components/manufacturing/manufacturing-table-skeleton";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
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
import {
  useBatches,
  useCancelBatch,
  useCompleteBatch,
  useCreateBatch,
  useDeleteBatch,
  useManufacturingBranches,
  useManufacturingProducts,
  useManufacturingRecipeByProduct,
  useStartBatch,
  useUpdateBatch,
} from "@/hooks/use-manufacturing";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import type {
  BatchFilters,
  CreateBatchPayload,
  ProductionBatch,
  UpdateBatchPayload,
} from "@/types/manufacturing";

const defaultFilters: BatchFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  productId: "all",
  search: "",
  status: "all",
};

type PendingAction = {
  batch: ProductionBatch;
  type: "start" | "complete" | "cancel" | "delete";
} | null;

export function BatchesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.manufacturingView, PERMISSIONS.inventoryView]);
  const canManage = hasAnyPermission([
    PERMISSIONS.manufacturingBatchesCreate,
    PERMISSIONS.manufacturingBatchesEdit,
    PERMISSIONS.manufacturingBatchesDelete,
    PERMISSIONS.manufacturingBatchesStart,
    PERMISSIONS.manufacturingBatchesComplete,
    PERMISSIONS.manufacturingBatchesCancel,
  ]);
  const [filters, setFilters] = useState<BatchFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const batchesQuery = useBatches(filters, canView && branchScope.hasBranchScope);
  const productsQuery = useManufacturingProducts(canView);
  const branchesQuery = useManufacturingBranches(canView);
  const recipesQuery = useManufacturingRecipeByProduct(selectedProductId, canView);
  const createMutation = useCreateBatch();
  const updateMutation = useUpdateBatch();
  const startMutation = useStartBatch();
  const completeMutation = useCompleteBatch();
  const cancelMutation = useCancelBatch();
  const deleteMutation = useDeleteBatch();
  const isPermissionDenied =
    batchesQuery.error instanceof ApiError && batchesQuery.error.status === 403;

  const branchOptions = useMemo(
    () =>
      (branchesQuery.data ?? []).filter(
        (branch) => branchScope.canAccessAllBranches || branchScope.isBranchAllowed(branch.id),
      ),
    [branchScope, branchesQuery.data],
  );

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

  const openCreate = (): void => {
    setEditingBatch(null);
    setSelectedProductId("");
    setFormOpen(true);
  };

  const updateFilter = (patch: Partial<BatchFilters>): void => {
    setFilters({ ...filters, ...patch });
  };

  const handleCreate = async (payload: CreateBatchPayload): Promise<void> => {
    try {
      await createMutation.mutateAsync(payload);
      toast.success("Production batch created.");
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleUpdate = async (id: string, payload: UpdateBatchPayload): Promise<void> => {
    try {
      await updateMutation.mutateAsync({ id, payload });
      toast.success("Production batch updated.");
      setEditingBatch(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const confirmAction = async (): Promise<void> => {
    if (!pendingAction) return;

    try {
      if (pendingAction.type === "start") await startMutation.mutateAsync(pendingAction.batch.id);
      if (pendingAction.type === "complete") {
        await completeMutation.mutateAsync(pendingAction.batch.id);
      }
      if (pendingAction.type === "cancel") await cancelMutation.mutateAsync(pendingAction.batch.id);
      if (pendingAction.type === "delete") await deleteMutation.mutateAsync(pendingAction.batch.id);
      toast.success("Batch action completed.");
      setPendingAction(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const batches = batchesQuery.data ?? [];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-6">
      <PageHeader
        title="Production Batches"
        description="Track production lifecycle, ingredient consumption, outputs, and wastage."
        actions={
          canManage ? (
            <Button onClick={openCreate} type="button">
              <Plus className="h-4 w-4" />
              Create Batch
            </Button>
          ) : undefined
        }
      />

      <div className="grid gap-3 rounded-2xl border border-brand-cappuccino/60 bg-white/80 p-4 lg:grid-cols-[1.4fr_repeat(5,minmax(0,1fr))]">
        <Input
          aria-label="Search batches"
          onChange={(event) => updateFilter({ search: event.target.value })}
          placeholder="Search batch number, product..."
          value={filters.search}
        />
        <Select
          value={filters.productId}
          onValueChange={(productId) => updateFilter({ productId })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Product" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All products</SelectItem>
            {(productsQuery.data ?? []).map((product) => (
              <SelectItem key={product.id} value={product.id}>
                {product.productName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filters.branchId} onValueChange={(branchId) => updateFilter({ branchId })}>
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
          value={filters.status}
          onValueChange={(status) => updateFilter({ status: status as BatchFilters["status"] })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="in_progress">In progress</SelectItem>
            <SelectItem value="partially_completed">Partially completed</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="cancelled">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Input
          aria-label="Date from"
          onChange={(event) => updateFilter({ dateFrom: event.target.value })}
          type="date"
          value={filters.dateFrom}
        />
        <div className="flex gap-3">
          <Input
            aria-label="Date to"
            onChange={(event) => updateFilter({ dateTo: event.target.value })}
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

      {batchesQuery.isLoading ? <ManufacturingTableSkeleton /> : null}

      {!batchesQuery.isLoading && batchesQuery.error ? (
        isPermissionDenied ? (
          <AccessDeniedCard message="The backend denied access to manufacturing batches." />
        ) : (
          <ManufacturingErrorState
            description={getErrorMessage(batchesQuery.error)}
            onRetry={() => {
              void batchesQuery.refetch();
            }}
          />
        )
      ) : null}

      {!batchesQuery.isLoading && !batchesQuery.error && batches.length === 0 ? (
        <ManufacturingEmptyState
          actionLabel={canManage ? "Create Batch" : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      ) : null}

      {!batchesQuery.isLoading && !batchesQuery.error && batches.length > 0 ? (
        <Card>
          <CardContent className="p-0">
            <BatchesTable
              batches={batches}
              canManage={canManage}
              onCancel={(batch) => setPendingAction({ batch, type: "cancel" })}
              onComplete={(batch) => setPendingAction({ batch, type: "complete" })}
              onDelete={(batch) => setPendingAction({ batch, type: "delete" })}
              onEdit={(batch) => {
                setEditingBatch(batch);
                setSelectedProductId(batch.productId);
                setFormOpen(true);
              }}
              onStart={(batch) => setPendingAction({ batch, type: "start" })}
            />
          </CardContent>
        </Card>
      ) : null}

      <BatchFormDialog
        batch={editingBatch}
        branches={branchOptions}
        isSubmitting={createMutation.isPending || updateMutation.isPending}
        onClose={() => {
          setEditingBatch(null);
          setFormOpen(false);
        }}
        onCreate={handleCreate}
        onProductChange={setSelectedProductId}
        onUpdate={handleUpdate}
        open={formOpen}
        products={productsQuery.data ?? []}
        recipes={recipesQuery.data ?? []}
      />

      <Dialog
        open={pendingAction !== null}
        onOpenChange={(open) => (!open ? setPendingAction(null) : undefined)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm batch action</DialogTitle>
            <DialogDescription>
              Continue with {pendingAction?.type ?? "this action"} for{" "}
              {pendingAction?.batch.batchNumber ?? "this batch"}?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setPendingAction(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              disabled={
                startMutation.isPending ||
                completeMutation.isPending ||
                cancelMutation.isPending ||
                deleteMutation.isPending
              }
              onClick={() => void confirmAction()}
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
