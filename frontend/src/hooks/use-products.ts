"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { useBranchQueryKey } from "@/hooks/use-branch-scope";
import {
  applyProductPriceSuggestion,
  bulkApplyProductPriceSuggestions,
  createProduct,
  createProductVariant,
  deleteProduct,
  deleteProductVariant,
  dismissProductPriceSuggestion,
  getProductById,
  getProductPriceSuggestions,
  getProductReferenceData,
  getProducts,
  getProductVariants,
  updateProduct,
  updateProductStatus,
  updateProductVariant,
  updateProductVariantStatus,
} from "@/lib/api/products";
import type {
  CreateProductPayload,
  CreateProductVariantPayload,
  Product,
  ProductListFilters,
  ProductListResponse,
  ProductPriceSuggestion,
  ProductPriceSuggestionListFilters,
  ProductPriceSuggestionListResponse,
  ProductReferenceData,
  ProductVariant,
  UpdateProductPayload,
  UpdateProductStatusPayload,
  UpdateProductVariantPayload,
  UpdateProductVariantStatusPayload,
} from "@/types/product";

const productsQueryKey = "products";

export function useProducts(filters: ProductListFilters, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [productsQueryKey, branchQueryKey, "list", filters],
    queryFn: async () => getProducts(filters),
    enabled,
  });
}

export function useProduct(id: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery({
    queryKey: [productsQueryKey, branchQueryKey, "detail", id],
    queryFn: async () => {
      if (!id) {
        throw new Error("Product ID is required.");
      }

      return getProductById(id);
    },
    enabled: enabled && id !== null,
  });
}

export function useProductReferenceData(enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductReferenceData>({
    queryKey: [productsQueryKey, branchQueryKey, "reference-data"],
    queryFn: async () => getProductReferenceData(),
    enabled,
  });
}

export function useProductPriceSuggestions(
  filters: ProductPriceSuggestionListFilters = {},
  enabled = true,
) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductPriceSuggestionListResponse>({
    queryKey: [productsQueryKey, branchQueryKey, "price-suggestions", filters],
    queryFn: async () => getProductPriceSuggestions(filters),
    enabled,
  });
}

function invalidateProducts(queryClient: ReturnType<typeof useQueryClient>): Promise<unknown[]> {
  return Promise.all([queryClient.invalidateQueries({ queryKey: [productsQueryKey] })]);
}

function invalidateVariants(
  queryClient: ReturnType<typeof useQueryClient>,
  productId?: string,
): Promise<unknown[]> {
  void productId;
  return Promise.all([queryClient.invalidateQueries({ queryKey: [productsQueryKey] })]);
}

export function useCreateProduct() {
  const queryClient = useQueryClient();

  return useMutation<Product, Error, CreateProductPayload>({
    mutationFn: async (payload) => createProduct(payload),
    onSuccess: async () => {
      await invalidateProducts(queryClient);
    },
  });
}

export function useUpdateProduct() {
  const queryClient = useQueryClient();

  return useMutation<
    Product,
    Error,
    {
      id: string;
      payload: UpdateProductPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateProduct(id, payload),
    onSuccess: async () => {
      await invalidateProducts(queryClient);
    },
  });
}

export function useUpdateProductStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    Product,
    Error,
    {
      id: string;
      payload: UpdateProductStatusPayload;
    }
  >({
    mutationFn: async ({ id, payload }) => updateProductStatus(id, payload),
    onSuccess: async () => {
      await invalidateProducts(queryClient);
    },
  });
}

export function useDeleteProduct() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteProduct(id),
    onSuccess: async () => {
      await invalidateProducts(queryClient);
    },
  });
}

export function useApplyProductPriceSuggestion() {
  const queryClient = useQueryClient();

  return useMutation<
    ProductPriceSuggestion,
    Error,
    {
      id: string;
      salePrice?: number;
    }
  >({
    mutationFn: async ({ id, salePrice }) => applyProductPriceSuggestion(id, salePrice),
    onSuccess: async () => {
      await invalidateProducts(queryClient);
    },
  });
}

export function useDismissProductPriceSuggestion() {
  const queryClient = useQueryClient();

  return useMutation<ProductPriceSuggestion, Error, string>({
    mutationFn: async (id) => dismissProductPriceSuggestion(id),
    onSuccess: async () => {
      await invalidateProducts(queryClient);
    },
  });
}

export function useBulkApplyProductPriceSuggestions() {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string[]>({
    mutationFn: async (ids) => bulkApplyProductPriceSuggestions(ids),
    onSuccess: async () => {
      await invalidateProducts(queryClient);
    },
  });
}

export function useProductVariants(productId: string | null, enabled = true) {
  const branchQueryKey = useBranchQueryKey();

  return useQuery<ProductVariant[]>({
    queryKey: [productsQueryKey, branchQueryKey, "variants", productId],
    queryFn: async () => {
      if (!productId) {
        throw new Error("Product ID is required.");
      }

      return getProductVariants(productId);
    },
    enabled: enabled && productId !== null,
  });
}

export function useCreateProductVariant() {
  const queryClient = useQueryClient();

  return useMutation<
    ProductVariant,
    Error,
    {
      productId: string;
      payload: CreateProductVariantPayload;
    }
  >({
    mutationFn: async ({ productId, payload }) => createProductVariant(productId, payload),
    onSuccess: async (_, variables) => {
      await invalidateVariants(queryClient, variables.productId);
      await invalidateProducts(queryClient);
    },
  });
}

export function useUpdateProductVariant() {
  const queryClient = useQueryClient();

  return useMutation<
    ProductVariant,
    Error,
    {
      productId: string;
      variantId: string;
      payload: UpdateProductVariantPayload;
    }
  >({
    mutationFn: async ({ productId, variantId, payload }) =>
      updateProductVariant(productId, variantId, payload),
    onSuccess: async (_, variables) => {
      await invalidateVariants(queryClient, variables.productId);
      await invalidateProducts(queryClient);
    },
  });
}

export function useUpdateProductVariantStatus() {
  const queryClient = useQueryClient();

  return useMutation<
    ProductVariant,
    Error,
    {
      productId: string;
      variantId: string;
      payload: UpdateProductVariantStatusPayload;
    }
  >({
    mutationFn: async ({ productId, variantId, payload }) =>
      updateProductVariantStatus(productId, variantId, payload),
    onSuccess: async (_, variables) => {
      await invalidateVariants(queryClient, variables.productId);
      await invalidateProducts(queryClient);
    },
  });
}

export function useDeleteProductVariant() {
  const queryClient = useQueryClient();

  return useMutation<
    void,
    Error,
    {
      productId: string;
      variantId: string;
    }
  >({
    mutationFn: async ({ productId, variantId }) => deleteProductVariant(productId, variantId),
    onSuccess: async (_, variables) => {
      await invalidateVariants(queryClient, variables.productId);
      await invalidateProducts(queryClient);
    },
  });
}

export type ProductsQueryData = ProductListResponse;
