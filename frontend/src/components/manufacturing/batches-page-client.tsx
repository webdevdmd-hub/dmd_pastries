"use client";

import { BarChart3, Factory, Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import type { JSX } from "react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { AccessDeniedCard } from "@/components/manufacturing/access-denied-card";
import { BatchFormDialog } from "@/components/manufacturing/batch-form-dialog";
import { BatchWastageDialog } from "@/components/manufacturing/batch-wastage-dialog";
import { BatchesTable } from "@/components/manufacturing/batches-table";
import { ManufacturingEmptyState } from "@/components/manufacturing/manufacturing-empty-state";
import { ManufacturingErrorState } from "@/components/manufacturing/manufacturing-error-state";
import { ManufacturingTableSkeleton } from "@/components/manufacturing/manufacturing-table-skeleton";
import { NoBranchScopeCard } from "@/components/shared/no-branch-scope-card";
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
import { ROUTES } from "@/constants/routes";
import { useBranchScope } from "@/hooks/use-branch-scope";
import {
  useAddBatchWastage,
  useBatches,
  useCreateBatch,
  useCreateProduction,
  useDeleteBatch,
  useManufacturingBranches,
  useManufacturingInventory,
  useManufacturingProducts,
  useManufacturingRecipeByProduct,
  useProduceBatch,
  useUpdateBatch,
} from "@/hooks/use-manufacturing";
import { usePermission } from "@/hooks/use-permission";
import { ApiError, getErrorMessage } from "@/lib/api/client";
import { canProduceBatch } from "@/lib/manufacturing/batch-status";
import { productionFailureMessage } from "@/lib/manufacturing/production-errors";
import type {
  BatchFilters,
  CreateBatchPayload,
  CreateProductionPayload,
  ProducePayload,
  ProductionBatch,
  UpdateBatchPayload,
  WastagePayload,
} from "@/types/manufacturing";

const defaultFilters: BatchFilters = {
  branchId: "",
  dateFrom: "",
  dateTo: "",
  productId: "all",
  search: "",
  status: "all",
};

function formatMetric(value: number): string {
  return new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value);
}

