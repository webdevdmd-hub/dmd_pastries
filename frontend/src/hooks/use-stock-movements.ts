"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  createManualMovement,
  getInventoryAudit,
  getInventoryItemMovements,
  getStockMovementById,
  getStockMovements,
  getStockMovementSummary,
  reverseStockMovement,
} from "@/lib/api/stock-movements";
import type {
  AuditResult,
  ManualMovementPayload,
  MovementSummary,
  ReversalPayload,
  StockMovement,
  StockMovementFilters,
  StockMovementSummaryParams,
} from "@/types/stock-movements";

const stockMovementsQueryKey = "stock-movements";
const inventoryQueryKey = "inventory";

function invalidateStockMovements(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [stockMovementsQueryKey] }),
    queryClient.invalidateQueries({ queryKey: [inventoryQueryKey] }),
  ]);
}

export function useStockMovements(filters: StockMovementFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockMovement[]>({
    queryKey: [stockMovementsQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getStockMovements(filters),
    enabled,
  });
}

export function useStockMovement(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockMovement>({
    queryKey: [stockMovementsQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Stock movement ID is required.");
      }

      return getStockMovementById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useInventoryItemMovements(
  inventoryItemId: string | null,
  filters: Partial<StockMovementFilters>,
  enabled = true,
) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<StockMovement[]>({
    queryKey: [stockMovementsQueryKey, branchQueryKey, "inventory-item", inventoryItemId, filters],
    queryFn: async () => {
      if (!inventoryItemId) {
        throw new Error("Inventory item ID is required.");
      }

      return getInventoryItemMovements(inventoryItemId, filters);
    },
    enabled: enabled && inventoryItemId !== null,
  });
}

export function useCreateManualMovement() {
  const queryClient = useQueryClient();

  return useMutation<StockMovement, Error, ManualMovementPayload>({
    mutationFn: async (payload) => createManualMovement(payload),
    onSuccess: async () => {
      await invalidateStockMovements(queryClient);
    },
  });
}

export function useReverseStockMovement() {
  const queryClient = useQueryClient();

  return useMutation<
    StockMovement,
    Error,
    {
      id: string;
      payload: ReversalPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => reverseStockMovement(id, payload),
    onSuccess: async () => {
      await invalidateStockMovements(queryClient);
    },
  });
}

export function useStockMovementSummary(params: StockMovementSummaryParams, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<MovementSummary>({
    queryKey: [stockMovementsQueryKey, branchQueryKey, "summary", params],
    queryFn: async () => getStockMovementSummary(params),
    enabled,
  });
}

export function useInventoryAudit(inventoryItemId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<AuditResult>({
    queryKey: [stockMovementsQueryKey, branchQueryKey, "audit", inventoryItemId],
    queryFn: async () => {
      if (!inventoryItemId) {
        throw new Error("Inventory item ID is required.");
      }

      return getInventoryAudit(inventoryItemId);
    },
    enabled: enabled && inventoryItemId !== null,
  });
}
