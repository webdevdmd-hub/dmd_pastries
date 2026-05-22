"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  cancelHeldSale,
  checkoutPOS,
  getHeldSaleById,
  getHeldSales,
  holdSalePOS,
  resumeHeldSale,
} from "@/lib/api/pos";
import type {
  CheckoutPayload,
  CheckoutResponse,
  HeldSale,
  HeldSaleResumeData,
  HoldSalePayload,
} from "@/types/pos";

export function usePOSCheckout() {
  return useMutation<CheckoutResponse, Error, CheckoutPayload>({
    mutationFn: async (payload) => checkoutPOS(payload),
  });
}

export function useHeldSales(enabled: boolean) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<HeldSale[]>({
    queryKey: ["pos", branchQueryKey, "held-sales"],
    queryFn: getHeldSales,
    enabled,
  });
}

export function useHeldSaleDetails(heldSaleId: string | null, enabled: boolean) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<HeldSaleResumeData>({
    queryKey: ["pos", branchQueryKey, "held-sales", heldSaleId],
    queryFn: async () => {
      if (!heldSaleId) {
        throw new Error("Held sale id is required.");
      }

      return getHeldSaleById(heldSaleId);
    },
    enabled: enabled && heldSaleId !== null,
  });
}

export function useHoldSale() {
  const queryClient = useQueryClient();

  return useMutation<HeldSale, Error, HoldSalePayload>({
    mutationFn: holdSalePOS,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos"] });
    },
  });
}

export function useResumeHeldSale() {
  const queryClient = useQueryClient();

  return useMutation<HeldSaleResumeData, Error, string>({
    mutationFn: resumeHeldSale,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos"] });
    },
  });
}

export function useCancelHeldSale() {
  const queryClient = useQueryClient();

  return useMutation<HeldSale, Error, string>({
    mutationFn: cancelHeldSale,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["pos"] });
    },
  });
}
