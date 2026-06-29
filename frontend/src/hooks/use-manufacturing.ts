"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  addBatchWastage,
  cancelBatch,
  completeBatch,
  consumeBatch,
  createBatch,
  createProduction,
  deleteBatch,
  getBatchById,
  getBatches,
  getBatchIngredients,
  getBatchOutputs,
  getBatchPackaging,
  getBatchWastage,
  getManufacturingBranches,
  getManufacturingInventory,
  getManufacturingProducts,
  getManufacturingRecipeByProduct,
  getManufacturingSummary,
  getManufacturingUnits,
  produceBatch,
  startBatch,
  updateBatch,
  updateBatchStatus,
} from "@/lib/api/manufacturing";
import { invalidateManufacturingData } from "@/lib/query-invalidation";
import type {
  BatchFilters,
  ConsumePayload,
  CreateBatchPayload,
  CreateProductionPayload,
  ManufacturingBranchOption,
  ManufacturingInventoryOption,
  ManufacturingProductOption,
  ManufacturingRecipeOption,
  ManufacturingSummary,
  ManufacturingUnitOption,
  ProducePayload,
  ProductionBatch,
  ProductionBatchIngredient,
  ProductionBatchPackaging,
  ProductionOutput,
  ProductionWastage,
  UpdateBatchPayload,
  UpdateBatchStatusPayload,
  WastagePayload,
} from "@/types/manufacturing";

const manufacturingQueryKey = "manufacturing";

export function useManufacturingSummary(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ManufacturingSummary>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "summary"],
    queryFn: async () => getManufacturingSummary(),
    enabled,
  });
}

export function useBatches(filters: BatchFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductionBatch[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "batches", filters],
    queryFn: async () => getBatches(filters),
    enabled,
  });
}

export function useBatch(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductionBatch>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "batch", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Batch ID is required.");
      }

      return getBatchById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useBatchIngredients(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductionBatchIngredient[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "ingredients", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Batch ID is required.");
      }

      return getBatchIngredients(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useBatchPackaging(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductionBatchPackaging[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "packaging", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Batch ID is required.");
      }

      return getBatchPackaging(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useBatchOutputs(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductionOutput[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "outputs", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Batch ID is required.");
      }

      return getBatchOutputs(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useBatchWastage(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductionWastage[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "wastage", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Batch ID is required.");
      }

      return getBatchWastage(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useManufacturingProducts(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ManufacturingProductOption[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "products"],
    queryFn: async () => getManufacturingProducts(),
    enabled,
  });
}

export function useManufacturingRecipeByProduct(productId: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ManufacturingRecipeOption[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "recipe-by-product", productId],
    queryFn: async () => getManufacturingRecipeByProduct(productId),
    enabled: enabled && productId.trim().length > 0,
  });
}

export function useManufacturingInventory(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ManufacturingInventoryOption[]>({
    queryKey: [manufacturingQueryKey, branchQueryKey, "inventory"],
    queryFn: async () => getManufacturingInventory(),
    enabled,
  });
}

export function useManufacturingUnits(enabled = true) {
  return useQuery<ManufacturingUnitOption[]>({
    queryKey: [manufacturingQueryKey, "units"],
    queryFn: async () => getManufacturingUnits(),
    enabled,
  });
}

export function useManufacturingBranches(enabled = true) {
  return useQuery<ManufacturingBranchOption[]>({
    queryKey: [manufacturingQueryKey, "branches"],
    queryFn: async () => getManufacturingBranches(),
    enabled,
  });
}

function invalidateManufacturing(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return invalidateManufacturingData(queryClient);
}

export function useCreateBatch() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, CreateBatchPayload>({
    mutationFn: async (payload) => createBatch(payload),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useCreateProduction() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, CreateProductionPayload>({
    mutationFn: async (payload) => createProduction(payload),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useUpdateBatch() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, { id: string; payload: UpdateBatchPayload }>({
    mutationFn: async ({ id, payload }) => updateBatch(id, payload),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useUpdateBatchStatus() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, { id: string; payload: UpdateBatchStatusPayload }>({
    mutationFn: async ({ id, payload }) => updateBatchStatus(id, payload),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useDeleteBatch() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteBatch(id),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useStartBatch() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, string>({
    mutationFn: async (id) => startBatch(id),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useCompleteBatch() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, string>({
    mutationFn: async (id) => completeBatch(id),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useCancelBatch() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, string>({
    mutationFn: async (id) => cancelBatch(id),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useConsumeBatch() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, { id: string; payload: ConsumePayload }>({
    mutationFn: async ({ id, payload }) => consumeBatch(id, payload),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useProduceBatch() {
  const queryClient = useQueryClient();

  return useMutation<ProductionBatch, Error, { id: string; payload: ProducePayload }>({
    mutationFn: async ({ id, payload }) => produceBatch(id, payload),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}

export function useAddBatchWastage() {
  const queryClient = useQueryClient();

  return useMutation<ProductionWastage, Error, { id: string; payload: WastagePayload }>({
    mutationFn: async ({ id, payload }) => addBatchWastage(id, payload),
    onSuccess: async () => {
      await invalidateManufacturing(queryClient);
    },
  });
}