export function BatchesPageClient(): JSX.Element {
  const { hasAnyPermission } = usePermission();
  const branchScope = useBranchScope();
  const { normalizeBranchId } = branchScope;
  const canView = hasAnyPermission([PERMISSIONS.manufacturingView, PERMISSIONS.inventoryView]);
  const canCreate = hasAnyPermission([PERMISSIONS.manufacturingBatchesCreate]);
  const canEdit = hasAnyPermission([PERMISSIONS.manufacturingBatchesEdit]);
  const canProduce = hasAnyPermission([PERMISSIONS.manufacturingBatchesProduce]);
  const canDelete = hasAnyPermission([PERMISSIONS.manufacturingBatchesDelete]);
  const canRecordWastage = hasAnyPermission([PERMISSIONS.manufacturingBatchesWastage]);
  const [filters, setFilters] = useState<BatchFilters>({
    ...defaultFilters,
    branchId: branchScope.defaultBranchId,
  });
  const [selectedProductId, setSelectedProductId] = useState("");
  const [editingBatch, setEditingBatch] = useState<ProductionBatch | null>(null);
  const [deleteBatchTarget, setDeleteBatchTarget] = useState<ProductionBatch | null>(null);
  const [wastageBatch, setWastageBatch] = useState<ProductionBatch | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [producingBatchId, setProducingBatchId] = useState<string | null>(null);
  const batchesQuery = useBatches(filters, canView && branchScope.hasBranchScope);
  const productsQuery = useManufacturingProducts(canView);
  const branchesQuery = useManufacturingBranches(canView);
  const recipesQuery = useManufacturingRecipeByProduct(selectedProductId, canView);
  const inventoryQuery = useManufacturingInventory(canView && canRecordWastage);
  const createPlannedMutation = useCreateBatch();
  const createProductionMutation = useCreateProduction();
  const updateBatchMutation = useUpdateBatch();
  const produceBatchMutation = useProduceBatch();
  const deleteBatchMutation = useDeleteBatch();
  const addWastageMutation = useAddBatchWastage();
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

  const openEdit = (batch: ProductionBatch): void => {
    setEditingBatch(batch);
    setSelectedProductId(batch.productId);
    setFormOpen(true);
  };

  const updateFilter = (patch: Partial<BatchFilters>): void => {
    setFilters({ ...filters, ...patch });
  };

  const handleCreatePlanned = async (payload: CreateBatchPayload): Promise<void> => {
    try {
      await createPlannedMutation.mutateAsync(payload);
      toast.success("Planned production saved.");
      setFormOpen(false);
    } catch (error) {
      toast.error(productionFailureMessage(error));
    }
  };

  const handleProduceNow = async (payload: CreateProductionPayload): Promise<void> => {
    await createProductionMutation.mutateAsync(payload);
    toast.success("Production completed.");
    setFormOpen(false);
  };

  const handleUpdate = async (id: string, payload: UpdateBatchPayload): Promise<void> => {
    try {
      await updateBatchMutation.mutateAsync({ id, payload });
      toast.success("Planned production updated.");
      setEditingBatch(null);
      setFormOpen(false);
    } catch (error) {
      toast.error(productionFailureMessage(error));
    }
  };

  const handleProducePlanned = async (
    id: string,
    producePayload: ProducePayload,
  ): Promise<void> => {
    await produceBatchMutation.mutateAsync({ id, payload: producePayload });
    toast.success("Planned production produced.");
    setEditingBatch(null);
    setFormOpen(false);
  };

  const handleProducePlannedFromRow = async (batch: ProductionBatch): Promise<void> => {
    if (produceBatchMutation.isPending || producingBatchId !== null) {
      return;
    }

    if (!canProduceBatch(batch)) {
      toast.error("Only planned, draft, or in-progress batches without output can be produced.");
      return;
    }

    setProducingBatchId(batch.id);
    try {
      await produceBatchMutation.mutateAsync({
        id: batch.id,
        payload: {
          ...(batch.productionDate ? { productionDate: batch.productionDate.slice(0, 10) } : {}),
          ...(batch.notes ? { notes: batch.notes } : {}),
          quantityProduced: batch.plannedQuantity,
        },
      });
      toast.success("Planned production produced.");
    } catch (error) {
      toast.error(productionFailureMessage(error));
    } finally {
      setProducingBatchId(null);
    }
  };

  const confirmDelete = async (): Promise<void> => {
    if (!deleteBatchTarget) {
      return;
    }

    try {
      await deleteBatchMutation.mutateAsync(deleteBatchTarget.id);
      toast.success("Planned production deleted.");
      setDeleteBatchTarget(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const handleWastage = async (payload: WastagePayload): Promise<void> => {
    if (!wastageBatch) {
      return;
    }

    try {
      await addWastageMutation.mutateAsync({ id: wastageBatch.id, payload });
      toast.success("Wastage recorded.");
      setWastageBatch(null);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  const batches = batchesQuery.data ?? [];
  const batchMetrics = {
    completed: batches.filter((batch) => batch.status === "completed").length,
    inProgress: batches.filter(
      (batch) => batch.status === "in_progress" || batch.status === "partially_completed",
    ).length,
    planned: batches.reduce((total, batch) => total + batch.plannedQuantity, 0),
    produced: batches.reduce((total, batch) => total + batch.producedQuantity, 0),
    total: batches.length,
    wastage: batches.reduce((total, batch) => total + batch.wastageQuantity, 0),
  };
  const metricCards = [
    { label: "Total Batches", meta: "visible", value: formatMetric(batchMetrics.total) },
    { label: "In Progress", meta: "active", value: formatMetric(batchMetrics.inProgress) },
    { label: "Completed", meta: "closed", value: formatMetric(batchMetrics.completed) },
    {
      label: "Wastage Recorded",
      meta: "units",
      tone: "danger",
      value: formatMetric(batchMetrics.wastage),
    },
    { label: "Planned Output", meta: "units", value: formatMetric(batchMetrics.planned) },
    { label: "Produced Output", meta: "units", value: formatMetric(batchMetrics.produced) },
  ];

  return (
    <div className="mx-auto flex max-w-7xl flex-col gap-7">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.22em] text-neutral-500">
            Manufacturing
          </p>
          <h1 className="mt-2 text-4xl font-semibold tracking-tight text-neutral-950">
            Production
          </h1>
          <p className="mt-2 max-w-2xl text-base text-neutral-600">
            Choose a recipe and output quantity. Component consumption, packaging consumption,
            output stock, costing, and accounting are handled automatically by the backend.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            asChild
            className="border-neutral-300 bg-white text-neutral-950 hover:bg-neutral-100"
            variant="outline"
          >
            <Link href={ROUTES.reportsManufacturing}>
              <BarChart3 className="h-4 w-4" />
              View Reports
            </Link>
          </Button>
          {canCreate ? (
            <Button
              className="bg-black text-white hover:bg-neutral-800"
              onClick={openCreate}
              type="button"
            >
              <Factory className="h-4 w-4" />
              Create Production
            </Button>
          ) : null}
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {metricCards.map((metric) => (
          <section
            className="rounded-2xl border border-neutral-300 bg-white p-5"
            key={metric.label}
          >
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-neutral-500">
              {metric.label}
            </p>
            <div className="mt-4 flex items-end gap-2">
              <p
                className={
                  metric.tone === "danger"
                    ? "font-mono text-4xl font-semibold leading-none text-red-600"
                    : "font-mono text-4xl font-semibold leading-none text-neutral-950"
                }
              >
                {metric.value}
              </p>
              <p className="pb-1 text-sm text-neutral-500">{metric.meta}</p>
            </div>
          </section>
        ))}
      </div>

      <div className="rounded-2xl border border-neutral-300 bg-white p-5">
        <div className="grid gap-4 lg:grid-cols-[1.5fr_repeat(5,minmax(0,1fr))]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500" />
            <Input
              aria-label="Search batches"
              className="pl-10"
              onChange={(event) => updateFilter({ search: event.target.value })}
              placeholder="Batch ID or product..."
              value={filters.search}
            />
          </div>
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
              <SelectItem value="draft">Draft planned</SelectItem>
              <SelectItem value="planned">Planned</SelectItem>
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
          <Input
            aria-label="Date to"
            onChange={(event) => updateFilter({ dateTo: event.target.value })}
            type="date"
            value={filters.dateTo}
          />
        </div>
        <div className="mt-4 flex items-center justify-between gap-3">
          <Button className="border-neutral-300" type="button" variant="ghost">
            <SlidersHorizontal className="h-4 w-4" />
            Filter options
          </Button>
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
          actionLabel={canCreate ? "Create Production" : undefined}
          onAction={canCreate ? openCreate : undefined}
        />
      ) : null}

      {!batchesQuery.isLoading && !batchesQuery.error && batches.length > 0 ? (
        <Card className="overflow-hidden rounded-2xl border-neutral-300 bg-white shadow-none">
          <CardContent className="p-0">
            <BatchesTable
              batches={batches}
              canDelete={canDelete}
              canEdit={canEdit}
              canProduce={canProduce}
              canRecordWastage={canRecordWastage}
              onDelete={setDeleteBatchTarget}
              onEdit={openEdit}
              onProduce={(batch) => {
                void handleProducePlannedFromRow(batch);
              }}
              onWastage={setWastageBatch}
              producingBatchId={producingBatchId}
            />
          </CardContent>
        </Card>
      ) : null}

      <BatchFormDialog
        batch={editingBatch}
        branches={branchOptions}
        canProducePlanned={canProduce}
        isSubmitting={
          createPlannedMutation.isPending ||
          createProductionMutation.isPending ||
          produceBatchMutation.isPending ||
          updateBatchMutation.isPending
        }
        onClose={() => {
          setEditingBatch(null);
          setFormOpen(false);
        }}
        onCreatePlanned={handleCreatePlanned}
        onProductChange={setSelectedProductId}
        onProducePlanned={handleProducePlanned}
        onProduceNow={handleProduceNow}
        onUpdate={handleUpdate}
        open={formOpen}
        products={productsQuery.data ?? []}
        recipes={recipesQuery.data ?? []}
      />

      <BatchWastageDialog
        inventory={inventoryQuery.data ?? []}
        isSubmitting={addWastageMutation.isPending}
        onClose={() => setWastageBatch(null)}
        onWastage={handleWastage}
        open={wastageBatch !== null}
      />

      <Dialog
        onOpenChange={(open) => {
          if (!open) {
            setDeleteBatchTarget(null);
          }
        }}
        open={deleteBatchTarget !== null}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete planned production?</DialogTitle>
            <DialogDescription>
              This production has not posted stock or accounting yet. Deleting it cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button onClick={() => setDeleteBatchTarget(null)} type="button" variant="outline">
              Cancel
            </Button>
            <Button
              className="bg-red-700 text-white hover:bg-red-800"
              disabled={deleteBatchMutation.isPending}
              onClick={() => void confirmDelete()}
              type="button"
            >
              Delete planned production
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
