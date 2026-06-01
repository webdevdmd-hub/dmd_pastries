"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  createIngredient,
  deleteIngredient,
  getIngredientById,
  getIngredientCategories,
  getIngredients,
  getIngredientUnits,
  lookupIngredients,
  lookupIngredientSuppliers,
  updateIngredient,
  updateIngredientStatus,
} from "@/lib/api/ingredients";
import type {
  CreateIngredientPayload,
  Ingredient,
  IngredientCategory,
  IngredientFilters,
  IngredientSupplierOption,
  IngredientUnitOption,
  UpdateIngredientPayload,
  UpdateIngredientStatusPayload,
} from "@/types/ingredient";

const ingredientsQueryKey = "ingredients";

export function useIngredients(filters: IngredientFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Ingredient[]>({
    queryKey: [ingredientsQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getIngredients(filters),
    enabled,
  });
}

export function useIngredient(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Ingredient>({
    queryKey: [ingredientsQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) throw new Error("Ingredient ID is required.");
      return getIngredientById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useIngredientLookup(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<Ingredient[]>({
    queryKey: [ingredientsQueryKey, branchQueryKey, "lookup", debouncedSearch],
    queryFn: async () => lookupIngredients({ search: debouncedSearch, limit: 20 }),
    enabled,
  });
}

export function useIngredientCategories(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<IngredientCategory[]>({
    queryKey: [ingredientsQueryKey, branchQueryKey, "categories"],
    queryFn: async () => getIngredientCategories(),
    enabled,
  });
}

export function useIngredientSupplierLookup(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<IngredientSupplierOption[]>({
    queryKey: [ingredientsQueryKey, branchQueryKey, "supplier-lookup", debouncedSearch],
    queryFn: async () => lookupIngredientSuppliers(debouncedSearch),
    enabled,
  });
}

export function useIngredientUnits(enabled = true) {
  return useQuery<IngredientUnitOption[]>({
    queryKey: [ingredientsQueryKey, "units"],
    queryFn: async () => getIngredientUnits(),
    enabled,
  });
}

function invalidateIngredients(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: [ingredientsQueryKey] }),
    queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    queryClient.invalidateQueries({ queryKey: ["recipes"] }),
  ]);
}

export function useCreateIngredient() {
  const queryClient = useQueryClient();

  return useMutation<Ingredient, Error, CreateIngredientPayload>({
    mutationFn: async (payload) => createIngredient(payload),
    onSuccess: async () => {
      await invalidateIngredients(queryClient);
    },
  });
}

export function useUpdateIngredient() {
  const queryClient = useQueryClient();

  return useMutation<Ingredient, Error, { id: string; payload: UpdateIngredientPayload }>({
    mutationFn: async ({ id, payload }) => updateIngredient(id, payload),
    onSuccess: async () => {
      await invalidateIngredients(queryClient);
    },
  });
}

export function useUpdateIngredientStatus() {
  const queryClient = useQueryClient();

  return useMutation<Ingredient, Error, { id: string; payload: UpdateIngredientStatusPayload }>({
    mutationFn: async ({ id, payload }) => updateIngredientStatus(id, payload),
    onSuccess: async () => {
      await invalidateIngredients(queryClient);
    },
  });
}

export function useDeleteIngredient() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteIngredient(id),
    onSuccess: async () => {
      await invalidateIngredients(queryClient);
    },
  });
}
