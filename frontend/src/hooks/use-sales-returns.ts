"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  cancelSalesReturn,
  createSalesReturn,
  getReturnableSaleItems,
  getSaleSalesReturns,
  getSalesReturnById,
  getSalesReturns,
  postSalesReturn,
  reverseSalesReturn,
  updateSalesReturn,
} from "@/lib/api/sales-returns";
import { invalidatePosTransactionData } from "@/lib/query-invalidation";
import type {
  CreateSalesReturnPayload,
  ReturnableSaleItem,
  ReverseSalesReturnPayload,
  SalesReturn,
  SalesReturnFilters,
} from "@/types/sales-return";

const salesReturnsQueryKey = "sales-returns";

function invalidateSalesReturnData(
  queryClient: ReturnType<typeof useQueryClient>,
): Promise<unknown[]> {
  return invalidatePosTransactionData(queryClient);
}

export function useSalesReturns(filters: SalesReturnFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SalesReturn[]>({
    queryKey: [salesReturnsQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getSalesReturns(filters),
    enabled,
  });
}

export function useSalesReturn(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SalesReturn>({
    queryKey: [salesReturnsQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Sales return ID is required.");
      }

      return getSalesReturnById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useReturnableSaleItems(saleId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ReturnableSaleItem[]>({
    queryKey: [salesReturnsQueryKey, branchQueryKey, "returnable-items", saleId],
    queryFn: async () => {
      if (!saleId) {
        throw new Error("Sale ID is required.");
      }

      return getReturnableSaleItems(saleId);
    },
    enabled: enabled && saleId !== null,
  });
}

export function useSaleSalesReturns(saleId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<SalesReturn[]>({
    queryKey: [salesReturnsQueryKey, branchQueryKey, "sale", saleId],
    queryFn: async () => {
      if (!saleId) {
        throw new Error("Sale ID is required.");
      }

      return getSaleSalesReturns(saleId);
    },
    enabled: enabled && saleId !== null,
  });
}

export function useCreateSalesReturn() {
  const queryClient = useQueryClient();

  return useMutation<SalesReturn, Error, CreateSalesReturnPayload>({
    mutationFn: async (payload) => createSalesReturn(payload),
    onSuccess: async () => {
      await invalidateSalesReturnData(queryClient);
    },
  });
}

export function useUpdateSalesReturn() {
  const queryClient = useQueryClient();

  return useMutation<
    SalesReturn,
    Error,
    {
      id: string;
      payload: CreateSalesReturnPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateSalesReturn(id, payload),
    onSuccess: async () => {
      await invalidateSalesReturnData(queryClient);
    },
  });
}

export function usePostSalesReturn() {
  const queryClient = useQueryClient();

  return useMutation<SalesReturn, Error, string>({
    mutationFn: async (id) => postSalesReturn(id),
    onSuccess: async () => {
      await invalidateSalesReturnData(queryClient);
    },
  });
}

export function useCancelSalesReturn() {
  const queryClient = useQueryClient();

  return useMutation<SalesReturn, Error, string>({
    mutationFn: async (id) => cancelSalesReturn(id),
    onSuccess: async () => {
      await invalidateSalesReturnData(queryClient);
    },
  });
}

export function useReverseSalesReturn() {
  const queryClient = useQueryClient();

  return useMutation<
    SalesReturn,
    Error,
    {
      id: string;
      payload: ReverseSalesReturnPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => reverseSalesReturn(id, payload),
    onSuccess: async () => {
      await invalidateSalesReturnData(queryClient);
    },
  });
}
