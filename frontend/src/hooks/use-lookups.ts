"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  getLookups,
  getProductPicker,
  type LookupKind,
  type Lookups,
  type ProductPickerParams,
} from "@/lib/api/lookups";
import { QUERY_ROOTS } from "@/lib/query-invalidation";
import type { ProductListResponse } from "@/types/product";

/**
 * Reference lists for a form. Keyed under the roots the owning modules
 * invalidate (master-data, settings, branches), so editing a category in
 * Master Data refreshes every open form's dropdown too.
 */
export function useLookups(kinds: readonly LookupKind[], enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Lookups>({
    queryKey: [QUERY_ROOTS.masterData, branchQueryKey, "lookups", [...kinds].sort()],
    queryFn: async () => getLookups(kinds),
    enabled: enabled && kinds.length > 0,
  });
}

/** Products for a form's dropdown. Keyed under the products root. */
export function useProductPicker(params: ProductPickerParams = {}, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductListResponse>({
    queryKey: [QUERY_ROOTS.products, branchQueryKey, "picker", params],
    queryFn: async () => getProductPicker(params),
    enabled,
  });
}
