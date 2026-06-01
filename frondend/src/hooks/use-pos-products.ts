"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import { getPaymentMethods, getPOSCategories, getPOSProducts } from "@/lib/api/pos";
import type { POSProductFilters, POSReferenceData } from "@/types/pos";

const posQueryKey = "pos";

export function usePOSProducts(filters: POSProductFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [posQueryKey, branchQueryKey, "products", filters],
    queryFn: async () => getPOSProducts(filters),
    enabled,
  });
}

export function usePOSReferenceData(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<POSReferenceData>({
    queryKey: [posQueryKey, branchQueryKey, "reference-data"],
    queryFn: async () => {
      const [categories, paymentMethods] = await Promise.all([
        getPOSCategories(),
        getPaymentMethods(),
      ]);

      return {
        categories,
        paymentMethods,
      };
    },
    enabled,
  });
}
