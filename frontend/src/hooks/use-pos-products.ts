"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  filterPOSProducts,
  getPOSPaymentMethods,
  getPOSProductCatalog,
  getPOSReferenceData,
} from "@/lib/api/pos";
import type { POSProductFilters, POSReferenceData } from "@/types/pos";
import type { PaymentMethod } from "@/types/settings";

const posQueryKey = "pos";

export function usePOSProducts(filters: POSProductFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  // Keyed on what the request actually sends, so the register's two views of
  // the catalogue share one fetch; each applies its own filter in select.
  return useQuery({
    queryKey: [posQueryKey, branchQueryKey, "products", filters.itemStructure ?? "all"],
    queryFn: async () => getPOSProductCatalog(filters.itemStructure),
    select: (products) => filterPOSProducts(products, filters),
    enabled,
  });
}

export function usePOSPaymentMethods(branchId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PaymentMethod[]>({
    queryKey: [posQueryKey, branchQueryKey, "payment-methods", branchId ?? "current"],
    queryFn: async () => getPOSPaymentMethods(branchId),
    enabled,
  });
}

export function usePOSReferenceData(branchId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<POSReferenceData>({
    queryKey: [posQueryKey, branchQueryKey, "reference-data", branchId ?? "current"],
    queryFn: async () => getPOSReferenceData(branchId),
    enabled,
  });
}
