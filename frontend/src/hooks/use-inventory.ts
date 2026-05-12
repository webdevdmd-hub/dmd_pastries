"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  adjustStock,
  createExpiryBatch,
  createOpeningStock,
  getExpiryAlerts,
  getExpiryBatches,
  getInventory,
  getInventoryById,
  getInventoryItemMovements,
  getInventoryMovements,
  getLowStock,
  updateExpiryBatch,
  updateExpiryBatchStatus,
} from "@/lib/api/inventory";
import type {
  CreateExpiryBatchPayload,
  ExpiryAlertFilters,
  ExpiryBatch,
  InventoryFilters,
  InventoryItem,
  LowStockFilters,
  OpeningStockPayload,
  StockAdjustmentPayload,
  StockMovement,
  StockMovementFilters,
  UpdateExpiryBatchPayload,
  UpdateExpiryBatchStatusPayload,
} from "@/types/inventory";

const inventoryQueryKey = "inventory";

function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [inventoryQueryKey] })]);
}

export function useInventory(filters: InventoryFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [inventoryQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getInventory(filters),
    enabled,
  });
}

export function useInventoryItem(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [inventoryQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Inventory item ID is required.");
      }

      return getInventoryById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useCreateOpeningStock() {
  const queryClient = useQueryClient();

  return useMutation<InventoryItem, Error, OpeningStockPayload>({
    mutationFn: async (payload) => createOpeningStock(payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useAdjustStock() {
  const queryClient = useQueryClient();

  return useMutation<
    InventoryItem,
    Error,
    {
      id: string;
      payload: StockAdjustmentPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => adjustStock(id, payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useInventoryMovements(filters: StockMovementFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockMovement[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "movements", filters],
    queryFn: async () => getInventoryMovements(filters),
    enabled,
  });
}

export function useInventoryItemMovements(
  id: string | null,
  filters: Partial<StockMovementFilters>,
  enabled = true,
) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockMovement[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "movements", "item", id, filters],
    queryFn: async () => {
      if (!id) {
        throw new Error("Inventory item ID is required.");
      }

      return getInventoryItemMovements(id, filters);
    },
    enabled: enabled && id !== null,
  });
}

export function useLowStock(filters: LowStockFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<InventoryItem[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "low-stock", filters],
    queryFn: async () => getLowStock(filters),
    enabled,
  });
}

export function useExpiryAlerts(filters: ExpiryAlertFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ExpiryBatch[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "expiry-alerts", filters],
    queryFn: async () => getExpiryAlerts(filters),
    enabled,
  });
}

export function useExpiryBatches(inventoryItemId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ExpiryBatch[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "expiry-batches", inventoryItemId],
    queryFn: async () => {
      if (!inventoryItemId) {
        throw new Error("Inventory item ID is required.");
      }

      return getExpiryBatches(inventoryItemId);
    },
    enabled: enabled && inventoryItemId !== null,
  });
}

export function useCreateExpiryBatch() {
  const queryClient = useQueryClient();

  return useMutation<
    ExpiryBatch,
    Error,
    {
      inventoryItemId: string;
      payload: CreateExpiryBatchPayload;
    }
  >({
    mutationFn: async ({ inventoryItemId, payload }) => createExpiryBatch(inventoryItemId, payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useUpdateExpiryBatch() {
  const queryClient = useQueryClient();

  return useMutation<
    ExpiryBatch,
    Error,
    {
      batchId: string;
      payload: UpdateExpiryBatchPayload;
    }
  >({
    mutationFn: async ({ batchId, payload }) => updateExpiryBatch(batchId, payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useUpdateExpiryBatchStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    ExpiryBatch,
    Error,
    {
      batchId: string;
      payload: UpdateExpiryBatchStatusPayload;
    }
  >({
    mutationFn: async ({ batchId, payload }) => updateExpiryBatchStatus(batchId, payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}
