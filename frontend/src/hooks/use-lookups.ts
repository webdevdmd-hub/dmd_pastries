"use client";

import { useQuery } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  getLookups,
  getProductPicker,
  getUserPicker,
  type LookupKind,
  type Lookups,
  type ProductPickerParams,
  type UserPickerOption,
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

/** Colleagues for a form's dropdown. Keyed under the users root. */
export function useUserPicker(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<UserPickerOption[]>({
    queryKey: [QUERY_ROOTS.users, branchQueryKey, "picker"],
    queryFn: async () => getUserPicker(),
    enabled,
  });
}

/**
 * Branch options for filters and forms outside the Branches module. Shaped
 * like useBranches() so call sites swap in one line, but served by the
 * lookup tier: filtering a report by branch needs no branches.view.
 */
export function useBranchOptions(enabled = true) {
  const query = useLookups(["branches"], enabled);
  return { ...query, data: query.data?.branches };
}
