"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  adjustStock,
  cancelStockTransfer,
  completeStockTransfer,
  createExpiryBatch,
  createOpeningStock,
  createStockLocation,
  createStockTransfer,
  deleteStockLocation,
  getExpiryAlerts,
  getExpiryBatches,
  getInventory,
  getInventoryById,
  getInventoryItemLocationBalances,
  getInventoryItemMovements,
  getInventoryMovements,
  getLocationBalances,
  getStockLocationById,
  getStockLocations,
  getStockTransferById,
  getStockTransfers,
  setDefaultStockLocation,
  updateExpiryBatch,
  updateExpiryBatchStatus,
  updateStockLocation,
  updateStockLocationStatus,
} from "@/lib/api/inventory";
import { invalidateInventoryData } from "@/lib/query-invalidation";
import type {
  CreateExpiryBatchPayload,
  ExpiryAlertFilters,
  ExpiryBatch,
  InventoryFilters,
  InventoryItem,
  InventoryItemLocationBreakdown,
  InventoryStatus,
  LocationBalance,
  LocationBalanceFilters,
  OpeningStockPayload,
  StockAdjustmentPayload,
  StockLocation,
  StockLocationPayload,
  StockMovement,
  StockMovementFilters,
  StockTransfer,
  StockTransferFilters,
  StockTransferPayload,
  UpdateExpiryBatchPayload,
  UpdateExpiryBatchStatusPayload,
} from "@/types/inventory";

const inventoryQueryKey = "inventory";

function invalidateInventory(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return invalidateInventoryData(queryClient);
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

export function useStockLocations(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockLocation[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "stock-locations"],
    queryFn: getStockLocations,
    enabled,
  });
}

export function useStockLocation(locationId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockLocation>({
    queryKey: [inventoryQueryKey, branchQueryKey, "stock-location", locationId],
    queryFn: async () => {
      if (!locationId) {
        throw new Error("Stock location ID is required.");
      }

      return getStockLocationById(locationId);
    },
    enabled: enabled && locationId !== null,
  });
}

export function useCreateStockLocation() {
  const queryClient = useQueryClient();

  return useMutation<StockLocation, Error, StockLocationPayload>({
    mutationFn: async (payload) => createStockLocation(payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useUpdateStockLocation() {
  const queryClient = useQueryClient();

  return useMutation<
    StockLocation,
    Error,
    {
      locationId: string;
      payload: StockLocationPayload;
    }
  >({
    mutationFn: async ({ locationId, payload }) => updateStockLocation(locationId, payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useUpdateStockLocationStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    StockLocation,
    Error,
    {
      locationId: string;
      status: InventoryStatus;
    }
  >({
    mutationFn: async ({ locationId, status }) => updateStockLocationStatus(locationId, status),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useSetDefaultStockLocation() {
  const queryClient = useQueryClient();

  return useMutation<StockLocation, Error, string>({
    mutationFn: async (locationId) => setDefaultStockLocation(locationId),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useDeleteStockLocation() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (locationId) => deleteStockLocation(locationId),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useLocationBalances(filters: LocationBalanceFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<LocationBalance[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "location-balances", filters],
    queryFn: async () => getLocationBalances(filters),
    enabled,
  });
}

export function useInventoryItemLocationBalances(inventoryItemId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<InventoryItemLocationBreakdown>({
    queryKey: [inventoryQueryKey, branchQueryKey, "location-balances", inventoryItemId],
    queryFn: async () => {
      if (!inventoryItemId) {
        throw new Error("Inventory item ID is required.");
      }

      return getInventoryItemLocationBalances(inventoryItemId);
    },
    enabled: enabled && inventoryItemId !== null,
  });
}

export function useStockTransfers(filters: StockTransferFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockTransfer[]>({
    queryKey: [inventoryQueryKey, branchQueryKey, "stock-transfers", filters],
    queryFn: async () => getStockTransfers(filters),
    enabled,
  });
}

export function useStockTransfer(transferId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockTransfer>({
    queryKey: [inventoryQueryKey, branchQueryKey, "stock-transfer", transferId],
    queryFn: async () => {
      if (!transferId) {
        throw new Error("Stock transfer ID is required.");
      }

      return getStockTransferById(transferId);
    },
    enabled: enabled && transferId !== null,
  });
}

export function useCreateStockTransfer() {
  const queryClient = useQueryClient();

  return useMutation<StockTransfer, Error, StockTransferPayload>({
    mutationFn: async (payload) => createStockTransfer(payload),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useCompleteStockTransfer() {
  const queryClient = useQueryClient();

  return useMutation<StockTransfer, Error, string>({
    mutationFn: async (transferId) => completeStockTransfer(transferId),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}

export function useCancelStockTransfer() {
  const queryClient = useQueryClient();

  return useMutation<StockTransfer, Error, string>({
    mutationFn: async (transferId) => cancelStockTransfer(transferId),
    onSuccess: async () => {
      await invalidateInventory(queryClient);
    },
  });
}
