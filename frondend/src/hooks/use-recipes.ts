"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  addRecipeIngredient,
  addRecipePackaging,
  createRecipe,
  createRecipeVersion,
  deleteRecipe,
  deleteRecipeIngredient,
  deleteRecipePackaging,
  getRecipeById,
  getRecipeByProduct,
  getRecipeComponentProducts,
  getRecipeCost,
  getRecipeIngredients,
  getRecipePackaging,
  getRecipeProducts,
  getRecipes,
  getRecipeUnits,
  getRecipeVersions,
  lookupRecipes,
  recalculateRecipeCost,
  updateRecipe,
  updateRecipeIngredient,
  updateRecipePackaging,
  updateRecipeStatus,
} from "@/lib/api/recipes";
import type {
  CreateRecipePayload,
  CreateRecipeVersionPayload,
  Recipe,
  RecipeCost,
  RecipeFilters,
  RecipeIngredientLine,
  RecipeIngredientPayload,
  RecipePackagingLine,
  RecipePackagingPayload,
  RecipeProductOption,
  RecipeUnitOption,
  RecipeVersion,
  UpdateRecipePayload,
  UpdateRecipeStatusPayload,
} from "@/types/recipes";

const recipeQueryKey = "recipes";

export function useRecipes(filters: RecipeFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Recipe[]>({
    queryKey: [recipeQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getRecipes(filters),
    enabled,
  });
}

export function useRecipe(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Recipe>({
    queryKey: [recipeQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Recipe ID is required.");
      }

      return getRecipeById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useRecipeLookup(search: string, enabled = true) {
  const branchQueryKey = useBranchQueryKey();
  const [debouncedSearch, setDebouncedSearch] = useState(search.trim());

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => window.clearTimeout(timeoutId);
  }, [search]);

  return useQuery<Recipe[]>({
    queryKey: [recipeQueryKey, branchQueryKey, "lookup", debouncedSearch],
    queryFn: async () => lookupRecipes(debouncedSearch),
    enabled: enabled && debouncedSearch.length >= 2,
  });
}

export function useRecipeByProduct(productId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<Recipe>({
    queryKey: [recipeQueryKey, branchQueryKey, "product", productId],
    queryFn: async () => {
      if (!productId) {
        throw new Error("Product ID is required.");
      }

      return getRecipeByProduct(productId);
    },
    enabled: enabled && productId !== null,
  });
}

export function useRecipeIngredients(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<RecipeIngredientLine[]>({
    queryKey: [recipeQueryKey, branchQueryKey, "ingredients", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Recipe ID is required.");
      }

      return getRecipeIngredients(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useRecipePackaging(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<RecipePackagingLine[]>({
    queryKey: [recipeQueryKey, branchQueryKey, "packaging", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Recipe ID is required.");
      }

      return getRecipePackaging(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useRecipeCost(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<RecipeCost>({
    queryKey: [recipeQueryKey, branchQueryKey, "cost", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Recipe ID is required.");
      }

      return getRecipeCost(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useRecipeVersions(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<RecipeVersion[]>({
    queryKey: [recipeQueryKey, branchQueryKey, "versions", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Recipe ID is required.");
      }

      return getRecipeVersions(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useRecipeReferenceData(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<{
    componentProducts: RecipeProductOption[];
    products: RecipeProductOption[];
    units: RecipeUnitOption[];
  }>({
    queryKey: [recipeQueryKey, branchQueryKey, "reference-data"],
    queryFn: async () => {
      const [products, componentProducts, units] = await Promise.all([
        getRecipeProducts(),
        getRecipeComponentProducts(),
        getRecipeUnits(),
      ]);

      return { componentProducts, products, units };
    },
    enabled,
  });
}

function invalidateRecipeList(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [recipeQueryKey] })]);
}

function invalidateRecipeDetail(
  queryClient: ReturnType<typeof useQueryClient>,
  id: string,
): Promise<unknown[]> {
  void id;
  return Promise.all([queryClient.invalidateQueries({ queryKey: [recipeQueryKey] })]);
}

export function useCreateRecipe() {
  const queryClient = useQueryClient();

  return useMutation<Recipe, Error, CreateRecipePayload>({
    mutationFn: async (payload) => createRecipe(payload),
    onSuccess: async () => {
      await invalidateRecipeList(queryClient);
    },
  });
}

export function useUpdateRecipe() {
  const queryClient = useQueryClient();

  return useMutation<Recipe, Error, { id: string; payload: UpdateRecipePayload }>({
    mutationFn: async ({ id, payload }) => updateRecipe(id, payload),
    onSuccess: async (_recipe, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}

export function useUpdateRecipeStatus() {
  const queryClient = useQueryClient();

  return useMutation<Recipe, Error, { id: string; payload: UpdateRecipeStatusPayload }>({
    mutationFn: async ({ id, payload }) => updateRecipeStatus(id, payload),
    onSuccess: async (_recipe, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}

export function useDeleteRecipe() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteRecipe(id),
    onSuccess: async () => {
      await invalidateRecipeList(queryClient);
    },
  });
}

export function useAddRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation<RecipeIngredientLine, Error, { id: string; payload: RecipeIngredientPayload }>(
    {
      mutationFn: async ({ id, payload }) => addRecipeIngredient(id, payload),
      onSuccess: async (_line, variables) => {
        await invalidateRecipeDetail(queryClient, variables.id);
      },
    },
  );
}

export function useUpdateRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation<
    RecipeIngredientLine,
    Error,
    { id: string; lineId: string; payload: RecipeIngredientPayload }
  >({
    mutationFn: async ({ id, lineId, payload }) => updateRecipeIngredient(id, lineId, payload),
    onSuccess: async (_line, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}

export function useDeleteRecipeIngredient() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; lineId: string }>({
    mutationFn: async ({ id, lineId }) => deleteRecipeIngredient(id, lineId),
    onSuccess: async (_result, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}

export function useAddRecipePackaging() {
  const queryClient = useQueryClient();

  return useMutation<RecipePackagingLine, Error, { id: string; payload: RecipePackagingPayload }>({
    mutationFn: async ({ id, payload }) => addRecipePackaging(id, payload),
    onSuccess: async (_line, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}

export function useUpdateRecipePackaging() {
  const queryClient = useQueryClient();

  return useMutation<
    RecipePackagingLine,
    Error,
    { id: string; lineId: string; payload: RecipePackagingPayload }
  >({
    mutationFn: async ({ id, lineId, payload }) => updateRecipePackaging(id, lineId, payload),
    onSuccess: async (_line, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}

export function useDeleteRecipePackaging() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; lineId: string }>({
    mutationFn: async ({ id, lineId }) => deleteRecipePackaging(id, lineId),
    onSuccess: async (_result, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}

export function useRecalculateRecipeCost() {
  const queryClient = useQueryClient();

  return useMutation<RecipeCost, Error, string>({
    mutationFn: async (id) => recalculateRecipeCost(id),
    onSuccess: async (_cost, id) => {
      await invalidateRecipeDetail(queryClient, id);
    },
  });
}

export function useCreateRecipeVersion() {
  const queryClient = useQueryClient();

  return useMutation<RecipeVersion, Error, { id: string; payload: CreateRecipeVersionPayload }>({
    mutationFn: async ({ id, payload }) => createRecipeVersion(id, payload),
    onSuccess: async (_version, variables) => {
      await invalidateRecipeDetail(queryClient, variables.id);
    },
  });
}
