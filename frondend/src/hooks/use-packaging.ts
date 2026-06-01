"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  createPackaging,
  createPackagingUsage,
  deletePackaging,
  deletePackagingUsage,
  getPackaging,
  getPackagingById,
  getPackagingCategories,
  getPackagingUsage,
  getUnits,
  lookupPackaging,
  lookupSuppliers,
  updatePackaging,
  updatePackagingStatus,
} from "@/lib/api/packaging";
import type {
  CreatePackagingPayload,
  CreatePackagingUsagePayload,
  PackagingCategory,
  PackagingFilters,
  PackagingItem,
  PackagingSupplierOption,
  PackagingUnitOption,
  PackagingUsageRule,
  UpdatePackagingPayload,
  UpdatePackagingStatusPayload,
} from "@/types/packaging";

const packagingQueryKey = "packaging";

export function usePackaging(filters: PackagingFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PackagingItem[]>({
    queryKey: [packagingQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getPackaging(filters),
    enabled,
  });
}

export function usePackagingItem(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PackagingItem>({
    queryKey: [packagingQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Packaging ID is required.");
      }

      return getPackagingById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function usePackagingLookup(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<PackagingItem[]>({
    queryKey: [packagingQueryKey, branchQueryKey, "lookup", debouncedSearch],
    queryFn: async () => lookupPackaging({ search: debouncedSearch, limit: 10 }),
    enabled: enabled && debouncedSearch.length >= 2,
  });
}

export function usePackagingCategories(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PackagingCategory[]>({
    queryKey: [packagingQueryKey, branchQueryKey, "categories"],
    queryFn: async () => getPackagingCategories(),
    enabled,
  });
}

export function usePackagingSupplierLookup(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<PackagingSupplierOption[]>({
    queryKey: [packagingQueryKey, branchQueryKey, "supplier-lookup", debouncedSearch],
    queryFn: async () => lookupSuppliers(debouncedSearch),
    enabled,
  });
}

export function usePackagingUnits(enabled = true) {
  return useQuery<PackagingUnitOption[]>({
    queryKey: [packagingQueryKey, "units"],
    queryFn: async () => getUnits(),
    enabled,
  });
}

export function usePackagingUsage(productId: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<PackagingUsageRule[]>({
    queryKey: [packagingQueryKey, branchQueryKey, "usage", productId],
    queryFn: async () => getPackagingUsage(productId),
    enabled: enabled && productId.trim().length > 0,
  });
}

function invalidatePackaging(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [packagingQueryKey] })]);
}

export function useCreatePackaging() {
  const queryClient = useQueryClient();

  return useMutation<PackagingItem, Error, CreatePackagingPayload>({
    mutationFn: async (payload) => createPackaging(payload),
    onSuccess: async () => {
      await invalidatePackaging(queryClient);
    },
  });
}

export function useUpdatePackaging() {
  const queryClient = useQueryClient();

  return useMutation<PackagingItem, Error, { id: string; payload: UpdatePackagingPayload }>({
    mutationFn: async ({ id, payload }) => updatePackaging(id, payload),
    onSuccess: async () => {
      await invalidatePackaging(queryClient);
    },
  });
}

export function useUpdatePackagingStatus() {
  const queryClient = useQueryClient();

  return useMutation<PackagingItem, Error, { id: string; payload: UpdatePackagingStatusPayload }>({
    mutationFn: async ({ id, payload }) => updatePackagingStatus(id, payload),
    onSuccess: async () => {
      await invalidatePackaging(queryClient);
    },
  });
}

export function useDeletePackaging() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deletePackaging(id),
    onSuccess: async () => {
      await invalidatePackaging(queryClient);
    },
  });
}

export function useCreatePackagingUsage() {
  const queryClient = useQueryClient();

  return useMutation<
    PackagingUsageRule,
    Error,
    { productId: string; payload: CreatePackagingUsagePayload }
  >({
    mutationFn: async ({ productId, payload }) => createPackagingUsage(productId, payload),
    onSuccess: async () => {
      await invalidatePackaging(queryClient);
    },
  });
}

export function useDeletePackagingUsage() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { productId: string; ruleId: string }>({
    mutationFn: async ({ productId, ruleId }) => deletePackagingUsage(productId, ruleId),
    onSuccess: async () => {
      await invalidatePackaging(queryClient);
    },
  });
}
